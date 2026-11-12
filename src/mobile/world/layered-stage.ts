/**
 * 第一期分层纸娃娃 + 舞台动作状态机。
 * 层序自下而上：body → dress → head → arms-front（760×760，脚底约 y=748）。
 * 任一层不可用时回退整身图 + loadCutoutImage；不硬切 4 张 breathe 帧。
 *
 * 本地约定（尚无文件时仍可映射；存在后才启用分层）：
 * - assets/characters/{skin}/body.png → /files/base/{skin}-body.png
 * - assets/characters/{skin}/head.png → /files/base/{skin}-head.png
 * - assets/characters/{skin}/arms-front.png → /files/base/{skin}-arms-front.png
 * - assets/characters/parts/dress/{outfitId}.png → /files/dress/{outfitId}.png
 * 注意：不复用 public/assets/nikki/dress-*.png（那些是不透明整身 Comfy 图）。
 */
import { resolveAsset } from "./remote-assets.ts";

export type LayerSkinId = "original" | "maid";

export type StageMotion = "idle" | "react" | "equip";

/** 第一期候选是 dress-snow-white，但图库四张仍是整身图、尚未过门，暂不启用探测。过门后再加回。 */
export const PHASE1_LAYERED_OUTFIT_IDS = [] as const;

export function isPhase1LayeredOutfit(outfitId: string): boolean {
  return (PHASE1_LAYERED_OUTFIT_IDS as readonly string[]).includes(outfitId);
}

export interface LayeredPartUrls {
  body: string;
  dress: string;
  head: string;
  armsFront: string;
}

/** 本地相对 public 的路径（未 resolve）。 */
export function getLayeredPartLocalPaths(skinId: LayerSkinId, outfitId: string): LayeredPartUrls {
  return {
    body: `assets/characters/${skinId}/body.png`,
    head: `assets/characters/${skinId}/head.png`,
    armsFront: `assets/characters/${skinId}/arms-front.png`,
    dress: `assets/characters/parts/dress/${outfitId}.png`,
  };
}

export function resolveLayeredPartUrls(skinId: LayerSkinId, outfitId: string): LayeredPartUrls {
  const local = getLayeredPartLocalPaths(skinId, outfitId);
  return {
    body: resolveAsset(local.body),
    head: resolveAsset(local.head),
    armsFront: resolveAsset(local.armsFront),
    dress: resolveAsset(local.dress),
  };
}

export const MOTION_DURATION_MS: Record<Exclude<StageMotion, "idle">, number> = {
  react: 720,
  equip: 680,
};

export function nextMotion(current: StageMotion, input: StageMotion): StageMotion {
  if (input === "idle") return "idle";
  // 新输入打断旧片段
  return input;
}

export function motionReturnsToIdle(state: StageMotion): boolean {
  return state === "react" || state === "equip";
}

/** 探测单张图是否可加载。浏览器用 Image；非 DOM（Node 测试）视为缺失以保持回退安全。 */
export function probeImageUrl(url: string): Promise<boolean> {
  if (!url) return Promise.resolve(false);

  if (typeof Image !== "undefined") {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  return Promise.resolve(false);
}

export async function probeLayeredParts(urls: LayeredPartUrls): Promise<boolean> {
  const results = await Promise.all([
    probeImageUrl(urls.body),
    probeImageUrl(urls.dress),
    probeImageUrl(urls.head),
    probeImageUrl(urls.armsFront),
  ]);
  return results.every(Boolean);
}
