"""
Core mosaic generation algorithm.
Uses pure numpy for all color matching — no scipy dependency.
"""
from __future__ import annotations

import io
import math
import random
from typing import List, Tuple

import numpy as np
from PIL import Image


# ---------------------------------------------------------------------------
# Nearest-neighbor helper (pure numpy, no scipy)
# ---------------------------------------------------------------------------

class _NNIndex:
    """Brute-force nearest neighbor in RGB space using numpy broadcasting."""

    def __init__(self, colors: np.ndarray):
        # colors: (N, 3) float32
        self._colors = colors.astype(np.float32)

    def query(self, q: np.ndarray, k: int = 1) -> Tuple[np.ndarray, np.ndarray]:
        """
        q: array-like of shape (1, 3) or (3,).
        Returns (distances, indices) each of length k.
        """
        q = np.array(q, dtype=np.float32).reshape(1, 3)
        diff = self._colors - q  # (N, 3)
        dists = (diff ** 2).sum(axis=1)  # (N,)
        if k == 1:
            idx = int(np.argmin(dists))
            return np.array([dists[idx]]), np.array([idx])
        idxs = np.argsort(dists)[:k]
        return dists[idxs], idxs


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _avg_color(img: Image.Image) -> Tuple[float, float, float]:
    """Return the mean (R, G, B) of an image as floats 0-255."""
    arr = np.array(img.convert("RGB"), dtype=np.float32)
    return float(arr[:, :, 0].mean()), float(arr[:, :, 1].mean()), float(arr[:, :, 2].mean())


def _tint(tile: Image.Image, target_rgb: Tuple[float, float, float], strength: float = 0.55) -> Image.Image:
    """
    Color-correct a tile toward target_rgb using a weighted average blend.
    strength=1.0 → solid color; strength=0.0 → original tile.
    """
    arr = np.array(tile.convert("RGB"), dtype=np.float32)
    target = np.array(target_rgb, dtype=np.float32)
    blended = arr * (1 - strength) + target * strength
    return Image.fromarray(np.clip(blended, 0, 255).astype(np.uint8), "RGB")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_sources(raw_images: List[bytes]) -> List[dict]:
    """
    Given a list of raw image bytes, return a palette list:
    [{"index": i, "r": float, "g": float, "b": float}, ...]
    """
    palette = []
    for i, data in enumerate(raw_images):
        try:
            img = Image.open(io.BytesIO(data))
            r, g, b = _avg_color(img)
            palette.append({"index": i, "r": r, "g": g, "b": b})
        except Exception:
            continue
    return palette


def generate_mosaic(
    main_image_bytes: bytes,
    source_images_bytes: List[bytes],
    palette: List[dict],
    tile_size: int = 40,
    style: str = "A",           # "A" | "B" | "C"
    allow_repeats: bool = True,
    overlay_opacity: float = 0.25,
    shuffle_sources: bool = False,
    a4_output: bool = False,
) -> bytes:
    """
    Generate a mosaic PNG and return raw bytes.

    Parameters
    ----------
    main_image_bytes   : JPEG/PNG bytes of the main target image
    source_images_bytes: raw bytes for each sub-image in palette order
    palette            : output of analyze_sources()
    tile_size          : size of each mosaic cell in pixels
    style              : blending style A/B/C
    allow_repeats      : whether the same sub-image may be reused
    overlay_opacity    : opacity of the main image ghost (Style C only)
    shuffle_sources    : randomly shuffle the palette before matching (for variety)
    a4_output          : resize main image to A4 @ 300 DPI before tiling
    """
    if not palette or not source_images_bytes:
        raise ValueError("No source images / palette provided")

    # ---- A4 @ 300 DPI constants -----------------------------------------
    A4_W, A4_H = 2480, 3508  # portrait

    # ---- Load main image ------------------------------------------------
    main = Image.open(io.BytesIO(main_image_bytes)).convert("RGB")
    main_w, main_h = main.size

    if a4_output:
        # Determine orientation and scale to fill A4 with letterboxing
        if main_w >= main_h:  # landscape
            target_w, target_h = A4_H, A4_W
        else:                  # portrait
            target_w, target_h = A4_W, A4_H
        # Scale to cover target, then center-crop
        scale = max(target_w / main_w, target_h / main_h)
        new_w = int(main_w * scale)
        new_h = int(main_h * scale)
        main = main.resize((new_w, new_h), Image.LANCZOS)
        left = (new_w - target_w) // 2
        top  = (new_h - target_h) // 2
        main = main.crop((left, top, left + target_w, top + target_h))
        main_w, main_h = main.size

    cols = math.ceil(main_w / tile_size)
    rows = math.ceil(main_h / tile_size)
    canvas_w = cols * tile_size
    canvas_h = rows * tile_size
    main_scaled = main.resize((canvas_w, canvas_h), Image.LANCZOS)

    # ---- Build nearest-neighbor index from palette ----------------------
    palette_colors = np.array([[p["r"], p["g"], p["b"]] for p in palette], dtype=np.float32)
    palette_indices = [p["index"] for p in palette]

    if shuffle_sources:
        # Zip colors+indices together, shuffle, unzip
        combined = list(zip(palette_colors.tolist(), palette_indices))
        random.shuffle(combined)
        palette_colors = np.array([c[0] for c in combined], dtype=np.float32)
        palette_indices = [c[1] for c in combined]

    nn = _NNIndex(palette_colors)

    # ---- Cache resized source tiles in memory ---------------------------
    loaded_sources: dict[int, Image.Image] = {}

    def get_source(idx: int) -> Image.Image:
        if idx not in loaded_sources:
            try:
                img = Image.open(io.BytesIO(source_images_bytes[idx])).convert("RGB")
                loaded_sources[idx] = img.resize((tile_size, tile_size), Image.LANCZOS)
            except Exception:
                loaded_sources[idx] = Image.new("RGB", (tile_size, tile_size), (128, 128, 128))
        return loaded_sources[idx]

    # ---- Create output canvas -------------------------------------------
    mosaic = Image.new("RGB", (canvas_w, canvas_h))
    available: list[int] = list(range(len(palette_indices)))  # for unique mode

    for row in range(rows):
        for col in range(cols):
            x0, y0 = col * tile_size, row * tile_size
            x1, y1 = x0 + tile_size, y0 + tile_size

            cell = main_scaled.crop((x0, y0, x1, y1))
            cell_r, cell_g, cell_b = _avg_color(cell)
            query = np.array([cell_r, cell_g, cell_b], dtype=np.float32)

            if allow_repeats:
                _, pos = nn.query(query)
                best_pos = int(pos[0])
            else:
                k = min(max(len(available), 1), len(palette_indices))
                _, positions = nn.query(query, k=k)
                positions = positions.flatten()
                best_pos = None
                for p in positions:
                    p = int(p)
                    if p in available:
                        best_pos = p
                        available.remove(p)
                        break
                if best_pos is None:
                    best_pos = int(positions[0])  # fallback to repeats when exhausted

            src_idx = palette_indices[best_pos]
            tile = get_source(src_idx).copy()

            if style == "B":
                tile = _tint(tile, (cell_r, cell_g, cell_b))
            # Style A: raw tile as-is

            mosaic.paste(tile, (x0, y0))

    # Style C: ghost overlay of original image
    if style == "C":
        ghost = main_scaled.convert("RGBA")
        alpha = int(overlay_opacity * 255)
        r_ch, g_ch, b_ch, _ = ghost.split()
        a_ch = Image.new("L", ghost.size, alpha)
        ghost = Image.merge("RGBA", (r_ch, g_ch, b_ch, a_ch))
        mosaic = mosaic.convert("RGBA")
        mosaic.paste(ghost, (0, 0), ghost)
        mosaic = mosaic.convert("RGB")

    buf = io.BytesIO()
    mosaic.save(buf, format="PNG", optimize=False)
    buf.seek(0)
    return buf.read()


def generate_preview(
    main_image_bytes: bytes,
    palette: List[dict],
    tile_size: int = 40,
) -> dict:
    """
    Generate a low-res preview as a list of colored blocks.
    Returns: {"cols": N, "rows": M, "blocks": [{x, y, cellR, cellG, cellB, srcR, srcG, srcB}]}
    """
    main = Image.open(io.BytesIO(main_image_bytes)).convert("RGB")
    main_w, main_h = main.size

    cols = math.ceil(main_w / tile_size)
    rows = math.ceil(main_h / tile_size)
    canvas_w = cols * tile_size
    canvas_h = rows * tile_size
    main_scaled = main.resize((canvas_w, canvas_h), Image.LANCZOS)

    palette_colors = np.array([[p["r"], p["g"], p["b"]] for p in palette], dtype=np.float32)
    nn = _NNIndex(palette_colors)

    blocks = []
    for row in range(rows):
        for col in range(cols):
            x0, y0 = col * tile_size, row * tile_size
            x1, y1 = x0 + tile_size, y0 + tile_size
            cell = main_scaled.crop((x0, y0, x1, y1))
            cell_r, cell_g, cell_b = _avg_color(cell)
            _, pos = nn.query(np.array([cell_r, cell_g, cell_b]))
            best = palette[int(pos[0])]
            blocks.append({
                "x": col, "y": row,
                "cellR": int(cell_r), "cellG": int(cell_g), "cellB": int(cell_b),
                "srcR": int(best["r"]), "srcG": int(best["g"]), "srcB": int(best["b"]),
            })
    return {"cols": cols, "rows": rows, "blocks": blocks}
