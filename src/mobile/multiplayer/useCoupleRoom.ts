import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SceneId } from "../data/scenes";
import type { PlayerLookId } from "../data/player-looks";
import { peerColor, preferredSlot, type SlotId } from "../data/slots";
import { createMockTransport, type RoomTransport } from "./mock-transport";
import {
  type Presence,
  type RoomMember,
  type RoomMessage,
} from "./types";

export interface LocalIdentity {
  playerId: string;
  name: string;
  lookId: PlayerLookId;
}

function buildMember(
  identity: LocalIdentity,
  sceneId: SceneId,
  slot: SlotId,
  presence: Presence,
  action = "idle",
): RoomMember {
  return {
    playerId: identity.playerId,
    name: identity.name,
    lookId: identity.lookId,
    color: peerColor(identity.playerId),
    sceneId,
    slot,
    action,
    actionStartedAt: Date.now(),
    presence,
  };
}

/**
 * 情侣房：本地独立角色 + 远端 peers。
 * roomId 为 null 时不连中继（单人 + 雯宝代理）。
 */
export function useCoupleRoom(
  identity: LocalIdentity | null,
  sceneId: SceneId,
  roomId: string | null,
) {
  const [peers, setPeers] = useState<Record<string, RoomMember>>({});
  const [localSlot, setLocalSlot] = useState<SlotId>("L");
  const [localAction, setLocalAction] = useState("idle");
  const [joinedFlashName, setJoinedFlashName] = useState<string | null>(null);
  const transportRef = useRef<RoomTransport | null>(null);
  const identityRef = useRef(identity);
  const sceneRef = useRef(sceneId);
  const slotRef = useRef<SlotId>("L");
  const actionRef = useRef("idle");
  const roomIdRef = useRef(roomId);

  identityRef.current = identity;
  sceneRef.current = sceneId;
  roomIdRef.current = roomId;

  const publishHelloOrSync = useCallback((type: "hello" | "sync", presence: Presence = "online") => {
    const current = identityRef.current;
    const transport = transportRef.current;
    const activeRoom = roomIdRef.current;
    if (!current || !transport || !activeRoom) return;
    transport.publish({
      type,
      roomId: activeRoom,
      member: buildMember(current, sceneRef.current, slotRef.current, presence, actionRef.current),
    });
  }, []);

  useEffect(() => {
    if (!identity || !roomId) {
      setPeers({});
      setLocalAction("idle");
      return;
    }

    const transport = createMockTransport(roomId);
    transportRef.current = transport;
    slotRef.current = "L";
    setLocalSlot("L");
    setPeers({});

    const unsubscribe = transport.subscribe((message: RoomMessage) => {
      if (message.roomId !== roomId) return;
      const selfId = identityRef.current?.playerId;
      if (!selfId) return;

      if (message.type === "who" && message.fromId !== selfId) {
        publishHelloOrSync("hello", "online");
        return;
      }

      if (message.type === "hello" || message.type === "sync") {
        const member = message.member;
        if (member.playerId === selfId) return;
        setPeers((previous) => {
          const wasMissing = !previous[member.playerId];
          if (wasMissing && message.type === "hello") {
            queueMicrotask(() => setJoinedFlashName(member.name));
          }
          const next = { ...previous, [member.playerId]: member };
          const slot = preferredSlot(
            selfId,
            Object.keys(next).filter((id) => id !== selfId),
          );
          slotRef.current = slot;
          queueMicrotask(() => setLocalSlot(slot));
          return next;
        });
        return;
      }

      if (message.type === "bye") {
        if (message.playerId === selfId) return;
        setPeers((previous) => {
          const next = { ...previous };
          delete next[message.playerId];
          const slot = preferredSlot(
            selfId,
            Object.keys(next).filter((id) => id !== selfId),
          );
          slotRef.current = slot;
          queueMicrotask(() => setLocalSlot(slot));
          return next;
        });
        return;
      }

      if (message.type === "away") {
        if (message.playerId === selfId) return;
        setPeers((previous) => {
          const peer = previous[message.playerId];
          if (!peer) return previous;
          return {
            ...previous,
            [message.playerId]: { ...peer, presence: "away" },
          };
        });
        return;
      }

      if (message.type === "scene") {
        if (message.playerId === selfId) return;
        setPeers((previous) => {
          const peer = previous[message.playerId];
          if (!peer) return previous;
          return {
            ...previous,
            [message.playerId]: {
              ...peer,
              sceneId: message.sceneId,
              slot: message.slot,
              presence: "online",
            },
          };
        });
        return;
      }

      if (message.type === "action") {
        if (message.playerId === selfId) return;
        setPeers((previous) => {
          const peer = previous[message.playerId];
          if (!peer) return previous;
          return {
            ...previous,
            [message.playerId]: {
              ...peer,
              action: message.action,
              actionStartedAt: message.at,
              presence: "online",
            },
          };
        });
        return;
      }

      if (message.type === "coplay") {
        if (message.fromId === selfId) return;
        setPeers((previous) => {
          const peer = previous[message.fromId];
          if (!peer) return previous;
          return {
            ...previous,
            [message.fromId]: {
              ...peer,
              action: message.coplayId,
              actionStartedAt: message.at,
              presence: "online",
            },
          };
        });
      }
    });

    transport.publish({ type: "who", roomId, fromId: identity.playerId });
    publishHelloOrSync("hello", "online");

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        transport.publish({ type: "away", roomId, playerId: identity.playerId });
      } else {
        publishHelloOrSync("sync", "online");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      transport.publish({ type: "bye", roomId, playerId: identity.playerId });
      unsubscribe();
      transport.close();
      transportRef.current = null;
    };
  }, [identity?.playerId, identity?.name, identity?.lookId, roomId, publishHelloOrSync]);

  useEffect(() => {
    if (!identity || !roomId || !transportRef.current) return;
    slotRef.current = localSlot;
    transportRef.current.publish({
      type: "scene",
      roomId,
      playerId: identity.playerId,
      sceneId,
      slot: localSlot,
    });
    publishHelloOrSync("sync", "online");
  }, [sceneId, localSlot, identity, roomId, publishHelloOrSync]);

  useEffect(() => {
    if (!joinedFlashName) return;
    const timer = setTimeout(() => setJoinedFlashName(null), 1800);
    return () => clearTimeout(timer);
  }, [joinedFlashName]);

  const broadcastAction = useCallback((action: string) => {
    const current = identityRef.current;
    const transport = transportRef.current;
    const activeRoom = roomIdRef.current;
    if (!current || !transport || !activeRoom) return;
    actionRef.current = action;
    setLocalAction(action);
    transport.publish({
      type: "action",
      roomId: activeRoom,
      playerId: current.playerId,
      action,
      at: Date.now(),
    });
  }, []);

  const broadcastCoplay = useCallback((coplayId: string) => {
    const current = identityRef.current;
    const transport = transportRef.current;
    const activeRoom = roomIdRef.current;
    if (!current || !transport || !activeRoom) return;
    actionRef.current = coplayId;
    setLocalAction(coplayId);
    transport.publish({
      type: "coplay",
      roomId: activeRoom,
      fromId: current.playerId,
      coplayId,
      at: Date.now(),
    });
  }, []);

  const peerList = useMemo(
    () => Object.values(peers).filter((peer) => peer.playerId !== identity?.playerId),
    [peers, identity?.playerId],
  );

  return {
    roomId,
    isInRoom: Boolean(roomId),
    localSlot,
    localAction,
    peers: peerList,
    peersInScene: peerList.filter(
      (peer) => peer.sceneId === sceneId && peer.presence !== "offline",
    ),
    joinedFlashName,
    broadcastAction,
    broadcastCoplay,
  };
}
