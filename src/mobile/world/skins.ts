/**
 * 角色皮肤。两套皮肤使用同一套帧规格，运行时可无缝切换：
 *   760x760 画布、脚底 y=748、水平居中 x=380。
 *
 * original = 原来的白色雯宝（默认）
 * maid     = 蓝白女仆（小鲸鱼）
 *
 * 姿势帧：
 *   idle      站立
 *   breathe*  待机呼吸（4 帧循环）
 *   walk*     走路（4 帧）
 *   react     短交互（点她 / 到达物件）
 *   sit       坐下（可选，缺失时回落到 react）
 *   sleep     躺下（可选，缺失时回落到 sit）
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
  /** 待机呼吸帧；空数组表示只用 idle 静帧 */
  breathe: string[];
  /** 短交互姿态（点她 / 抵达物件时） */
  react: string;
  walk: string[];
  /** 坐下 / 蹲下（可选） */
  sit?: string;
  /** 躺下（可选） */
  sleep?: string;
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
    breathe: [
      "assets/characters/original/breathe-1.webp",
      "assets/characters/original/breathe-2.webp",
      "assets/characters/original/breathe-3.webp",
      "assets/characters/original/breathe-4.webp",
    ],
    react: "assets/characters/original/react.webp",
    walk: [
      "assets/characters/original/walk-1.webp",
      "assets/characters/original/walk-2.webp",
      "assets/characters/original/walk-3.webp",
      "assets/characters/original/walk-4.webp",
    ],
    sit: "assets/characters/original/sit.webp",
    sleep: "assets/characters/original/sleep.webp",
    avatar: "assets/characters/original/avatar.webp",
    metrics: { ...METRICS, visibleHeight: 720, visibleWidth: 429 },
  },
  maid: {
    id: "maid",
    label: "小鲸鱼",
    note: "蓝白女仆",
    idle: "assets/characters/maid/idle.webp",
    breathe: [
      "assets/characters/maid/breathe-1.webp",
      "assets/characters/maid/breathe-2.webp",
      "assets/characters/maid/breathe-3.webp",
      "assets/characters/maid/breathe-4.webp",
    ],
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
