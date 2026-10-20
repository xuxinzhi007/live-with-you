import { useCallback, useEffect, useRef, useState } from "react";
import { SCENE_FURNITURE, type SceneId } from "../data/scenes";
import { PET_ACTIONS, type PetAction } from "../data/pet-actions";
import { interactWithFurniture as applyFurnitureInteraction, petCompanion, switchScene as applySceneChange } from "./game-rules";
import { INITIAL_GAME_UI_STATE, type GameState, type GameUIState } from "./types";
import { loadGameState, saveGameState } from "./storage";

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

  const selectFurniture = useCallback((furnitureId: string, position: { x: number; y: number }) => {
    setUI({ selectedFurniture: furnitureId, showActionMenu: true, actionMenuPosition: position });
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

  return {
    state,
    ui,
    switchScene,
    selectFurniture,
    closeActionMenu,
    interactWithFurniture,
    petThePet,
  };
}

export type { GameState, GameUIState } from "./types";
