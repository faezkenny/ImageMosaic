"""
Core mosaic generation algorithm.
Uses pure numpy for all color matching — no scipy dependency.

Performance improvements over v1:
- Vectorized cell-average computation via reshape (no per-cell crop loop)
- Vectorized nearest-neighbor matching over all cells in one broadcast
- CIE LAB color space for perceptually uniform distance matching
- Session-level tile resize cache keyed by (idx, tile_size)
- Compressed PNG output (optimize=True, compress_level=6)
"""
from __future__ import annotations

import io
import math
import random
from typing import List, Tuple

import numpy as np
from PIL import Image


# ---------------------------------------------------------------------------
# CIE LAB color conversion (pure numpy, no scipy)
# ---------------------------------------------------------------------------

def _srgb_to_linear(c: np.ndarray) -> np.ndarray:
    """sRGB [0,255] → linear [0,1]."""
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _linear_to_xyz(rgb_linear: np.ndarray) -> np.ndarray:
    """Linear RGB → CIE XYZ (D65 illuminant). Input shape (..., 3)."""
    M = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ], dtype=np.float32)
    return rgb_linear @ M.T


def _xyz_to_lab(xyz: np.ndarray) -> np.ndarray:
    """CIE XYZ → CIE LAB. Input shape (..., 3)."""
    # D65 reference white
    ref = np.array([0.95047, 1.00000, 1.08883], dtype=np.float32)
    xyz_n = xyz / ref
    eps = 0.008856
    kappa = 903.3

    def f(t: np.ndarray) -> np.ndarray:
        return np.where(t > eps, t ** (1.0 / 3.0), (kappa * t + 16.0) / 116.0)

    fx = f(xyz_n[..., 0])
    fy = f(xyz_n[..., 1])
    fz = f(xyz_n[..., 2])

    L = 116.0 * fy - 16.0
    a = 500.0 * (fx - fy)
    b = 200.0 * (fy - fz)
    return np.stack([L, a, b], axis=-1)


def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """
    Convert RGB array (shape (..., 3), dtype float32, values 0-255) to CIE LAB.
    Returns LAB array of same shape.
    """
    linear = _srgb_to_linear(rgb.astype(np.float32))
    xyz = _linear_to_xyz(linear)
    return _xyz_to_lab(xyz).astype(np.float32)


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _avg_color_arr(arr: np.ndarray) -> Tuple[float, float, float]:
    """Return mean (R, G, B) of a (H, W, 3) float32 array."""
    return float(arr[:, :, 0].mean()), float(arr[:, :, 1].mean()), float(arr[:, :, 2].mean())


def _avg_color(img: Image.Image) -> Tuple[float, float, float]:
    """Return the mean (R, G, B) of an image as floats 0-255."""
    arr = np.array(img.convert("RGB"), dtype=np.float32)
    return _avg_color_arr(arr)


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
# Vectorized nearest-neighbor matching (LAB space)
# ---------------------------------------------------------------------------

def _match_all_cells(
    cell_colors_rgb: np.ndarray,   # (N, 3) float32, values 0-255
    palette_colors_rgb: np.ndarray, # (P, 3) float32, values 0-255
) -> np.ndarray:
    """
    For each of N cells, find the index of the nearest palette entry in LAB space.
    Returns int array of shape (N,).
    """
    cell_lab = rgb_to_lab(cell_colors_rgb)       # (N, 3)
    palette_lab = rgb_to_lab(palette_colors_rgb)  # (P, 3)

    # Broadcast: (P, 1, 3) - (1, N, 3) → (P, N, 3) → sum sq → (P, N)
    diff = palette_lab[:, None, :] - cell_lab[None, :, :]  # (P, N, 3)
    dists = (diff ** 2).sum(axis=2)                         # (P, N)
    return np.argmin(dists, axis=0).astype(np.int32)        # (N,)


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
    tile_cache: dict | None = None,  # session-level cache: {(idx, tile_size): Image}
) -> bytes:
    """
    Generate a mosaic PNG and return raw bytes.

    Parameters
    ----------
    main_image_bytes   : JPEG/PNG bytes of the main target image
    source_images_bytes: raw bytes for each sub-image in palette order
    palette            : output of analyze_sources()
    tile_size          : size of each mosaic cell in pixels (5-200)
    style              : blending style A/B/C
    allow_repeats      : whether the same sub-image may be reused
    overlay_opacity    : opacity of the main image ghost (Style C only)
    shuffle_sources    : randomly shuffle the palette before matching (for variety)
    a4_output          : resize main image to A4 @ 300 DPI before tiling
    tile_cache         : optional dict for caching resized tiles across calls
    """
    if not palette or not source_images_bytes:
        raise ValueError("No source images / palette provided")

    if tile_cache is None:
        tile_cache = {}

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

    # ---- Build palette arrays -------------------------------------------
    palette_colors = np.array([[p["r"], p["g"], p["b"]] for p in palette], dtype=np.float32)
    palette_indices = [p["index"] for p in palette]

    if shuffle_sources:
        combined = list(zip(palette_colors.tolist(), palette_indices))
        random.shuffle(combined)
        palette_colors = np.array([c[0] for c in combined], dtype=np.float32)
        palette_indices = [c[1] for c in combined]

    # ---- Vectorized cell average computation ----------------------------
    # Convert entire scaled image to array once, then reshape to extract tile means
    main_arr = np.array(main_scaled, dtype=np.float32)  # (canvas_h, canvas_w, 3)
    # Reshape to (rows, tile_size, cols, tile_size, 3) then mean over tile dims
    cell_colors = (
        main_arr
        .reshape(rows, tile_size, cols, tile_size, 3)
        .mean(axis=(1, 3))
    )  # (rows, cols, 3)
    cell_colors_flat = cell_colors.reshape(rows * cols, 3)  # (N, 3)

    # ---- Vectorized nearest-neighbor matching ---------------------------
    if allow_repeats:
        best_positions = _match_all_cells(cell_colors_flat, palette_colors)  # (N,)
    else:
        # For unique mode we still need per-cell logic, but vectorize the distance matrix
        cell_lab = rgb_to_lab(cell_colors_flat)       # (N, 3)
        palette_lab = rgb_to_lab(palette_colors)       # (P, 3)
        diff = palette_lab[:, None, :] - cell_lab[None, :, :]
        dists = (diff ** 2).sum(axis=2)  # (P, N)
        # For each cell, get sorted palette positions by distance
        sorted_positions = np.argsort(dists, axis=0)  # (P, N) — sorted by dist per cell

        available = set(range(len(palette_indices)))
        best_positions = np.zeros(rows * cols, dtype=np.int32)
        for cell_idx in range(rows * cols):
            chosen = None
            for pos in sorted_positions[:, cell_idx]:
                p = int(pos)
                if p in available:
                    chosen = p
                    available.discard(p)
                    break
            if chosen is None:
                chosen = int(sorted_positions[0, cell_idx])  # fallback
            best_positions[cell_idx] = chosen

    # ---- Cached source tile loader --------------------------------------
    def get_source(idx: int) -> Image.Image:
        key = (idx, tile_size)
        if key not in tile_cache:
            try:
                img = Image.open(io.BytesIO(source_images_bytes[idx])).convert("RGB")
                tile_cache[key] = img.resize((tile_size, tile_size), Image.LANCZOS)
            except Exception:
                tile_cache[key] = Image.new("RGB", (tile_size, tile_size), (128, 128, 128))
        return tile_cache[key]

    # ---- Create output canvas -------------------------------------------
    mosaic = Image.new("RGB", (canvas_w, canvas_h))

    for row in range(rows):
        for col in range(cols):
            cell_idx = row * cols + col
            best_pos = int(best_positions[cell_idx])
            src_idx = palette_indices[best_pos]
            tile = get_source(src_idx).copy()

            if style == "B":
                cell_r, cell_g, cell_b = (
                    float(cell_colors[row, col, 0]),
                    float(cell_colors[row, col, 1]),
                    float(cell_colors[row, col, 2]),
                )
                tile = _tint(tile, (cell_r, cell_g, cell_b))

            mosaic.paste(tile, (col * tile_size, row * tile_size))

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
    mosaic.save(buf, format="PNG", optimize=True, compress_level=6)
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
    Uses vectorized cell averaging and LAB-space matching.
    """
    main = Image.open(io.BytesIO(main_image_bytes)).convert("RGB")
    main_w, main_h = main.size

    cols = math.ceil(main_w / tile_size)
    rows = math.ceil(main_h / tile_size)
    canvas_w = cols * tile_size
    canvas_h = rows * tile_size
    main_scaled = main.resize((canvas_w, canvas_h), Image.LANCZOS)

    palette_colors = np.array([[p["r"], p["g"], p["b"]] for p in palette], dtype=np.float32)

    # Vectorized cell averages
    main_arr = np.array(main_scaled, dtype=np.float32)
    cell_colors = (
        main_arr
        .reshape(rows, tile_size, cols, tile_size, 3)
        .mean(axis=(1, 3))
    )  # (rows, cols, 3)
    cell_colors_flat = cell_colors.reshape(rows * cols, 3)

    # Vectorized LAB matching
    best_positions = _match_all_cells(cell_colors_flat, palette_colors)  # (N,)

    blocks = []
    for row in range(rows):
        for col in range(cols):
            cell_idx = row * cols + col
            best = palette[int(best_positions[cell_idx])]
            cr, cg, cb = cell_colors[row, col]
            blocks.append({
                "x": col, "y": row,
                "cellR": int(cr), "cellG": int(cg), "cellB": int(cb),
                "srcR": int(best["r"]), "srcG": int(best["g"]), "srcB": int(best["b"]),
            })
    return {"cols": cols, "rows": rows, "blocks": blocks}
