#!/usr/bin/env python3
"""Shared matting + 760 dress alignment for 雯宝 / 林小燕 assets.

Why flood-fill (not ImageColorToMask):
  ComfyUI has no local RMBG / BiRefNet / rembg / LayerDiffuse node installed.
  BriaRemoveImageBackground is cloud-only (needs Comfy Org auth).
  Pure white color-key eats white dresses / socks / lace.
  Border-connected flood-fill only removes background that touches the canvas
  edge, so enclosed white clothing is preserved.

Official dress delivery = this module (or deliver-dress-frame.py).
The Comfy cutout workflow still exports a draft RGBA via color-key + feather
for quick preview; do not treat that draft as the wardrobe source of truth.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from collections import deque
from pathlib import Path
from typing import Literal

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SPEC_PATH = ROOT / "tools" / "character" / "spec.json"
STAGE_ROOT = ROOT / "tools" / "out" / "wenbao-assets"
CATEGORIES = ("dress", "part", "card", "icon", "raw", "base", "ui")

MARKER = (255, 0, 255)


def load_spec() -> dict:
    with SPEC_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def stage_dir(category: str) -> Path:
    if category not in CATEGORIES:
        raise ValueError(f"unknown category {category!r}; expected one of {CATEGORIES}")
    path = STAGE_ROOT / category
    path.mkdir(parents=True, exist_ok=True)
    return path


def flood_background(
    img: Image.Image,
    tolerance: int = 22,
    near_white: int = 245,
) -> Image.Image:
    """Remove border-connected near-white / near-bg pixels; keep enclosed whites."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    work = rgb.copy()
    seeds: list[tuple[int, int]] = []
    step = max(1, min(w, h) // 40)
    for x in range(0, w, step):
        seeds.append((x, 0))
        seeds.append((x, h - 1))
    for y in range(0, h, step):
        seeds.append((0, y))
        seeds.append((w - 1, y))
    for seed in seeds:
        try:
            ImageDraw.floodfill(work, seed, MARKER, thresh=tolerance)
        except Exception:
            pass

    arr = np.asarray(work)
    marked = (arr[..., 0] == 255) & (arr[..., 1] == 0) & (arr[..., 2] == 255)

    # Also drop near-white pixels that are 4-connected to the border flood result.
    # This cleans soft anti-aliased fringes without punching holes in enclosed whites.
    src = np.asarray(rgb, dtype=np.int16)
    is_near = (src[..., 0] >= near_white) & (src[..., 1] >= near_white) & (src[..., 2] >= near_white)
    visited = marked.copy()
    q: deque[tuple[int, int]] = deque()
    ys, xs = np.where(marked)
    for y, x in zip(ys.tolist(), xs.tolist()):
        q.append((y, x))
    while q:
        cy, cx = q.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_near[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    alpha = np.where(visited, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha, "L")
    alpha_img = alpha_img.filter(ImageFilter.MinFilter(3))
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(0.6))
    out = img.convert("RGBA")
    out.putalpha(alpha_img)
    return out


def color_key_cutout(img: Image.Image, threshold: int = 245) -> Image.Image:
    """Draft-only: hard-ish white key. Prefer flood_background for dresses."""
    rgba = img.convert("RGBA")
    arr = np.asarray(rgba)
    rgb = arr[..., :3].astype(np.int16)
    white = (rgb[..., 0] >= threshold) & (rgb[..., 1] >= threshold) & (rgb[..., 2] >= threshold)
    alpha = np.where(white, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha, "L")
    alpha_img = alpha_img.filter(ImageFilter.MinFilter(3))
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(0.75))
    out = rgba.copy()
    out.putalpha(alpha_img)
    return out


def trim(img: Image.Image, padding: int = 6, alpha_threshold: int = 8) -> Image.Image:
    alpha = img.getchannel("A").point(lambda v: 255 if v > alpha_threshold else 0)
    bbox = alpha.getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(img.width, x1 + padding)
    y1 = min(img.height, y1 + padding)
    return img.crop((x0, y0, x1, y1))


def align_dress_frame(
    img: Image.Image,
    *,
    target_visible_height: int | None = None,
    spec: dict | None = None,
) -> Image.Image:
    """Place cutout on 760x760: feet on baselineY, center on centerX (spec.json)."""
    spec = spec or load_spec()
    canvas = int(spec["frame"]["canvas"])
    baseline = int(spec["frame"]["baselineY"])
    center = int(spec["frame"]["centerX"])
    alpha_thr = int(spec["measure"]["alphaThreshold"])
    if target_visible_height is None:
        target_visible_height = int(spec["skins"].get("maid", {}).get("visibleHeight") or 714)

    rgba = img.convert("RGBA")
    # If still fully opaque, flood first.
    a = np.asarray(rgba.getchannel("A"))
    if int(a.min()) > 250:
        rgba = flood_background(rgba)

    trimmed = trim(rgba, alpha_threshold=alpha_thr)
    alpha = trimmed.getchannel("A").point(lambda v: 255 if v > alpha_thr else 0)
    bbox = alpha.getbbox()
    if not bbox:
        return Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    body = trimmed.crop(bbox)
    factor = target_visible_height / max(1, body.height)
    new_w = max(1, round(body.width * factor))
    new_h = max(1, round(body.height * factor))
    scaled = body.resize((new_w, new_h), Image.LANCZOS)

    frame = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    dx = center - new_w // 2
    dy = baseline - (new_h - 1)
    frame.alpha_composite(scaled, (dx, dy))
    return frame


def measure_frame(img: Image.Image, alpha_threshold: int = 8) -> dict | None:
    alpha = img.getchannel("A")
    bbox = alpha.point(lambda v: 255 if v > alpha_threshold else 0).getbbox()
    if not bbox:
        return None
    x0, y0, x1, y1 = bbox
    return {
        "w": x1 - x0,
        "h": y1 - y0,
        "cx": (x0 + x1 - 1) // 2,
        "feet": y1 - 1,
        "canvas": img.width,
        "transparent_pct": float((np.asarray(alpha) < alpha_threshold).mean() * 100),
    }


def deliver_dress(
    src: str | Path,
    *,
    out_name: str | None = None,
    method: Literal["flood", "colorkey"] = "flood",
    fmt: Literal["png", "webp"] = "png",
    upload: bool = False,
    upload_base: str | None = None,
) -> Path:
    """Cutout + align one dress PNG into tools/out/wenbao-assets/dress/."""
    src_path = Path(src)
    img = Image.open(src_path)
    if method == "colorkey":
        cut = color_key_cutout(img)
    else:
        cut = flood_background(img)
    aligned = align_dress_frame(cut)
    name = out_name or (src_path.stem + f".{fmt}")
    if not name.lower().endswith((".png", ".webp")):
        name = f"{name}.{fmt}"
    out_path = stage_dir("dress") / name
    if name.lower().endswith(".webp"):
        aligned.save(out_path, "WEBP", quality=92, method=6)
    else:
        aligned.save(out_path, "PNG")
    metrics = measure_frame(aligned)
    print(f"OK dress -> {out_path}")
    if metrics:
        print(
            f"   {metrics['canvas']}x{metrics['canvas']} visible={metrics['w']}x{metrics['h']} "
            f"cx={metrics['cx']} feet={metrics['feet']} transparent={metrics['transparent_pct']:.1f}%"
        )
    if upload:
        upload_asset(out_path, "dress", upload_base=upload_base)
    return out_path


def deliver_part(
    src: str | Path,
    *,
    out_name: str | None = None,
    canvas: int = 360,
    method: Literal["flood", "colorkey"] = "flood",
) -> Path:
    src_path = Path(src)
    img = Image.open(src_path)
    cut = color_key_cutout(img) if method == "colorkey" else flood_background(img, tolerance=28)
    trimmed = trim(cut)
    max_dim = max(trimmed.width, trimmed.height, 1)
    target = int(canvas * 0.84)
    factor = target / max_dim
    new_w = max(1, round(trimmed.width * factor))
    new_h = max(1, round(trimmed.height * factor))
    scaled = trimmed.resize((new_w, new_h), Image.LANCZOS)
    frame = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    frame.alpha_composite(scaled, ((canvas - new_w) // 2, (canvas - new_h) // 2))
    name = out_name or (src_path.stem + ".png")
    if not name.lower().endswith((".png", ".webp")):
        name = f"{name}.png"
    out_path = stage_dir("part") / name
    frame.save(out_path, "PNG" if name.lower().endswith(".png") else "WEBP")
    print(f"OK part  -> {out_path}")
    return out_path


def upload_asset(
    local_path: Path,
    category: str,
    *,
    upload_base: str | None = None,
) -> bool:
    """Optional PUT/POST to mini-host. Soft-fail if unreachable."""
    base = (upload_base or os.environ.get("WENBAO_ASSETS_URL") or "http://192.168.124.77:8788").rstrip("/")
    # Try common patterns without assuming a specific API.
    candidates = [
        f"{base}/upload/{category}/{local_path.name}",
        f"{base}/api/upload/{category}/{local_path.name}",
        f"{base}/files/{category}/{local_path.name}",
    ]
    data = local_path.read_bytes()
    for url in candidates:
        try:
            req = urllib.request.Request(
                url,
                data=data,
                method="PUT",
                headers={"Content-Type": "application/octet-stream"},
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                if 200 <= getattr(resp, "status", 200) < 300:
                    print(f"UPLOADED {url}")
                    return True
        except Exception as exc:  # noqa: BLE001
            last = exc
            continue
    print(f"UPLOAD skipped ({base} unreachable or no write API): {last!r}")
    return False
