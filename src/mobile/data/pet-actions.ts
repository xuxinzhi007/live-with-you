// 移动端宠物行为与动作系统
import { wenbebi } from "../../game/data/pet.js";

export type PetMood = "happy" | "normal" | "sleepy" | "excited" | "curious";

export interface PetAction {
  id: string;
  label: string;
  icon: string;
  sprite: string;
  duration: number; // 毫秒
  mood: PetMood;
  energyChange?: number;
  happinessChange?: number;
  dialogue?: string;
}

export const PET_ACTIONS: PetAction[] = [
  { id: "idle", label: "发会儿呆", icon: "😴", sprite: "idle", duration: 3000, mood: "normal" },
  { id: "walk", label: "散散步", icon: "🚶", sprite: "walk", duration: 2000, mood: "normal", energyChange: -2, happinessChange: 3 },
  { id: "sit", label: "坐一会儿", icon: "🪑", sprite: "sit", duration: 2500, mood: "normal", energyChange: 4, happinessChange: 2 },
  { id: "sleep", label: "睡一觉", icon: "🌙", sprite: "sleep", duration: 5000, mood: "sleepy", energyChange: 12, happinessChange: 1 },
  { id: "rest", label: "休息", icon: "🛏️", sprite: "sit", duration: 2500, mood: "normal", energyChange: 8, happinessChange: 2 },
  { id: "relax", label: "放松一下", icon: "🍃", sprite: "sit", duration: 2500, mood: "happy", energyChange: 5, happinessChange: 4 },
  { id: "play", label: "玩玩具", icon: "🧸", sprite: "jump", duration: 1500, mood: "excited", energyChange: -5, happinessChange: 10 },
  { id: "dance", label: "跳支舞", icon: "🎵", sprite: "happy", duration: 2000, mood: "happy", energyChange: -3, happinessChange: 8 },
  { id: "happy", label: "开心一下", icon: "😊", sprite: "happy", duration: 2000, mood: "happy", happinessChange: 5 },
  { id: "look", label: "看看风景", icon: "👀", sprite: "look", duration: 2500, mood: "curious", happinessChange: 2 },
  { id: "sniff", label: "闻闻花香", icon: "🌼", sprite: "look", duration: 2000, mood: "curious", happinessChange: 4 },
  { id: "water", label: "浇浇花", icon: "💧", sprite: "happy", duration: 2000, mood: "happy", energyChange: -1, happinessChange: 4 },
  { id: "light", label: "打开小灯", icon: "💡", sprite: "happy", duration: 1200, mood: "happy", happinessChange: 2 },
  { id: "work", label: "整理桌面", icon: "✏️", sprite: "look", duration: 2000, mood: "normal", energyChange: -2, happinessChange: 2 },
  { id: "read", label: "读一会儿", icon: "📖", sprite: "sit", duration: 2500, mood: "curious", energyChange: -1, happinessChange: 4 },
  { id: "treat", label: "吃点心", icon: "🍪", sprite: "happy", duration: 1800, mood: "happy", happinessChange: 10 },
  { id: "buy", label: "买一束花", icon: "💐", sprite: "happy", duration: 1800, mood: "happy", happinessChange: 5 },
  { id: "order", label: "点杯热饮", icon: "☕", sprite: "happy", duration: 1800, mood: "happy", happinessChange: 7 },
  { id: "wave", label: "挥挥手", icon: "👋", sprite: "wave", duration: 1500, mood: "happy", happinessChange: 4 },
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
  const pick = (arr: string[] | undefined, fallback?: string) => {
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
