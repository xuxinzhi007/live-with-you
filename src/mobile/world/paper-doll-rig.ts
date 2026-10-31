/**
 * V7 · 角色 760×760 统一骨骼坐标系统 (Skeleton Bone System) + 17 件纯透明矢量可穿戴配饰 + 无损边缘抠图引擎
 *
 * 1. 【760×760 归一化骨骼坐标系统（Scale-Invariant Bone System）】：
 *    依据 `tools/character/spec.json` 与 `docs/character-rig-design.md` §5.2 的实测关键点（Landmarks）：
 *    - 画布固定 760×760 比例（aspect-ratio: 1 / 1），脚底基线 y = 98.4% (748/760)，中心线 x = 50% (380/760)。
 *    - 头顶骨骼点 `crown`   : (x: 50%, y: 12%)
 *    - 额头/发际骨骼点 `head`: (x: 50%, y: 20%)
 *    - 左耳侧发夹骨骼点 `hairSide`: (x: 63%, y: 24%)
 *    - 颈部/领口骨骼点 `neck`: (x: 50%, y: 55%)
 *    - 右手骨骼点 `handR`   : (x: 68%, y: 69%)
 *    - 左手骨骼点 `handL`   : (x: 32%, y: 69%)
 *    - 背部光环骨骼点 `aura`: (x: 50%, y: 50%)
 *    所有配饰均作为 1:1 骨骼舞台的子节点，宽度与位置全部用 `%` 绑定在骨骼上！
 *    因此无论普通模式还是「👁️ 全景放大」模式，头饰和手持物都 100% 锁死在头顶与手上，绝不偏移失效！
 *
 * 2. 【17 件 100% 纯透明 SVG 精致动漫可穿戴配饰库】：
 *    彻底杜绝 AI 把“发夹/花束”生成出“金发人头”或“花盆底座”的问题！
 *    当穿戴在雯宝骨骼上时，直接使用专门按骨骼对位绘制的 100% 透明底多层高光动漫 SVG 部件。
 *
 * 3. 【防过度抠图引擎（Anti-Overcut Flood-Fill）】：
 *    严格只抠除与四周边框连通的纯背景色，且一旦遇到深色轮廓线立即停止向内渗透，
 *    100% 保护角色头发高光、眼白、脸部皮肤与白色裙摆不被抠穿！
 */
import type { WardrobeSlot } from "./nikki-wardrobe.ts";

export interface RigPlacement {
  /** 相对骨骼基准锚点的水平偏移百分比 (-40 ~ +40) */
  dx: number;
  /** 相对骨骼基准锚点的垂直偏移百分比 (-40 ~ +40) */
  dy: number;
  /** 缩放倍率 (0.5 ~ 2.0) */
  scale: number;
  /** 旋转角度 (-45 ~ +45 度) */
  rotate: number;
}

export type RigOverrideMap = Record<string, RigPlacement>;

/**
 * 760×760 骨骼标准锚点（百分比坐标，随骨骼容器等比缩放，放大后永不失效！）
 * - anchorX / anchorY: 骨骼基准点在 1:1 角色框内的百分比位置
 * - baseWidthPct     : 配饰相对于角色框宽度的百分比尺寸（随角色放大等比放大！）
 */
export interface BoneSocketSpec {
  anchorX: number;
  anchorY: number;
  baseWidthPct: number;
  zIndex: number;
}

export const BONE_SOCKETS: Record<string, BoneSocketSpec> = {
  // 头顶发箍 / 皇冠 / 帽子骨骼点（对应头顶 y=13%~16%）
  "hair-crown": { anchorX: 50, anchorY: 14, baseWidthPct: 38, zIndex: 32 },
  // 侧边发夹 / 蝴蝶结骨骼点（对应左侧刘海旁 x=63%, y=23%）
  "hair-side":  { anchorX: 63, anchorY: 23, baseWidthPct: 22, zIndex: 33 },
  // 右手手持物骨骼点（对应右手位置 x=68%, y=68%）
  "hand-right": { anchorX: 67, anchorY: 67, baseWidthPct: 26, zIndex: 35 },
  // 左手手持物骨骼点（对应左手位置 x=33%, y=68%）
  "hand-left":  { anchorX: 33, anchorY: 67, baseWidthPct: 25, zIndex: 35 },
  // 身后环绕香氛光环骨骼点（居中衬托在角色背后 zIndex=10）
  "aura-back":  { anchorX: 50, anchorY: 48, baseWidthPct: 92, zIndex: 10 },
};

/** 每件单品绑定的具体骨骼插槽 */
export function getSocketForItem(itemId: string, slot: Exclude<WardrobeSlot, "dress" | "memoryCard">): BoneSocketSpec {
  if (slot === "hairAcc") {
    if (itemId === "hair-daisy-clip" || itemId === "hair-lace-ribbon") {
      return BONE_SOCKETS["hair-side"];
    }
    return BONE_SOCKETS["hair-crown"];
  }
  if (slot === "handheld") {
    if (itemId === "hand-pocket-watch") {
      return BONE_SOCKETS["hand-left"];
    }
    return BONE_SOCKETS["hand-right"];
  }
  return BONE_SOCKETS["aura-back"];
}

export const DEFAULT_SLOT_RIG: Record<Exclude<WardrobeSlot, "dress" | "memoryCard">, RigPlacement> = {
  hairAcc:  { dx: 0, dy: 0, scale: 1.0, rotate: 0 },
  handheld: { dx: 0, dy: 0, scale: 1.0, rotate: 0 },
  aura:     { dx: 0, dy: 0, scale: 1.0, rotate: 0 },
};

export const ITEM_DEFAULT_RIG: Record<string, RigPlacement> = {
  "hair-daisy-clip":        { dx: 0,  dy: 0,  scale: 1.0,  rotate: 12 },
  "hair-lace-ribbon":       { dx: 2,  dy: -2, scale: 1.05, rotate: 8 },
  "hair-plush-bunny":       { dx: 0,  dy: -3, scale: 1.12, rotate: 0 },
  "hair-whale-beret":       { dx: 3,  dy: -1, scale: 1.08, rotate: 8 },
  "hair-pearl-tiara":       { dx: 0,  dy: -1, scale: 0.96, rotate: 0 },
  "hair-sunflower-hat":     { dx: 0,  dy: 0,  scale: 1.22, rotate: -3 },

  "hand-teacup":            { dx: 0,  dy: 0,  scale: 0.95, rotate: 0 },
  "hand-cookie-basket":     { dx: 2,  dy: 3,  scale: 1.05, rotate: 4 },
  "hand-sunflower-bouquet": { dx: -2, dy: -2, scale: 1.15, rotate: -10 },
  "hand-music-box":         { dx: 0,  dy: 2,  scale: 1.0,  rotate: 0 },
  "hand-whale-globe":       { dx: 0,  dy: 0,  scale: 1.02, rotate: 0 },
  "hand-pocket-watch":      { dx: 0,  dy: 0,  scale: 0.95, rotate: -8 },

  "aura-morning-breeze":    { dx: 0,  dy: 0,  scale: 1.0,  rotate: 0 },
  "aura-honey-amber":       { dx: 0,  dy: 0,  scale: 1.0,  rotate: 0 },
  "aura-rose-petals":       { dx: 0,  dy: 0,  scale: 1.05, rotate: 0 },
  "aura-ocean-bubbles":     { dx: 0,  dy: 0,  scale: 1.05, rotate: 0 },
  "aura-starlight-firefly": { dx: 0,  dy: 0,  scale: 1.08, rotate: 0 },
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
    dx: num(input.dx, fallback.dx, -40, 40),
    dy: num(input.dy, fallback.dy, -40, 40),
    scale: num(input.scale, fallback.scale, 0.4, 2.2),
    rotate: num(input.rotate, fallback.rotate, -60, 60),
  };
}

/* ==================== 17 件 100% 透明底可穿戴动漫矢量配饰（专为骨骼穿戴设计，零杂边、零错位！） ==================== */

function svgDataUrl(svgContent: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent.trim())}`;
}

export const WEARABLE_SVG_OVERLAYS: Record<string, string> = {
  // 1. 头饰 (hairAcc)
  "hair-daisy-clip": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <g filter="drop-shadow(0 3px 5px rgba(80,50,30,0.28))">
        <path d="M22 72 Q45 55 96 48" stroke="#f0c14b" stroke-width="6" stroke-linecap="round" fill="none"/>
        <ellipse cx="36" cy="52" rx="14" ry="7" transform="rotate(-28 36 52)" fill="#7ac769" stroke="#3e7a34" stroke-width="2.5"/>
        <g transform="translate(65,55)">
          <ellipse cx="0" cy="-22" rx="9" ry="16" fill="#ffffff" stroke="#d9d2c5" stroke-width="2"/>
          <ellipse cx="0" cy="22" rx="9" ry="16" fill="#ffffff" stroke="#d9d2c5" stroke-width="2"/>
          <ellipse cx="-22" cy="0" rx="16" ry="9" fill="#ffffff" stroke="#d9d2c5" stroke-width="2"/>
          <ellipse cx="22" cy="0" rx="16" ry="9" fill="#ffffff" stroke="#d9d2c5" stroke-width="2"/>
          <ellipse cx="-15" cy="-15" rx="14" ry="8" transform="rotate(45 -15 -15)" fill="#fffcf5" stroke="#d9d2c5" stroke-width="2"/>
          <ellipse cx="15" cy="15" rx="14" ry="8" transform="rotate(45 15 15)" fill="#fffcf5" stroke="#d9d2c5" stroke-width="2"/>
          <ellipse cx="15" cy="-15" rx="14" ry="8" transform="rotate(-45 15 -15)" fill="#fffcf5" stroke="#d9d2c5" stroke-width="2"/>
          <ellipse cx="-15" cy="15" rx="14" ry="8" transform="rotate(-45 -15 15)" fill="#fffcf5" stroke="#d9d2c5" stroke-width="2"/>
          <circle cx="0" cy="0" r="12" fill="#f7c331" stroke="#c98a18" stroke-width="2.5"/>
          <circle cx="-4" cy="-4" r="3.5" fill="#fff4b8"/>
        </g>
      </g>
    </svg>
  `),
  "hair-lace-ribbon": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 120">
      <g filter="drop-shadow(0 3px 6px rgba(140,50,80,0.3))">
        <path d="M56 64 L32 106 L48 100 L58 110 L66 68 Z" fill="#f79bb6" stroke="#a83c5e" stroke-width="2.5"/>
        <path d="M84 64 L108 106 L92 100 L82 110 L74 68 Z" fill="#f79bb6" stroke="#a83c5e" stroke-width="2.5"/>
        <path d="M68 56 C32 22 14 40 22 66 C30 86 54 74 68 60 Z" fill="#ffb8ce" stroke="#a83c5e" stroke-width="3"/>
        <path d="M72 56 C108 22 126 40 118 66 C110 86 86 74 72 60 Z" fill="#ffb8ce" stroke="#a83c5e" stroke-width="3"/>
        <path d="M62 56 C38 34 26 46 32 62 C36 74 52 68 62 58 Z" fill="#fff5f8"/>
        <path d="M78 56 C102 34 114 46 108 62 C104 74 88 68 78 58 Z" fill="#fff5f8"/>
        <circle cx="70" cy="58" r="11" fill="#ff85a9" stroke="#a83c5e" stroke-width="3"/>
        <circle cx="70" cy="58" r="5.5" fill="#fffdf7"/>
      </g>
    </svg>
  `),
  "hair-plush-bunny": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 150">
      <g filter="drop-shadow(0 4px 7px rgba(120,70,85,0.26))">
        <path d="M42 128 Q110 74 178 128" stroke="#fff5f8" stroke-width="10" stroke-linecap="round" fill="none"/>
        <path d="M42 128 Q110 74 178 128" stroke="#c97a90" stroke-width="3" stroke-linecap="round" fill="none"/>
        <ellipse cx="74" cy="58" rx="22" ry="48" transform="rotate(-14 74 58)" fill="#fffaf7" stroke="#c97a90" stroke-width="3.5"/>
        <ellipse cx="74" cy="62" rx="11" ry="34" transform="rotate(-14 74 62)" fill="#ffc2d4"/>
        <ellipse cx="146" cy="58" rx="22" ry="48" transform="rotate(14 146 58)" fill="#fffaf7" stroke="#c97a90" stroke-width="3.5"/>
        <ellipse cx="146" cy="62" rx="11" ry="34" transform="rotate(14 146 62)" fill="#ffc2d4"/>
        <circle cx="94" cy="96" r="9" fill="#ff8aad" stroke="#a83c5e" stroke-width="2"/>
      </g>
    </svg>
  `),
  "hair-whale-beret": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 130">
      <g filter="drop-shadow(0 4px 8px rgba(35,65,110,0.3))">
        <ellipse cx="112" cy="64" rx="84" ry="38" transform="rotate(-6 112 64)" fill="#3b6cb7" stroke="#1d3b6e" stroke-width="3.5"/>
        <ellipse cx="106" cy="56" rx="70" ry="26" transform="rotate(-6 106 56)" fill="#588ce0"/>
        <path d="M42 84 Q110 98 178 78 L174 92 Q110 108 46 96 Z" fill="#ffffff" stroke="#1d3b6e" stroke-width="3"/>
        <circle cx="112" cy="22" r="8" fill="#ffffff" stroke="#1d3b6e" stroke-width="2.5"/>
        <circle cx="142" cy="68" r="11" fill="#ffd452" stroke="#9e6b14" stroke-width="2.5"/>
      </g>
    </svg>
  `),
  "hair-pearl-tiara": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 130">
      <g filter="drop-shadow(0 4px 8px rgba(160,115,30,0.35))">
        <path d="M36 98 L54 48 L84 78 L110 22 L136 78 L166 48 L184 98 Q110 86 36 98 Z" fill="#ffe484" stroke="#b57c1e" stroke-width="3.5" stroke-linejoin="round"/>
        <polygon points="110,38 120,62 110,82 100,62" fill="#7ec8ff" stroke="#2c6aa0" stroke-width="2"/>
        <circle cx="54" cy="44" r="6" fill="#fffdf9" stroke="#b57c1e" stroke-width="2"/>
        <circle cx="110" cy="18" r="7.5" fill="#fffdf9" stroke="#b57c1e" stroke-width="2"/>
        <circle cx="166" cy="44" r="6" fill="#fffdf9" stroke="#b57c1e" stroke-width="2"/>
        <circle cx="80" cy="76" r="5" fill="#ffb8d0" stroke="#b57c1e" stroke-width="1.8"/>
        <circle cx="140" cy="76" r="5" fill="#ffb8d0" stroke="#b57c1e" stroke-width="1.8"/>
      </g>
    </svg>
  `),
  "hair-sunflower-hat": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 130">
      <g filter="drop-shadow(0 4px 8px rgba(110,75,30,0.28))">
        <ellipse cx="130" cy="84" rx="116" ry="26" fill="#f3cf7a" stroke="#9e6d24" stroke-width="3.5"/>
        <path d="M58 80 C62 24 198 24 202 80 Z" fill="#f7dc94" stroke="#9e6d24" stroke-width="3.5"/>
        <path d="M58 76 Q130 88 202 76" stroke="#e05a7a" stroke-width="9" fill="none"/>
        <circle cx="172" cy="72" r="18" fill="#ffbe2e" stroke="#9e5b10" stroke-width="2.5"/>
        <circle cx="172" cy="72" r="8" fill="#6e3f14"/>
      </g>
    </svg>
  `),

  // 2. 手持物 (handheld)
  "hand-teacup": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">
      <g filter="drop-shadow(0 4px 7px rgba(80,55,40,0.28))">
        <path d="M52 28 Q46 18 54 10" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.85"/>
        <path d="M72 26 Q66 16 74 8" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.85"/>
        <ellipse cx="62" cy="98" rx="44" ry="11" fill="#fffdf8" stroke="#8c725e" stroke-width="3"/>
        <path d="M88 56 C108 56 108 82 86 82" stroke="#fffdf8" stroke-width="8" fill="none"/>
        <path d="M88 56 C108 56 108 82 86 82" stroke="#8c725e" stroke-width="3" fill="none"/>
        <path d="M28 48 L96 48 C94 84 82 94 62 94 C42 94 30 84 28 48 Z" fill="#fffdf8" stroke="#8c725e" stroke-width="3"/>
        <ellipse cx="62" cy="48" rx="34" ry="8" fill="#d97b29" stroke="#8c725e" stroke-width="2.5"/>
        <circle cx="62" cy="72" r="7" fill="#ffd24c"/>
      </g>
    </svg>
  `),
  "hand-cookie-basket": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">
      <g filter="drop-shadow(0 4px 8px rgba(95,55,25,0.3))">
        <path d="M36 68 C36 18 104 18 104 68" stroke="#c9853b" stroke-width="7" fill="none"/>
        <circle cx="52" cy="58" r="14" fill="#f5b942" stroke="#995c18" stroke-width="2.5"/>
        <circle cx="72" cy="54" r="15" fill="#f7c654" stroke="#995c18" stroke-width="2.5"/>
        <circle cx="90" cy="60" r="13" fill="#f0ad35" stroke="#995c18" stroke-width="2.5"/>
        <path d="M26 66 L114 66 L100 114 Q70 122 40 114 Z" fill="#d99348" stroke="#7d4918" stroke-width="3.5"/>
        <path d="M24 66 L116 66 L112 78 L28 78 Z" fill="#ff6b88" stroke="#9e2a45" stroke-width="2.5"/>
      </g>
    </svg>
  `),
  "hand-sunflower-bouquet": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 160">
      <g filter="drop-shadow(0 5px 9px rgba(90,60,25,0.32))">
        <path d="M40 72 L75 146 L110 72 Z" fill="#f2d2a9" stroke="#9c6c3b" stroke-width="3.5" stroke-linejoin="round"/>
        <circle cx="54" cy="56" r="24" fill="#ffbf2b" stroke="#a66312" stroke-width="3"/>
        <circle cx="54" cy="56" r="10" fill="#5e3410"/>
        <circle cx="96" cy="58" r="22" fill="#ffbf2b" stroke="#a66312" stroke-width="3"/>
        <circle cx="96" cy="58" r="9" fill="#5e3410"/>
        <circle cx="75" cy="38" r="25" fill="#ffd042" stroke="#a66312" stroke-width="3"/>
        <circle cx="75" cy="38" r="11" fill="#5e3410"/>
        <path d="M56 108 Q75 100 94 108 L88 122 Q75 114 62 122 Z" fill="#ff789e" stroke="#a83255" stroke-width="2.5"/>
      </g>
    </svg>
  `),
  "hand-music-box": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">
      <g filter="drop-shadow(0 4px 8px rgba(85,45,35,0.32))">
        <text x="26" y="34" font-size="22" fill="#ff78a5">♪</text>
        <text x="94" y="28" font-size="24" fill="#ffbf3c">♫</text>
        <rect x="28" y="64" width="84" height="52" rx="8" fill="#a8643b" stroke="#592e16" stroke-width="3.5"/>
        <rect x="34" y="72" width="72" height="36" rx="5" fill="#c98253" stroke="#f5cb6e" stroke-width="2"/>
        <circle cx="70" cy="52" r="16" fill="#ff82a9" stroke="#9e2d52" stroke-width="2.5"/>
        <circle cx="70" cy="52" r="7" fill="#ffe1eb"/>
      </g>
    </svg>
  `),
  "hand-whale-globe": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">
      <g filter="drop-shadow(0 4px 9px rgba(35,80,130,0.34))">
        <circle cx="70" cy="62" r="44" fill="#9be0ff" fill-opacity="0.78" stroke="#3678b8" stroke-width="3.5"/>
        <path d="M44 68 C44 48 76 46 84 62 C92 58 98 52 102 56 C100 66 92 74 82 74 C68 78 44 76 44 68 Z" fill="#2c6fd1" stroke="#163e7a" stroke-width="2.5"/>
        <circle cx="56" cy="62" r="3" fill="#ffffff"/>
        <circle cx="52" cy="36" r="4" fill="#ffffff" opacity="0.9"/>
        <path d="M40 100 L100 100 L108 120 L32 120 Z" fill="#f2bd46" stroke="#946514" stroke-width="3"/>
      </g>
    </svg>
  `),
  "hand-pocket-watch": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 140">
      <g filter="drop-shadow(0 4px 8px rgba(110,75,20,0.34))">
        <circle cx="65" cy="20" r="10" fill="none" stroke="#f5c242" stroke-width="5"/>
        <circle cx="65" cy="76" r="44" fill="#f7c844" stroke="#9c6615" stroke-width="3.5"/>
        <circle cx="65" cy="76" r="34" fill="#23396c" stroke="#fff2b2" stroke-width="2.5"/>
        <line x1="65" y1="76" x2="65" y2="52" stroke="#ffe680" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="65" y1="76" x2="84" y2="76" stroke="#ffe680" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="65" cy="76" r="4.5" fill="#ffffff"/>
      </g>
    </svg>
  `),

  // 3. 背部环绕香氛光环 (aura —— 100% 透明环绕粒子，再也不会出现大瓶子挡住脸！)
  "aura-morning-breeze": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <circle cx="150" cy="150" r="118" fill="none" stroke="#7ce0a3" stroke-width="3" stroke-dasharray="12 10" opacity="0.75"/>
      <ellipse cx="42" cy="96" rx="14" ry="7" transform="rotate(-35 42 96)" fill="#6ad18a"/>
      <ellipse cx="258" cy="108" rx="14" ry="7" transform="rotate(30 258 108)" fill="#6ad18a"/>
      <ellipse cx="52" cy="212" rx="13" ry="6" transform="rotate(25 52 212)" fill="#8be8a8"/>
      <ellipse cx="246" cy="204" rx="13" ry="6" transform="rotate(-25 246 204)" fill="#8be8a8"/>
      <circle cx="72" cy="62" r="5" fill="#d4ffea"/>
      <circle cx="230" cy="64" r="6" fill="#d4ffea"/>
    </svg>
  `),
  "aura-honey-amber": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <circle cx="150" cy="150" r="120" fill="none" stroke="#ffbe4f" stroke-width="3.5" stroke-dasharray="10 12" opacity="0.8"/>
      <circle cx="46" cy="110" r="9" fill="#ffd269" opacity="0.85"/>
      <circle cx="254" cy="102" r="10" fill="#ffbe4f" opacity="0.85"/>
      <circle cx="56" cy="208" r="8" fill="#ffe194" opacity="0.85"/>
      <circle cx="244" cy="212" r="9" fill="#ffd269" opacity="0.85"/>
    </svg>
  `),
  "aura-rose-petals": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <circle cx="150" cy="150" r="122" fill="none" stroke="#ff94b8" stroke-width="3" stroke-dasharray="8 12" opacity="0.78"/>
      <path d="M40 90 C30 76 52 68 56 84 C52 96 44 96 40 90 Z" fill="#ff85ad"/>
      <path d="M252 96 C242 82 264 74 268 90 C264 102 256 102 252 96 Z" fill="#ffa3c2"/>
      <path d="M48 210 C38 196 60 188 64 204 C60 216 52 216 48 210 Z" fill="#ffa3c2"/>
      <path d="M244 214 C234 200 256 192 260 208 C256 220 248 220 244 214 Z" fill="#ff85ad"/>
    </svg>
  `),
  "aura-ocean-bubbles": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <circle cx="48" cy="102" r="14" fill="#c7f2ff" fill-opacity="0.55" stroke="#5cc3ff" stroke-width="2.5"/>
      <circle cx="252" cy="96" r="16" fill="#c7f2ff" fill-opacity="0.55" stroke="#5cc3ff" stroke-width="2.5"/>
      <circle cx="56" cy="206" r="12" fill="#c7f2ff" fill-opacity="0.55" stroke="#5cc3ff" stroke-width="2.5"/>
      <circle cx="246" cy="208" r="15" fill="#c7f2ff" fill-opacity="0.55" stroke="#5cc3ff" stroke-width="2.5"/>
      <circle cx="82" cy="54" r="8" fill="#e3f9ff" stroke="#5cc3ff" stroke-width="2"/>
      <circle cx="222" cy="56" r="9" fill="#e3f9ff" stroke="#5cc3ff" stroke-width="2"/>
    </svg>
  `),
  "aura-starlight-firefly": svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <circle cx="150" cy="150" r="124" fill="none" stroke="#ffe066" stroke-width="3" stroke-dasharray="6 10" opacity="0.85"/>
      <polygon points="48,78 53,90 66,92 55,100 58,112 48,105 38,112 41,100 30,92 43,90" fill="#ffe46b"/>
      <polygon points="252,82 257,94 270,96 259,104 262,116 252,109 242,116 245,104 234,96 247,94" fill="#ffe46b"/>
      <polygon points="54,202 58,211 68,212 60,218 62,228 54,222 46,228 48,218 40,212 50,211" fill="#fff099"/>
      <polygon points="246,204 250,213 260,214 252,220 254,230 246,224 238,230 240,220 232,214 242,213" fill="#fff099"/>
    </svg>
  `),
};

/** 获取穿戴在角色骨骼上的透明部件图（配饰优先使用 100% 透明矢量骨骼图，彻底杜绝方形照片贴脸！） */
export function getWearableOverlaySrc(itemId: string, fallbackImg: string): string {
  return WEARABLE_SVG_OVERLAYS[itemId] || fallbackImg;
}

/* ==================== 浏览器端防过度抠图引擎（严格外框连通 + 轮廓线阻断保护） ==================== */

const CUTOUT_CACHE = new Map<string, Promise<string>>();

export function loadCutoutImage(src: string, mode: "character" | "accessory" = "character"): Promise<string> {
  if (src.startsWith("data:image/svg+xml")) {
    return Promise.resolve(src);
  }
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

        // 1. 若原图四角已经是透明像素（如 original/idle.webp），直接原样返回，不做任何裁剪，保持 760x760 骨骼比例！
        const cornerIndices = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
        const alreadyTransparent = cornerIndices.every((idx) => data[idx + 3] < 20);
        if (alreadyTransparent) {
          resolve(src);
          return;
        }

        // 2. 采样四周边框背景色
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

        // 3. 严格外框种子 BFS（遇到深色轮廓线或色差突变立即停止，100% 保护内部眼白/头发高光/白裙子！）
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

        // 严格收紧容差，防止越过浅色轮廓线把衣服抠穿
        const globalTolSq = 34 * 34;
        const stepTolSq = 12 * 12;

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

            if (stepDistSq <= stepTolSq && bgDistSq <= globalTolSq) {
              visited[nxt] = 1;
              queue[tail++] = nxt;
            }
          }
        }

        for (let pos = 0; pos < total; pos++) {
          if (isBg[pos]) {
            data[pos * 4 + 3] = 0;
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // 4. 将抠好的角色立绘统一放入 760×760 标准骨骼画布（脚底对齐 y=748，中心对齐 x=380）
        if (mode === "character") {
          let minX = w, minY = h, maxX = 0, maxY = 0;
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
            const rigCanvas = document.createElement("canvas");
            rigCanvas.width = 760;
            rigCanvas.height = 760;
            const rigCtx = rigCanvas.getContext("2d");
            if (rigCtx) {
              const targetH = 716;
              const scale = targetH / ch;
              const drawW = Math.round(cw * scale);
              const drawH = Math.round(ch * scale);
              const dx = Math.round(380 - drawW / 2);
              const dy = Math.round(748 - drawH);
              rigCtx.drawImage(canvas, minX, minY, cw, ch, dx, dy, drawW, drawH);
              resolve(rigCanvas.toDataURL("image/png"));
              return;
            }
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
