import type { SceneId } from "../data/scenes";
import type { PetState } from "../data/pet-actions";
import type { PlayerLookId } from "../data/player-looks";

export interface JournalEntry {
  id: string;
  text: string;
  time: number;
}

/** 玩家自己的角色（独立身份）。null = 尚未创建，需走创建流。 */
export interface PlayerProfile {
  playerId: string;
  name: string;
  lookId: PlayerLookId;
  createdAt: number;
}

/* ============ V2：可走动的单主角小世界 ============ */

export type WorldRoomId = "home" | "garden" | "street";

export type FlowerKind = "daisy" | "rose" | "sunflower";

/** 庭院花圃。kind 为 null 表示空地。 */
export interface GardenPlot {
  kind: FlowerKind | null;
  plantedAt: number;
  /** 浇过水的花圃成长更快；0 表示没浇过 */
  wateredAt: number;
}

/**
 * V2 世界状态。与 currentScene / pet 并存：旧移动端与桌面仍读取旧字段，
 * 新主线只读写这里，避免破坏旧存档与旧测试。
 */
export interface WorldState {
  room: WorldRoomId;
  plots: GardenPlot[];
  /** 每件物件的冷却结束时间（绝对时间戳）。 */
  cooldowns: Record<string, number>;
  bestCombo: number;
  seenIntro: boolean;
  planted: number;
  harvested: number;
  kicks: number;
  /** 已收集的花朵，按品种计数。 */
  collection: Record<FlowerKind, number>;
  /** 去过的房间；只用于第一次进房的生活小记。 */
  visited: WorldRoomId[];
}

export interface GameState {
  currentScene: SceneId;
  pet: PetState;
  /** 我在场；旧档 normalize 后为 null，进入创建流 */
  player: PlayerProfile | null;
  coins: number;
  seeds: number;
  flowers: number;
  mementos: number;
  bond: number;
  exploredScenes: SceneId[];
  bondedMoments: string[];
  journal: JournalEntry[];
  /** 最近一次共处动词 id，供 UI juice / 相遇提示 */
  lastCoplayId: string | null;
  lastCoplayAt: number;
  /** V2 世界状态；旧档由 normalizeGameState 补默认值。 */
  world: WorldState;
}

export interface GameUIState {
  selectedFurniture: string | null;
  showActionMenu: boolean;
}

export const INITIAL_GAME_UI_STATE: GameUIState = {
  selectedFurniture: null,
  showActionMenu: false,
};
