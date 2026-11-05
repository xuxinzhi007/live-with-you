/**
 * 本地 ComfyUI (http://127.0.0.1:8188 · meinamix_v12Final.safetensors + xiaoyan.safetensors LoRA)
 * 雯宝同角色换装 + 纯单件无人物配饰 + 同角色羁绊 CG 生成管线（V7.1：分类暂存 + 可选 760 透明交付）
 *
 * 解决三大问题：
 * 1. 【礼服同角色且颜色款式 100% 准确】：LoRA 强度设为 0.58，负向强力排除 `wings, black dress, white dress, detached sleeves`，
 *    确保「杏仁奶昔针织裙」是暖杏色毛衣裙、「暮色蔷薇圆舞曲」是粉红蔷薇礼服、「星河眠云轻纱裙」是星空蓝紫纱裙，且无黑块残影！
 * 2. 【配饰 100% 是纯物品（绝不画出金发陌生女孩）】：在 MeinaMix 中绝对不能写 `hairpin / headband / hat` 等会触发画人头的词，
 *    并在负向提示词中加入 `(1girl, girl, human, face, head, hair, eyes, person, body:1.6)`，使用纯色背景 `plain solid white background`，
 *    确保发夹、茶杯、花束、香水瓶都是干净独立的单件物品！
 * 3. 【心境羁绊卡 CG 全部挂载雯宝 LoRA】：确保 5 张羁绊卡里的主角也是同一个短黑发棕眼的 Q 版雯宝！
 */
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const COMFY_URL = process.env.COMFY_BASE_URL || "http://127.0.0.1:8188";
const CHECKPOINT = process.env.COMFY_CHECKPOINT || "meinamix_v12Final.safetensors";
const LORA_FILE = "xiaoyan.safetensors";
const LEGACY_NIKKI_DIR = path.resolve("public/assets/nikki");
const STAGE_ROOT = path.resolve("tools/out/wenbao-assets");

// ---- 可选增强（默认关，向后兼容；不传则与现状一致） ----
// COMFY_CONTROLNET=openpose|dwpose|none  正式 dress 应开；无锁姿 = unofficial
// COMFY_CONTROLNET_IMAGE=<path>          骨架图路径（不填则跳过 ControlNet）
// COMFY_CONTROLNET_STRENGTH=0.9          姿势约束强度
// COMFY_LAYERDIFFUSE=1                   开 LayerDiffusion（本机通常未装，勿默认开）
// WENBAO_DELIVER_DRESS=1                 生成后对 dress 跑 flood 抠图 + 760 对齐
// WENBAO_ALSO_NIKKI=1                    额外拷贝一份到 public/assets/nikki（兼容旧路径）
// WENBAO_KIND=dress|card|prop            只跑某一类
// WENBAO_ONLY=dress-apricot-tea.png      只跑单个文件名
const CONTROLNET = process.env.COMFY_CONTROLNET || "none";
const CONTROLNET_IMAGE = process.env.COMFY_CONTROLNET_IMAGE || "";
const CONTROLNET_STRENGTH = Number(process.env.COMFY_CONTROLNET_STRENGTH || 0.9);
const LAYERDIFFUSE = process.env.COMFY_LAYERDIFFUSE === "1";
const DELIVER_DRESS = process.env.WENBAO_DELIVER_DRESS === "1";
const ALSO_NIKKI = process.env.WENBAO_ALSO_NIKKI === "1";
const ONLY_KIND = process.env.WENBAO_KIND || "";
const ONLY_NAME = process.env.WENBAO_ONLY || "";
const PYTHON =
  process.env.WENBAO_PYTHON ||
  "D:\\xuxinzhi\\ComfyUI_windows_portable_nvidia\\ComfyUI_windows_portable\\python_embeded\\python.exe";

function stageCategory(kind) {
  if (kind === "dress") return "dress";
  if (kind === "card") return "card";
  if (kind === "prop") return "part";
  return "raw";
}

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
      "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, wearing a (warm apricot beige cable-knit sweater dress:1.4) with a brown caramel ribbon bow at collar, warm cream stockings, brown mary jane shoes, standing, front view, looking at viewer, (plain solid white background:1.5), simple background",
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
      "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, wearing a (crimson and dusty rose pink layered frilly princess ballgown dress:1.4) with pink rose corsage and white lace trim, pink ribbon shoes, standing, front view, looking at viewer, (plain solid white background:1.5), simple background",
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
      "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, wearing a (celestial royal blue and violet gradient starry chiffon dress:1.4) with golden star ornaments and translucent galaxy capelet, standing, front view, looking at viewer, (plain solid white background:1.5), simple background",
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
      "masterpiece, best quality, anime style, xiaoyan, chibi, 1girl, solo, sitting at a sunlit wooden cafe table with strawberry shortcake and white porcelain teacup, warm afternoon sunlight, floating flower petals, cozy healing anime CG",
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
      "masterpiece, best quality, anime style, xiaoyan, chibi, 1girl, solo, sitting by a rainy glass window indoors, blooming blue hydrangea outside window, soft cozy lo-fi lighting, anime CG illustration",
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
      "masterpiece, best quality, anime style, xiaoyan, chibi, 1girl, solo, holding a warm mug of hot cocoa with marshmallows, warm fairy lights in cozy bedroom at night, amber candle glow, anime CG",
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
      "masterpiece, best quality, anime style, xiaoyan, chibi, 1girl, solo, wearing blue and white sailor maid dress by the sparkling turquoise ocean beach, floating translucent bubbles, bright summer sky, anime CG",
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
      "masterpiece, best quality, anime style, xiaoyan, chibi, 1girl, solo, wearing starry evening dress near a glowing fountain under milky way night sky, golden fireflies swirling, romantic fantasy anime CG",
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
  const useControlnet = CONTROLNET !== "none" && CONTROLNET_IMAGE;
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
        positive: useControlnet ? ["14", 0] : ["6", 0],
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

  // ControlNet：用一张骨架图锁死姿势。节点名按 comfyui_controlnet_aux 插件约定。
  // 链路：LoadImage → 预处理器 → ControlNetLoader → ControlNetApply(接原 positive) → KSampler
  if (useControlnet) {
    const preprocessor = CONTROLNET === "dwpose" ? "DWPreprocessor" : "OpenposePreprocessor";
    graph["20"] = { class_type: "LoadImage", inputs: { image: CONTROLNET_IMAGE } };
    graph["21"] = { class_type: preprocessor, inputs: { image: ["20", 0] } };
    graph["22"] = {
      class_type: "ControlNetLoader",
      inputs: { control_net_name: "control_v11p_sd15_openpose.pth" },
    };
    graph["23"] = {
      class_type: "ControlNetApply",
      inputs: {
        conditioning: ["6", 0],
        control_net: ["22", 0],
        image: ["21", 0],
        strength: CONTROLNET_STRENGTH,
      },
    };
    graph["3"].inputs.positive = ["23", 0];
  }

  // LayerDiffusion：出透明分层。节点名按 ComfyUI-layerdiffuse 插件约定。
  // 注意：插件版本差异大，参数名可能不同；此处给最小可用形态，接入时按 /object_info 校准。
  if (LAYERDIFFUSE) {
    graph["30"] = {
      class_type: "LayerDiffuseApply",
      inputs: { images: ["8", 0] },
    };
    graph["9"].inputs.images = ["30", 0];
  }

  return graph;
}

function runDeliverDress(rawPath, outName) {
  return new Promise((resolve, reject) => {
    const args = [
      path.resolve("tools/deliver-dress-frame.py"),
      rawPath,
      "--name",
      outName,
      "--check-spec",
    ];
    const child = spawn(PYTHON, args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`deliver-dress-frame exited ${code}`));
    });
  });
}

async function generateOne(job) {
  const category = stageCategory(job.kind);
  const rawDir = path.join(STAGE_ROOT, "raw");
  const catDir = path.join(STAGE_ROOT, category);
  await mkdir(rawDir, { recursive: true });
  await mkdir(catDir, { recursive: true });
  const rawPath = path.join(rawDir, job.name);
  const officialLock = CONTROLNET !== "none" && CONTROLNET_IMAGE;
  const label = officialLock ? "official-lockpose" : "unofficial-txt2img";

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
        await writeFile(rawPath, buf);
        // Non-dress categories: stage RGB as-is under category (card stays 512x640).
        if (job.kind !== "dress") {
          await writeFile(path.join(catDir, job.name), buf);
        }
        if (ALSO_NIKKI) {
          await mkdir(LEGACY_NIKKI_DIR, { recursive: true });
          await writeFile(path.join(LEGACY_NIKKI_DIR, job.name), buf);
        }
        console.log(
          `OK   [${job.kind}/${label}] raw ${job.name} (${(buf.length / 1024).toFixed(1)} KiB, ${((Date.now() - start) / 1000).toFixed(1)}s) -> ${path.relative(process.cwd(), rawPath)}`,
        );
        if (job.kind === "dress" && DELIVER_DRESS) {
          await runDeliverDress(rawPath, job.name.replace(/\.png$/i, ".png"));
        } else if (job.kind === "dress") {
          console.log(
            `NOTE dress RGB only. Official 760 RGBA: python tools/deliver-dress-frame.py ${path.relative(process.cwd(), rawPath)} --name ${job.name} --check-spec`,
          );
        }
        return;
      }
    }
  }
  throw new Error(`Timeout waiting for ${job.name}`);
}

async function main() {
  await mkdir(STAGE_ROOT, { recursive: true });
  for (const cat of ["dress", "part", "card", "icon", "raw"]) {
    await mkdir(path.join(STAGE_ROOT, cat), { recursive: true });
  }
  const jobs = ASSET_JOBS.filter((j) => {
    if (ONLY_KIND && j.kind !== ONLY_KIND) return false;
    if (ONLY_NAME && j.name !== ONLY_NAME) return false;
    return true;
  });
  if (!jobs.length) {
    console.error("No jobs matched WENBAO_KIND / WENBAO_ONLY filters.");
    process.exit(1);
  }
  const lock = CONTROLNET !== "none" && CONTROLNET_IMAGE;
  console.log(
    `Connecting to ComfyUI at ${COMFY_URL} (model: ${CHECKPOINT}, LoRA: ${LORA_FILE})`,
  );
  console.log(
    `Staging -> ${STAGE_ROOT} | jobs=${jobs.length} | dressDeliver=${DELIVER_DRESS} | alsoNikki=${ALSO_NIKKI} | poseLock=${lock ? "ON" : "OFF(unofficial)"}`,
  );
  if (!lock) {
    console.log(
      "WARN formal dress should set COMFY_CONTROLNET=openpose and COMFY_CONTROLNET_IMAGE=<pose ref>.",
    );
  }
  for (const job of jobs) {
    await generateOne(job);
  }
  console.log(`DONE ${jobs.length} asset(s). See tools/PIPELINE-DRESS.md`);
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
