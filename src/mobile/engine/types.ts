import type { SceneId } from "../data/scenes";
import type { PetState } from "../data/pet-actions";

export interface JournalEntry {
  id: string;
  text: string;
  time: number;
}

export interface GameState {
  currentScene: SceneId;
  pet: PetState;
  coins: number;
  seeds: number;
  flowers: number;
  mementos: number;
  bond: number;
  exploredScenes: SceneId[];
  bondedMoments: string[];
  journal: JournalEntry[];
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
