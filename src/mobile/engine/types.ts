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
}

export interface GameUIState {
  selectedFurniture: string | null;
  showActionMenu: boolean;
  actionMenuPosition: { x: number; y: number } | null;
}

export const INITIAL_GAME_UI_STATE: GameUIState = {
  selectedFurniture: null,
  showActionMenu: false,
  actionMenuPosition: null,
};
