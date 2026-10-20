import type { FurnitureItem } from "../data/scenes.ts";
import {
  COPLAY_PAIR_SLOTS,
  SCENE_SLOTS,
  furnitureNearSlots,
  type SlotId,
  type SlotPose,
} from "../data/slots.ts";
import type { CoplayJuice } from "../data/coplay-actions.ts";

/** 锚点短位移时长（竖屏不走长途） */
export const APPROACH_MS = 720;
export const SCENE_FADE_MS = 220;
export const RETURN_HOME_MS = 1600;

export type StageActor = "self" | "peer" | "pet";

export function poseFromSlot(slot: SlotId): SlotPose {
  return { ...SCENE_SLOTS[slot] };
}

export function poseStyle(pose: SlotPose): { left: string; bottom: string } {
  return {
    left: `${pose.left}%`,
    bottom: `${pose.bottom}%`,
  };
}

/** 共处动词 → 优先走近的家具 id（当前场景没有则用靠拢槽） */
export function coplayFurnitureHint(juice: CoplayJuice, sceneId: string): string | null {
  const map: Record<CoplayJuice, Record<string, string>> = {
    sit: { bedroom: "armchair", balcony: "balcony-chair", cafe: "cafe-table", street: "street-bench" },
    look: { bedroom: "window-a", balcony: "sky-view", cafe: "cafe-table", street: "street-sign" },
    pass: { bedroom: "snack", cafe: "cafe-counter", street: "street-flower" },
    lean: { bedroom: "armchair", balcony: "balcony-chair", cafe: "cafe-table" },
    greet: {},
    clap: {},
  };
  return map[juice]?.[sceneId] ?? null;
}

export function nearPoseForActor(
  furniture: FurnitureItem,
  actor: "self" | "other",
): SlotPose {
  const near = furnitureNearSlots(furniture);
  return actor === "self" ? { ...near.L } : { ...near.R };
}

export function coplayPairPoses(): { self: SlotPose; other: SlotPose } {
  return {
    self: poseFromSlot(COPLAY_PAIR_SLOTS.self),
    other: poseFromSlot(COPLAY_PAIR_SLOTS.peer),
  };
}
