#!/usr/bin/env python3
"""Pad the official stand-pose control image with head/foot margins. Compare-only."""
from pathlib import Path
from PIL import Image
import numpy as np
import shutil

SRC = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\input\xiaoyan_pose_stand_clean.png"
)
COMPARE = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\out\wenbao-assets\_compare")
INPUT_DIR = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\input"
)
NAME = "xiaoyan_pose_stand_clean_padded.png"

CANVAS_W, CANVAS_H = 512, 640  # match official latent so ControlNet will not squash/crop
TOP_FRAC, BOTTOM_FRAC = 0.08, 0.12


def main():
    src = Image.open(SRC).convert("RGB")
    arr = np.array(src)
    # background from border median
    border = np.concatenate(
        [arr[:8].reshape(-1, 3), arr[-8:].reshape(-1, 3), arr[:, :8].reshape(-1, 3), arr[:, -8:].reshape(-1, 3)]
    )
    bg = tuple(int(x) for x in np.median(border, axis=0))
    top = int(round(CANVAS_H * TOP_FRAC))
    bottom = int(round(CANVAS_H * BOTTOM_FRAC))
    content_h = CANVAS_H - top - bottom
    scale = content_h / src.height
    new_w = max(1, int(round(src.width * scale)))
    new_h = content_h
    scaled = src.resize((new_w, new_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (CANVAS_W, CANVAS_H), bg)
    x = (CANVAS_W - new_w) // 2
    y = top
    canvas.paste(scaled, (x, y))
    COMPARE.mkdir(parents=True, exist_ok=True)
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    dest_compare = COMPARE / NAME
    dest_input = INPUT_DIR / NAME
    canvas.save(dest_compare, "PNG")
    shutil.copy2(dest_compare, dest_input)
    print(
        {
            "src": f"{src.size}",
            "bg": bg,
            "scale": round(scale, 4),
            "pasted": [new_w, new_h],
            "xy": [x, y],
            "top_px": top,
            "bottom_px": CANVAS_H - (y + new_h),
            "side_px": x,
            "top_frac": top / CANVAS_H,
            "bottom_frac": (CANVAS_H - (y + new_h)) / CANVAS_H,
            "side_frac": x / CANVAS_W,
            "compare": str(dest_compare),
            "input": str(dest_input),
        }
    )


if __name__ == "__main__":
    main()
