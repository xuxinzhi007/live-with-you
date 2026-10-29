/**
 * 角色皮肤。两套皮肤使用同一套帧规格，运行时可无缝切换：
 *   760x760 画布、可见高 714、脚底 y=748、水平居中 x=380。
 *
 * original = 原来的白色雯宝（默认）
 * maid     = 蓝白女仆（小鲸鱼）
 */
import type { CharacterSkinId } from "../engine/types";
import { CHARACTER_SKIN_IDS, DEFAULT_CHARACTER_SKIN } from "./state.ts";

export { CHARACTER_SKIN_IDS, DEFAULT_CHARACTER_SKIN };

export interface CharacterSkinMetrics {
  /** 帧画布边长（px） */
  frame: number;
  /** 画布内角色可见高度（px） */
  visibleHeight: number;
  /** 画布内角色可见宽度（px） */
  visibleWidth: number;
  /** 脚底锚点（0–1，相对画布高度） */
  baseline: number;
}

export interface CharacterSkin {
  id: CharacterSkinId;
  label: string;
  note: string;
  idle: string;
  /** 短交互姿态（点她 / 抵达物件时） */
  react: string;
  walk: string[];
  avatar: string;
  metrics: CharacterSkinMetrics;
}

const METRICS = {
  frame: 760,
  baseline: 748 / 760,
} as const;

export const CHARACTER_SKINS: Record<CharacterSkinId, CharacterSkin> = {
  original: {
    id: "original",
    label: "白色",
    note: "原来的她",
    idle: "assets/characters/original/idle.webp",
    react: "assets/characters/original/react.webp",
    walk: [
      "assets/characters/original/walk-1.webp",
      "assets/characters/original/walk-2.webp",
      "assets/characters/original/walk-3.webp",
      "assets/characters/original/walk-4.webp",
    ],
    avatar: "assets/characters/original/avatar.webp",
    metrics: { ...METRICS, visibleHeight: 720, visibleWidth: 429 },
  },
  maid: {
    id: "maid",
    label: "小鲸鱼",
    note: "蓝白女仆",
    idle: "assets/characters/maid/idle.webp",
    react: "assets/characters/maid/react.webp",
    walk: [
      "assets/characters/maid/walk-1.webp",
      "assets/characters/maid/walk-2.webp",
      "assets/characters/maid/walk-3.webp",
      "assets/characters/maid/walk-4.webp",
    ],
    avatar: "assets/characters/maid/avatar.webp",
    metrics: { ...METRICS, visibleHeight: 714, visibleWidth: 554 },
  },
};

export const CHARACTER_SKIN_LIST: CharacterSkin[] = CHARACTER_SKIN_IDS.map(
  (id) => CHARACTER_SKINS[id],
);

export function isCharacterSkinId(value: unknown): value is CharacterSkinId {
  return typeof value === "string" && CHARACTER_SKIN_IDS.includes(value as CharacterSkinId);
}

export function getCharacterSkin(id: CharacterSkinId | string | undefined): CharacterSkin {
  return isCharacterSkinId(id) ? CHARACTER_SKINS[id] : CHARACTER_SKINS[DEFAULT_CHARACTER_SKIN];
}
