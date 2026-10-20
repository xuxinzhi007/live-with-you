import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleCompanion } from "./netlify/functions/companion-scene.mjs";
import { coupleRoomDevPlugin } from "./vite-plugins/couple-room-dev";

function readBody(req: { on: (event: string, cb: (chunk?: Buffer) => void) => void }): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function companionDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: "companion-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== "/.netlify/functions/companion-scene") {
          next();
          return;
        }
        try {
          const body = req.method === "POST" || req.method === "PUT" ? await readBody(req) : "";
          const result = await handleCompanion({
            httpMethod: req.method || "GET",
            body,
            env,
          });
          res.statusCode = result.statusCode;
          for (const [key, value] of Object.entries(result.headers || {})) {
            res.setHeader(key, value);
          }
          res.end(result.body);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : "陪伴接口失败",
          }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), companionDevPlugin(env), coupleRoomDevPlugin()],
    server: {
      host: true,
      port: 5173,
    },
  };
});
