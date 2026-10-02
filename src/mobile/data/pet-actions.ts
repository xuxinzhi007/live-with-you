// 移动端宠物行为与动作系统
import { wenbebi } from "../../game/data/pet";

export type PetMood = "happy" | "normal" | "sleepy" | "excited" | "curious";

export interface PetAction {
  id: string;
  label: string;
  icon: string;
  sprite: string;
  duration: number; // 毫秒
  mood: PetMood;
  dialogue?: string;
}

export const PET_ACTIONS: PetAction[] = [
  { id: "idle", label: "发呆", icon: "😴", sprite: "idle", duration: 3000, mood: "normal" },
  { id: "walk", label: "走动", icon: "🚶", sprite: "walk", duration: 2000, mood: "normal" },
  { id: "sit", label: "坐下", icon: "🪑", sprite: "sit", duration: 2500, mood: "normal" },
  { id: "sleep", label: "睡觉", icon: "", sprite: "sleep", duration: 5000, mood: "sleepy" },
  { id: "jump", label: "跳跃", icon: "🦘", sprite: "jump", duration: 1500, mood: "excited" },
  { id: "happy", label: "开心", icon: "😊", sprite: "happy", duration: 2000, mood: "happy" },
  { id: "look", label: "观察", icon: "", sprite: "look", duration: 2500, mood: "curious" },
  { id: "wave", label: "挥手", icon: "👋", sprite: "wave", duration: 1500, mood: "happy" },
];

export interface PetState {
  currentAction: string;
  mood: PetMood;
  energy: number; // 0-100
  happiness: number; // 0-100
  lastInteraction: number; // 时间戳
}

export const INITIAL_PET_STATE: PetState = {
  currentAction: "idle",
  mood: "normal",
  energy: 80,
  happiness: 70,
  lastInteraction: Date.now(),
};

export function getSpriteForAction(actionId: string): string {
  const action = PET_ACTIONS.find((a) => a.id === actionId);
  if (!action) return wenbebi.sprites.idle;
  return wenbebi.sprites[action.sprite as keyof typeof wenbebi.sprites] || wenbebi.sprites.idle;
}

export function getDialogueForMood(mood: PetMood): string {
  const lines = wenbebi.lines;
  const pick = (arr: string[] | undefined, fallback: string) => {
    if (!arr || arr.length === 0) return fallback;
    return arr[Math.floor(Math.random() * arr.length)];
  };
  switch (mood) {
    case "happy":
      return pick(lines.jump, "嘿！跳～");
    case "sleepy":
      return pick(lines.sleepy, pick(lines.wake, "有点困。"));
    case "excited":
      return pick(lines.jump, "嘿！");
    case "curious":
      return pick(lines.window, "外面好亮");
    default:
      return pick(lines.idle, "……");
  }
}

export function getDialogueForFurniture(furnitureId: string): string | undefined {
  const lines = wenbebi.lines;
  const pick = (arr: string[] | undefined, fallback: string) => {
    if (!arr || arr.length === 0) return fallback;
    return arr[Math.floor(Math.random() * arr.length)];
  };
  switch (furnitureId) {
    case "bed":
      return pick(lines.bed, undefined);
    case "desk":
      return pick(lines.desk, undefined);
    case "armchair":
      return pick(lines.sit, undefined);
    case "window-a":
    case "window-b":
      return pick(lines.window, undefined);
    case "plant-a":
    case "plant-b":
      return pick(lines.plant, undefined);
    case "lamp":
      return pick(lines.lamp, undefined);
    case "rug":
      return pick(lines.sit, undefined);
    case "toy-box":
      return pick(lines.toybox, undefined);
    case "snack":
      return pick(lines.treat, undefined);
    case "record-player":
      return pick(lines.music, undefined);
    case "toy":
      return pick(lines.toy, undefined);
    case "balcony-plant":
      return pick(lines.plant, undefined);
    case "balcony-chair":
      return pick(lines.sit, undefined);
    case "sky-view":
      return pick(lines.window, undefined);
    case "street-fountain":
      return pick(lines.window, undefined);
    case "street-flower":
      return pick(lines.plant, undefined);
    case "street-bench":
      return pick(lines.sit, undefined);
    case "street-sign":
      return pick(lines.window, undefined);
    case "cafe-counter":
      return pick(lines.cafeCounter, undefined);
    case "cafe-table":
      return pick(lines.cafeTable, undefined);
    default:
      return undefined;
  }
}
