export type SceneId = "bedroom" | "balcony" | "street" | "cafe";
export type PetMood = "happy" | "normal" | "sleepy" | "excited" | "curious";
export type PlayerLookId = "soft" | "bright" | "calm" | "warm";

export interface PetState {
  currentAction: string;
  mood: PetMood;
  energy: number;
  happiness: number;
  lastInteraction: number;
}

export const INITIAL_PET_STATE: PetState = {
  currentAction: "idle",
  mood: "normal",
  energy: 80,
  happiness: 70,
  lastInteraction: Date.now(),
};

export interface JournalEntry {
  id: string;
  text: string;
  time: number;
}

export interface PlayerProfile {
  playerId: string;
  name: string;
  lookId: PlayerLookId;
  createdAt: number;
}

export type WorldRoomId = "home" | "garden" | "street";

/** 角色皮肤。original = 原来的白色雯宝（默认）；maid = 蓝白女仆。 */
export type CharacterSkinId = "original" | "maid";

export type FlowerKind = "daisy" | "rose" | "sunflower";

/** 庭院花圃。kind 为 null 表示空地。 */
export interface GardenPlot {
  kind: FlowerKind | null;
  plantedAt: number;
  /** 浇过水的花圃成长更快；0 表示没浇过 */
  wateredAt: number;
}

export interface WorldState {
  room: WorldRoomId;
  /** 当前角色皮肤；旧档缺失时默认 original。 */
  skin: CharacterSkinId;
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
  player: PlayerProfile | null;
  coins: number;
  seeds: number;
  flowers: number;
  mementos: number;
  bond: number;
  exploredScenes: SceneId[];
  bondedMoments: string[];
  journal: JournalEntry[];
  lastCoplayId: string | null;
  lastCoplayAt: number;
  world: WorldState;
}
