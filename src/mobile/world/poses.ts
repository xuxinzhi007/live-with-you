/**
 * 动作 → 角色姿态的纯映射。
 *
 * 放在 WorldApp 之外，方便单测；渲染层只负责按 PlayerPose 取帧。
 * 没有对应素材的皮肤会在渲染层回落到 react / idle。
 */
import type { ActionTone } from "./actions.ts";
import type { PlayerPose } from "./runtime.ts";
import type { RoomProp } from "./rooms.ts";

export interface PoseCue {
  pose: PlayerPose;
  duration: number;
}

export function poseForProp(prop: RoomProp, tone: ActionTone): PoseCue | null {
  // 冷却中的点击没有动作，只给一句提示。
  if (tone === "blocked") return null;
  // 门在抵达时直接切房间，不做姿态。
  if (prop.doorTo) return null;

  switch (prop.action) {
    case "rest":
      // 床铺：躺下。
      return { pose: "sleep", duration: 1800 };
    case "sit":
    case "read":
      // 长椅 / 书桌：坐下。
      return { pose: "sit", duration: 1600 };
    case "plot":
      // 花圃：蹲下照料，用坐姿短播。
      return { pose: "sit", duration: 900 };
    default:
      // 种花、浇水、买种、许愿、收藏架：一个短促的交互姿态。
      return { pose: "react", duration: 700 };
  }
}
