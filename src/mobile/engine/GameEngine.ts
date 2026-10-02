// 移动端游戏引擎 - 核心状态管理
import { useState, useCallback, useRef } from "react";
import { SceneId } from "../data/scenes";
import { PetState, INITIAL_PET_STATE, PetAction, PET_ACTIONS, getSpriteForAction, getDialogueForMood } from "../data/pet-actions";

export interface GameState {
  currentScene: SceneId;
  pet: PetState;
  selectedFurniture: string | null;
  showActionMenu: boolean;
  actionMenuPosition: { x: number; y: number } | null;
}

const INITIAL_STATE: GameState = {
  currentScene: "bedroom",
  pet: { ...INITIAL_PET_STATE },
  selectedFurniture: null,
  showActionMenu: false,
  actionMenuPosition: null,
};

export function useGameEngine() {
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 切换场景
  const switchScene = useCallback((sceneId: SceneId) => {
    setState((prev) => ({
      ...prev,
      currentScene: sceneId,
      selectedFurniture: null,
      showActionMenu: false,
      actionMenuPosition: null,
    }));
  }, []);

  // 选择家具
  const selectFurniture = useCallback(
    (furnitureId: string, position: { x: number; y: number }) => {
      setState((prev) => ({
        ...prev,
        selectedFurniture: furnitureId,
        showActionMenu: true,
        actionMenuPosition: position,
      }));
    },
    []
  );

  // 关闭动作菜单
  const closeActionMenu = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedFurniture: null,
      showActionMenu: false,
      actionMenuPosition: null,
    }));
  }, []);

  // 执行宠物动作
  const executeAction = useCallback(
    (action: PetAction) => {
      setState((prev) => {
        const newPet = {
          ...prev.pet,
          currentAction: action.id,
          mood: action.mood,
          lastInteraction: Date.now(),
          happiness: Math.min(100, prev.pet.happiness + 5),
        };

        // 动作结束后恢复 idle
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setState((p) => ({
            ...p,
            pet: { ...p.pet, currentAction: "idle", mood: "normal" },
          }));
        }, action.duration);

        return {
          ...prev,
          pet: newPet,
          showActionMenu: false,
          selectedFurniture: null,
          actionMenuPosition: null,
        };
      });
    },
    []
  );

  // 与家具互动
  const interactWithFurniture = useCallback(
    (furnitureId: string, actionId: string) => {
      const action = PET_ACTIONS.find((a) => a.id === actionId);
      if (action) {
        executeAction(action);
      }
    },
    [executeAction]
  );

  // 触摸宠物
  const petThePet = useCallback(() => {
    setState((prev) => {
      const newPet = {
        ...prev.pet,
        currentAction: "happy",
        mood: "happy",
        happiness: Math.min(100, prev.pet.happiness + 10),
        lastInteraction: Date.now(),
      };

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setState((p) => ({
          ...p,
          pet: { ...p.pet, currentAction: "idle", mood: "normal" },
        }));
      }, 2000);

      return { ...prev, pet: newPet };
    });
  }, []);

  return {
    state,
    switchScene,
    selectFurniture,
    closeActionMenu,
    executeAction,
    interactWithFurniture,
    petThePet,
  };
}
