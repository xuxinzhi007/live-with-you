#!/usr/bin/env python3
"""Patch tools/generate-comfy-assets.mjs for staging + dress deliver + prompt cleanup."""
from __future__ import annotations

from pathlib import Path

PATH = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\generate-comfy-assets.mjs")
text = PATH.read_text(encoding="utf-8")

# --- header / constants ---
old_header_tail = '''const OUT_DIR = path.resolve("public/assets/nikki");

// ---- 可选增强（默认关，向后兼容；不传则与现状一致） ----
// COMFY_CONTROLNET=openpose|dwpose|none  用骨架图锁死姿势，解决漂浮
// COMFY_CONTROLNET_IMAGE=<path>          骨架图路径（不填则跳过 ControlNet）
// COMFY_CONTROLNET_STRENGTH=0.9          姿势约束强度
// COMFY_LAYERDIFFUSE=1                   开 LayerDiffusion 出透明分层（需装插件）
const CONTROLNET = process.env.COMFY_CONTROLNET || "none";
const CONTROLNET_IMAGE = process.env.COMFY_CONTROLNET_IMAGE || "";
const CONTROLNET_STRENGTH = Number(process.env.COMFY_CONTROLNET_STRENGTH || 0.9);
const LAYERDIFFUSE = process.env.COMFY_LAYERDIFFUSE === "1";'''

new_header_tail = '''const LEGACY_NIKKI_DIR = path.resolve("public/assets/nikki");
const STAGE_ROOT = path.resolve("tools/out/wenbao-assets");

// ---- 可选增强（默认关，向后兼容；不传则与现状一致） ----
// COMFY_CONTROLNET=openpose|dwpose|none  正式 dress 应开；无锁姿 = unofficial
// COMFY_CONTROLNET_IMAGE=<path>          骨架图路径（不填则跳过 ControlNet）
// COMFY_CONTROLNET_STRENGTH=0.9          姿势约束强度
// COMFY_LAYERDIFFUSE=1                   开 LayerDiffusion（本机通常未装，勿默认开）
// WENBAO_DELIVER_DRESS=1                 生成后对 dress 跑 flood 抠图 + 760 对齐
// WENBAO_ALSO_NIKKI=1                    额外拷贝一份到 public/assets/nikki（兼容旧路径）
// WENBAO_KIND=dress|card|prop            只跑某一类
// WENBAO_ONLY=dress-apricot-tea.png      只跑单个文件名
const CONTROLNET = process.env.COMFY_CONTROLNET || "none";
const CONTROLNET_IMAGE = process.env.COMFY_CONTROLNET_IMAGE || "";
const CONTROLNET_STRENGTH = Number(process.env.COMFY_CONTROLNET_STRENGTH || 0.9);
const LAYERDIFFUSE = process.env.COMFY_LAYERDIFFUSE === "1";
const DELIVER_DRESS = process.env.WENBAO_DELIVER_DRESS === "1";
const ALSO_NIKKI = process.env.WENBAO_ALSO_NIKKI === "1";
const ONLY_KIND = process.env.WENBAO_KIND || "";
const ONLY_NAME = process.env.WENBAO_ONLY || "";
const PYTHON =
  process.env.WENBAO_PYTHON ||
  "D:\\\\xuxinzhi\\\\ComfyUI_windows_portable_nvidia\\\\ComfyUI_windows_portable\\\\python_embeded\\\\python.exe";

function stageCategory(kind) {
  if (kind === "dress") return "dress";
  if (kind === "card") return "card";
  if (kind === "prop") return "part";
  return "raw";
}'''

if old_header_tail not in text:
    # try looser match - the comment encoding may differ
    import re
    m = re.search(r'const OUT_DIR = path\.resolve\("public/assets/nikki"\);.*?const LAYERDIFFUSE = process\.env\.COMFY_LAYERDIFFUSE === "1";', text, re.S)
    if not m:
        raise SystemExit("header block not found")
    text = text[: m.start()] + new_header_tail + text[m.end() :]
else:
    text = text.replace(old_header_tail, new_header_tail)

# Strip appearance tags from dress/card prompts (keep clothing)
replacements = [
    ("short black bob hair, bangs, warm brown eyes, cute smile, ", ""),
    ("short black bob hair, bangs, brown eyes, sweet smile, ", ""),
    ("short black bob hair, bangs, sparkling brown eyes, gentle smile, ", ""),
    ("short black bob hair, bangs, brown eyes, happy smile, ", ""),
    ("short black bob hair, bangs, brown eyes, gentle expression, ", ""),
    ("short black bob hair, bangs, brown eyes, holding", "holding"),
    ("short black bob hair, bangs, brown eyes, wearing", "wearing"),
]
for a, b in replacements:
    text = text.replace(a, b)

# Patch generateOne + main
old_gen = '''async function generateOne(job) {
  const outPath = path.join(OUT_DIR, job.name);
  const submitRes = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: "wenbebi-v7-gen",
      prompt: buildComfyGraph(job),
    }),
  });
  if (!submitRes.ok) {
    throw new Error(`ComfyUI /prompt HTTP ${submitRes.status}`);
  }
  const { prompt_id: promptId } = await submitRes.json();

  const start = Date.now();
  while (Date.now() - start < 180_000) {
    await new Promise((r) => setTimeout(r, 750));
    const histRes = await fetch(`${COMFY_URL}/history/${encodeURIComponent(promptId)}`);
    if (!histRes.ok) continue;
    const hist = await histRes.json();
    const record = hist[promptId];
    if (!record) continue;

    const outputs = record.outputs || {};
    for (const nodeOut of Object.values(outputs)) {
      if (nodeOut?.images?.length > 0) {
        const img = nodeOut.images[0];
        const q = new URLSearchParams({
          filename: img.filename,
          subfolder: img.subfolder || "",
          type: img.type || "output",
        });
        const viewRes = await fetch(`${COMFY_URL}/view?${q.toString()}`);
        const buf = Buffer.from(await viewRes.arrayBuffer());
        await writeFile(outPath, buf);
        console.log(`OK   [${job.kind}] ${job.name} (${(buf.length / 1024).toFixed(1)} KiB, ${((Date.now() - start) / 1000).toFixed(1)}s)`);
        return;
      }
    }
  }
  throw new Error(`Timeout waiting for ${job.name}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Connecting to ComfyUI at ${COMFY_URL} (model: ${CHECKPOINT}, LoRA: ${LORA_FILE})...`);
  for (const job of ASSET_JOBS) {
    await generateOne(job);
  }
  console.log("ALL 25 V7 ASSETS GENERATED SUCCESSFULLY.");
}'''

new_gen = '''import { spawn } from "node:child_process";
import { copyFile } from "node:fs/promises";

function runDeliverDress(rawPath, outName) {
  return new Promise((resolve, reject) => {
    const args = [
      path.resolve("tools/deliver-dress-frame.py"),
      rawPath,
      "--name",
      outName,
      "--check-spec",
    ];
    const child = spawn(PYTHON, args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`deliver-dress-frame exited ${code}`));
    });
  });
}

async function generateOne(job) {
  const category = stageCategory(job.kind);
  const rawDir = path.join(STAGE_ROOT, "raw");
  const catDir = path.join(STAGE_ROOT, category);
  await mkdir(rawDir, { recursive: true });
  await mkdir(catDir, { recursive: true });
  const rawPath = path.join(rawDir, job.name);
  const officialLock = CONTROLNET !== "none" && CONTROLNET_IMAGE;
  const label = officialLock ? "official-lockpose" : "unofficial-txt2img";

  const submitRes = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: "wenbebi-v7-gen",
      prompt: buildComfyGraph(job),
    }),
  });
  if (!submitRes.ok) {
    throw new Error(`ComfyUI /prompt HTTP ${submitRes.status}`);
  }
  const { prompt_id: promptId } = await submitRes.json();

  const start = Date.now();
  while (Date.now() - start < 180_000) {
    await new Promise((r) => setTimeout(r, 750));
    const histRes = await fetch(`${COMFY_URL}/history/${encodeURIComponent(promptId)}`);
    if (!histRes.ok) continue;
    const hist = await histRes.json();
    const record = hist[promptId];
    if (!record) continue;

    const outputs = record.outputs || {};
    for (const nodeOut of Object.values(outputs)) {
      if (nodeOut?.images?.length > 0) {
        const img = nodeOut.images[0];
        const q = new URLSearchParams({
          filename: img.filename,
          subfolder: img.subfolder || "",
          type: img.type || "output",
        });
        const viewRes = await fetch(`${COMFY_URL}/view?${q.toString()}`);
        const buf = Buffer.from(await viewRes.arrayBuffer());
        await writeFile(rawPath, buf);
        // Non-dress categories: stage RGB as-is under category (card stays 512x640).
        if (job.kind !== "dress") {
          await writeFile(path.join(catDir, job.name), buf);
        }
        if (ALSO_NIKKI) {
          await mkdir(LEGACY_NIKKI_DIR, { recursive: true });
          await writeFile(path.join(LEGACY_NIKKI_DIR, job.name), buf);
        }
        console.log(
          `OK   [${job.kind}/${label}] raw ${job.name} (${(buf.length / 1024).toFixed(1)} KiB, ${((Date.now() - start) / 1000).toFixed(1)}s) -> ${path.relative(process.cwd(), rawPath)}`,
        );
        if (job.kind === "dress" && DELIVER_DRESS) {
          await runDeliverDress(rawPath, job.name.replace(/\\.png$/i, ".png"));
        } else if (job.kind === "dress") {
          console.log(
            `NOTE dress RGB only. Official 760 RGBA: python tools/deliver-dress-frame.py ${path.relative(process.cwd(), rawPath)} --name ${job.name} --check-spec`,
          );
        }
        return;
      }
    }
  }
  throw new Error(`Timeout waiting for ${job.name}`);
}

async function main() {
  await mkdir(STAGE_ROOT, { recursive: true });
  for (const cat of ["dress", "part", "card", "icon", "raw"]) {
    await mkdir(path.join(STAGE_ROOT, cat), { recursive: true });
  }
  const jobs = ASSET_JOBS.filter((j) => {
    if (ONLY_KIND && j.kind !== ONLY_KIND) return false;
    if (ONLY_NAME && j.name !== ONLY_NAME) return false;
    return true;
  });
  if (!jobs.length) {
    console.error("No jobs matched WENBAO_KIND / WENBAO_ONLY filters.");
    process.exit(1);
  }
  const lock = CONTROLNET !== "none" && CONTROLNET_IMAGE;
  console.log(
    `Connecting to ComfyUI at ${COMFY_URL} (model: ${CHECKPOINT}, LoRA: ${LORA_FILE})`,
  );
  console.log(
    `Staging -> ${STAGE_ROOT} | jobs=${jobs.length} | dressDeliver=${DELIVER_DRESS} | alsoNikki=${ALSO_NIKKI} | poseLock=${lock ? "ON" : "OFF(unofficial)"}`,
  );
  if (!lock) {
    console.log(
      "WARN formal dress should set COMFY_CONTROLNET=openpose and COMFY_CONTROLNET_IMAGE=<pose ref>.",
    );
  }
  for (const job of jobs) {
    await generateOne(job);
  }
  console.log(`DONE ${jobs.length} asset(s). See tools/PIPELINE-DRESS.md`);
}'''

# The old_gen might have encoding differences in comments - match by unique anchors
import re
m = re.search(r"async function generateOne\(job\) \{.*?^main\(\)\.catch", text, re.S | re.M)
if not m:
    raise SystemExit("generateOne/main block not found")
# keep main().catch
tail = text[m.end() :]
# m ends at main().catch - need to include from generateOne through end of main function only
m2 = re.search(r"async function generateOne\(job\) \{.*?\n\}\n\nmain\(\)\.catch", text, re.S)
if not m2:
    raise SystemExit("generateOne block end not found")
text = text[: m2.start()] + new_gen + "\n\nmain().catch" + text[m2.end() :]

# Fix import - spawn/copyFile should be at top. Move imports into top area.
if 'import { spawn }' in text:
    # remove inline import block from new_gen and add to top
    text = text.replace(
        'import { mkdir, writeFile } from "node:fs/promises";\nimport path from "node:path";',
        'import { mkdir, writeFile, copyFile } from "node:fs/promises";\nimport { spawn } from "node:child_process";\nimport path from "node:path";',
    )
    text = text.replace('import { spawn } from "node:child_process";\nimport { copyFile } from "node:fs/promises";\n\n', "")

# Update file header comment briefly
text = text.replace(
    "生成管线（V7 校准版）",
    "生成管线（V7.1：分类暂存 + 可选 760 透明交付）",
)

PATH.write_text(text, encoding="utf-8")
print("Patched", PATH, "bytes", PATH.stat().st_size)
# sanity
assert "STAGE_ROOT" in text
assert "DELIVER_DRESS" in text
assert "deliver-dress-frame.py" in text
assert "OUT_DIR" not in text or "LEGACY_NIKKI" in text
print("sanity ok")
