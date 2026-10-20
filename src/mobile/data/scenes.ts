// 竖屏移动端场景定义 - 基于9:16设计基准
// 坐标系统: left/bottom 百分比定位，确保所有竖屏设备一致

export const SCENES = [
  { id: "bedroom", name: "小屋", icon: "🏠", order: 0 },
  { id: "balcony", name: "阳台", icon: "🌤️", order: 1 },
  { id: "street", name: "街区", icon: "✨", order: 2 },
  { id: "cafe", name: "咖啡馆", icon: "☕", order: 3 },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

// 场景背景配置 (墙面 + 地板)
export const SCENE_BACKGROUNDS: Record<SceneId, { wall: string; floor: string }> = {
  bedroom: {
    wall: "linear-gradient(180deg, #f5e6d3 0%, #e8d4ba 100%)",
    floor: "linear-gradient(180deg, #c9a87c 0%, #b08d5e 100%)",
  },
  balcony: {
    wall: "linear-gradient(180deg, #8ec5dd 0%, #d9ebda 72%, #b9d19c 72% 100%)",
    floor: "linear-gradient(180deg, #9b7756 0%, #795740 100%)",
  },
  street: {
    wall: "linear-gradient(180deg, #a8d8ea 0%, #d9e3c6 60%, #b7c999 60% 100%)",
    floor: "linear-gradient(180deg, #b6a58e 0%, #9d8b74 100%)",
  },
  cafe: {
    wall: "linear-gradient(180deg, #c9a87c 0%, #d8a77f 48%, #8e604b 48% 100%)",
    floor: "linear-gradient(180deg, #7a5241 0%, #694535 100%)",
  },
};

// 家具交互定义 - 每个家具的坐标、样式、可执行动作
// 坐标基于 100x100 的相对坐标系，left/bottom 百分比
export const SCENE_FURNITURE: Record<SceneId, FurnitureItem[]> = {
  bedroom: [
    // === 地毯（贴地板线）===
    {
      id: "rug",
      type: "decoration",
      label: "",
      left: 6, bottom: 13, w: 88, h: 3,
      actions: [],
    },
    // === 墙面装饰（中高处）===
    {
      id: "window-a",
      type: "decoration",
      label: "",
      left: 6, bottom: 55, w: 26, h: 24,
      actions: ["look"],
      dialogue: "外面的天气真好呢",
      // 脚底仍在玩法带，只是站到窗下
      anchors: { L: { left: 14, bottom: 12 }, R: { left: 26, bottom: 12 } },
    },
    {
      id: "window-b",
      type: "decoration",
      label: "",
      left: 68, bottom: 55, w: 26, h: 24,
      actions: ["look"],
      dialogue: "看看窗外吧",
    },
    // === 左侧区域（地板上）===
    {
      id: "plant-a",
      type: "decoration",
      label: "",
      left: 1, bottom: 14, w: 6, h: 22,
      actions: ["sniff", "water"],
      dialogue: "植物长高了呢！",
      effects: {
        water: { cost: { seeds: 1 }, reward: { flowers: 1 }, insufficientMessage: "花种不够了，可以先去街区看看。" },
      },
    },
    {
      id: "bed",
      type: "furniture",
      label: "",
      left: 7, bottom: 14, w: 28, h: 18,
      actions: ["sleep", "rest"],
      dialogue: "想休息一下吗？",
      anchors: { L: { left: 14, bottom: 12 }, R: { left: 28, bottom: 12 } },
      sprite: "rest",
    },
    {
      id: "toy-box",
      type: "interactive",
      label: "",
      left: 10, bottom: 15, w: 9, h: 11,
      actions: ["play"],
      dialogue: "一起玩吧！",
      sprite: "jump",
    },
    // === 中间区域 ===
    {
      id: "armchair",
      type: "furniture",
      label: "",
      left: 40, bottom: 14, w: 20, h: 15,
      actions: ["sit", "relax"],
      dialogue: "坐一会儿吧～",
      anchors: { L: { left: 42, bottom: 12 }, R: { left: 56, bottom: 12 } },
    },
    {
      id: "record-player",
      type: "interactive",
      label: "",
      left: 43, bottom: 16, w: 8, h: 8,
      actions: ["dance"],
      dialogue: "一起跳舞吧！",
      sprite: "happy",
    },
    // === 右侧区域 ===
    {
      id: "lamp",
      type: "decoration",
      label: "",
      left: 91, bottom: 14, w: 7, h: 26,
      actions: ["light"],
      dialogue: "开灯啦～",
    },
    {
      id: "desk",
      type: "furniture",
      label: "",
      left: 68, bottom: 14, w: 22, h: 18,
      actions: ["work", "read"],
      dialogue: "要写点什么吗？",
    },
    {
      id: "snack",
      type: "interactive",
      label: "",
      left: 71, bottom: 17, w: 7, h: 7,
      actions: ["treat"],
      dialogue: "好吃～",
      sprite: "happy",
      anchors: { L: { left: 66, bottom: 12 }, R: { left: 78, bottom: 12 } },
      effects: {
        treat: { cost: { coins: 3 }, insufficientMessage: "零钱不够，先去街区转转吧。" },
      },
    },
    // === 门户 ===
    {
      id: "home-door",
      type: "portal",
      label: "出门",
      left: 84, bottom: 13, w: 9, h: 30,
      actions: ["travel"],
      targetScene: "street",
      dialogue: "一起出门吧！",
    },
  ],
  balcony: [
    {
      id: "balcony-plant",
      type: "decoration",
      label: "",
      left: 3, bottom: 14, w: 16, h: 22,
      actions: ["sniff", "water"],
      dialogue: "浇浇水吧～",
      effects: {
        water: { cost: { seeds: 1 }, reward: { flowers: 1 }, insufficientMessage: "花种不够了，可以先去街区看看。" },
      },
    },
    {
      id: "balcony-chair",
      type: "furniture",
      label: "",
      left: 28, bottom: 14, w: 30, h: 18,
      actions: ["sit", "relax"],
      dialogue: "坐着吹风好舒服",
      anchors: { L: { left: 34, bottom: 12 }, R: { left: 50, bottom: 12 } },
    },
    {
      id: "railing",
      type: "decoration",
      label: "",
      left: 0, bottom: 13, w: 100, h: 3,
      actions: ["look"],
    },
    {
      id: "sky-view",
      type: "decoration",
      label: "",
      left: 0, bottom: 16, w: 100, h: 35,
      actions: ["look"],
      dialogue: "今天的天空真美",
    },
    {
      id: "balcony-exit",
      type: "portal",
      label: "下楼",
      left: 80, bottom: 13, w: 14, h: 28,
      actions: ["travel"],
      targetScene: "street",
      dialogue: "下楼去玩吧！",
    },
  ],
  street: [
    {
      id: "street-fountain",
      type: "decoration",
      label: "",
      left: 26, bottom: 14, w: 38, h: 24,
      actions: ["look", "play"],
      dialogue: "喷泉好漂亮～",
    },
    {
      id: "street-flower",
      type: "interactive",
      label: "",
      left: 3, bottom: 14, w: 14, h: 18,
      actions: ["buy", "sniff"],
      dialogue: "要买花吗？",
      sprite: "happy",
      effects: {
        buy: { cost: { coins: 8 }, reward: { flowers: 1 }, insufficientMessage: "零钱还差一点才能买花。" },
      },
    },
    {
      id: "street-bench",
      type: "furniture",
      label: "",
      left: 62, bottom: 14, w: 24, h: 14,
      actions: ["sit", "rest"],
      dialogue: "坐下来休息一下吧",
    },
    {
      id: "street-sign",
      type: "decoration",
      label: "",
      left: 17, bottom: 14, w: 6, h: 22,
      actions: ["look"],
      dialogue: "这是哪里呢？",
    },
    {
      id: "street-gate",
      type: "portal",
      label: "回家",
      left: 83, bottom: 13, w: 12, h: 28,
      actions: ["travel"],
      targetScene: "bedroom",
      dialogue: "回家吧～",
    },
  ],
  cafe: [
    {
      id: "cafe-counter",
      type: "furniture",
      label: "",
      left: 3, bottom: 14, w: 94, h: 20,
      actions: ["order"],
      dialogue: "想喝点什么？",
      effects: {
        order: { cost: { coins: 6 }, insufficientMessage: "零钱不够点热饮。" },
      },
    },
    {
      id: "cafe-table",
      type: "furniture",
      label: "",
      left: 32, bottom: 42, w: 30, h: 16,
      actions: ["sit", "rest"],
      dialogue: "坐这儿喝咖啡吧",
      anchors: { L: { left: 36, bottom: 12 }, R: { left: 52, bottom: 12 } },
    },
    {
      id: "cafe-exit",
      type: "portal",
      label: "离开",
      left: 83, bottom: 13, w: 12, h: 28,
      actions: ["travel"],
      targetScene: "street",
      dialogue: "回去吧～",
    },
  ],
};

export interface FurnitureItem {
  id: string;
  type: "furniture" | "decoration" | "interactive" | "portal";
  label: string;
  left: number;
  bottom: number;
  w: number;
  h: number;
  actions: string[];
  dialogue?: string;
  targetScene?: SceneId;
  sprite?: string;
  /** 共处走近时的左右子槽（竖屏百分比）；缺省可由 furnitureNearSlots 推导 */
  anchors?: {
    L: { left: number; bottom: number };
    R: { left: number; bottom: number };
  };
  effects?: Record<string, FurnitureActionEffect>;
}

export interface FurnitureActionEffect {
  cost?: Partial<Record<"coins" | "seeds", number>>;
  reward?: Partial<Record<"coins" | "seeds" | "flowers" | "mementos", number>>;
  insufficientMessage?: string;
  bond?: number;
  journal?: string;
}
