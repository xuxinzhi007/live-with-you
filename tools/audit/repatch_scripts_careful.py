#!/usr/bin/env python3
"""Carefully retarget build/generate scripts after restore from backup."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi")


def patch_build_py() -> None:
    p = ROOT / "tools" / "build-wenbao-lora-cutout.py"
    text = p.read_text(encoding="utf-8")

    old = '''ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NIKKI_DIR = os.path.join(ROOT, "public", "assets", "nikki")
CUTOUT_DIR = os.path.join(NIKKI_DIR, "cutout")'''
    new = '''ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NIKKI_DIR = os.path.join(ROOT, "public", "assets", "nikki")  # legacy optional
STAGE_ROOT = os.path.join(ROOT, "tools", "out", "wenbao-assets")
CUTOUT_DIR = os.path.join(STAGE_ROOT, "dress")
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
        raise SystemExit("build: ROOT block missing")
    text = text.replace(old, new)

    # Replace appearance lines inside concatenated prompt strings without collapsing quotes
    # Exact substrings as they appear across string literals
    repls = [
        ("1girl, black hair, ", "1girl, "),
        ("short hair, bob cut, bangs, brown eyes, cute gentle smile, ", ""),
        ("short hair, bob cut, bangs, brown eyes, sweet smile, ", ""),
        ("short hair, bob cut, bangs, sparkling brown eyes, ", ""),
    ]
    for a, b in repls:
        text = text.replace(a, b)

    # align_character_canvas signature/body
    m = re.search(
        r"def align_character_canvas\(trimmed: Image\.Image, canvas: int = 760, target_h: int = 690, baseline_y: int = 742\).*?return frame\n",
        text,
        re.S,
    )
    if not m:
        raise SystemExit("build: align_character_canvas missing")
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

    text = text.replace(
        "def main() -> None:\n    os.makedirs(CUTOUT_DIR, exist_ok=True)",
        "def main() -> None:\n"
        "    os.makedirs(CUTOUT_DIR, exist_ok=True)\n"
        "    os.makedirs(PART_DIR, exist_ok=True)\n"
        "    os.makedirs(RAW_DIR, exist_ok=True)\n"
        "    also_nikki = os.environ.get('WENBAO_ALSO_NIKKI') == '1'\n"
        "    if also_nikki:\n"
        "        os.makedirs(NIKKI_DIR, exist_ok=True)\n"
        "        os.makedirs(os.path.join(NIKKI_DIR, 'cutout'), exist_ok=True)",
    )

    text = text.replace(
        'raw_path = os.path.join(NIKKI_DIR, job["raw_file"])\n        raw_img.save(raw_path, "PNG")\n\n'
        '        trimmed = smart_border_cutout(raw_img, color_tol=44.0)\n'
        '        aligned = align_character_canvas(trimmed)\n'
        '        cutout_path = os.path.join(CUTOUT_DIR, job["cutout_file"])\n'
        '        aligned.save(cutout_path, "WEBP", quality=92, method=6)\n'
        '        print(f"  -> Saved transparent cutout: {cutout_path} ({os.path.getsize(cutout_path)/1024:.1f} KiB)")',
        'raw_path = os.path.join(RAW_DIR, job["raw_file"])\n'
        '        raw_img.save(raw_path, "PNG")\n'
        '        if also_nikki:\n'
        '            raw_img.save(os.path.join(NIKKI_DIR, job["raw_file"]), "PNG")\n\n'
        '        trimmed = smart_border_cutout(raw_img, color_tol=44.0)\n'
        '        aligned = align_character_canvas(trimmed)\n'
        '        cutout_path = os.path.join(CUTOUT_DIR, job["raw_file"])\n'
        '        aligned.save(cutout_path, "PNG")\n'
        '        webp_path = os.path.join(CUTOUT_DIR, job["cutout_file"])\n'
        '        aligned.save(webp_path, "WEBP", quality=92, method=6)\n'
        '        if also_nikki:\n'
        '            aligned.save(os.path.join(NIKKI_DIR, "cutout", job["cutout_file"]), "WEBP", quality=92, method=6)\n'
        '        print(f"  -> Saved transparent cutout: {cutout_path} ({os.path.getsize(cutout_path)/1024:.1f} KiB)")',
    )

    text = text.replace(
        'src_path = os.path.join(NIKKI_DIR, filename)\n'
        '        if not os.path.exists(src_path):\n'
        '            print(f"  WARN: missing {src_path}")\n'
        '            continue\n'
        '        img = Image.open(src_path)\n'
        '        trimmed = smart_border_cutout(img, color_tol=52.0)\n'
        '        aligned = align_item_canvas(trimmed, canvas=360)\n'
        '        webp_name = os.path.splitext(filename)[0] + ".webp"\n'
        '        out_path = os.path.join(CUTOUT_DIR, webp_name)\n'
        '        aligned.save(out_path, "WEBP", quality=90, method=6)\n'
        '        print(f"  -> Cutout wearable item: {webp_name} ({os.path.getsize(out_path)/1024:.1f} KiB)")',
        'src_path = os.path.join(NIKKI_DIR, filename)\n'
        '        if not os.path.exists(src_path):\n'
        '            alt = os.path.join(RAW_DIR, filename)\n'
        '            src_path = alt if os.path.exists(alt) else src_path\n'
        '        if not os.path.exists(src_path):\n'
        '            print(f"  WARN: missing {src_path}")\n'
        '            continue\n'
        '        img = Image.open(src_path)\n'
        '        trimmed = smart_border_cutout(img, color_tol=52.0)\n'
        '        aligned = align_item_canvas(trimmed, canvas=360)\n'
        '        png_name = os.path.splitext(filename)[0] + ".png"\n'
        '        out_path = os.path.join(PART_DIR, png_name)\n'
        '        aligned.save(out_path, "PNG")\n'
        '        if also_nikki:\n'
        '            webp_name = os.path.splitext(filename)[0] + ".webp"\n'
        '            aligned.save(os.path.join(NIKKI_DIR, "cutout", webp_name), "WEBP", quality=90, method=6)\n'
        '        print(f"  -> Cutout wearable item: {png_name} ({os.path.getsize(out_path)/1024:.1f} KiB)")',
    )

    p.write_text(text, encoding="utf-8")
    print("patched", p)


def patch_generate_mjs() -> None:
    """Re-run the V7 staging patch against restored? generate-comfy-assets may still be patched.
    Check STAGE_ROOT presence; if missing, apply lightweight patch.
    """
    p = ROOT / "tools" / "generate-comfy-assets.mjs"
    text = p.read_text(encoding="utf-8")
    if "STAGE_ROOT" in text and "deliver-dress-frame" in text:
        # still strip appearance if any left
        text2 = text
        for a in [
            "short black bob hair, bangs, warm brown eyes, cute smile, ",
            "short black bob hair, bangs, brown eyes, sweet smile, ",
            "short black bob hair, bangs, sparkling brown eyes, gentle smile, ",
            "short black bob hair, bangs, brown eyes, happy smile, ",
            "short black bob hair, bangs, brown eyes, gentle expression, ",
            "short black bob hair, bangs, brown eyes, holding",
            "short black bob hair, bangs, brown eyes, wearing",
        ]:
            b = "holding" if a.endswith("holding") else ("wearing" if a.endswith("wearing") else "")
            text2 = text2.replace(a, b)
        p.write_text(text2, encoding="utf-8")
        print("generate-comfy-assets.mjs already staged; appearance scrubbed")
        return
    raise SystemExit("generate-comfy-assets.mjs lost STAGE_ROOT — restore from bak then re-run audit patch")


def patch_wenbao_cutout_mjs() -> None:
    p = ROOT / "tools" / "generate-wenbao-lora-cutout.mjs"
    text = p.read_text(encoding="utf-8")
    # Fresh from backup — apply staging + grow/feather + appearance
    text = text.replace(
        'const NIKKI_DIR = path.resolve("public/assets/nikki");\nconst CUTOUT_DIR = path.resolve("public/assets/nikki/cutout");',
        'const STAGE_ROOT = path.resolve("tools/out/wenbao-assets");\n'
        'const NIKKI_DIR = path.resolve("public/assets/nikki");\n'
        'const CUTOUT_DIR = path.resolve("tools/out/wenbao-assets/dress");\n'
        'const RAW_DIR = path.resolve("tools/out/wenbao-assets/raw");\n'
        'const PART_DIR = path.resolve("tools/out/wenbao-assets/part");\n'
        'const ALSO_NIKKI = process.env.WENBAO_ALSO_NIKKI === "1";',
    )
    old_chain = '''    "14": {
      class_type: "ImageColorToMask",
      inputs: { image: ["8", 0], color: 16777215 },
    },
    "15": {
      class_type: "InvertMask",
      inputs: { mask: ["14", 0] },
    },
    "16": {
      class_type: "JoinImageWithAlpha",
      inputs: { image: ["8", 0], alpha: ["15", 0] },
    },
    "17": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "wenbao_cutout", images: ["16", 0] },
    },'''
    new_chain = '''    // DRAFT color-key only. Official dress: workflow MeinaMix_雯宝LoRA_换装抠图 + deliver-dress-frame.py
    "14": {
      class_type: "ImageColorToMask",
      inputs: { image: ["8", 0], color: 16777215 },
    },
    "15": {
      class_type: "InvertMask",
      inputs: { mask: ["14", 0] },
    },
    "18": {
      class_type: "GrowMask",
      inputs: { mask: ["15", 0], expand: -2, tapered_corners: true },
    },
    "19": {
      class_type: "FeatherMask",
      inputs: { mask: ["18", 0], left: 2, top: 2, right: 2, bottom: 2 },
    },
    "16": {
      class_type: "JoinImageWithAlpha",
      inputs: { image: ["8", 0], alpha: ["19", 0] },
    },
    "17": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "wenbao_cutout", images: ["16", 0] },
    },'''
    if old_chain not in text:
        raise SystemExit("wenbao mjs cutout chain missing")
    text = text.replace(old_chain, new_chain)
    for a, b in [
        ("1girl, black hair, short hair, bob cut, bangs, brown eyes, cute gentle smile, ", "1girl, "),
        ("1girl, black hair, short hair, bob cut, bangs, brown eyes, sweet smile, ", "1girl, "),
        ("1girl, black hair, short hair, bob cut, bangs, sparkling brown eyes, ", "1girl, "),
    ]:
        text = text.replace(a, b)

    text = text.replace(
        '''async function main() {
  await mkdir(NIKKI_DIR, { recursive: true });
  await mkdir(CUTOUT_DIR, { recursive: true });''',
        '''async function main() {
  await mkdir(STAGE_ROOT, { recursive: true });
  await mkdir(CUTOUT_DIR, { recursive: true });
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(PART_DIR, { recursive: true });
  if (ALSO_NIKKI) {
    await mkdir(NIKKI_DIR, { recursive: true });
    await mkdir(path.join(NIKKI_DIR, "cutout"), { recursive: true });
  }''',
    )
    # dress outs
    text = text.replace(
        "const p1 = path.join(NIKKI_DIR, job.file);\n    const p2 = path.join(CUTOUT_DIR, job.file);",
        "const p1 = path.join(RAW_DIR, job.file);\n"
        "    const p2 = path.join(CUTOUT_DIR, job.file);\n"
        '    const outs = ALSO_NIKKI ? [p1, p2, path.join(NIKKI_DIR, job.file), path.join(NIKKI_DIR, "cutout", job.file)] : [p1, p2];',
    )
    text = text.replace(
        "const bytes = await runComfyJob(graph, [p1, p2]);\n"
        "    console.log(`OK [Wenbao LoRA Dress] ${job.file} (${(bytes / 1024).toFixed(1)} KiB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);\n"
        "  }\n\n"
        "  // 2.",
        "const bytes = await runComfyJob(graph, outs);\n"
        "    console.log(`OK [Wenbao LoRA Dress DRAFT] ${job.file} (${(bytes / 1024).toFixed(1)} KiB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);\n"
        "    console.log(`NOTE official 760: python tools/deliver-dress-frame.py ${path.relative(process.cwd(), p1)} --name ${job.file} --check-spec`);\n"
        "  }\n\n"
        "  // 2.",
    )
    text = text.replace(
        "const p1 = path.join(NIKKI_DIR, item.file);\n    const p2 = path.join(CUTOUT_DIR, item.file);",
        "const p1 = path.join(RAW_DIR, item.file);\n"
        "    const p2 = path.join(PART_DIR, item.file);\n"
        '    const outs = ALSO_NIKKI ? [p1, p2, path.join(NIKKI_DIR, item.file), path.join(NIKKI_DIR, "cutout", item.file)] : [p1, p2];',
    )
    text = text.replace(
        "const bytes = await runComfyJob(graph, [p1, p2]);\n"
        "    console.log(`OK [Wearable Cutout] ${item.file}",
        "const bytes = await runComfyJob(graph, outs);\n"
        "    console.log(`OK [Wearable Cutout DRAFT] ${item.file}",
    )
    p.write_text(text, encoding="utf-8")
    print("patched", p)


def main() -> None:
    patch_build_py()
    patch_generate_mjs()
    patch_wenbao_cutout_mjs()


if __name__ == "__main__":
    main()
