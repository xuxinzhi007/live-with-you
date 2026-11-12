/**
 * LEGACY MeinaMix 7-group wrapper — NOT live official character production as of 2026-11-13.
 * Live official CHARACTER production is `Qwen_Image_Edit_2509_Q4_官方出图.json`.
 * Default is to refuse and exit, pointing at the Qwen official workflow and
 * `_archive_20261113_meinamix`. Historical replay requires `--legacy-meinamix`,
 * which then launches the archived `MeinaMix_雯宝LoRA_换装抠图.json`
 * (not a silently patched API graph), queues it, stages compare outputs, then hooks
 * `tools/official-isnet-rematte.py` (rembg isnet-anime onto solid white).
 *
 * Usage (from repo root; historical replay only):
 *   node tools/run-official-dress.mjs --legacy-meinamix --name character-xiaoyan-official-YYYYMMDDSEED.png --seed 202611110501
 *
 * Prompts, LoRA, face/pose refs, AnimeSharp and sampler come from the official JSON.
 * --prompt / --negative are rejected: those were unofficial API overrides.
 * Writes only under tools/out/wenbao-assets/_compare/ by default.
 * Does not copy to public/assets/nikki or upload to :8788.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pyRunner = path.join(repoRoot, "tools", "run-official-dress.py");
const PORTABLE_PY =
  process.env.COMFY_PYTHON ||
  "D:\\xuxinzhi\\ComfyUI_windows_portable_nvidia\\ComfyUI_windows_portable\\python_embeded\\python.exe";

function parseArgs(argv) {
  const out = { name: null, seed: null, workflow: null, skipRematte: false, legacyMeinamix: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--name") out.name = next();
    else if (a === "--seed") out.seed = next();
    else if (a === "--workflow") out.workflow = next();
    else if (a === "--skip-rematte") out.skipRematte = true;
    else if (a === "--legacy-meinamix") out.legacyMeinamix = true;
    else if (a === "--prompt" || a === "--negative") {
      console.error(
        `Rejected ${a}: official dress compares must use prompts from MeinaMix_雯宝LoRA_换装抠图.json, not API overrides.`
      );
      process.exit(2);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const qwenOfficial =
  "D:\\xuxinzhi\\ComfyUI_windows_portable_nvidia\\ComfyUI_windows_portable\\ComfyUI\\user\\default\\workflows\\Qwen_Image_Edit_2509_Q4_官方出图.json";
const archiveComfy =
  "D:\\xuxinzhi\\ComfyUI_windows_portable_nvidia\\ComfyUI_windows_portable\\ComfyUI\\user\\default\\workflows\\_archive_20261113_meinamix";
const archiveRepo = path.join(repoRoot, "tools", "workflows", "_archive_20261113_meinamix");
if (!args.legacyMeinamix) {
  console.error(
    "REFUSED: tools/run-official-dress.mjs no longer runs the old MeinaMix 7-group path by default.\n" +
    "As of 2026-11-13, live official character production is:\n  " +
    qwenOfficial +
    "\nThe old official MeinaMix graphs were archived to:\n  " +
    archiveComfy +
    "\n  " +
    archiveRepo +
    "\nTo historically replay the archived 7-group MeinaMix dress path, pass --legacy-meinamix explicitly. " +
    "That is not official production."
  );
  process.exit(2);
}
console.warn(
  "WARNING: --legacy-meinamix is set. This wrapper will still launch the ARCHIVED MeinaMix 7-group path. " +
  "As of 2026-11-13, live official CHARACTER production is " +
  "Qwen_Image_Edit_2509_Q4_官方出图.json (Qwen-Image-Edit-2509 Q4)."
);
const pyArgs = [pyRunner, "--legacy-meinamix"];
if (args.name) pyArgs.push("--name", args.name);
if (args.seed) pyArgs.push("--seed", String(args.seed));
if (args.workflow) pyArgs.push("--workflow", args.workflow);
if (args.skipRematte) pyArgs.push("--skip-rematte");

const child = spawn(PORTABLE_PY, pyArgs, { cwd: repoRoot, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
