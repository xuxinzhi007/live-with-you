import type { SceneId } from "../data/scenes";
import type { PlayerLookId } from "../data/player-looks";
import type { SlotId } from "../data/slots";

export type Presence = "online" | "away" | "offline";

/** 房间内一个独立玩家（本地或远端） */
export interface RoomMember {
  playerId: string;
  name: string;
  lookId: PlayerLookId;
  color: string;
  sceneId: SceneId;
  slot: SlotId;
  action: string;
  actionStartedAt: number;
  presence: Presence;
}

export type RoomMessage =
  | { type: "who"; roomId: string; fromId: string }
  | { type: "hello"; roomId: string; member: RoomMember }
  | { type: "sync"; roomId: string; member: RoomMember }
  | { type: "bye"; roomId: string; playerId: string }
  | { type: "away"; roomId: string; playerId: string }
  | { type: "scene"; roomId: string; playerId: string; sceneId: SceneId; slot: SlotId }
  | { type: "action"; roomId: string; playerId: string; action: string; at: number }
  | { type: "coplay"; roomId: string; fromId: string; coplayId: string; at: number };

export const DEFAULT_ROOM_ID = "wenbebi-couple";
