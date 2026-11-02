#!/usr/bin/env node
/**
 * 下载 Live2D Cubism Core（专有文件，不进仓库）。
 *
 * 用法：
 *   node tools/fetch-cubism-core.mjs          # 已存在则跳过，缺失则下载
 *   node tools/fetch-cubism-core.mjs --force  # 强制重新下载
 *
 * 跨机器开发：任何机器上跑同一条命令即可，产物在 public/vendor/（gitignore 排除）。
 * 下载失败时会打印手动下载地址与放置路径。
 */
import { mkdir, writeFile, stat, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "public", "vendor");
const OUT_FILE = path.join(OUT_DIR, "live2dcubismcore.min.js");

const URLS = [
  "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js",
  "https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/live2dcubismcore.min.js",
];

const MIN_BYTES = 100 * 1024;
const MARKER = "Live2DCubismCore";

async function isValid(file) {
  if (!existsSync(file)) return false;
  const st = await stat(file);
  if (st.size < MIN_BYTES) return false;
  const head = await readFile(file, "utf8").catch(() => "");
  return head.includes(MARKER);
}

async function fetchOne(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < MIN_BYTES) throw new Error(`too small (${buf.length} bytes)`);
  if (!buf.toString("utf8", 0, 4096).includes(MARKER)) {
    throw new Error("marker not found (file may have changed)");
  }
  return buf;
}

async function main() {
  const force = process.argv.includes("--force");

  if (!force && (await isValid(OUT_FILE))) {
    const st = await stat(OUT_FILE);
    console.log(`SKIP 已存在且有效 ${path.relative(ROOT, OUT_FILE)} (${st.size} bytes)`);
    return 0;
  }

  await mkdir(OUT_DIR, { recursive: true });

  let lastErr = null;
  for (const url of URLS) {
    try {
      const buf = await fetchOne(url);
      await writeFile(OUT_FILE, buf);
      console.log(`OK   下载完成 ${path.relative(ROOT, OUT_FILE)} (${buf.length} bytes)`);
      console.log(`     来源 ${url}`);
      return 0;
    } catch (e) {
      lastErr = e;
      console.warn(`WARN ${url} 失败: ${e.message}`);
    }
  }

  console.error(`
ERROR 无法自动下载 Cubism Core。
  最后错误: ${lastErr?.message}

  手动下载步骤：
    1. 打开 https://www.live2d.com/en/sdk/download/web/
       （或直链 ${URLS[0]}）
    2. 下载 live2dcubismcore.min.js
    3. 放到 ${path.relative(ROOT, OUT_FILE)}

  注意：该文件是 Live2D 专有许可，不要提交进 git。`);
  return 1;
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
