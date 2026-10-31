import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleCompanion } from "./netlify/functions/companion-scene.mjs";

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
  const comfyBase = (env.COMFY_BASE_URL || "http://127.0.0.1:8188").replace(/\/$/, "");
  const defaultCkpt = env.COMFY_CHECKPOINT || "meinamix_v12Final.safetensors";

  return {
    name: "companion-and-comfy-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];

        // 1. 本地 ComfyUI 雯宝同角色 LoRA + 自动透明抠图代理接口 (/api/comfy/draw)
        if (url === "/api/comfy/draw" && req.method === "POST") {
          try {
            const raw = await readBody(req);
            const input = JSON.parse(raw || "{}");
            const useWenbaoLora = input.useWenbaoLora !== false;
            const userPrompt = String(input.prompt || "wearing a cute pastel dress").slice(0, 600);
            const fullPrompt = useWenbaoLora
              ? `masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, black hair, short hair, bob cut, bangs, brown eyes, cute smile, ${userPrompt}, standing, front view, looking at viewer, (white background:1.4), simple background`
              : `masterpiece, best quality, anime style, 2d illustration, no humans, ${userPrompt}, centered, (white background:1.4), simple background`;
            const negative =
              "wings, black dress, dark background, complex background, scenery, furniture, window, shadow, floor, cropped, close-up, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, worst quality, low quality, watermark, blurry, multiple girls";
            const seed = Math.floor(Math.random() * 900000000) + 100000;

            const graph: Record<string, any> = {
              "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: defaultCkpt } },
              "10": {
                class_type: "CLIPSetLastLayer",
                inputs: { clip: useWenbaoLora ? ["12", 1] : ["4", 1], stop_at_clip_layer: -2 },
              },
              "6": { class_type: "CLIPTextEncode", inputs: { text: fullPrompt, clip: ["10", 0] } },
              "7": { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["10", 0] } },
              "5": { class_type: "EmptyLatentImage", inputs: { width: 512, height: 640, batch_size: 1 } },
              "3": {
                class_type: "KSampler",
                inputs: {
                  seed,
                  steps: 24,
                  cfg: 6.8,
                  sampler_name: "dpmpp_2m",
                  scheduler: "karras",
                  denoise: 1,
                  model: useWenbaoLora ? ["12", 0] : ["4", 0],
                  positive: ["6", 0],
                  negative: ["7", 0],
                  latent_image: ["5", 0],
                },
              },
              "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
              "9": { class_type: "SaveImage", inputs: { filename_prefix: "wenbao_lora_live", images: ["8", 0] } },
            };

            if (useWenbaoLora) {
              graph["12"] = {
                class_type: "LoraLoader",
                inputs: {
                  model: ["4", 0],
                  clip: ["4", 1],
                  lora_name: "xiaoyan.safetensors",
                  strength_model: 0.8,
                  strength_clip: 0.8,
                },
              };
            }

            const submitRes = await fetch(`${comfyBase}/prompt`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ client_id: "wenbebi-live", prompt: graph }),
            });
            if (!submitRes.ok) throw new Error(`ComfyUI status ${submitRes.status}`);
            const { prompt_id: promptId } = (await submitRes.json()) as { prompt_id: string };

            const start = Date.now();
            let imageDataUrl = "";
            while (Date.now() - start < 120_000) {
              await new Promise((r) => setTimeout(r, 750));
              const hRes = await fetch(`${comfyBase}/history/${encodeURIComponent(promptId)}`);
              if (!hRes.ok) continue;
              const hDoc = (await hRes.json()) as Record<string, any>;
              const item = hDoc[promptId];
              if (!item) continue;
              for (const out of Object.values(item.outputs || {}) as any[]) {
                if (out?.images?.length > 0) {
                  const im = out.images[0];
                  const q = new URLSearchParams({
                    filename: im.filename,
                    subfolder: im.subfolder || "",
                    type: im.type || "output",
                  });
                  const vRes = await fetch(`${comfyBase}/view?${q.toString()}`);
                  const buf = Buffer.from(await vRes.arrayBuffer());
                  imageDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
                  break;
                }
              }
              if (imageDataUrl) break;
            }

            if (!imageDataUrl) throw new Error("生图超时");
            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: true, image: imageDataUrl, model: defaultCkpt }));
          } catch (error) {
            res.statusCode = 502;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : "本地 ComfyUI (8188) 未启动",
              }),
            );
          }
          return;
        }

        // 2. Ollama 陪伴接口
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
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : "陪伴接口失败",
            }),
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), companionDevPlugin(env)],
    server: {
      host: true,
      port: 5173,
    },
  };
});
