/**
 * 本地 ComfyUI (http://127.0.0.1:8188 · meinamix_v12Final.safetensors) 动漫美术资产批量生成器
 *
 * 1:1 复刻 C:\Users\ZhuanZ1\Desktop\moe_social\backend\internal\biz\media\comfy.go 的节点图：
 * - CheckpointLoaderSimple: meinamix_v12Final.safetensors
 * - CLIPSetLastLayer: -2
 * - KSampler: dpmpp_2m + karras, cfg=6.5, steps=22
 *
 * 用法：
 *   node tools/generate-comfy-assets.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const COMFY_URL = process.env.COMFY_BASE_URL || "http://127.0.0.1:8188";
const CHECKPOINT = process.env.COMFY_CHECKPOINT || "meinamix_v12Final.safetensors";
const OUT_DIR = path.resolve("public/assets/nikki");

const NEGATIVE =
  "realistic, photorealistic, 3d, bad anatomy, bad hands, extra fingers, missing fingers, worst quality, low quality, blurry, watermark, text, signature, deformed, ugly, multiple girls";

/**
 * 为《雯宝 · 高定衣橱》生成的全套二次元动漫美术图清单：
 * 包含：
 * - 3 套新礼服角色立绘卡面
 * - 5 张唯美心境羁绊卡 CG
 * - 4 张高定配饰/手持物特写插画
 * - 2 张梦幻舞台画卷背景
 */
const ASSET_JOBS = [
  // 1. 礼服角色立绘 (512x640, 挂载 xiaoyan.safetensors LoRA 0.80 + 纯白背景便于 100% 透明抠图)
  {
    name: "dress-apricot-tea.png",
    width: 512,
    height: 640,
    seed: 2026110111,
    lora: "xiaoyan.safetensors",
    loraStrength: 0.8,
    prompt:
      "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, black hair, short hair, bob cut, bangs, brown eyes, cute gentle smile, wearing a cozy warm apricot cream knitted sweater dress with caramel ribbon bow and white stockings, standing, front view, looking at viewer, (white background:1.5), simple background",
  },
  {
    name: "dress-rose-waltz.png",
    width: 512,
    height: 640,
    seed: 2026110112,
    lora: "xiaoyan.safetensors",
    loraStrength: 0.8,
    prompt:
      "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, black hair, short hair, bob cut, bangs, brown eyes, sweet smile, wearing an elegant dusty rose pink frilly tea party dress with white lace collar and rose corset ribbon, standing, front view, looking at viewer, (white background:1.5), simple background",
  },
  {
    name: "dress-starlight-dream.png",
    width: 512,
    height: 640,
    seed: 2026110113,
    lora: "xiaoyan.safetensors",
    loraStrength: 0.8,
    prompt:
      "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, black hair, short hair, bob cut, bangs, sparkling brown eyes, wearing a dreamy pastel lavender and starlight blue layered chiffon princess dress with golden star ribbons, standing, front view, looking at viewer, (white background:1.5), simple background",
  },

  // 2. 5 张心境羁绊卡 CG (512x640)
  {
    name: "card-first-tea.png",
    width: 512,
    height: 640,
    seed: 2026103104,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, 1girl, solo, cute anime girl with short dark brown hair, sitting at a sunlit wooden table with strawberry shortcake and white porcelain teacup, warm afternoon sunlight through window, floating flower petals, cozy healing atmosphere",
  },
  {
    name: "card-rainy-window.png",
    width: 512,
    height: 640,
    seed: 2026103105,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, 1girl, solo, cute anime girl with short dark brown hair leaning by a rainy glass window, drawing a tiny smiley face on fogged glass, soft blue-green hydrangea outside, gentle lo-fi cozy mood",
  },
  {
    name: "card-midnight-cocoa.png",
    width: 512,
    height: 640,
    seed: 2026103106,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, 1girl, solo, cute anime girl with short dark brown hair holding a warm mug of hot cocoa topped with marshmallows, fairy lights in bedroom at night, warm amber glow, soft blanket",
  },
  {
    name: "card-ocean-promise.png",
    width: 512,
    height: 640,
    seed: 2026103107,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, 1girl, solo, cute anime girl with short dark brown hair in blue and white whale maid dress by the sparkling turquoise seaside, floating translucent bubbles and sea breeze, bright summer sky",
  },
  {
    name: "card-starlight-waltz.png",
    width: 512,
    height: 640,
    seed: 2026103108,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, 1girl, solo, cute anime girl with short dark brown hair dancing near a glowing fountain under a starry milky way night sky, golden fireflies and rose petals swirling, romantic fantasy anime CG",
  },

  // 3. 高定配饰与手持物精美特写卡面 (512x512) —— 全 17 件配饰/手持/香氛 100% 覆盖！
  {
    name: "item-daisy-clip.png",
    width: 512,
    height: 512,
    seed: 2026103113,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, delicate white daisy flower hairpin with golden leaf clip on a pastel cream velvet box, morning dew drops, soft sunlight, fantasy game item card",
  },
  {
    name: "item-lace-ribbon.png",
    width: 512,
    height: 512,
    seed: 2026103114,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, romantic ivory white lace ribbon bow hairband with tiny pearl charm, soft pastel pink background, anime dress-up game icon",
  },
  {
    name: "item-plush-bunny.png",
    width: 512,
    height: 512,
    seed: 2026103115,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, cute fluffy white and pastel pink lop-eared bunny plush headband with satin bow, warm cozy lighting, kawaii anime item illustration",
  },
  {
    name: "item-whale-beret.png",
    width: 512,
    height: 512,
    seed: 2026103116,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, cute navy blue and white sailor beret hat with a golden whale anchor brooch and white ribbon, ocean breeze sparkles, anime game item card",
  },
  {
    name: "item-sunflower-hat.png",
    width: 512,
    height: 512,
    seed: 2026103117,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, woven summer straw sunhat decorated with a bright blooming golden sunflower and chiffon ribbon, sunlit meadow background, anime illustration",
  },
  {
    name: "item-teacup.png",
    width: 512,
    height: 512,
    seed: 2026103118,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, warm white ceramic teacup filled with amber Earl Grey tea, painted with a tiny daisy, rising fragrant steam, cozy sunlight, anime item card",
  },
  {
    name: "item-cookie-basket.png",
    width: 512,
    height: 512,
    seed: 2026103119,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, woven picnic basket lined with red gingham cloth, filled with golden butter cookies and honey jar, warm bakery glow, anime food illustration",
  },
  {
    name: "item-sunflower-bouquet.png",
    width: 512,
    height: 512,
    seed: 2026103120,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, lush bouquet of golden sunflowers and white baby's breath wrapped in kraft paper and twine ribbon, sparkling sunlight particles, anime item card",
  },
  {
    name: "item-morning-breeze.png",
    width: 512,
    height: 512,
    seed: 2026103121,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, crystal perfume bottle with emerald green leaf stopper, surrounded by glowing mint leaves, morning dew droplets and wind swirls, magical aura item",
  },
  {
    name: "item-honey-amber.png",
    width: 512,
    height: 512,
    seed: 2026103122,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, ornate amber glass aromatherapy candle and honey perfume vial, surrounded by warm golden glowing light orbs and vanilla flowers, cozy magical aura",
  },
  {
    name: "item-rose-petals.png",
    width: 512,
    height: 512,
    seed: 2026103123,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, rose quartz crystal atomizer bottle surrounded by swirling pink sakura and rose petals in a magical glowing breeze, romantic anime item card",
  },
  {
    name: "item-ocean-bubbles.png",
    width: 512,
    height: 512,
    seed: 2026103124,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, seashell glass bottle surrounded by iridescent floating ocean bubbles, sea stars and shimmering aqua light waves, fantasy anime item",
  },
  {
    name: "item-starlight-firefly.png",
    width: 512,
    height: 512,
    seed: 2026103125,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, celestial star-shaped glass lantern with glowing golden fireflies and galaxy stardust swirling around it, dreamy night magic illustration",
  },
  {
    name: "item-pearl-tiara.png",
    width: 512,
    height: 512,
    seed: 2026103109,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, ornate silver tiara crown woven with glowing freshwater pearls and crystal flowers on a soft velvet cushion, magical sparkles, pastel fantasy item icon",
  },
  {
    name: "item-whale-globe.png",
    width: 512,
    height: 512,
    seed: 2026103110,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, magical glass snowglobe containing a cute miniature blue whale swimming in aurora borealis and silver glitter, ornate gold base, fantasy item illustration",
  },
  {
    name: "item-music-box.png",
    width: 512,
    height: 512,
    seed: 2026103111,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, vintage carved walnut wooden music box with golden gears and blooming pink roses, glowing musical notes floating in the air, warm dreamy lighting",
  },
  {
    name: "item-pocket-watch.png",
    width: 512,
    height: 512,
    seed: 2026103112,
    prompt:
      "masterpiece, best quality, anime style, 2d illustration, no humans, antique golden filigree pocket watch with starry celestial dial, surrounded by ribbons and starlight dust, anime game SSR item card",
  },
];

function buildComfyGraph({ prompt, width, height, seed, lora, loraStrength = 0.8 }) {
  const neg = lora
    ? "wings, black dress, dark background, complex background, scenery, furniture, window, shadow, floor, cropped, close-up, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, worst quality, low quality, watermark, blurry, multiple girls"
    : NEGATIVE;
  const graph = {
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: CHECKPOINT },
    },
    "10": {
      class_type: "CLIPSetLastLayer",
      inputs: { clip: lora ? ["12", 1] : ["4", 1], stop_at_clip_layer: -2 },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["10", 0] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: neg, clip: ["10", 0] },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: 1 },
    },
    "3": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 24,
        cfg: 6.8,
        sampler_name: "dpmpp_2m",
        scheduler: "karras",
        denoise: 1,
        model: lora ? ["12", 0] : ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "wenbebi_nikki", images: ["8", 0] },
    },
  };
  if (lora) {
    graph["12"] = {
      class_type: "LoraLoader",
      inputs: {
        model: ["4", 0],
        clip: ["4", 1],
        lora_name: lora,
        strength_model: loraStrength,
        strength_clip: loraStrength,
      },
    };
  }
  return graph;
}

async function generateOne(job) {
  const outPath = path.join(OUT_DIR, job.name);
  if (existsSync(outPath) && process.env.FORCE_REGEN !== "1" && !job.lora) {
    console.log(`SKIP (exists) ${job.name}`);
    return;
  }

  const submitRes = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: "wenbebi-nikki-gen",
      prompt: buildComfyGraph(job),
    }),
  });
  if (!submitRes.ok) {
    throw new Error(`ComfyUI /prompt HTTP ${submitRes.status}`);
  }
  const { prompt_id: promptId } = await submitRes.json();

  const start = Date.now();
  while (Date.now() - start < 180_000) {
    await new Promise((r) => setTimeout(r, 800));
    const histRes = await fetch(`${COMFY_URL}/history/${encodeURIComponent(promptId)}`);
    if (!histRes.ok) continue;
    const hist = await histRes.json();
    const record = hist[promptId];
    if (!record) continue;

    const outputs = record.outputs || {};
    for (const nodeOut of Object.values(outputs)) {
      if (nodeOut?.images?.length > 0) {
        const img = nodeOut.images[0];
        const q = new URLSearchParams({
          filename: img.filename,
          subfolder: img.subfolder || "",
          type: img.type || "output",
        });
        const viewRes = await fetch(`${COMFY_URL}/view?${q.toString()}`);
        const buf = Buffer.from(await viewRes.arrayBuffer());
        await writeFile(outPath, buf);
        console.log(`OK   ${job.name} (${(buf.length / 1024).toFixed(1)} KiB, ${((Date.now() - start) / 1000).toFixed(1)}s)`);
        return;
      }
    }
  }
  throw new Error(`Timeout waiting for ${job.name}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Connecting to ComfyUI at ${COMFY_URL} (model: ${CHECKPOINT})...`);
  for (const job of ASSET_JOBS) {
    await generateOne(job);
  }
  console.log("ALL DONE.");
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
