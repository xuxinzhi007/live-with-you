// 竖屏宽场景世界坐标：设计稿 0–100 相对坐标 → 世界坐标
// 纵向 1:1（100 = 一个屏幕高）；横向拉伸到 WORLD_W（默认 1.6 屏），
// 让房间「比一屏更大」，可左右拖动 + 镜头跟随。

export const WORLD_W = 160;
export const WORLD_H = 100;

/** 设计稿 left/w（0–100，相对屏宽）→ 世界横向坐标/宽度 */
export function designX(value: number): number {
  return (value * WORLD_W) / 100;
}
export const designW = designX;

/** 设计稿 bottom/h（0–100，相对屏高）→ 世界纵向坐标/高度（1:1） */
export function designY(value: number): number {
  return (value * WORLD_H) / 100;
}
export const designH = designY;

export interface GradientStop {
  color: string; // CSS 颜色（#rrggbb）
  at: number; // 0..1，顶部起算
}

/**
 * 解析 CSS `linear-gradient(180deg, #hex pct%[, #hex pct% pct%]...)`。
 * 硬停（两个位置 `#c 72% 100%`）展开为两个同色相邻色标，直接喂给
 * Canvas 2D 的 addColorStop，语义与 CSS 一致。
 */
export function parseVerticalGradient(css: string): GradientStop[] {
  const open = css.indexOf("(");
  const close = css.lastIndexOf(")");
  const inner = open >= 0 && close > open ? css.slice(open + 1, close) : css;
  // 去掉方向段（"180deg," 或 "to bottom,"）
  const comma = inner.indexOf(",");
  const body = comma >= 0 ? inner.slice(comma + 1) : inner;

  const stops: GradientStop[] = [];
  for (const raw of body.split(",")) {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const color = tokens[0];
    const positions = tokens.slice(1).map((token) => parseFloat(token) / 100);
    if (positions.length === 0) {
      stops.push({ color, at: 0 });
      continue;
    }
    stops.push({ color, at: positions[0] });
    if (positions.length >= 2) {
      // 硬停：从 p1 到 p2 保持同色
      stops.push({ color, at: positions[1] });
    }
  }
  return stops;
}
