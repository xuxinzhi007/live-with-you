#!/usr/bin/env python3
"""Build transparent character sprites for every V2 character skin.

Skins
-----
original (default)  the white-dress 雯宝 that predates the V2 rewrite:
                    public/assets/idle.webp (idle) + jump.webp (react)
maid                the blue-white maid ("小鲸鱼"):
                    spark-output/wenbao-maid-wave.png + wenbao-maid-curtsy.png

Both skins are written with the same frame convention so the renderer can swap
them at runtime without changing scale or foot line:

  <out>/idle.webp
  <out>/react.webp        short interaction pose (used for tap / arrive)
  <out>/walk-1..4.webp    four-frame walk cycle
  <out>/avatar.webp       160x160 HUD portrait

  canvas 760x760, visible height 714, feet on y=748, centered on x=380.

Opaque sources (the maid PNGs) get a border flood-fill to remove the flat white
background. Sources that already carry alpha (the original webp frames) are used
as-is. A one-pixel erosion kills the white fringe left by the flood fill.

Run:
  python3 tools/build-character-assets.py
"""

from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_ROOT = os.path.join(ROOT, "public", "assets", "characters")

SKINS = {
    "original": {
        "idle": os.path.join(ROOT, "public", "assets", "idle.webp"),
        "react": os.path.join(ROOT, "public", "assets", "jump.webp"),
        "cutout": False,
    },
    "maid": {
        "idle": os.path.join(ROOT, "spark-output", "wenbao-maid-wave.png"),
        "react": os.path.join(ROOT, "spark-output", "wenbao-maid-curtsy.png"),
        "cutout": True,
    },
}

FRAME = 760          # square canvas for every animation frame
FRAME_HEIGHT = 720   # character height inside the square
BASELINE_Y = 748     # every frame puts the feet on the same line
CENTER_X = 380       # every frame is horizontally centered on this line
MARKER = (255, 0, 255)


def flood_background(img: Image.Image, tolerance: int = 22) -> Image.Image:
    """Return RGBA image with the border-connected near-white background removed."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    work = rgb.copy()
    seeds = []
    for x in range(0, w, 20):
        seeds.append((x, 0))
        seeds.append((x, h - 1))
    for y in range(0, h, 20):
        seeds.append((0, y))
        seeds.append((w - 1, y))
    for seed in seeds:
        try:
            ImageDraw.floodfill(work, seed, MARKER, thresh=tolerance)
        except Exception:
            pass
    arr = np.asarray(work)
    removed = (arr[..., 0] == 255) & (arr[..., 1] == 0) & (arr[..., 2] == 255)
    alpha = np.where(removed, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha, "L")
    # Kill the one-pixel white fringe left by the flood fill.
    alpha_img = alpha_img.filter(ImageFilter.MinFilter(3))
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(0.6))
    out = img.convert("RGBA")
    out.putalpha(alpha_img)
    return out


def prepare_source(path: str, cutout: bool) -> Image.Image:
    img = Image.open(path)
    if cutout:
        return flood_background(img)

    rgba = img.convert("RGBA")
    alpha = np.asarray(rgba.getchannel("A"))
    if alpha.min() > 250:
        # Source claims alpha but is actually opaque; fall back to flood fill.
        return flood_background(rgba)
    return rgba


def trim(img: Image.Image, padding: int = 6) -> Image.Image:
    alpha = img.getchannel("A").point(lambda v: 255 if v > 8 else 0)
    bbox = alpha.getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(img.width, x1 + padding)
    y1 = min(img.height, y1 + padding)
    return img.crop((x0, y0, x1, y1))


def scale_to_height(img: Image.Image, height: int) -> Image.Image:
    ratio = height / img.height
    return img.resize((max(1, round(img.width * ratio)), height), Image.LANCZOS)


def align_frame(img: Image.Image, canvas: int = FRAME) -> Image.Image:
    """Place on a square canvas: feet on BASELINE_Y, visual center on CENTER_X."""
    alpha = img.getchannel("A").point(lambda v: 255 if v > 8 else 0)
    bbox = alpha.getbbox()
    if not bbox:
        return Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    x0, y0, x1, y1 = bbox
    frame = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    dx = CENTER_X - (x0 + x1) // 2
    dy = BASELINE_Y - (y1 - 1)
    frame.alpha_composite(img, (dx, dy))
    return frame


def walk_frame(base: Image.Image, angle: float, bob: int, squeeze: float) -> Image.Image:
    """Cheap but readable walk cycle: sway + bob, pivoting near the feet."""
    w = max(1, round(base.width * squeeze))
    scaled = base.resize((w, base.height), Image.LANCZOS)
    pivot = (scaled.width // 2, scaled.height - 2)
    rotated = scaled.rotate(
        angle,
        resample=Image.BICUBIC,
        center=pivot,
        expand=True,
        fillcolor=(0, 0, 0, 0),
    )
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    x = (FRAME - rotated.width) // 2
    y = FRAME - rotated.height - 8 - bob
    frame.alpha_composite(rotated, (x, y))
    return align_frame(frame)


def build_avatar(trimmed: Image.Image) -> Image.Image:
    """HUD portrait: top 46% of the body, square crop, 160x160."""
    head_h = max(1, round(trimmed.height * 0.46))
    head = trimmed.crop((0, 0, trimmed.width, head_h))
    side = min(head.width, head.height)
    x = max(0, (head.width - side) // 2)
    return head.crop((x, 0, x + side, side)).resize((160, 160), Image.LANCZOS)


def save_webp(img: Image.Image, path: str) -> None:
    img.save(path, "WEBP", quality=92, method=6)
    size = os.path.getsize(path)
    alpha = np.asarray(img.getchannel("A"))
    bbox = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    name = os.path.basename(path)
    print(
        f"  {name:12s} {img.width}x{img.height}  {size / 1024:6.1f} KiB  "
        f"transparent {float((alpha < 8).mean()) * 100:5.1f}%  bbox {bbox}"
    )


def build_skin(skin_id: str, config: dict) -> None:
    out_dir = os.path.join(OUT_ROOT, skin_id)
    os.makedirs(out_dir, exist_ok=True)
    print(f"\n[{skin_id}] -> {os.path.relpath(out_dir, ROOT)}")

    cutouts = {}
    for key in ("idle", "react"):
        path = config[key]
        if not os.path.exists(path):
            raise SystemExit(f"missing source for {skin_id}.{key}: {path}")
        print(f"  source {key}: {os.path.relpath(path, ROOT)}")
        cut = trim(prepare_source(path, config["cutout"]))
        cutouts[key] = cut
        print(f"    trimmed {cut.width}x{cut.height}")

    idle = align_frame(scale_to_height(cutouts["idle"], FRAME_HEIGHT))
    react = align_frame(scale_to_height(cutouts["react"], FRAME_HEIGHT))

    save_webp(idle, os.path.join(out_dir, "idle.webp"))
    save_webp(react, os.path.join(out_dir, "react.webp"))

    # Four-frame procedural walk: two sway extremes and two passes through the middle.
    walk_specs = [
        (-2.4, 2, 1.008),
        (0.0, 6, 0.998),
        (2.4, 2, 1.008),
        (0.0, 6, 0.998),
    ]
    for index, (angle, bob, squeeze) in enumerate(walk_specs, start=1):
        frame = walk_frame(idle, angle, bob, squeeze)
        save_webp(frame, os.path.join(out_dir, f"walk-{index}.webp"))

    save_webp(build_avatar(cutouts["idle"]), os.path.join(out_dir, "avatar.webp"))


def main() -> None:
    for skin_id, config in SKINS.items():
        build_skin(skin_id, config)


if __name__ == "__main__":
    main()
