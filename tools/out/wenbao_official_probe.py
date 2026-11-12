# -*- coding: utf-8 -*-
import json, os, sys, urllib.request, urllib.error
from pathlib import Path

LIVE = Path(r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\user\default\workflows\MeinaMix_雯宝LoRA_换装抠图.json")
REPO = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\workflows\MeinaMix_雯宝LoRA_换装抠图.json")
COMFY = "http://127.0.0.1:8188"
STAGE = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\out\wenbao-assets\_compare")

def get(path, timeout=8):
    try:
        with urllib.request.urlopen(COMFY + path, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, raw
    except Exception as e:
        return None, str(e)

print("=== interpreters / rembg ===")
print("exe", sys.executable, sys.version)
try:
    import rembg
    print("rembg", getattr(rembg, "__file__", "ok"))
except Exception as e:
    print("rembg missing:", type(e).__name__, e)

print("\n=== workflow files ===")
for p in (LIVE, REPO):
    print(p, "exists" if p.is_file() else "MISSING", p.stat().st_size if p.is_file() else 0)

def inspect(p: Path, label: str):
    ui = json.loads(p.read_text(encoding="utf-8"))
    nodes = ui.get("nodes") or []
    print(f"\n=== {label} nodes={len(nodes)} ===")
    for n in nodes:
        nid = n.get("id")
        typ = n.get("type") or n.get("class_type")
        title = n.get("title") or ""
        widgets = n.get("widgets_values")
        meta = n.get("properties") or {}
        interesting = typ in (
            "LoraLoader", "CheckpointLoaderSimple", "KSampler", "CLIPTextEncode",
            "LoadImage", "IPAdapterAdvanced", "IPAdapterFaceID", "IPAdapterUnifiedLoader",
            "ControlNetApplyAdvanced", "ControlNetLoader", "FaceDetailer",
            "ImageUpscaleWithModel", "UpscaleModelLoader", "SaveImage", "EmptyLatentImage",
        ) or "LoRA" in typ or "IPAdapter" in typ or "Openpose" in typ or "ControlNet" in typ
        if interesting:
            print(f"  id={nid} type={typ} title={title}")
            if widgets is not None:
                # compact
                w = widgets
                if typ == "CLIPTextEncode" and isinstance(w, list) and w:
                    text = w[0] if isinstance(w[0], str) else w
                    print(f"    TEXT: {text}")
                else:
                    s = json.dumps(w, ensure_ascii=False)
                    if len(s) > 800:
                        s = s[:800] + "..."
                    print(f"    widgets: {s}")

inspect(LIVE, "LIVE")

# also extract seed/lora/prompt more reliably
print("\n=== targeted scan LIVE ===")
ui = json.loads(LIVE.read_text(encoding="utf-8"))
needles = ("wenbao", "xiaoyan", "seed", "safetensors", "0.8", "standby", "pose", "white")
for n in ui.get("nodes") or []:
    blob = json.dumps(n, ensure_ascii=False)
    low = blob.lower()
    if any(x.lower() in low for x in needles) or n.get("type") in ("LoraLoader", "KSampler", "CLIPTextEncode", "LoadImage", "FaceDetailer"):
        typ = n.get("type")
        if typ in ("Note", "MarkdownNote"):
            continue
        print(f"-- node {n.get('id')} {typ} {n.get('title','')}")
        wv = n.get("widgets_values")
        if wv is not None:
            s = json.dumps(wv, ensure_ascii=False)
            if len(s) > 1200:
                s = s[:1200] + "..."
            print("   ", s)

print("\n=== Comfy system/stats ===")
st, raw = get("/system_stats")
print("system_stats", st, (raw[:2000] if isinstance(raw, bytes) else raw))
st, raw = get("/queue")
print("queue", st, (raw.decode('utf-8','replace')[:1500] if isinstance(raw, bytes) else raw))
st, raw = get("/prompt")
# GET /prompt may 405
print("GET /prompt", st if st else raw)
st, raw = get("/object_info/LoraLoader")
print("object_info LoraLoader", "ok" if st else raw)

# process list-ish via nvidia-smi later
print("\n=== existing compare dir ===")
print("STAGE exists", STAGE.is_dir(), STAGE)
if STAGE.is_dir():
    for root, dirs, files in os.walk(STAGE):
        for f in sorted(files):
            fp = Path(root) / f
            print(f"  {fp} {fp.stat().st_size}")
