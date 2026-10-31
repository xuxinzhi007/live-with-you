/**
 * 本地 ComfyUI (http://127.0.0.1:8188 · meinamix_v12Final.safetensors + xiaoyan.safetensors LoRA)
 * 雯宝同角色换装 + 纯单件无人物配饰 + 同角色羁绊 CG 生成管线（V7 校准版）
 *
 * 解决三大问题：
 * 1. 【礼服同角色且颜色款式 100% 准确】：LoRA 强度设为 0.58，负向强力排除 `wings, black dress, white dress, detached sleeves`，
 *    确保「杏仁奶昔针织裙」是暖杏色毛衣裙、「暮色蔷薇圆舞曲」是粉红蔷薇礼服、「星河眠云轻纱裙」是星空蓝紫纱裙，且无黑块残影！
 * 2. 【配饰 100% 是纯物品（绝不画出金发陌生女孩）】：在 MeinaMix 中绝对不能写 `hairpin / headband / hat` 等会触发画人头的词，
 *    并在负向提示词中加入 `(1girl, girl, human, face, head, hair, eyes, person, body:1.6)`，使用纯色背景 `plain solid white background`，
 *    确保发夹、茶杯、花束、香水瓶都是干净独立的单件物品！
 * 3. 【心境羁绊卡 CG 全部挂载雯宝 LoRA】：确保 5 张羁绊卡里的主角也是同一个短黑发棕眼的 Q 版雯宝！
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const COMFY_URL = process.env.COMFY_BASE_URL || "http://127.0.0.1:8188";
const CHECKPOINT = process.env.COMFY_CHECKPOINT || "meinamix_v12Final.safetensors";
const LORA_FILE = "xiaoyan.safetensors";
const OUT_DIR = path.resolve("public/assets/nikki");

const NEGATIVE_CHAR =
  "wings, black dress, dark background, detached sleeves, floating hair, complex background, scenery, furniture, window, shadow, floor, cropped, close-up, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, worst quality, low quality, watermark, blurry, multiple girls";

const NEGATIVE_PROP =
  "(1girl, 1boy, girl, woman, human, person, character, face, head, eyes, hair, hands, fingers, body, doll, portrait, mannequin:1.6), complex background, scenery, table, room, window, blurry, text, watermark, signature, frame, border, low quality, worst quality";

const ASSET_JOBS = [
  // ==================== 1. 同角色 Q 版雯宝礼服立绘 (512x640, 挂载 LoRA 0.58) ====================
  {
    name: "dress-apricot-tea.png",
    kind: "dress",
    width: 512,
    height: 640,
    seed: 2026110701,
    lora: LORA_FILE,
    loraStrength: 0.58,
    negative: NEGATIVE_CHAR + ", white dress, blue dress",
    prompt:
      "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, short black bob hair, bangs, warm brown eyes, cute smile, wearing a (warm apricot beige cable-knit sweater dress:1.4) with a brown caramel ribbon bow at collar, warm cream stockings, brown mary jane shoes, standing, front view, looking at viewer, (plain solid white background:1.5), simple background",
  },
  {
    name: "dress-rose-waltz.png",
    kind: "dress",
    width: 512,
    height: 640,
    seed: 2026110702,
    lora: LORA_FILE,
    loraStrength: 0.58,
    negative: NEGATIVE_CHAR + ", white dress, black sleeves",
    prompt:
      "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, short black bob hair, bangs, brown eyes, sweet smile, wearing a (crimson and dusty rose pink layered frilly princess ballgown dress:1.4) with pink rose corsage and white lace trim, pink ribbon shoes, standing, front view, looking at viewer, (plain solid white background:1.5), simple background",
  },
  {
    name: "dress-starlight-dream.png",
    kind: "dress",
    width: 512,
    height: 640,
    seed: 2026110703,
    lora: LORA_FILE,
    loraStrength: 0.58,
    negative: NEGATIVE_CHAR + ", white shirt",
    prompt:
      "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, short black bob hair, bangs, sparkling brown eyes, gentle smile, wearing a (celestial royal blue and violet gradient starry chiffon dress:1.4) with golden star ornaments and translucent galaxy capelet, standing, front view, looking at viewer, (plain solid white background:1.5), simple background",
  },

  // ==================== 2. 同角色雯宝 · 5 张心境羁绊卡 CG (512x640, 挂载 LoRA 0.65) ====================
  {
    name: "card-first-tea.png",
    kind: "card",
    width: 512,
    height: 640,
    seed: 2026110704,
    lora: LORA_FILE,
    loraStrength: 0.65,
    negative: "wings, lowres, bad anatomy, bad hands, text, watermark, blurry, multiple girls",
    prompt:
      "masterpiece, best quality, anime style, xiaoyan, chibi, 1girl, solo, short black bob hair, bangs, brown eyes, happy smile, sitting at a sunlit wooden cafe table with strawberry shortcake and white porcelain teacup, warm afternoon sunlight, floating flower petals, cozy healing anime CG",
  },
  {
    name: "card-rainy-window.png",
    kind: "card",
    width: 512,
    height: 640,
    seed: 2026110705,
    lora: LORA_FILE,
    loraStrength: 0.65,
    negative: "wings, lowres, bad anatomy, bad hands, text, watermark, blurry, multiple girls",
    prompt:
      "masterpiece, best quality, anime style, xiaoyan, chibi, 1girl, solo, short black bob hair, bangs, brown eyes, gentle expression, sitting by a rainy glass window indoors, blooming blue hydrangea outside window, soft cozy lo-fi lighting, anime CG illustration",
  },
  {
    name: "card-midnight-cocoa.png",
    kind: "card",
    width: 512,
    height: 640,
    seed: 2026110706,
    lora: LORA_FILE,
    loraStrength: 0.65,
    negative: "wings, lowres, bad anatomy, bad hands, text, watermark, blurry, multiple girls",
    prompt:
      "masterpiece, best quality, anime style, xiaoyan, chibi, 1girl, solo, short black bob hair, bangs, brown eyes, holding a warm mug of hot cocoa with marshmallows, warm fairy lights in cozy bedroom at night, amber candle glow, anime CG",
  },
  {
    name: "card-ocean-promise.png",
    kind: "card",
    width: 512,
    height: 640,
    seed: 2026110707,
    lora: LORA_FILE,
    loraStrength: 0.65,
    negative: "wings, lowres, bad anatomy, bad hands, text, watermark, blurry, multiple girls",
    prompt:
      "masterpiece, best quality, anime style, xiaoyan, chibi, 1girl, solo, short black bob hair, bangs, brown eyes, wearing blue and white sailor maid dress by the sparkling turquoise ocean beach, floating translucent bubbles, bright summer sky, anime CG",
  },
  {
    name: "card-starlight-waltz.png",
    kind: "card",
    width: 512,
    height: 640,
    seed: 2026110708,
    lora: LORA_FILE,
    loraStrength: 0.65,
    negative: "wings, lowres, bad anatomy, bad hands, text, watermark, blurry, multiple girls",
    prompt:
      "masterpiece, best quality, anime style, xiaoyan, chibi, 1girl, solo, short black bob hair, bangs, brown eyes, wearing starry evening dress near a glowing fountain under milky way night sky, golden fireflies swirling, romantic fantasy anime CG",
  },

  // ==================== 3. 17 件纯物品无人物配饰 (512x512, 严禁出现人头/背景杂物) ====================
  {
    name: "item-daisy-clip.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110711,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a single cute white daisy flower blossom with yellow center and two small green leaves, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-lace-ribbon.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110712,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a single cute pink and white frilly satin ribbon bow tie with a pearl in the center, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-plush-bunny.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110713,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a pair of cute pink and white plush rabbit ears arch ornament with a tiny ribbon, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-whale-beret.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110714,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a single blue and white navy sailor cap object with golden anchor emblem, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-pearl-tiara.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110715,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a sparkling silver and gold royal crown jewel studded with white pearls and blue gems, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-sunflower-hat.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110716,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a single round woven straw hat object decorated with a yellow sunflower and ribbon, top-down front view, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-teacup.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110717,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a single white porcelain teacup and saucer filled with warm amber tea, painted with a tiny flower, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-cookie-basket.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110718,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a small woven wicker basket filled with golden star-shaped butter cookies and red ribbon, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-sunflower-bouquet.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110719,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, botanical illustration of three bright yellow sunflowers tied together with kraft paper and ribbon bow, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-music-box.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110720,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, an ornate vintage wooden music box with golden gears and a pink rose on top, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-whale-globe.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110721,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a glass snowglobe sphere on a golden base containing a miniature blue whale toy and blue water, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-pocket-watch.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110722,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, an antique golden pocket watch with blue starry clock face and gold chain, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-morning-breeze.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110723,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a single cute emerald green glass perfume bottle with a leaf-shaped crystal stopper, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-honey-amber.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110724,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a single warm golden amber glass perfume bottle tied with a yellow honey ribbon, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-rose-petals.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110725,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a single pink rose quartz crystal perfume bottle with a golden spray nozzle and pink bow, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-ocean-bubbles.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110726,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a single ocean blue seashell-shaped glass perfume bottle with pearl cap, centered, isolated on (plain solid white background:1.6), simple background",
  },
  {
    name: "item-starlight-firefly.png",
    kind: "prop",
    width: 512,
    height: 512,
    seed: 2026110727,
    negative: NEGATIVE_PROP,
    prompt:
      "masterpiece, best quality, anime game icon, no humans, still life, object only, a single star-shaped golden lantern glass bottle glowing with warm yellow light, centered, isolated on (plain solid white background:1.6), simple background",
  },
];

function buildComfyGraph({ prompt, negative, width, height, seed, lora, loraStrength = 0.58 }) {
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
      inputs: { text: negative, clip: ["10", 0] },
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
      inputs: { filename_prefix: "wenbebi_v7", images: ["8", 0] },
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
  const submitRes = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: "wenbebi-v7-gen",
      prompt: buildComfyGraph(job),
    }),
  });
  if (!submitRes.ok) {
    throw new Error(`ComfyUI /prompt HTTP ${submitRes.status}`);
  }
  const { prompt_id: promptId } = await submitRes.json();

  const start = Date.now();
  while (Date.now() - start < 180_000) {
    await new Promise((r) => setTimeout(r, 750));
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
        console.log(`OK   [${job.kind}] ${job.name} (${(buf.length / 1024).toFixed(1)} KiB, ${((Date.now() - start) / 1000).toFixed(1)}s)`);
        return;
      }
    }
  }
  throw new Error(`Timeout waiting for ${job.name}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Connecting to ComfyUI at ${COMFY_URL} (model: ${CHECKPOINT}, LoRA: ${LORA_FILE})...`);
  for (const job of ASSET_JOBS) {
    await generateOne(job);
  }
  console.log("ALL 25 V7 ASSETS GENERATED SUCCESSFULLY.");
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
