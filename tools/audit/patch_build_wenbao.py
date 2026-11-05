#!/usr/bin/env python3
"""Retarget build-wenbao-lora-cutout.py to staging + spec.json alignment."""
from __future__ import annotations

from pathlib import Path

PATH = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\build-wenbao-lora-cutout.py")
text = PATH.read_text(encoding="utf-8")

old = '''ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NIKKI_DIR = os.path.join(ROOT, "public", "assets", "nikki")
CUTOUT_DIR = os.path.join(NIKKI_DIR, "cutout")'''

new = '''ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NIKKI_DIR = os.path.join(ROOT, "public", "assets", "nikki")  # legacy optional
STAGE_ROOT = os.path.join(ROOT, "tools", "out", "wenbao-assets")
CUTOUT_DIR = os.path.join(STAGE_ROOT, "dress")  # primary dress staging
PART_DIR = os.path.join(STAGE_ROOT, "part")
RAW_DIR = os.path.join(STAGE_ROOT, "raw")
SPEC_PATH = os.path.join(ROOT, "tools", "character", "spec.json")
with open(SPEC_PATH, encoding="utf-8") as _sf:
    SPEC = json.load(_sf)
CANVAS = int(SPEC["frame"]["canvas"])
BASELINE_Y = int(SPEC["frame"]["baselineY"])
CENTER_X = int(SPEC["frame"]["centerX"])
TARGET_H = int(SPEC["skins"].get("maid", {}).get("visibleHeight") or 714)'''

if old not in text:
    raise SystemExit("ROOT block not found")
text = text.replace(old, new)

# Fix prompts: strip appearance
for a in [
    "black hair, short hair, bob cut, bangs, brown eyes, cute gentle smile, ",
    "black hair, short hair, bob cut, bangs, brown eyes, sweet smile, ",
    "black hair, short hair, bob cut, bangs, sparkling brown eyes, ",
]:
    text = text.replace(a, "")

# Fix align_character_canvas to use SPEC constants
old_align = '''def align_character_canvas(trimmed: Image.Image, canvas: int = 760, target_h: int = 690, baseline_y: int = 742) -> Image.Image:
    """将抠好图的全身雯宝立绘统一缩放至 760x760 画布、脚底对齐 y=742，和 original/maid 完全一致！"""
    factor = target_h / max(1, trimmed.height)
    new_w = max(1, round(trimmed.width * factor))
    new_h = max(1, round(trimmed.height * factor))
    scaled = trimmed.resize((new_w, new_h), Image.LANCZOS)

    frame = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    dx = (canvas - new_w) // 2
    dy = baseline_y - new_h
    frame.alpha_composite(scaled, (dx, max(0, dy)))
    return frame'''

# Encoding may have garbled Chinese - use regex
import re
m = re.search(
    r"def align_character_canvas\(trimmed: Image\.Image, canvas: int = 760, target_h: int = 690, baseline_y: int = 742\).*?return frame\n",
    text,
    re.S,
)
if not m:
    raise SystemExit("align_character_canvas not found")
new_align = '''def align_character_canvas(
    trimmed: Image.Image,
    canvas: int = CANVAS,
    target_h: int = TARGET_H,
    baseline_y: int = BASELINE_Y,
    center_x: int = CENTER_X,
) -> Image.Image:
    """Align cutout to tools/character/spec.json (760, feet baselineY, centerX)."""
    factor = target_h / max(1, trimmed.height)
    new_w = max(1, round(trimmed.width * factor))
    new_h = max(1, round(trimmed.height * factor))
    scaled = trimmed.resize((new_w, new_h), Image.LANCZOS)

    frame = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    dx = center_x - new_w // 2
    dy = baseline_y - (new_h - 1)
    frame.alpha_composite(scaled, (dx, max(0, dy)))
    return frame
'''
text = text[: m.start()] + new_align + text[m.end() :]

old_main_start = '''def main() -> None:
    os.makedirs(CUTOUT_DIR, exist_ok=True)'''
new_main_start = '''def main() -> None:
    os.makedirs(CUTOUT_DIR, exist_ok=True)
    os.makedirs(PART_DIR, exist_ok=True)
    os.makedirs(RAW_DIR, exist_ok=True)
    # Set WENBAO_ALSO_NIKKI=1 to also write legacy public/assets/nikki paths.
    also_nikki = os.environ.get("WENBAO_ALSO_NIKKI") == "1"
    if also_nikki:
        os.makedirs(NIKKI_DIR, exist_ok=True)
        os.makedirs(os.path.join(NIKKI_DIR, "cutout"), exist_ok=True)'''
if old_main_start not in text:
    raise SystemExit("main start not found")
text = text.replace(old_main_start, new_main_start)

# Change raw save path and cutout path; item path
text = text.replace(
    '''        raw_path = os.path.join(NIKKI_DIR, job["raw_file"])
        raw_img.save(raw_path, "PNG")

        trimmed = smart_border_cutout(raw_img, color_tol=44.0)
        aligned = align_character_canvas(trimmed)
        cutout_path = os.path.join(CUTOUT_DIR, job["cutout_file"])
        aligned.save(cutout_path, "WEBP", quality=92, method=6)
        print(f"  -> Saved transparent cutout: {cutout_path} ({os.path.getsize(cutout_path)/1024:.1f} KiB)")''',
    '''        raw_path = os.path.join(RAW_DIR, job["raw_file"])
        raw_img.save(raw_path, "PNG")
        if also_nikki:
            raw_img.save(os.path.join(NIKKI_DIR, job["raw_file"]), "PNG")

        trimmed = smart_border_cutout(raw_img, color_tol=44.0)
        aligned = align_character_canvas(trimmed)
        cutout_path = os.path.join(CUTOUT_DIR, job["raw_file"].replace(".png", ".png"))
        # Prefer PNG RGBA for wardrobe compositing; also keep webp sibling.
        aligned.save(cutout_path, "PNG")
        webp_path = os.path.join(CUTOUT_DIR, job["cutout_file"])
        aligned.save(webp_path, "WEBP", quality=92, method=6)
        if also_nikki:
            aligned.save(os.path.join(NIKKI_DIR, "cutout", job["cutout_file"]), "WEBP", quality=92, method=6)
        print(f"  -> Saved transparent cutout: {cutout_path} ({os.path.getsize(cutout_path)/1024:.1f} KiB)")''',
)

text = text.replace(
    '''        src_path = os.path.join(NIKKI_DIR, filename)
        if not os.path.exists(src_path):
            print(f"  WARN: missing {src_path}")
            continue
        img = Image.open(src_path)
        trimmed = smart_border_cutout(img, color_tol=52.0)
        aligned = align_item_canvas(trimmed, canvas=360)
        webp_name = os.path.splitext(filename)[0] + ".webp"
        out_path = os.path.join(CUTOUT_DIR, webp_name)
        aligned.save(out_path, "WEBP", quality=90, method=6)
        print(f"  -> Cutout wearable item: {webp_name} ({os.path.getsize(out_path)/1024:.1f} KiB)")''',
    '''        src_path = os.path.join(NIKKI_DIR, filename)
        if not os.path.exists(src_path):
            alt = os.path.join(RAW_DIR, filename)
            src_path = alt if os.path.exists(alt) else src_path
        if not os.path.exists(src_path):
            print(f"  WARN: missing {src_path}")
            continue
        img = Image.open(src_path)
        trimmed = smart_border_cutout(img, color_tol=52.0)
        aligned = align_item_canvas(trimmed, canvas=360)
        png_name = os.path.splitext(filename)[0] + ".png"
        out_path = os.path.join(PART_DIR, png_name)
        aligned.save(out_path, "PNG")
        if also_nikki:
            webp_name = os.path.splitext(filename)[0] + ".webp"
            aligned.save(os.path.join(NIKKI_DIR, "cutout", webp_name), "WEBP", quality=90, method=6)
        print(f"  -> Cutout wearable item: {png_name} ({os.path.getsize(out_path)/1024:.1f} KiB)")''',
)

# Docstring note at top
text = text.replace(
    '输出 100% 透明底 `.webp` 到 `public/assets/nikki/cutout/`，供前端 Paper-Doll 多层骨骼直接穿戴上身。',
    '输出 RGBA 到 `tools/out/wenbao-assets/dress|part/`（760 对齐见 spec.json）。'
    '设 WENBAO_ALSO_NIKKI=1 才额外写 public/assets/nikki。',
)

PATH.write_text(text, encoding="utf-8")
print("Patched", PATH)
