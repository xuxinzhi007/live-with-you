#!/usr/bin/env node
/**
 * 场景背景试点出图：上传源图 → 走 dev 中间件 /api/comfy/draw（官方 Qwen 编辑线）→ 存 PNG。
 *
 *   node tools/draw-scene.mjs --source public/assets/scenes/home.webp \
 *     --prompt "同一构图，改成温暖动漫插画风……" \
 *     --out tools/out/lobby-world/home-anime.png [--seed 123]
 *
 * 只输出到 tools/out/（gitignore），不写 public/assets；过目通过后再人工替换。
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const source = arg('source');
const prompt = arg('prompt');
const out = arg('out');
const seed = arg('seed');
const base = arg('base', 'http://127.0.0.1:5199');

if (!source || !prompt || !out) {
  console.error('用法: node tools/draw-scene.mjs --source <图> --prompt "<词>" --out <png> [--seed n] [--base url]');
  process.exit(2);
}
if (!fs.existsSync(source)) {
  console.error('源图不存在: ' + source);
  process.exit(2);
}

// 1) 上传源图到 ComfyUI input
const form = new FormData();
form.append('image', new Blob([fs.readFileSync(source)], { type: 'application/octet-stream' }), path.basename(source));
form.append('overwrite', 'true');
const upRes = await fetch('http://127.0.0.1:8188/upload/image', { method: 'POST', body: form });
if (!upRes.ok) {
  console.error('上传失败:', upRes.status, await upRes.text());
  process.exit(1);
}
const up = await upRes.json();
const remoteName = up.subfolder ? `${up.name} [${up.subfolder}]` : up.name;
console.log('uploaded →', remoteName);

// 2) 走官方 Qwen 编辑线
console.log('drawing… (约 2–4 分钟)');
const t0 = Date.now();
const res = await fetch(`${base}/api/comfy/draw`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, source: remoteName, ...(seed ? { seed: Number(seed) } : {}) }),
});
const payload = await res.json().catch(() => ({}));
if (!res.ok || !payload?.ok || !payload?.image) {
  console.error('出图失败:', payload?.error || `HTTP ${res.status}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(payload.image.split(',')[1], 'base64'));
console.log(`saved ${out}  ${(Date.now() - t0) / 1000}s`);
