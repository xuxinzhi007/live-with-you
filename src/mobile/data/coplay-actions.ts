/**
 * 共处动词（方向 B）：我对「她」的互动之外，双方角色之间能一起做的事。
 * 本地双角色先验；实时联机后置。目标 ≥5。
 */
export type CoplayJuice = "greet" | "sit" | "pass" | "clap" | "look" | "lean";

export interface CoplayAction {
  id: string;
  label: string;
  icon: string;
  /** 点下去后她的气泡 */
  dialogue: string;
  /** 驱动 pet.currentAction，复用现有精灵映射 */
  petAction: string;
  bond: number;
  juice: CoplayJuice;
  /** 写入手账的模板；{me} {her} 占位 */
  journal: string;
}

export const COPLAY_ACTIONS: CoplayAction[] = [
  {
    id: "greet",
    label: "打招呼",
    icon: "👋",
    dialogue: "嗨——你也来了。",
    petAction: "wave",
    bond: 1,
    juice: "greet",
    journal: "{me} 向 {her} 挥了挥手。",
  },
  {
    id: "sit-together",
    label: "一起坐",
    icon: "🪑",
    dialogue: "那就坐一会儿吧。",
    petAction: "sit",
    bond: 2,
    juice: "sit",
    journal: "{me} 和 {her} 并肩坐下。",
  },
  {
    id: "pass-snack",
    label: "递点心",
    icon: "🍪",
    dialogue: "谢谢你，刚好有点饿。",
    petAction: "treat",
    bond: 2,
    juice: "pass",
    journal: "{me} 把点心递给了 {her}。",
  },
  {
    id: "high-five",
    label: "击掌",
    icon: "✋",
    dialogue: "啪！嘿。",
    petAction: "happy",
    bond: 1,
    juice: "clap",
    journal: "{me} 和 {her} 击了个掌。",
  },
  {
    id: "look-out",
    label: "一起看",
    icon: "🪟",
    dialogue: "外面今天还不错。",
    petAction: "look",
    bond: 1,
    juice: "look",
    journal: "{me} 和 {her} 一起看向窗外。",
  },
  {
    id: "lean",
    label: "并肩靠",
    icon: "🤍",
    dialogue: "……我就在这儿。",
    petAction: "rest",
    bond: 2,
    juice: "lean",
    journal: "{me} 轻轻靠在 {her} 身边。",
  },
];

export function getCoplayAction(id: string): CoplayAction | undefined {
  return COPLAY_ACTIONS.find((action) => action.id === id);
}
