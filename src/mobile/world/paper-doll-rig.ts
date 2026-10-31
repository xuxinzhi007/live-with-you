/**
 * V6 · 边缘连通域洪水抠图 + 角色换装纸偶骨骼锚点系统 (Paper-Doll Rig & Cutout Engine)
 *
 * 解决两大核心问题：
 * 1. 【自动透明抠图】：把 ComfyUI 生成的带白底/浅色底的角色立绘与配饰图，通过四边连通域洪水填充（BFS Flood-Fill）
 *    + 边缘 1px 消白边 + 柔和羽化，实时转换为 100% 透明底的 PNG DataURL（角色内部的白色衬衫/白袜子因为被轮廓线包围，完好保留！）。
 * 2. 【纸偶骨骼锚点与手动微调（Paper-Doll Rig）】：定义头饰（hairAcc）、手持物（handheld）、香氛光环（aura）
 *    在雯宝身体上的默认骨骼挂载点（x%, y%, scale, rotate, zIndex），并支持玩家手动拖拽/滑块调整穿戴位置和大小！
 */
import type { WardrobeSlot } from "./nikki-wardrobe.ts";

export interface RigPlacement {
  /** 相对角色立绘容器宽度的水平中心百分比 (-50 ~ +50) */
  dx: number;
  /** 相对角色立绘容器高度的垂直百分比 (-50 ~ +50) */
  dy: number;
  /** 缩放倍率 (0.4 ~ 2.0) */
  scale: number;
  /** 旋转角度 (-45 ~ +45 度) */
  rotate: number;
}

export type RigOverrideMap = Record<string, RigPlacement>;

/** 每个可穿戴槽位在雯宝 Q 版立绘上的默认骨骼锚点（头顶、右手边、身后光环） */
export const DEFAULT_SLOT_RIG: Record<Exclude<WardrobeSlot, "dress" | "memoryCard">, RigPlacement> = {
  hairAcc:  { dx: 2,   dy: -31, scale: 0.95, rotate: -4 },
  handheld: { dx: 24,  dy: 14,  scale: 0.92, rotate: 6 },
  aura:     { dx: -22, dy: -16, scale: 1.05, rotate: 0 },
};

/** 针对特定单品的精细默认骨骼对位微调 */
export const ITEM_DEFAULT_RIG: Record<string, RigPlacement> = {
  "hair-daisy-clip":        { dx: 13,  dy: -27, scale: 0.72, rotate: 10 },
  "hair-lace-ribbon":       { dx: 0,   dy: -32, scale: 0.85, rotate: 0 },
  "hair-plush-bunny":       { dx: 0,   dy: -36, scale: 0.96, rotate: 0 },
  "hair-whale-beret":       { dx: 4,   dy: -34, scale: 0.92, rotate: 8 },
  "hair-pearl-tiara":       { dx: 0,   dy: -34, scale: 0.88, rotate: 0 },
  "hair-sunflower-hat":     { dx: 0,   dy: -35, scale: 1.08, rotate: -3 },

  "hand-teacup":            { dx: 23,  dy: 12,  scale: 0.78, rotate: 0 },
  "hand-cookie-basket":     { dx: 25,  dy: 18,  scale: 0.88, rotate: 5 },
  "hand-sunflower-bouquet": { dx: 22,  dy: 14,  scale: 0.95, rotate: -8 },
  "hand-music-box":         { dx: 24,  dy: 15,  scale: 0.84, rotate: 4 },
  "hand-whale-globe":       { dx: 24,  dy: 12,  scale: 0.86, rotate: 0 },
  "hand-pocket-watch":      { dx: -23, dy: 14,  scale: 0.78, rotate: -10 },

  "aura-morning-breeze":    { dx: -24, dy: -18, scale: 0.92, rotate: -6 },
  "aura-honey-amber":       { dx: -24, dy: -14, scale: 0.92, rotate: 0 },
  "aura-rose-petals":       { dx: 24,  dy: -20, scale: 0.98, rotate: 8 },
  "aura-ocean-bubbles":     { dx: -23, dy: -20, scale: 0.96, rotate: 0 },
  "aura-starlight-firefly": { dx: 23,  dy: -22, scale: 1.02, rotate: 0 },
};

export function getRigPlacement(
  itemId: string,
  slot: Exclude<WardrobeSlot, "dress" | "memoryCard">,
  overrides: RigOverrideMap = {},
): RigPlacement {
  if (overrides[itemId]) return overrides[itemId];
  if (ITEM_DEFAULT_RIG[itemId]) return ITEM_DEFAULT_RIG[itemId];
  return DEFAULT_SLOT_RIG[slot];
}

export function clampRigPlacement(input: Partial<RigPlacement>, fallback: RigPlacement): RigPlacement {
  const num = (v: unknown, def: number, lo: number, hi: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def;
  return {
    dx: num(input.dx, fallback.dx, -48, 48),
    dy: num(input.dy, fallback.dy, -48, 48),
    scale: num(input.scale, fallback.scale, 0.35, 2.2),
    rotate: num(input.rotate, fallback.rotate, -60, 60),
  };
}

/* ==================== 浏览器端 Canvas 高精度四边连通洪水抠图引擎 ==================== */

const CUTOUT_CACHE = new Map<string, Promise<string>>();

/**
 * 将任意图片进行四边连通域洪水填充抠图（Border-Connected Flood-Fill Alpha Matting）：
 * - 若原图本身已是透明底（如 `assets/characters/original/idle.webp`），直接原样返回；
 * - 若原图是 ComfyUI 生成的实心底图，自动采样四周边框主背景色，从四周向内 BFS 抠除背景，
 *   保留被轮廓线包裹的角色主体与白色衣物，并对边缘做 1px 消白边柔化。
 */
export function loadCutoutImage(src: string, mode: "character" | "accessory" = "character"): Promise<string> {
  const cacheKey = `${mode}:${src}`;
  const hit = CUTOUT_CACHE.get(cacheKey);
  if (hit) return hit;

  const task = new Promise<string>((resolve) => {
    if (typeof document === "undefined" || typeof Image === "undefined") {
      resolve(src);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(src);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // 1. 检查四个角是否已经是透明像素（原图自带透明通道则无需再抠）
        const cornerIndices = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
        const alreadyTransparent = cornerIndices.every((idx) => data[idx + 3] < 20);
        if (alreadyTransparent) {
          resolve(src);
          return;
        }

        // 2. 采样四周边框像素的平均/中位背景色
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let bCount = 0;
        for (let x = 0; x < w; x += 4) {
          const topIdx = x * 4;
          const botIdx = ((h - 1) * w + x) * 4;
          rSum += data[topIdx] + data[botIdx];
          gSum += data[topIdx + 1] + data[botIdx + 1];
          bSum += data[topIdx + 2] + data[botIdx + 2];
          bCount += 2;
        }
        const bgR = rSum / bCount;
        const bgG = gSum / bCount;
        const bgB = bSum / bCount;

        // 3. 四边种子 BFS 洪水填充抠除连通背景
        const total = w * h;
        const visited = new Uint8Array(total);
        const isBg = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        const pushSeed = (x: number, y: number) => {
          const pos = y * w + x;
          if (!visited[pos]) {
            visited[pos] = 1;
            queue[tail++] = pos;
          }
        };

        for (let x = 0; x < w; x++) {
          pushSeed(x, 0);
          pushSeed(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
          pushSeed(0, y);
          pushSeed(w - 1, y);
        }

        const globalTolSq = mode === "accessory" ? 68 * 68 : 56 * 56;
        const stepTolSq = mode === "accessory" ? 28 * 28 : 22 * 22;

        while (head < tail) {
          const cur = queue[head++];
          isBg[cur] = 1;
          const cx = cur % w;
          const cy = (cur - cx) / w;
          const cIdx = cur * 4;
          const cr = data[cIdx];
          const cg = data[cIdx + 1];
          const cb = data[cIdx + 2];

          const neighbors = [
            cy > 0 ? cur - w : -1,
            cy < h - 1 ? cur + w : -1,
            cx > 0 ? cur - 1 : -1,
            cx < w - 1 ? cur + 1 : -1,
          ];

          for (let i = 0; i < 4; i++) {
            const nxt = neighbors[i];
            if (nxt < 0 || visited[nxt]) continue;
            const nIdx = nxt * 4;
            const nr = data[nIdx];
            const ng = data[nIdx + 1];
            const nb = data[nIdx + 2];

            const drStep = nr - cr;
            const dgStep = ng - cg;
            const dbStep = nb - cb;
            const stepDistSq = drStep * drStep + dgStep * dgStep + dbStep * dbStep;

            const drBg = nr - bgR;
            const dgBg = ng - bgG;
            const dbBg = nb - bgB;
            const bgDistSq = drBg * drBg + dgBg * dgBg + dbBg * dbBg;

            const isNearWhite = nr > 234 && ng > 234 && nb > 234;
            if ((stepDistSq <= stepTolSq && bgDistSq <= globalTolSq) || isNearWhite) {
              visited[nxt] = 1;
              queue[tail++] = nxt;
            }
          }
        }

        // 4. 写入透明通道 + 边缘 1px 半透明柔化去白边
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const pos = y * w + x;
            const idx = pos * 4;
            if (isBg[pos]) {
              data[idx + 3] = 0;
            } else {
              // 检查 4 邻域是否有背景像素，若有则做半透明消白边
              const touchBg =
                (y > 0 && isBg[pos - w]) ||
                (y < h - 1 && isBg[pos + w]) ||
                (x > 0 && isBg[pos - 1]) ||
                (x < w - 1 && isBg[pos + 1]);
              if (touchBg) {
                data[idx + 3] = 140;
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // 5. 自动裁剪掉四周多余透明空白，使主体居中对齐
        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 24) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX > minX && maxY > minY) {
          const cw = maxX - minX + 1;
          const ch = maxY - minY + 1;
          const outCanvas = document.createElement("canvas");
          outCanvas.width = cw;
          outCanvas.height = ch;
          const outCtx = outCanvas.getContext("2d");
          if (outCtx) {
            outCtx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
            resolve(outCanvas.toDataURL("image/png"));
            return;
          }
        }

        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });

  CUTOUT_CACHE.set(cacheKey, task);
  return task;
}
