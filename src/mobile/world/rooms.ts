/**
 * V2 房间与物件数据。
 *
 * 坐标是“世界单位”：世界高固定 1000，横向按房间加宽；渲染时按屏幕高度等比缩放，
 * 相机只做横向跟随。这样 360–430px 宽的手机都能得到同一个空间关系，不再用百分比
 * 把家具压成图标。
 *
 * 地平线在 y=640；可行走带 y≈760–900（底栏上方）。角色站立高 300 单位，
 * 门高 340、树高 500，关键物件按“角色身高的 0.6–1.5 倍”定标。
 */
import type { WorldRoomId } from "../engine/types";

export type PropKind =
  | "door"
  | "bed"
  | "desk"
  | "shelf"
  | "plant"
  | "rug"
  | "plot"
  | "stall"
  | "bench"
  | "fountain"
  | "lamp"
  | "tree"
  | "crate"
  | "ball";

export type PropAction =
  | "rest"
  | "read"
  | "shelf"
  | "plot"
  | "buySeed"
  | "sit"
  | "wish"
  | "playBall";

export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface RoomProp {
  id: string;
  kind: PropKind;
  label: string;
  /** 物件中心 x（世界单位） */
  x: number;
  /** 脚底 / 底边 y（世界单位） */
  y: number;
  w: number;
  h: number;
  /** 走近点；缺省为物件正前方 */
  approach?: { x: number; y: number };
  /** 阻挡区域；缺省不阻挡 */
  footprint?: Rect;
  action?: PropAction;
  plotIndex?: number;
  doorTo?: WorldRoomId;
  /** 从这扇门进入目标房间时，玩家出现的位置（目标房间坐标） */
  spawn?: { x: number; y: number };
  /** 靠近时是否显示标签 */
  tagged?: boolean;
}

export interface RoomDef {
  id: WorldRoomId;
  name: string;
  worldW: number;
  walk: Rect;
  defaultSpawn: { x: number; y: number };
  props: RoomProp[];
}

const DOOR_H = 340;

export const ROOMS: Record<WorldRoomId, RoomDef> = {
  home: {
    id: "home",
    name: "小屋",
    worldW: 980,
    walk: { x0: 60, x1: 920, y0: 760, y1: 884 },
    defaultSpawn: { x: 440, y: 880 },
    props: [
      {
        id: "home-garden-door",
        kind: "door",
        label: "庭院",
        x: 92,
        y: 830,
        w: 138,
        h: DOOR_H,
        doorTo: "garden",
        spawn: { x: 195, y: 880 },
        footprint: { x0: 23, x1: 161, y0: 800, y1: 830 },
        tagged: true,
      },
      {
        id: "bed",
        kind: "bed",
        label: "床",
        x: 292,
        y: 832,
        w: 320,
        h: 240,
        action: "rest",
        footprint: { x0: 132, x1: 452, y0: 796, y1: 832 },
        tagged: true,
      },
      {
        id: "desk",
        kind: "desk",
        label: "书桌",
        x: 580,
        y: 832,
        w: 220,
        h: 210,
        action: "read",
        footprint: { x0: 470, x1: 690, y0: 800, y1: 832 },
        tagged: true,
      },
      {
        id: "shelf",
        kind: "shelf",
        label: "收藏架",
        x: 772,
        y: 826,
        w: 156,
        h: 300,
        action: "shelf",
        footprint: { x0: 694, x1: 850, y0: 796, y1: 826 },
        tagged: true,
      },
      {
        id: "home-street-door",
        kind: "door",
        label: "出门",
        x: 898,
        y: 830,
        w: 130,
        h: DOOR_H,
        doorTo: "street",
        spawn: { x: 205, y: 880 },
        footprint: { x0: 833, x1: 963, y0: 800, y1: 830 },
        tagged: true,
      },
      {
        id: "home-plant",
        kind: "plant",
        label: "绿植",
        x: 664,
        y: 912,
        w: 100,
        h: 160,
      },
      {
        id: "home-rug",
        kind: "rug",
        label: "地毯",
        x: 486,
        y: 950,
        w: 820,
        h: 100,
      },
    ],
  },
  garden: {
    id: "garden",
    name: "庭院",
    worldW: 960,
    walk: { x0: 60, x1: 920, y0: 760, y1: 884 },
    defaultSpawn: { x: 200, y: 880 },
    props: [
      {
        id: "garden-home-door",
        kind: "door",
        label: "回屋",
        x: 96,
        y: 830,
        w: 138,
        h: DOOR_H,
        doorTo: "home",
        spawn: { x: 200, y: 880 },
        footprint: { x0: 27, x1: 165, y0: 800, y1: 830 },
        tagged: true,
      },
      {
        id: "plot-0",
        kind: "plot",
        label: "小花圃",
        x: 320,
        y: 838,
        w: 142,
        h: 96,
        action: "plot",
        plotIndex: 0,
        footprint: { x0: 249, x1: 391, y0: 796, y1: 838 },
        tagged: true,
      },
      {
        id: "plot-1",
        kind: "plot",
        label: "小花圃",
        x: 490,
        y: 838,
        w: 142,
        h: 96,
        action: "plot",
        plotIndex: 1,
        footprint: { x0: 419, x1: 561, y0: 796, y1: 838 },
        tagged: true,
      },
      {
        id: "plot-2",
        kind: "plot",
        label: "小花圃",
        x: 660,
        y: 838,
        w: 142,
        h: 96,
        action: "plot",
        plotIndex: 2,
        footprint: { x0: 589, x1: 731, y0: 796, y1: 838 },
        tagged: true,
      },
      {
        id: "garden-ball",
        kind: "ball",
        label: "小皮球",
        x: 780,
        y: 902,
        w: 64,
        h: 64,
        action: "playBall",
        approach: { x: 780, y: 898 },
        tagged: true,
      },
      {
        id: "garden-tree",
        kind: "tree",
        label: "大树",
        x: 840,
        y: 820,
        w: 320,
        h: 520,
        footprint: { x0: 730, x1: 950, y0: 786, y1: 820 },
      },
    ],
  },
  street: {
    id: "street",
    name: "街区",
    worldW: 1180,
    walk: { x0: 60, x1: 1120, y0: 760, y1: 884 },
    defaultSpawn: { x: 205, y: 880 },
    props: [
      {
        id: "street-home-door",
        kind: "door",
        label: "回家",
        x: 96,
        y: 830,
        w: 138,
        h: DOOR_H,
        doorTo: "home",
        spawn: { x: 860, y: 880 },
        footprint: { x0: 27, x1: 165, y0: 800, y1: 830 },
        tagged: true,
      },
      {
        id: "street-lamp",
        kind: "lamp",
        label: "路灯",
        x: 246,
        y: 824,
        w: 82,
        h: 380,
        footprint: { x0: 205, x1: 287, y0: 784, y1: 824 },
      },
      {
        id: "fountain",
        kind: "fountain",
        label: "喷泉",
        x: 480,
        y: 848,
        w: 340,
        h: 250,
        action: "wish",
        footprint: { x0: 310, x1: 650, y0: 812, y1: 848 },
        tagged: true,
      },
      {
        id: "flower-stall",
        kind: "stall",
        label: "花摊",
        x: 840,
        y: 838,
        w: 340,
        h: 330,
        action: "buySeed",
        footprint: { x0: 670, x1: 1010, y0: 798, y1: 838 },
        tagged: true,
      },
      {
        id: "street-bench",
        kind: "bench",
        label: "长椅",
        x: 1060,
        y: 832,
        w: 210,
        h: 140,
        action: "sit",
        footprint: { x0: 955, x1: 1165, y0: 802, y1: 832 },
        tagged: true,
      },
    ],
  },
};

export const ROOM_ORDER: WorldRoomId[] = ["home", "garden", "street"];

export function getRoom(room: WorldRoomId): RoomDef {
  return ROOMS[room] ?? ROOMS.home;
}

export function getProp(room: WorldRoomId, propId: string): RoomProp | undefined {
  return getRoom(room).props.find((prop) => prop.id === propId);
}

/** 走近点：默认站在物件正前方 66 单位处；由 runtime 再夹进可行走带。 */
export function propApproach(prop: RoomProp): { x: number; y: number } {
  if (prop.approach) return prop.approach;
  return { x: prop.x, y: prop.y + 66 };
}

export function propBounds(prop: RoomProp): Rect {
  return {
    x0: prop.x - prop.w / 2,
    x1: prop.x + prop.w / 2,
    y0: prop.y - prop.h,
    y1: prop.y,
  };
}

export function propFootprint(prop: RoomProp): Rect | null {
  if (prop.footprint) return prop.footprint;
  // Small scenery must not become an invisible wall across the walking band.
  if (prop.kind === "rug" || prop.kind === "ball" || prop.kind === "plant" || prop.action === "plot") {
    return null;
  }
  return { x0: prop.x - prop.w * 0.3, x1: prop.x + prop.w * 0.3, y0: prop.y - 18, y1: prop.y };
}
