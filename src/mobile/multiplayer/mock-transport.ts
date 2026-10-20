import type { RoomMessage } from "./types";

export interface RoomTransport {
  publish: (message: RoomMessage) => void;
  subscribe: (handler: (message: RoomMessage) => void) => () => void;
  close: () => void;
}

const ROOM_PATH = "/.wenbebi/couple-room";

function createBroadcastFallback(roomId: string): RoomTransport {
  const channelName = `wenbebi-room:${roomId}`;
  if (typeof BroadcastChannel === "undefined") {
    const handlers = new Set<(message: RoomMessage) => void>();
    return {
      publish(message) {
        for (const handler of handlers) handler(message);
      },
      subscribe(handler) {
        handlers.add(handler);
        return () => handlers.delete(handler);
      },
      close() {
        handlers.clear();
      },
    };
  }

  const channel = new BroadcastChannel(channelName);
  return {
    publish(message) {
      channel.postMessage(message);
    },
    subscribe(handler) {
      const onMessage = (event: MessageEvent<RoomMessage>) => {
        if (event.data?.roomId === roomId) handler(event.data);
      };
      channel.addEventListener("message", onMessage);
      return () => channel.removeEventListener("message", onMessage);
    },
    close() {
      channel.close();
    },
  };
}

/**
 * 优先走 Vite 开发中继（跨浏览器 / 局域网），失败再回退 BroadcastChannel（同浏览器标签）。
 */
export function createMockTransport(roomId: string): RoomTransport {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return createBroadcastFallback(roomId);
  }

  const handlers = new Set<(message: RoomMessage) => void>();
  const fallback = createBroadcastFallback(roomId);
  let closed = false;
  let hubReady = false;
  let source: EventSource | null = null;
  let unsubFallback: (() => void) | null = null;

  const deliver = (message: RoomMessage) => {
    if (closed || message.roomId !== roomId) return;
    for (const handler of handlers) handler(message);
  };

  const enableFallbackOnly = () => {
    hubReady = false;
    if (!unsubFallback) unsubFallback = fallback.subscribe(deliver);
  };

  try {
    source = new EventSource(`${ROOM_PATH}?room=${encodeURIComponent(roomId)}`);
    source.onmessage = (event) => {
      try {
        deliver(JSON.parse(event.data) as RoomMessage);
      } catch {
        // ignore malformed
      }
    };
    source.onopen = () => {
      hubReady = true;
      // 中继可用时关掉 BC，避免同浏览器双通道重复投递
      if (unsubFallback) {
        unsubFallback();
        unsubFallback = null;
      }
    };
    source.onerror = () => {
      if (source?.readyState === EventSource.CLOSED) enableFallbackOnly();
    };
  } catch {
    source = null;
    enableFallbackOnly();
  }

  // 中继尚未 open 前，先用 BC 兜底，避免握手空窗
  if (!hubReady) enableFallbackOnly();

  return {
    publish(message) {
      if (closed) return;
      if (hubReady) {
        void fetch(ROOM_PATH, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roomId, message }),
          keepalive: true,
        }).catch(() => {
          enableFallbackOnly();
          fallback.publish(message);
        });
        return;
      }
      fallback.publish(message);
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close() {
      closed = true;
      handlers.clear();
      unsubFallback?.();
      unsubFallback = null;
      fallback.close();
      source?.close();
      source = null;
    },
  };
}
