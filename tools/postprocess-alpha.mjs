/**
 * 把纯色背景图转成带 alpha 的 RGBA PNG。
 *
 * 为什么不是运行时抠图：渲染色牢度取决于资产本身。运行时洪水填充遇到渐变背景必坏，
 * 且同一张图要同时当卡面和纸偶部件，两个用途互斥。这里一次性在资产层解决。
 *
 * 算法与运行时那套的区别：不从四边种子做 BFS，而是按
 *   1) 采样四边框主色 -> 2) 按色差阈值生成初始 alpha -> 3) 只保留与边框连通的区域为透明
 *   4) 边缘做一轮 alpha 羽化，避免锯齿
 * 这样背景是渐变纸纹时仍能正确判定，而不是靠"遇到色差就停"。
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = path.resolve(process.env.ALPHA_IN_DIR || "public/assets/nikki");
const TOLERANCE = Number(process.env.ALPHA_TOLERANCE || 34);
const FEATHER = Number(process.env.ALPHA_FEATHER || 1);

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not png");
  let pos = 8;
  let ihdr = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error("no IHDR");
  if (ihdr.bitDepth !== 8 || ihdr.colorType !== 2 || ihdr.interlace !== 0) {
    throw new Error(`unsupported png: depth=${ihdr.bitDepth} colorType=${ihdr.colorType} interlace=${ihdr.interlace}`);
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { width: w, height: h } = ihdr;
  const stride = w * 3;
  const out = Buffer.alloc(w * h * 3);
  let prev = Buffer.alloc(stride);
  let i = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[i++];
    const line = Buffer.from(raw.subarray(i, i + stride));
    i += stride;
    if (filter === 1) for (let x = 3; x < stride; x++) line[x] = (line[x] + line[x - 3]) & 255;
    else if (filter === 2) for (let x = 0; x < stride; x++) line[x] = (line[x] + prev[x]) & 255;
    else if (filter === 3)
      for (let x = 0; x < stride; x++) {
        const a = x >= 3 ? line[x - 3] : 0;
        line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255;
      }
    else if (filter === 4)
      for (let x = 0; x < stride; x++) {
        const a = x >= 3 ? line[x - 3] : 0;
        const b = prev[x];
        const c = x >= 3 ? prev[x - 3] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    line.copy(out, y * stride);
    prev = line;
  }
  return { width: w, height: h, rgb: out };
}

function encodeRgbaPng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const chunks = [];
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  chunks.push(chunk("IHDR", ihdr));
  chunks.push(chunk("IDAT", idat));
  chunks.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

// 采样四边框像素做主色参考；背景可能是渐变，所以取均值 + 允许较大容差
function borderColor(rgb, w, h) {
  let r = 0, g = 0, b = 0, n = 0;
  const add = (x, y) => {
    const o = (y * w + x) * 3;
    r += rgb[o]; g += rgb[o + 1]; b += rgb[o + 2]; n++;
  };
  for (let x = 0; x < w; x += 2) { add(x, 0); add(x, h - 1); }
  for (let y = 0; y < h; y += 2) { add(0, y); add(w - 1, y); }
  return { r: r / n, g: g / n, b: b / n };
}

function buildAlpha(rgb, w, h, bg) {
  const size = w * h;
  const near = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const o = i * 3;
    const d = Math.max(
      Math.abs(rgb[o] - bg.r),
      Math.abs(rgb[o + 1] - bg.g),
      Math.abs(rgb[o + 2] - bg.b),
    );
    near[i] = d <= TOLERANCE ? 1 : 0;
  }
  // 四边连通洪水填充：只把连着画布边缘的背景变透明，保留被轮廓包住的白色主体
  const alpha = new Uint8Array(size).fill(255);
  const stack = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (near[i] && alpha[i] === 255) { alpha[i] = 0; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // 羽化：对半透明边界做一轮 3x3 均值，消锯齿
  if (FEATHER > 0) {
    const soft = Uint8Array.from(alpha);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (alpha[i] === 0 || alpha[i] === 255) continue;
        let s = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) s += alpha[i + dy * w + dx];
        soft[i] = Math.round(s / 9);
      }
    }
    // 边缘一圈：透明像素若邻接不透明，给部分 alpha
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (alpha[i] !== 0) continue;
        let opaque = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if (alpha[i + dy * w + dx] === 255) opaque++;
        if (opaque > 0) soft[i] = 255 - Math.round((opaque / 8) * 160);
      }
    }
    return soft;
  }
  return alpha;
}

async function processOne(file) {
  const buf = await readFile(path.join(ROOT, file));
  const { width, height, rgb } = decodePng(buf);
  const bg = borderColor(rgb, width, height);
  const alpha = buildAlpha(rgb, width, height, bg);
  const rgba = Buffer.alloc(width * height * 4);
  let transparent = 0;
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = alpha[i];
    if (alpha[i] < 8) transparent++;
  }
  const out = encodeRgbaPng(width, height, rgba);
  await writeFile(path.join(ROOT, file), out);
  return {
    file,
    dims: `${width}x${height}`,
    transparentPct: ((transparent / (width * height)) * 100).toFixed(1) + "%",
    beforeKB: (buf.length / 1024).toFixed(0),
    afterKB: (out.length / 1024).toFixed(0),
  };
}

const files = (await readdir(ROOT)).filter((f) => f.toLowerCase().endsWith(".png")).sort();
console.log(`处理 ${files.length} 张资产 (tolerance=${TOLERANCE}, feather=${FEATHER})`);
console.log("文件".padEnd(34), "尺寸".padEnd(11), "透明占比".padEnd(10), "体积变化");
console.log("-".repeat(76));
let suspicious = 0;
for (const f of files) {
  try {
    const r = await processOne(f);
    const pct = parseFloat(r.transparentPct);
    const flag = pct < 5 || pct > 95 ? "  <-- 异常，检查背景" : "";
    if (flag) suspicious++;
    console.log(r.file.padEnd(34), r.dims.padEnd(11), r.transparentPct.padEnd(10), `${r.beforeKB}KB -> ${r.afterKB}KB${flag}`);
  } catch (e) {
    console.error(f.padEnd(34), "跳过:", e.message);
    suspicious++;
  }
}
console.log("");
if (suspicious > 0) {
  console.error(`FAIL: ${suspicious} 张需要人工确认`);
  process.exit(1);
}
console.log("PASS: 全部转换完成");
