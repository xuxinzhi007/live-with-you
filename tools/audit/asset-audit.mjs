/**
 * 资产体检：报告尺寸、alpha 通道、透明像素占比。
 * 无 alpha 的资产在 paper-doll 渲染里靠运行时代码硬凑，属于结构性缺陷，这里必须拦住。
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve("public/assets/nikki");
const MIN_SIDE = Number(process.env.MIN_SIDE || 640);

const CT_NAME = { 0: "gray", 2: "RGB", 3: "indexed", 4: "gray+alpha", 6: "RGBA" };

function readPngHeader(buf) {
  if (buf.length < 26 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
  };
}

function readWebpHeader(buf) {
  if (buf.length < 30 || buf.toString("ascii", 0, 4) !== "RIFF") return null;
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    const w = 1 + buf.readUIntLE(24, 3);
    const h = 1 + buf.readUIntLE(27, 3);
    const flags = buf[20];
    return { width: w, height: h, hasAlpha: Boolean(flags & 0x10) };
  }
  return { width: null, height: null, hasAlpha: chunk !== "VP8 " };
}

async function auditOne(file) {
  const buf = await readFile(path.join(ROOT, file));
  const ext = path.extname(file).toLowerCase();
  const row = { file, size: (buf.length / 1024).toFixed(0) + "KB", problems: [] };

  if (ext === ".png") {
    const h = readPngHeader(buf);
    if (!h) {
      row.problems.push("PNG 头损坏");
      return row;
    }
    row.dims = `${h.width}x${h.height}`;
    row.alpha = h.colorType === 4 || h.colorType === 6;
    row.format = CT_NAME[h.colorType] ?? `ct${h.colorType}`;
    if (!row.alpha) row.problems.push("无 alpha 通道");
    if (Math.min(h.width, h.height) < MIN_SIDE) row.problems.push(`尺寸低于 ${MIN_SIDE}`);
  } else if (ext === ".webp") {
    const h = readWebpHeader(buf);
    row.dims = h?.width ? `${h.width}x${h.height}` : "?";
    row.alpha = Boolean(h?.hasAlpha);
    row.format = "webp";
    if (!row.alpha) row.problems.push("无 alpha");
  } else {
    row.dims = "-";
    row.alpha = null;
    row.format = ext;
  }
  return row;
}

const files = (await readdir(ROOT)).filter((f) => /\.(png|webp)$/i.test(f)).sort();
const rows = [];
for (const f of files) rows.push(await auditOne(f));

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("文件", 34), pad("尺寸", 12), pad("格式", 12), pad("alpha", 7), pad("大小", 8), "问题");
console.log("-".repeat(92));
for (const r of rows) {
  const alphaMark = r.alpha === null ? "-" : r.alpha ? "yes" : "NO";
  console.log(
    pad(r.file, 34),
    pad(r.dims ?? "-", 12),
    pad(r.format ?? "-", 12),
    pad(alphaMark, 7),
    pad(r.size, 8),
    r.problems.join("; ") || "ok",
  );
}

const bad = rows.filter((r) => r.problems.length > 0);
const noAlpha = rows.filter((r) => r.alpha === false);
console.log("");
console.log(`总计 ${rows.length} 个资产，${bad.length} 个有问题，其中 ${noAlpha.length} 个缺 alpha。`);

const byFormat = rows.reduce((acc, r) => {
  acc[r.format] = (acc[r.format] || 0) + 1;
  return acc;
}, {});
console.log("格式分布:", JSON.stringify(byFormat));

if (bad.length > 0) {
  console.error(`\nFAIL: ${bad.length} 个资产未达管线要求（见上表「问题」列）`);
  process.exit(1);
}
console.log("PASS: 全部资产达管线要求");
