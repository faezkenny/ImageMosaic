"""
FastAPI application — Photo Mosaic Generator backend.
"""
from __future__ import annotations

import io
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from mosaic import analyze_sources, generate_mosaic, generate_preview

app = FastAPI(title="Photo Mosaic API", version="1.0.0")

# Allow the Next.js dev server to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory session storage (suitable for a single-user local tool)
# ---------------------------------------------------------------------------
_SESSIONS: dict[str, dict] = {}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(
    session_id: str = Form(...),
    files: List[UploadFile] = File(...),
):
    """
    Upload source sub-images and compute their average colors.
    Supports chunked/batched uploads: subsequent calls for the same session_id
    append to the existing palette rather than replacing it.
    Returns a palette JSON for the frontend to cache.
    """
    raw_bytes: List[bytes] = []
    for f in files:
        data = await f.read()
        raw_bytes.append(data)

    palette = analyze_sources(raw_bytes)

    if session_id in _SESSIONS:
        # Append to existing session — chunked upload support
        existing = _SESSIONS[session_id]
        offset = len(existing["source_bytes"])
        # Re-index palette entries to continue from the existing offset
        for entry in palette:
            entry["index"] += offset
        existing["source_bytes"].extend(raw_bytes)
        existing["palette"].extend(palette)
        merged_palette = existing["palette"]
    else:
        # New session
        _SESSIONS[session_id] = {
            "source_bytes": raw_bytes,
            "palette": palette,
        }
        merged_palette = palette

    return JSONResponse({"palette": merged_palette, "count": len(merged_palette)})


@app.post("/api/preview")
async def preview(
    session_id: str = Form(...),
    main_image: UploadFile = File(...),
    tile_size: int = Form(40, ge=5, le=200),
):
    """
    Returns a low-res block grid for the canvas preview (no sub-images needed).
    """
    if session_id not in _SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found. Upload sources first.")

    palette = _SESSIONS[session_id]["palette"]
    if not palette:
        raise HTTPException(status_code=400, detail="No palette data.")

    main_bytes = await main_image.read()
    result = generate_preview(main_bytes, palette, tile_size=tile_size)
    return JSONResponse(result)


@app.post("/api/generate")
async def generate(
    session_id: str = Form(...),
    main_image: UploadFile = File(...),
    tile_size: int = Form(40, ge=5, le=200),
    style: str = Form("A"),
    allow_repeats: bool = Form(True),
    overlay_opacity: float = Form(0.25, ge=0.0, le=1.0),
    shuffle_sources: bool = Form(False),
    a4_output: bool = Form(False),
):
    """
    Generate the full-resolution mosaic PNG.
    Returns the image as a binary PNG response.
    """
    if session_id not in _SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found. Upload sources first.")

    session = _SESSIONS[session_id]
    palette = session["palette"]
    source_bytes = session["source_bytes"]

    if not palette:
        raise HTTPException(status_code=400, detail="No source images / palette. Upload sources first.")

    if style not in ("A", "B", "C"):
        raise HTTPException(status_code=422, detail="style must be A, B, or C")

    main_bytes = await main_image.read()

    try:
        mosaic_png = generate_mosaic(
            main_image_bytes=main_bytes,
            source_images_bytes=source_bytes,
            palette=palette,
            tile_size=tile_size,
            style=style,
            allow_repeats=allow_repeats,
            overlay_opacity=overlay_opacity,
            shuffle_sources=shuffle_sources,
            a4_output=a4_output,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return Response(
        content=mosaic_png,
        media_type="image/png",
        headers={"Content-Disposition": 'attachment; filename="mosaic.png"'},
    )
