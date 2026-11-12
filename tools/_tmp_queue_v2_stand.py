import json, time, shutil, urllib.request, urllib.error
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
SEED = 202611110031
PREFIX = "Wenbao_V2StandCompare"
SKEL_PREFIX = "Wenbao_V2StandCompare_PoseSkel"
STAGE = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\out\wenbao-assets\_compare")
OUT_DIR = Path(r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\output")

POS = "masterpiece, best quality, absurdres, 1girl, solo, xiaoyan, barefoot, full body, looking at viewer, standing, simple background, soft lighting"
NEG = "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, deformed, mutated, black hair, brown hair, brown eyes, chibi, multiple girls, extra limbs, fused fingers, long body, missing legs, truncated legs"

graph = {
  "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "meinamix_v12Final.safetensors"}},
  "28": {"class_type": "LoraLoader", "inputs": {"model": ["4", 0], "clip": ["4", 1], "lora_name": "xiaoyan.safetensors", "strength_model": 0.8, "strength_clip": 0.8}},
  "10": {"class_type": "CLIPSetLastLayer", "inputs": {"clip": ["28", 1], "stop_at_clip_layer": -2}},
  "20": {"class_type": "IPAdapterUnifiedLoader", "inputs": {"model": ["28", 0], "preset": "PLUS FACE (portraits)"}},
  "21": {"class_type": "LoadImage", "inputs": {"image": "待机状态.png"}},
  "22": {"class_type": "IPAdapter", "inputs": {"model": ["20", 0], "ipadapter": ["20", 1], "image": ["21", 0], "weight": 0.8, "start_at": 0, "end_at": 1, "weight_type": "standard"}},
  "23": {"class_type": "LoadImage", "inputs": {"image": "xiaoyan_pose_stand_clean.png"}},
  "24": {"class_type": "ImageScaleToMaxDimension", "inputs": {"image": ["23", 0], "upscale_method": "lanczos", "largest_size": 768}},
  "25": {"class_type": "OpenposePreprocessor", "inputs": {"image": ["24", 0], "detect_hand": "enable", "detect_body": "enable", "detect_face": "enable", "resolution": 512, "scale_stick_for_xinsr_cn": "disable"}},
  "26": {"class_type": "ControlNetLoader", "inputs": {"control_net_name": "control_v11p_sd15_openpose.pth"}},
  "6": {"class_type": "CLIPTextEncode", "inputs": {"text": POS, "clip": ["10", 0]}},
  "7": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG, "clip": ["10", 0]}},
  "27": {"class_type": "ControlNetApplyAdvanced", "inputs": {"positive": ["6", 0], "negative": ["7", 0], "control_net": ["26", 0], "image": ["25", 0], "strength": 0.85, "start_percent": 0, "end_percent": 1}},
  "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 512, "height": 768, "batch_size": 1}},
  "3": {"class_type": "KSampler", "inputs": {"model": ["22", 0], "positive": ["27", 0], "negative": ["27", 1], "latent_image": ["5", 0], "seed": SEED, "steps": 28, "cfg": 7, "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1}},
  "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
  "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": PREFIX}},
  "19": {"class_type": "SaveImage", "inputs": {"images": ["25", 0], "filename_prefix": SKEL_PREFIX}},
}

payload = json.dumps({"client_id": "wenbebi-v2-stand-compare", "prompt": graph}).encode("utf-8")
req = urllib.request.Request(COMFY + "/prompt", data=payload, headers={"Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        sub = json.load(resp)
except urllib.error.HTTPError as e:
    print("SUBMIT_HTTP", e.code, e.read().decode("utf-8", "replace"))
    raise SystemExit(1)
pid = sub.get("prompt_id")
print("queued", pid, "seed", SEED)
if not pid:
    print(sub)
    raise SystemExit(1)

deadline = time.time() + 240
hist = None
while time.time() < deadline:
    with urllib.request.urlopen(COMFY + "/history/" + pid, timeout=30) as resp:
        hist = json.load(resp)
    if pid in hist:
        break
    time.sleep(2)
else:
    print("TIMEOUT")
    raise SystemExit(2)

rec = hist[pid]
status = rec.get("status") or {}
print("status", json.dumps(status, ensure_ascii=False)[:1000])
if status.get("status_str") == "error" or status.get("completed") is False:
    print("GEN_FAIL")
    raise SystemExit(3)

STAGE.mkdir(parents=True, exist_ok=True)
copied = []
outputs = rec.get("outputs") or {}
for nid, node_out in outputs.items():
    for im in node_out.get("images") or []:
        src = OUT_DIR / im.get("subfolder", "") / im["filename"]
        dest = STAGE / im["filename"]
        if not src.exists():
            print("MISSING", src)
            continue
        shutil.copy2(src, dest)
        copied.append(str(dest))
        print("copied", dest, "bytes", dest.stat().st_size)

meta = {
    "workflow": "MeinaMix_小燕_姿势训练集_v2",
    "prompt_id": pid,
    "seed": SEED,
    "lora": "xiaoyan.safetensors 0.8/0.8",
    "face": "待机状态.png",
    "pose": "xiaoyan_pose_stand_clean.png",
    "canvas": "512x768",
    "cn": "OpenposePreprocessor -> CN 0.85 end=1.0",
    "ingest": False,
    "upload_8788": False,
    "files": copied,
}
meta_path = STAGE / "v2-stand-compare-meta.json"
meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
print("META_OK", meta_path)
print("DONE")
