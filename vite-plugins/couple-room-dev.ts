import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

type RoomClient = {
  res: ServerResponse;
  roomId: string;
};

const ROOM_PATH = "/.wenbebi/couple-room";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * 开发态情侣房中继：SSE 订阅 + POST 广播。
 * 跨浏览器 / 局域网双机可用（BroadcastChannel 做不到）。
 */
export function coupleRoomDevPlugin(): Plugin {
  const rooms = new Map<string, Set<RoomClient>>();

  const broadcast = (roomId: string, payload: string, except?: ServerResponse) => {
    const clients = rooms.get(roomId);
    if (!clients) return;
    for (const client of [...clients]) {
      if (except && client.res === except) continue;
      if (client.res.writableEnded) {
        clients.delete(client);
        continue;
      }
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch {
        clients.delete(client);
      }
    }
  };

  return {
    name: "couple-room-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || "";
        const url = new URL(rawUrl, "http://localhost");
        if (url.pathname !== ROOM_PATH) {
          next();
          return;
        }

        const roomId = (url.searchParams.get("room") || "").trim() || "wenbebi-couple";

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "content-type");
          res.end();
          return;
        }

        if (req.method === "GET") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
          });
          res.write(`: connected ${roomId}\n\n`);

          const client: RoomClient = { res, roomId };
          let set = rooms.get(roomId);
          if (!set) {
            set = new Set();
            rooms.set(roomId, set);
          }
          set.add(client);

          const keepAlive = setInterval(() => {
            if (res.writableEnded) {
              clearInterval(keepAlive);
              return;
            }
            try {
              res.write(`: ping\n\n`);
            } catch {
              clearInterval(keepAlive);
            }
          }, 15000);

          const cleanup = () => {
            clearInterval(keepAlive);
            set?.delete(client);
            if (set && set.size === 0) rooms.delete(roomId);
          };
          req.on("close", cleanup);
          req.on("error", cleanup);
          return;
        }

        if (req.method === "POST") {
          try {
            const body = await readBody(req);
            const parsed = JSON.parse(body) as { roomId?: string; message?: unknown };
            const targetRoom = (parsed.roomId || roomId).trim() || "wenbebi-couple";
            if (!parsed.message || typeof parsed.message !== "object") {
              res.statusCode = 400;
              res.setHeader("content-type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ ok: false, error: "message required" }));
              return;
            }
            const payload = JSON.stringify(parsed.message);
            broadcast(targetRoom, payload);
            res.statusCode = 204;
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end();
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : "room relay failed",
            }));
          }
          return;
        }

        res.statusCode = 405;
        res.end("Method Not Allowed");
      });
    },
  };
}
