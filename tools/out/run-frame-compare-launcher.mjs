import { spawn } from "node:child_process";
import path from "node:path";

const prompt =
  "masterpiece, best quality, xiaoyan, full body, solo, 1girl, standing, front view, looking at viewer, arms at sides, wearing a plain white t-shirt and white shorts, short black hair, brown eyes, simple white background, soft even lighting, no props, feet visible, entire body in frame";

const negative =
  "overexposed, blown out highlights, high-key, vignette, circle, oval, ring, halo, backdrop, spotlight, lantern, ornament, gourd, prop, object, scenery, furniture, chair, seat, pillar, doorway, door, curtain, frame, border, extra objects, wings, black dress, long skirt, dark background, complex background, window, shadow, floor, wooden floor, cropped, cropped feet, cut off, close-up, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, worst quality, low quality, watermark, blurry, multiple girls, extra limbs, deformed, socks, stockings, red eyes";

const repo = "C:\\Users\\ZhuanZ1\\Desktop\\wenbebi";
const runner = path.join(repo, "tools", "run-official-dress.mjs");
const seed = process.env.WENBAO_COMPARE_SEED || "202611110401";
const name = process.env.WENBAO_COMPARE_NAME || "character-xiaoyan-frame-202611110401.png";

const env = {
  ...process.env,
  COMFY_FACE_IMAGE: "standby-bust-white.png",
  COMFY_CONTROLNET_IMAGE: "xiaoyan_pose_stand_clean_padded.png",
  WENBAO_STAGE_ROOT: "C:\\Users\\ZhuanZ1\\Desktop\\wenbebi\\tools\\out\\wenbao-assets\\_compare",
  COMFY_BASE_URL: "http://127.0.0.1:8188",
};

const args = [
  runner,
  "--name",
  name,
  "--seed",
  String(seed),
  "--prompt",
  prompt,
  "--negative",
  negative,
];

const child = spawn("node", args, { cwd: repo, env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
