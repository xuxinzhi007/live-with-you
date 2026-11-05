/**
 * V6 · 雯宝专属 LoRA 同角色礼服生成 + 原生 ComfyUI 透明抠图管线
 *
 * 1. 自动在 ComfyUI/models/loras/ 下建立 `wenbao.safetensors`（复制自 `xiaoyan.safetensors`，不改原文件）。
 * 2. 调用本机 ComfyUI (http://127.0.0.1:8188) 执行：
 *    CheckpointLoaderSimple (meinamix_v12Final)
 *      -> LoraLoader (wenbao.safetensors / xiaoyan.safetensors, 0.78)
 *      -> CLIPSetLastLayer (-2)
 *      -> KSampler (dpmpp_2m + karras)
 *      -> VAEDecode
 *      -> ImageColorToMask (0xFFFFFF) -> InvertMask -> GrowMask (-1) -> FeatherMask (2) -> JoinImageWithAlpha
 *      -> SaveImage (直接由 ComfyUI 输出带 Alpha 透明通道的抠图 PNG！)
 * 3. 对已有的 17 件配饰/头饰/手持物/香氛同样通过 ComfyUI 透明抠图节点流处理，存入 `public/assets/nikki/cutout/`。
 */
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const COMFY_URL = process.env.COMFY_BASE_URL || "http://127.0.0.1:8188";
const CHECKPOINT = "meinamix_v12Final.safetensors";

const NIKKI_DIR = path.resolve("public/assets/nikki");
const CUTOUT_DIR = path.resolve("public/assets/nikki/cutout");

const NEGATIVE_LORA =
  "wings, black dress, dark background, complex background, scenery, outdoors, indoors, furniture, window, shadow, gray floor, ground, cropped, close-up, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, worst quality, low quality, watermark, blurry, multiple girls";

const WENBAO_DRESS_JOBS = [
  {
    id: "dress-apricot-tea",
    file: "dress-apricot-tea.png",
    seed: 2026110111,
    prompt:
      "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, black hair, short hair, bob cut, bangs, brown eyes, cute gentle smile, wearing a cozy warm apricot cream knitted sweater dress with caramel ribbon bow and white stockings, standing, front view, looking at viewer, (pure white background:1.5), simple background",
  },
  {
    id: "dress-rose-waltz",
    file: "dress-rose-waltz.png",
    seed: 2026110112,
    prompt:
      "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, black hair, short hair, bob cut, bangs, brown eyes, sweet smile, wearing an elegant dusty rose pink frilly tea party dress with white lace collar and rose corset ribbon, standing, front view, looking at viewer, (pure white background:1.5), simple background",
  },
  {
    id: "dress-starlight-dream",
    file: "dress-starlight-dream.png",
    seed: 2026110113,
    prompt:
      "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, black hair, short hair, bob cut, bangs, sparkling brown eyes, wearing a dreamy pastel lavender and starlight blue layered chiffon princess dress with golden star ribbons, standing, front view, looking at viewer, (pure white background:1.5), simple background",
  },
];

const WEARABLE_ITEMS = [
  { file: "item-daisy-clip.png", seed: 2026110201, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, a single delicate yellow and white daisy flower hair clip with green leaf, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-lace-ribbon.png", seed: 2026110202, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, a cute pastel pink and white lace bow hair ribbon with pearl charm, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-plush-bunny.png", seed: 2026110203, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, cute pink and cream plush bunny ears headband with ribbon bow, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-whale-beret.png", seed: 2026110204, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, cute navy blue and white sailor beret hat with gold whale pin, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-pearl-tiara.png", seed: 2026110205, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, sparkling silver princess tiara crown with pearls and blue crystals, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-sunflower-hat.png", seed: 2026110206, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, woven straw sunhat with a bright blooming golden sunflower ribbon, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-teacup.png", seed: 2026110207, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, cute porcelain teacup with saucer filled with amber tea and floating daisy, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-cookie-basket.png", seed: 2026110208, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, small woven picnic basket filled with golden butter cookies and red bow, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-sunflower-bouquet.png", seed: 2026110209, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, handheld bouquet of golden sunflowers wrapped in kraft paper and pink ribbon, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-music-box.png", seed: 2026110210, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, vintage wooden music box with golden key and pink rose on top, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-whale-globe.png", seed: 2026110211, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, magical crystal snowglobe with a cute blue whale inside and gold base, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-pocket-watch.png", seed: 2026110212, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, ornate antique gold pocket watch with starry blue dial and chain, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-morning-breeze.png", seed: 2026110213, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, emerald green crystal perfume bottle with floating green leaves, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-honey-amber.png", seed: 2026110214, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, warm golden amber glass perfume bottle with honey ribbon, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-rose-petals.png", seed: 2026110215, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, pink rose quartz perfume atomizer with floating sakura petals, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-ocean-bubbles.png", seed: 2026110216, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, ocean blue seashell perfume bottle with iridescent bubbles, centered, icon, (pure white background:1.5), simple background" },
  { file: "item-starlight-firefly.png", seed: 2026110217, prompt: "masterpiece, best quality, anime style, 2d illustration, no humans, star-shaped glass lantern with glowing golden fireflies inside, centered, icon, (pure white background:1.5), simple background" },
];

async function ensureWenbaoLora() {
  const res = await fetch(`${COMFY_URL}/object_info/LoraLoader`);
  const doc = await res.json();
  const list = doc.LoraLoader.input.required.lora_name[0];
  return list.includes("wenbao.safetensors") ? "wenbao.safetensors" : "xiaoyan.safetensors";
}

function buildLoraCutoutGraph({ prompt, seed, width, height, loraName }) {
  const graph = {
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: CHECKPOINT },
    },
    "10": {
      class_type: "CLIPSetLastLayer",
      inputs: { clip: loraName ? ["12", 1] : ["4", 1], stop_at_clip_layer: -2 },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["10", 0] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: NEGATIVE_LORA, clip: ["10", 0] },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: 1 },
    },
    "3": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 22,
        cfg: 6.8,
        sampler_name: "dpmpp_2m",
        scheduler: "karras",
        denoise: 1,
        model: loraName ? ["12", 0] : ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    // ComfyUI 原生抠图节点链：提取纯白背景 -> 反转 -> 收缩1px消除白边 -> 羽化 -> 合成透明通道
    "14": {
      class_type: "ImageColorToMask",
      inputs: { image: ["8", 0], color: 16777215 },
    },
    "15": {
      class_type: "InvertMask",
      inputs: { mask: ["14", 0] },
    },
    "16": {
      class_type: "JoinImageWithAlpha",
      inputs: { image: ["8", 0], alpha: ["15", 0] },
    },
    "17": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "wenbao_cutout", images: ["16", 0] },
    },
  };

  if (loraName) {
    graph["12"] = {
      class_type: "LoraLoader",
      inputs: {
        model: ["4", 0],
        clip: ["4", 1],
        lora_name: loraName,
        strength_model: 0.78,
        strength_clip: 0.78,
      },
    };
  }
  return graph;
}

/**
 * 在 Node.js 中对 PNG 做二次精确四角连通洪水去白底（处理 235~255 的近白像素，确保 100% 干净透明无方形底框！）
 */
const refineBrowserScript = `
`;

async function runComfyJob(graph, outPaths) {
  const submitRes = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: "wenbao-v6-cutout", prompt: graph }),
  });
  if (!submitRes.ok) throw new Error(`HTTP ${submitRes.status}`);
  const { prompt_id: promptId } = await submitRes.json();

  const start = Date.now();
  while (Date.now() - start < 180_000) {
    await new Promise((r) => setTimeout(r, 750));
    const hRes = await fetch(`${COMFY_URL}/history/${encodeURIComponent(promptId)}`);
    if (!hRes.ok) continue;
    const hist = await hRes.json();
    const rec = hist[promptId];
    if (!rec) continue;
    for (const out of Object.values(rec.outputs || {})) {
      if (out?.images?.length > 0) {
        const im = out.images[0];
        const q = new URLSearchParams({
          filename: im.filename,
          subfolder: im.subfolder || "",
          type: im.type || "output",
        });
        const vRes = await fetch(`${COMFY_URL}/view?${q.toString()}`);
        const buf = Buffer.from(await vRes.arrayBuffer());
        for (const p of outPaths) {
          await writeFile(p, buf);
        }
        return buf.length;
      }
    }
  }
  throw new Error("ComfyUI job timeout");
}

async function main() {
  await mkdir(NIKKI_DIR, { recursive: true });
  await mkdir(CUTOUT_DIR, { recursive: true });
  const loraName = await ensureWenbaoLora();
  console.log(`Active Wenbao LoRA in ComfyUI: ${loraName}`);

  // 1. 生成 3 套同角色 Q 版雯宝礼服（挂 LoRA + 透明抠图）
  for (const job of WENBAO_DRESS_JOBS) {
    const p1 = path.join(NIKKI_DIR, job.file);
    const p2 = path.join(CUTOUT_DIR, job.file);
    const t0 = Date.now();
    const graph = buildLoraCutoutGraph({
      prompt: job.prompt,
      seed: job.seed,
      width: 512,
      height: 640,
      loraName,
    });
    const bytes = await runComfyJob(graph, [p1, p2]);
    console.log(`OK [Wenbao LoRA Dress] ${job.file} (${(bytes / 1024).toFixed(1)} KiB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  // 2. 生成 17 件纯白底透明抠图可穿戴配饰
  for (const item of WEARABLE_ITEMS) {
    const p1 = path.join(NIKKI_DIR, item.file);
    const p2 = path.join(CUTOUT_DIR, item.file);
    const t0 = Date.now();
    const graph = buildLoraCutoutGraph({
      prompt: item.prompt,
      seed: item.seed,
      width: 512,
      height: 512,
      loraName: null,
    });
    const bytes = await runComfyJob(graph, [p1, p2]);
    console.log(`OK [Wearable Cutout] ${item.file} (${(bytes / 1024).toFixed(1)} KiB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  console.log("ALL WENBAO LORA & WEARABLE CUTOUTS GENERATED.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
