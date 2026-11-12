#!/usr/bin/env python3
"""Official dress post-step: rembg isnet-anime onto solid white.

This is the formal matte path for MeinaMix_雯宝LoRA_换装抠图.
Color-key / flood-fill is not the live cutout.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove


def rematte(src: Path, white_path: Path, rgba_path: Path, display_2x: Path | None):
    img = Image.open(src).convert("RGB")
    session = new_session("isnet-anime")
    rgba = remove(img, session=session).convert("RGBA")
    arr = np.array(rgba)
    alpha = arr[:, :, 3]
    keep = float((alpha > 16).mean())
    opaque = float((alpha > 240).mean())
    mid = float(((alpha > 16) & (alpha < 240)).mean())
    print(f"src={src} size={img.size} keep>16={keep:.3f} opaque>240={opaque:.3f} mid={mid:.3f}")
    if keep > 0.92:
        print("WARNING: keep-mask almost fills the canvas; likely backdrop leak")
    white = Image.new("RGB", img.size, (255, 255, 255))
    white.paste(rgba, mask=rgba.split()[-1])
    white_path.parent.mkdir(parents=True, exist_ok=True)
    rgba_path.parent.mkdir(parents=True, exist_ok=True)
    rgba.save(rgba_path)
    white.save(white_path)
    print(f"wrote {white_path} ({white_path.stat().st_size} bytes)")
    print(f"wrote {rgba_path} ({rgba_path.stat().st_size} bytes)")
    if display_2x is not None and img.size != (1024, 1280):
        disp = white.resize((1024, 1280), Image.Resampling.LANCZOS)
        disp.save(display_2x)
        print(f"wrote display 2x {display_2x} ({display_2x.stat().st_size} bytes)")
        rgba2 = rgba.resize((1024, 1280), Image.Resampling.LANCZOS)
        rgba2_path = display_2x.with_name(display_2x.name.replace("_white.png", "_rgba.png"))
        if rgba2_path != rgba_path:
            rgba2.save(rgba2_path)
            print(f"wrote display 2x rgba {rgba2_path}")
    elif display_2x is not None and img.size == (1024, 1280):
        if display_2x.resolve() != white_path.resolve():
            display_2x.write_bytes(white_path.read_bytes())
            print(f"copied 2x white {display_2x}")


def main():
    p = argparse.ArgumentParser(description="Official isnet-anime rematte onto solid white")
    p.add_argument("--src", required=True, help="AnimeSharp RAW (prefer 4x)")
    p.add_argument("--white", default="", help="Output white PNG path")
    p.add_argument("--rgba", default="", help="Output RGBA PNG path")
    p.add_argument("--display-2x-white", default="", help="Optional 1024x1280 white")
    p.add_argument("--stem", default="", help="If set with --outdir, derive default names")
    p.add_argument("--outdir", default="")
    args = p.parse_args()
    src = Path(args.src)
    if args.white:
        white = Path(args.white)
        rgba = Path(args.rgba) if args.rgba else white.with_name(white.name.replace("_white.png", "_rgba.png"))
        display = Path(args.display_2x_white) if args.display_2x_white else None
    else:
        if not args.stem or not args.outdir:
            raise SystemExit("pass --white/--rgba or --stem + --outdir")
        out = Path(args.outdir)
        stem = args.stem
        # If src looks 4x, write 4x names plus a 2x display
        if "4x" in src.name:
            white = out / f"{stem}_animesharp4x_white.png"
            rgba = out / f"{stem}_animesharp4x_rgba.png"
            display = out / f"{stem}_animesharp2x_white.png"
        else:
            white = out / f"{stem}_animesharp2x_white.png"
            rgba = out / f"{stem}_animesharp2x_rgba.png"
            display = None
    rematte(src, white, rgba, display)


if __name__ == "__main__":
    main()
