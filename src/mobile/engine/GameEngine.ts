import { useCallback, useEffect, useRef, useState } from "react";
import { SCENE_FURNITURE, type SceneId } from "../data/scenes";
import { PET_ACTIONS, type PetAction } from "../data/pet-actions";
import {
  applyCoplay,
  interactWithFurniture as applyFurnitureInteraction,
  petCompanion,
  switchScene as applySceneChange,
} from "./game-rules";
import type { PlayerLookId } from "../data/player-looks";
import { INITIAL_GAME_UI_STATE, type GameState, type GameUIState, type PlayerProfile } from "./types";
import { createPlayerId, loadGameState, saveGameState } from "./storage";

function scheduleIdle(
  timer: { current: ReturnType<typeof setTimeout> | null },
  setState: React.Dispatch<React.SetStateAction<GameState>>,
  duration: number,
) {
  if (timer.current) clearTimeout(timer.current);
  timer.current = setTimeout(() => {
    setState((previous) => ({
      ...previous,
      pet: { ...previous.pet, currentAction: "idle", mood: "normal" },
    }));
  }, duration);
}

export function useGameEngine() {
  const [state, setState] = useState<GameState>(loadGameState);
  const [ui, setUI] = useState<GameUIState>(INITIAL_GAME_UI_STATE);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    saveGameState(state);
  }, [state]);

  useEffect(() => () => {
    if (actionTimer.current) clearTimeout(actionTimer.current);
  }, []);

  const switchScene = useCallback((sceneId: SceneId) => {
    setState((previous) => applySceneChange(previous, sceneId));
    setUI(INITIAL_GAME_UI_STATE);
  }, []);

  const selectFurniture = useCallback((furnitureId: string) => {
    setUI({ selectedFurniture: furnitureId, showActionMenu: true });
  }, []);

  const closeActionMenu = useCallback(() => {
    setUI(INITIAL_GAME_UI_STATE);
  }, []);

  const interactWithFurniture = useCallback((furnitureId: string, actionId: string) => {
    const action = PET_ACTIONS.find((item) => item.id === actionId);
    if (!action) return;

    setState((previous) => {
      const furniture = SCENE_FURNITURE[previous.currentScene].find((item) => item.id === furnitureId);
      if (!furniture) return previous;
      const result = applyFurnitureInteraction(previous, furniture, action);
      return result.blockedMessage ? previous : result.state;
    });
    setUI(INITIAL_GAME_UI_STATE);
    scheduleIdle(actionTimer, setState, action.duration);
  }, []);

  const petThePet = useCallback(() => {
    setState((previous) => petCompanion(previous));
    scheduleIdle(actionTimer, setState, 1800);
  }, []);

  /** 方向 A：3 步创建「我」的角色，写入存档后进入共处场景 */
  const createPlayer = useCallback((name: string, lookId: PlayerLookId, now = Date.now()) => {
    const trimmed = name.trim().slice(0, 12);
    if (!trimmed) return false;
    const player: PlayerProfile = {
      playerId: createPlayerId(),
      name: trimmed,
      lookId,
      createdAt: now,
    };
    setState((previous) => ({
      ...previous,
      player,
      journal: [
        {
          id: `player-${now}`,
          text: `${trimmed} 走进了这个小世界。`,
          time: now,
        },
        ...previous.journal,
      ].slice(0, 48),
    }));
    return true;
  }, []);

  /** 方向 B：共处动词；事件里 setState updater 同步跑，可立刻取文案/juice */
  const doCoplay = useCallback((actionId: string) => {
    let result!: ReturnType<typeof applyCoplay>;
    setState((previous) => {
      result = applyCoplay(previous, actionId);
      return result.state;
    });
    return {
      dialogue: result.action?.dialogue ?? "",
      blockedMessage: result.blockedMessage,
      juice: result.action?.juice ?? null,
    };
  }, []);

  return {
    state,
    ui,
    switchScene,
    selectFurniture,
    closeActionMenu,
    interactWithFurniture,
    petThePet,
    createPlayer,
    doCoplay,
  };
}

export type { GameState, GameUIState } from "./types";
