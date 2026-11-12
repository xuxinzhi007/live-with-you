#!/usr/bin/env python3
import json
import urllib.request
from pathlib import Path

d = json.loads(urllib.request.urlopen("http://127.0.0.1:8188/system_stats", timeout=10).read())
print("comfy", d["system"]["comfyui_version"], "torch", d["system"]["pytorch_version"])
dev = d["devices"][0]
print(dev["name"], "vram_free_mb", round(dev["vram_free"] / 1024 / 1024, 1))
q = json.loads(urllib.request.urlopen("http://127.0.0.1:8188/queue", timeout=10).read())
print("queue running", len(q.get("queue_running") or []), "pending", len(q.get("queue_pending") or []))

info = json.loads(urllib.request.urlopen("http://127.0.0.1:8188/object_info", timeout=30).read())
needed = [
    "FaceDetailer",
    "FaceDetailerPipe",
    "UltralyticsDetectorProvider",
    "SAMLoader",
    "ImageUpscaleWithModel",
    "UpscaleModelLoader",
    "ImageScale",
]
for n in needed:
    print(n, "YES" if n in info else "NO")

needles = (
    "colorcorrect",
    "color_correct",
    "coloradjustment",
    "hsv",
    "hue",
    "stain",
    "whitebalance",
    "white_balance",
    "colormatch",
    "color_match",
    "imageblend",
    "sharpen",
    "levels",
    "curves",
)
print("COLOR/STAIN CANDIDATES:")
for k in sorted(info):
    low = k.lower()
    if any(s in low for s in needles):
        print(" ", k)

repo = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\workflows\MeinaMix_雯宝LoRA_换装抠图.json")
data = json.loads(repo.read_text(encoding="utf-8"))
print("official id", data.get("id"), "nodes", len(data["nodes"]), "groups", len(data.get("groups") or []), "last_node", data.get("last_node_id"))
print("GROUPS", data.get("groups"))
print("titles:")
for n in data["nodes"]:
    print(f"  {n['id']:3d} {n['type']:28s} mode={n.get('mode')} {n.get('title')}")
