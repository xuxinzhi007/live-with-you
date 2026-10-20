/** 竖屏多人站位槽（百分比，相对场景区域） */
export type SlotId = "L" | "R" | "C";

export interface SlotPose {
  left: number;
  bottom: number;
}

export const SCENE_SLOTS: Record<SlotId, SlotPose> = {
  L: { left: 28, bottom: 12 },
  R: { left: 62, bottom: 12 },
  C: { left: 45, bottom: 12 },
};

/** 共处动作临时站位：双方靠拢一点仍可读 */
export const COPLAY_PAIR_SLOTS: { self: SlotId; peer: SlotId } = {
  self: "L",
  peer: "R",
};

export function slotStyle(slot: SlotId): { left: string; bottom: string } {
  const pose = SCENE_SLOTS[slot];
  return {
    left: `${pose.left}%`,
    bottom: `${pose.bottom}%`,
  };
}

/** 稳定分配：playerId 字典序小的站 L，大的站 R */
export function preferredSlot(localId: string, peerIds: string[]): SlotId {
  const sorted = [localId, ...peerIds].sort();
  return sorted[0] === localId ? "L" : "R";
}

export function peerColor(playerId: string): string {
  let hash = 0;
  for (let i = 0; i < playerId.length; i += 1) {
    hash = (hash * 31 + playerId.charCodeAt(i)) >>> 0;
  }
  const palette = ["#56877a", "#c66f5c", "#6b7fd7", "#c4a35a", "#7a6b8a"];
  return palette[hash % palette.length];
}

/** 由家具包围盒推导 near 左右子槽 */
export function furnitureNearSlots(item: {
  left: number;
  bottom: number;
  w: number;
  anchors?: { L: SlotPose; R: SlotPose };
}): { L: SlotPose; R: SlotPose } {
  if (item.anchors) return item.anchors;
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    L: { left: round(item.left + item.w * 0.28), bottom: Math.max(8, item.bottom - 1) },
    R: { left: round(item.left + item.w * 0.72), bottom: Math.max(8, item.bottom - 1) },
  };
}
