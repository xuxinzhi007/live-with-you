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

/** 已跑通的官方 Qwen 编辑 API 图（docs/comfy-official-qwen 第 7 节）。只覆盖 8/11/13，需要负向时才改 9。 */
function officialQwenPrompt(overrides: {
  prompt: string;
  negative?: string;
  seed: number;
  filenamePrefix: string;
}): Record<string, unknown> {
  const negative = overrides.negative ?? "";
  return {
    "1": { class_type: "LoadImage", inputs: { image: "Wenbao_redraw_00001_.png" } },
    "2": { class_type: "UnetLoaderGGUF", inputs: { unet_name: "Qwen-Image-Edit-2509-Q4_K_M.gguf" } },
    "3": {
      class_type: "CLIPLoader",
      inputs: {
        clip_name: "qwen_2.5_vl_7b_fp8_scaled.safetensors",
        type: "qwen_image",
        device: "default",
      },
    },
    "4": { class_type: "VAELoader", inputs: { vae_name: "qwen_image_vae.safetensors" } },
    "5": {
      class_type: "LoraLoaderModelOnly",
      inputs: {
        model: ["2", 0],
        lora_name: "Qwen-Image-Edit-2509-Lightning-8steps-V1.0-bf16.safetensors",
        strength_model: 1.0,
      },
    },
    "6": { class_type: "ModelSamplingAuraFlow", inputs: { model: ["5", 0], shift: 3.0 } },
    "7": { class_type: "CFGNorm", inputs: { model: ["6", 0], strength: 1.0 } },
    "8": {
      class_type: "TextEncodeQwenImageEditPlus",
      inputs: { clip: ["3", 0], vae: ["4", 0], image1: ["1", 0], prompt: overrides.prompt },
    },
    "9": {
      class_type: "TextEncodeQwenImageEditPlus",
      inputs: { clip: ["3", 0], vae: ["4", 0], image1: ["1", 0], prompt: negative },
    },
    "10": { class_type: "VAEEncode", inputs: { pixels: ["1", 0], vae: ["4", 0] } },
    "11": {
      class_type: "KSampler",
      inputs: {
        seed: overrides.seed,
        steps: 8,
        cfg: 1.0,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 1.0,
        model: ["7", 0],
        positive: ["8", 0],
        negative: ["9", 0],
        latent_image: ["10", 0],
      },
    },
    "12": { class_type: "VAEDecode", inputs: { samples: ["11", 0], vae: ["4", 0] } },
    "13": {
      class_type: "SaveImage",
      inputs: { images: ["12", 0], filename_prefix: overrides.filenamePrefix },
    },
  };
}

const FORBIDDEN_GRAPH = [/meinamix/i, /wenbao_v1/i, /xiaoyan\.safetensors/i];
const DRAW_TIMEOUT_MS = 240_000;
const DEFAULT_EDIT_PROMPT =
  "Keep the same character and the same white T-shirt and white shorts. Front view, standing, looking at viewer, full body, simple white background.";

function companionDevPlugin(env: Record<string, string>): Plugin {
  const comfyBase = (env.COMFY_BASE_URL || "http://127.0.0.1:8188").replace(/\/$/, "");

  return {
    name: "companion-and-comfy-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];

        // 1. 本地 ComfyUI 官方 Qwen 编辑代理（/api/comfy/draw）
        if (url === "/api/comfy/draw" && req.method === "POST") {
          try {
            const raw = await readBody(req);
            const input = JSON.parse(raw || "{}");
            const userPrompt = String(input.prompt || "").trim().slice(0, 600);
            const prompt = userPrompt || DEFAULT_EDIT_PROMPT;
            const negativeRaw = input.negative != null ? String(input.negative).slice(0, 600) : "";
            const seed =
              Number.isFinite(Number(input.seed)) && Number(input.seed) >= 0
                ? Math.floor(Number(input.seed))
                : Math.floor(Math.random() * 900000000) + 100000;
            const filenamePrefix = "wenbao_qwen_edit_official/wenbao_q4_live";

            const graph = officialQwenPrompt({
              prompt,
              negative: negativeRaw,
              seed,
              filenamePrefix,
            });
            const graphText = JSON.stringify(graph);
            for (const pat of FORBIDDEN_GRAPH) {
              if (pat.test(graphText)) {
                throw new Error("官方 Qwen 图不应包含旧底模或角色 LoRA");
              }
            }

            const submitRes = await fetch(`${comfyBase}/prompt`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ client_id: "wenbebi-qwen-official", prompt: graph }),
            });
            if (!submitRes.ok) throw new Error(`ComfyUI status ${submitRes.status}`);
            const submitDoc = (await submitRes.json()) as {
              prompt_id?: string;
              node_errors?: Record<string, unknown>;
            };
            if (submitDoc.node_errors && Object.keys(submitDoc.node_errors).length > 0) {
              throw new Error("ComfyUI node_errors: " + JSON.stringify(submitDoc.node_errors));
            }
            const promptId = submitDoc.prompt_id;
            if (!promptId) throw new Error("ComfyUI 未返回 prompt_id");

            const start = Date.now();
            let imageDataUrl = "";
            while (Date.now() - start < DRAW_TIMEOUT_MS) {
              await new Promise((r) => setTimeout(r, 1000));
              const hRes = await fetch(`${comfyBase}/history/${encodeURIComponent(promptId)}`);
              if (!hRes.ok) continue;
              const hDoc = (await hRes.json()) as Record<string, any>;
              const item = hDoc[promptId];
              if (!item) continue;
              const statusStr = item.status?.status_str;
              if (statusStr === "error") {
                throw new Error("ComfyUI 执行失败");
              }
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

            if (!imageDataUrl) throw new Error("生图超时（官方 Qwen 线建议等待 180–240 秒）");
            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: true, image: imageDataUrl, model: "Qwen-Image-Edit-2509-Q4" }));
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
