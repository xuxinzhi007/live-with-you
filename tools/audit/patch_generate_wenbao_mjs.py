#!/usr/bin/env python3
from pathlib import Path
import re

PATH = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\generate-wenbao-lora-cutout.mjs")
text = PATH.read_text(encoding="utf-8")

text = text.replace(
    'const NIKKI_DIR = path.resolve("public/assets/nikki");\nconst CUTOUT_DIR = path.resolve("public/assets/nikki/cutout");',
    'const STAGE_ROOT = path.resolve("tools/out/wenbao-assets");\n'
    'const NIKKI_DIR = path.resolve("public/assets/nikki"); // legacy only if WENBAO_ALSO_NIKKI=1\n'
    'const CUTOUT_DIR = path.resolve("tools/out/wenbao-assets/dress");\n'
    'const RAW_DIR = path.resolve("tools/out/wenbao-assets/raw");\n'
    'const PART_DIR = path.resolve("tools/out/wenbao-assets/part");\n'
    'const ALSO_NIKKI = process.env.WENBAO_ALSO_NIKKI === "1";',
)

# Add GrowMask + FeatherMask into graph between InvertMask and JoinImageWithAlpha
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

new_chain = '''    // DRAFT color-key cutout (white clothes may hole). Official: tools/deliver-dress-frame.py
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
    raise SystemExit("cutout chain not found in mjs")
text = text.replace(old_chain, new_chain)

# Strip appearance from dress prompts
for a in [
    "black hair, short hair, bob cut, bangs, brown eyes, cute gentle smile, ",
    "black hair, short hair, bob cut, bangs, brown eyes, sweet smile, ",
    "black hair, short hair, bob cut, bangs, sparkling brown eyes, ",
]:
    text = text.replace(a, "")

# main mkdir + paths
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

text = text.replace(
    '''    const p1 = path.join(NIKKI_DIR, job.file);
    const p2 = path.join(CUTOUT_DIR, job.file);''',
    '''    const p1 = path.join(RAW_DIR, job.file);
    const p2 = path.join(CUTOUT_DIR, job.file);
    const outs = ALSO_NIKKI ? [p1, p2, path.join(NIKKI_DIR, job.file), path.join(NIKKI_DIR, "cutout", job.file)] : [p1, p2];''',
)

# first loop uses runComfyJob(graph, [p1, p2]) - replace carefully for dresses
text = text.replace(
    '''    const bytes = await runComfyJob(graph, [p1, p2]);
    console.log(`OK [Wenbao LoRA Dress] ${job.file} (${(bytes / 1024).toFixed(1)} KiB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  // 2. 生成 17 件纯白底透明抠图可穿戴配饰
  for (const item of WEARABLE_ITEMS) {
    const p1 = path.join(NIKKI_DIR, item.file);
    const p2 = path.join(CUTOUT_DIR, item.file);''',
    '''    const bytes = await runComfyJob(graph, outs);
    console.log(`OK [Wenbao LoRA Dress DRAFT-RGBA] ${job.file} (${(bytes / 1024).toFixed(1)} KiB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    console.log(`NOTE official 760: python tools/deliver-dress-frame.py ${path.relative(process.cwd(), p1)} --name ${job.file} --check-spec`);
  }

  // 2. 生成 17 件纯白底透明抠图可穿戴配饰
  for (const item of WEARABLE_ITEMS) {
    const p1 = path.join(RAW_DIR, item.file);
    const p2 = path.join(PART_DIR, item.file);
    const outs = ALSO_NIKKI ? [p1, p2, path.join(NIKKI_DIR, item.file), path.join(NIKKI_DIR, "cutout", item.file)] : [p1, p2];''',
)

text = text.replace(
    '''    const bytes = await runComfyJob(graph, [p1, p2]);
    console.log(`OK [Wearable Cutout] ${item.file} (${(bytes / 1024).toFixed(1)} KiB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);''',
    '''    const bytes = await runComfyJob(graph, outs);
    console.log(`OK [Wearable Cutout DRAFT] ${item.file} (${(bytes / 1024).toFixed(1)} KiB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);''',
)

PATH.write_text(text, encoding="utf-8")
print("Patched", PATH)
