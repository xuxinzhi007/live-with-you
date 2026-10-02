// 竖屏移动端场景定义 - 基于9:16设计基准
// 坐标系统: left/bottom 百分比定位，确保所有竖屏设备一致

export const SCENES = [
  { id: "bedroom", name: "小屋", icon: "🏠", order: 0 },
  { id: "balcony", name: "阳台", icon: "", order: 1 },
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
    {
      id: "bed",
      type: "furniture",
      label: "小床",
      left: 5, bottom: 35, w: 45, h: 25,
      color: "#d4a0a0",
      borderRadius: "8px 16px 4px 4px",
      actions: ["sleep", "rest"],
      dialogue: "想休息一下吗？",
      sprite: "rest",
    },
    {
      id: "desk",
      type: "furniture",
      label: "书桌",
      left: 55, bottom: 35, w: 40, h: 22,
      color: "#c99d70",
      borderRadius: "4px",
      actions: ["work", "read"],
      dialogue: "要写点什么吗？",
    },
    {
      id: "armchair",
      type: "furniture",
      label: "沙发",
      left: 52, bottom: 35, w: 38, h: 20,
      color: "#a86963",
      borderRadius: "12px 12px 4px 4px",
      actions: ["sit", "relax"],
      dialogue: "坐一会儿吧～",
    },
    {
      id: "window-a",
      type: "decoration",
      label: "窗户",
      left: 8, bottom: 62, w: 35, h: 28,
      color: "#8ec5dd",
      borderRadius: "4px",
      actions: ["look"],
      dialogue: "外面的天气真好呢",
    },
    {
      id: "window-b",
      type: "decoration",
      label: "窗户",
      left: 57, bottom: 62, w: 35, h: 28,
      color: "#8ec5dd",
      borderRadius: "4px",
      actions: ["look"],
      dialogue: "看看窗外吧",
    },
    {
      id: "plant-a",
      type: "decoration",
      label: "植物",
      left: 2, bottom: 35, w: 8, h: 28,
      color: "#7f9a6d",
      borderRadius: "50% 50% 4px 4px",
      actions: ["sniff", "water"],
      dialogue: "植物长高了呢！",
    },
    {
      id: "lamp",
      type: "decoration",
      label: "台灯",
      left: 82, bottom: 35, w: 12, h: 30,
      color: "#ead19b",
      borderRadius: "50% 50% 4px 4px",
      actions: ["light"],
      dialogue: "开灯啦～",
    },
    {
      id: "rug",
      type: "decoration",
      label: "地毯",
      left: 10, bottom: 32, w: 80, h: 5,
      color: "#d9b49a",
      borderRadius: "20px",
      actions: ["sit"],
    },
    {
      id: "toy-box",
      type: "interactive",
      label: "玩具箱",
      left: 15, bottom: 38, w: 18, h: 18,
      color: "#e8a87c",
      borderRadius: "8px",
      actions: ["play"],
      dialogue: "一起玩吧！",
      sprite: "jump",
    },
    {
      id: "snack",
      type: "interactive",
      label: "零食",
      left: 72, bottom: 38, w: 15, h: 15,
      color: "#f5c6aa",
      borderRadius: "50%",
      actions: ["treat"],
      dialogue: "好吃～",
      sprite: "happy",
    },
    {
      id: "record-player",
      type: "interactive",
      label: "唱片机",
      left: 35, bottom: 38, w: 15, h: 15,
      color: "#8b6f5c",
      borderRadius: "8px",
      actions: ["dance"],
      dialogue: "一起跳舞吧！",
      sprite: "happy",
    },
    {
      id: "home-door",
      type: "portal",
      label: "出门",
      left: 78, bottom: 35, w: 20, h: 35,
      color: "#a07050",
      borderRadius: "16px 4px 4px 4px",
      actions: ["travel"],
      targetScene: "street",
      dialogue: "一起出门吧！",
    },
  ],
  balcony: [
    {
      id: "balcony-plant",
      type: "decoration",
      label: "盆栽",
      left: 5, bottom: 35, w: 25, h: 28,
      color: "#659a68",
      borderRadius: "50% 50% 4px 4px",
      actions: ["sniff", "water"],
      dialogue: "浇浇水吧～",
    },
    {
      id: "balcony-chair",
      type: "furniture",
      label: "藤椅",
      left: 50, bottom: 35, w: 45, h: 28,
      color: "#d9b681",
      borderRadius: "12px",
      actions: ["sit", "relax"],
      dialogue: "坐着吹风好舒服",
    },
    {
      id: "railing",
      type: "decoration",
      label: "栏杆",
      left: 0, bottom: 32, w: 100, h: 5,
      color: "#9c714e",
      borderRadius: "2px",
      actions: ["look"],
    },
    {
      id: "sky-view",
      type: "decoration",
      label: "天空",
      left: 0, bottom: 37, w: 100, h: 35,
      color: "transparent",
      borderRadius: "0",
      actions: ["look"],
      dialogue: "今天的天空真美",
    },
    {
      id: "balcony-exit",
      type: "portal",
      label: "下楼",
      left: 75, bottom: 35, w: 22, h: 32,
      color: "#8b6f5c",
      borderRadius: "4px",
      actions: ["travel"],
      targetScene: "street",
      dialogue: "下楼去玩吧！",
    },
  ],
  street: [
    {
      id: "street-fountain",
      type: "decoration",
      label: "喷泉",
      left: 25, bottom: 35, w: 50, h: 30,
      color: "#78b8cf",
      borderRadius: "50%",
      actions: ["look", "play"],
      dialogue: "喷泉好漂亮～",
    },
    {
      id: "street-flower",
      type: "interactive",
      label: "花摊",
      left: 5, bottom: 35, w: 22, h: 20,
      color: "#e8a0bf",
      borderRadius: "8px",
      actions: ["buy", "sniff"],
      dialogue: "要买花吗？",
      sprite: "happy",
    },
    {
      id: "street-bench",
      type: "furniture",
      label: "长椅",
      left: 65, bottom: 35, w: 32, h: 18,
      color: "#b78155",
      borderRadius: "8px 8px 4px 4px",
      actions: ["sit", "rest"],
      dialogue: "坐下来休息一下吧",
    },
    {
      id: "street-sign",
      type: "decoration",
      label: "路牌",
      left: 20, bottom: 35, w: 8, h: 25,
      color: "#795542",
      borderRadius: "4px",
      actions: ["look"],
      dialogue: "这是哪里呢？",
    },
    {
      id: "street-gate",
      type: "portal",
      label: "入口",
      left: 80, bottom: 35, w: 18, h: 35,
      color: "#f5e6d1",
      borderRadius: "16px 4px 4px 4px",
      actions: ["travel"],
      targetScene: "bedroom",
      dialogue: "回家吧～",
    },
  ],
  cafe: [
    {
      id: "cafe-counter",
      type: "furniture",
      label: "吧台",
      left: 5, bottom: 35, w: 90, h: 25,
      color: "#9b674c",
      borderRadius: "8px 8px 0 0",
      actions: ["order"],
      dialogue: "想喝点什么？",
    },
    {
      id: "cafe-table",
      type: "furniture",
      label: "小桌",
      left: 30, bottom: 62, w: 40, h: 25,
      color: "#a85e4c",
      borderRadius: "50%",
      actions: ["sit", "rest"],
      dialogue: "坐这儿喝咖啡吧",
    },
    {
      id: "cafe-exit",
      type: "portal",
      label: "出口",
      left: 78, bottom: 35, w: 20, h: 35,
      color: "#7a4f3b",
      borderRadius: "4px",
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
  color: string;
  borderRadius: string;
  actions: string[];
  dialogue?: string;
  targetScene?: SceneId;
  sprite?: string;
}
