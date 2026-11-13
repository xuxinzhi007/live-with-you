#!/usr/bin/env python3
# Official Qwen-Image-Edit-2509 Q4 action-pose batch.
# Does not touch official workflow JSON on disk, public/assets, or git.

from __future__ import annotations

import json
import shutil
import sys
import time
import urllib.error
import urllib.request
from copy import deepcopy
from pathlib import Path

API = "http://127.0.0.1:8188"
CLIENT_ID = "wenbebi-qwen-official-action-poses"
COMFY_ROOT = Path(r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI")
INPUT_MASTER = COMFY_ROOT / "input" / "Wenbao_redraw_00001_.png"
OUTPUT_DIR = COMFY_ROOT / "output" / "wenbao_qwen_edit_official"
DESKTOP_DIR = Path(r"C:\Users\ZhuanZ1\Desktop\wenbao_qwen_action_poses")
LOG_DIR = Path(r"D:\lora_train\wenbao_v1\tmp_scripts")
SMOKE_JSON = LOG_DIR / "official_qwen_smoke_prompt.json"

FORBIDDEN = ("meinamix", "wenbao_v1", "xiaoyan.safetensors")
FORBIDDEN_SEEDS = {20261113010701, 20261113032101}

PROMPTS = {
    "react": (
        "Change only the pose to a standing full-body reaction to being lightly tapped. "
        "The girl stays on her feet, facing the camera, with a small happy flinch: her shoulders lift slightly and one hand moves up near her chest. "
        "Keep the exact same girl and identity from the input image. "
        "Keep the same face, short black hair with straight bangs, large brown eyes, and a slight smile. "
        "Keep the same clothes: a white short-sleeve T-shirt with a chest pocket, white shorts, and white shoes. "
        "Keep a standing full-body view with both feet visible. Keep a plain pure white background. "
        "Keep natural anime proportions; do not make chibi, Q-version, or big-head proportions. "
        "Do not change the clothes, hairstyle, or character design. Do not crop to a bust or close-up."
    ),
    "sit": (
        "Change only the pose so the girl is sitting on the ground, full body, facing the camera, with both feet clearly visible. "
        "She sits naturally with her legs folded in front of her, not standing, and not a cropped bust. "
        "Keep the exact same girl and identity from the input image. "
        "Keep the same face, short black hair with straight bangs, large brown eyes, and a slight smile. "
        "Keep the same clothes: a white short-sleeve T-shirt with a chest pocket, white shorts, and white shoes. "
        "Keep a full-body view including the feet. Keep a plain pure white background. "
        "Keep natural anime proportions; do not make chibi, Q-version, or big-head proportions. "
        "Do not change the clothes, hairstyle, or character design."
    ),
    "sleep": (
        "Change only the pose so the girl is lying down asleep on the ground, full body visible from head to feet, on a plain pure white background. "
        "She is resting on her side in a natural sleeping pose, not standing, and not a curled-up close-up of the head. "
        "Keep the exact same girl and identity from the input image. "
        "Keep the same face, short black hair with straight bangs, large brown eyes, and a slight smile. "
        "Keep the same clothes: a white short-sleeve T-shirt with a chest pocket, white shorts, and white shoes. "
        "Keep the entire body in frame, including both feet. "
        "Keep natural anime proportions; do not make chibi, Q-version, or big-head proportions. "
        "Do not change the clothes, hairstyle, or character design."
    ),
}

JOBS = [
    {"name": "react", "seed": 20261113035001, "prefix": "wenbao_qwen_edit_official/wenbao_q4_react"},
    {"name": "sit", "seed": 20261113035002, "prefix": "wenbao_qwen_edit_official/wenbao_q4_sit"},
    {"name": "sleep", "seed": 20261113035003, "prefix": "wenbao_qwen_edit_official/wenbao_q4_sleep"},
]


def http_json(method: str, path: str, payload=None, timeout: float = 30):
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            if not raw:
                return {"status_code": resp.status}
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError("HTTP %s %s: %s %s" % (method, path, exc.code, body[:2000])) from exc


def png_size(path: Path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    import struct
    w, h = struct.unpack(">II", data[16:24])
    return w, h


def build_prompt(base_prompt: dict, edit_text: str, seed: int, prefix: str) -> dict:
    prompt = deepcopy(base_prompt)
    prompt["8"]["inputs"]["prompt"] = edit_text
    prompt["9"]["inputs"]["prompt"] = ""
    prompt["1"]["inputs"]["image"] = "Wenbao_redraw_00001_.png"
    prompt["11"]["inputs"]["seed"] = int(seed)
    prompt["11"]["inputs"]["steps"] = 8
    prompt["11"]["inputs"]["cfg"] = 1.0
    prompt["11"]["inputs"]["sampler_name"] = "euler"
    prompt["11"]["inputs"]["scheduler"] = "simple"
    prompt["11"]["inputs"]["denoise"] = 1.0
    prompt["13"]["inputs"]["filename_prefix"] = prefix
    # Keep node 3 as CLIPLoader type qwen_image
    if prompt["3"]["class_type"] != "CLIPLoader" or prompt["3"]["inputs"].get("type") != "qwen_image":
        raise RuntimeError("CLIP loader drifted from official graph")
    if prompt["2"]["class_type"] != "UnetLoaderGGUF":
        raise RuntimeError("UNet loader drifted from official graph")
    blob = json.dumps(prompt).lower()
    for token in FORBIDDEN:
        if token in blob:
            raise RuntimeError("forbidden token in API graph: %s" % token)
    return prompt


def free_vram():
    print("POST /free unload_models=true free_memory=true", flush=True)
    try:
        http_json("POST", "/free", {"unload_models": True, "free_memory": True}, timeout=60)
    except Exception as exc:
        print("WARN /free failed: %s" % exc, flush=True)
    time.sleep(3)


def wait_history(prompt_id: str, timeout_s: float = 240.0, interval: float = 3.0):
    deadline = time.time() + timeout_s
    last = None
    while time.time() < deadline:
        try:
            last = http_json("GET", "/history/" + prompt_id, timeout=15)
        except Exception as exc:
            print("  poll error: %s" % exc, flush=True)
            time.sleep(interval)
            continue
        entry = last.get(prompt_id) if isinstance(last, dict) else None
        if entry:
            status = (entry.get("status") or {})
            status_str = status.get("status_str")
            completed = status.get("completed")
            outputs = entry.get("outputs") or {}
            has_images = any(
                (node.get("images") if isinstance(node, dict) else None)
                for node in outputs.values()
            )
            if status_str == "success" and has_images:
                return entry
            if status_str == "error" or (completed is False and status.get("messages")):
                # keep waiting unless explicit error
                msgs = status.get("messages") or []
                err_like = [m for m in msgs if isinstance(m, (list, tuple)) and m and m[0] in ("execution_error", "error")]
                if err_like or status_str == "error":
                    return entry
        time.sleep(interval)
    return last.get(prompt_id) if isinstance(last, dict) else last


def extract_images(entry: dict):
    images = []
    outputs = (entry or {}).get("outputs") or {}
    for node_id, node in outputs.items():
        if not isinstance(node, dict):
            continue
        for img in node.get("images") or []:
            item = dict(img)
            item["node"] = node_id
            images.append(item)
    return images


def resolve_output(img: dict) -> Path:
    sub = img.get("subfolder") or ""
    typ = img.get("type") or "output"
    name = img["filename"]
    if typ == "output":
        return COMFY_ROOT / "output" / sub / name if sub else COMFY_ROOT / "output" / name
    return COMFY_ROOT / typ / sub / name if sub else COMFY_ROOT / typ / name


def main():
    only = sys.argv[1:]  # optional job names
    jobs = [j for j in JOBS if (not only or j["name"] in only)]
    if not jobs:
        raise SystemExit("no jobs selected")

    if not INPUT_MASTER.is_file():
        raise SystemExit("master image missing: %s" % INPUT_MASTER)

    smoke = json.loads(SMOKE_JSON.read_text(encoding="utf-8"))
    base_prompt = smoke["prompt"]

    try:
        stats = http_json("GET", "/system_stats", timeout=8)
    except Exception as exc:
        raise SystemExit("ComfyUI is down or not reachable at %s: %s" % (API, exc))

    print("Comfy reachable. devices=%s" % json.dumps(stats.get("devices"), ensure_ascii=False), flush=True)

    DESKTOP_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Free leftover VRAM before the first job only.
    free_vram()

    results = []
    for job in jobs:
        name = job["name"]
        seed = int(job["seed"])
        prefix = job["prefix"]
        if seed in FORBIDDEN_SEEDS:
            raise SystemExit("refusing reused seed %s" % seed)
        edit_text = PROMPTS[name]
        prompt = build_prompt(base_prompt, edit_text, seed, prefix)
        payload = {"client_id": CLIENT_ID, "prompt": prompt}
        submitted_path = LOG_DIR / ("official_qwen_%s_prompt.json" % name)
        submitted_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

        print("=" * 72, flush=True)
        print("SUBMIT %s seed=%s prefix=%s" % (name, seed, prefix), flush=True)
        t0 = time.time()
        resp = http_json("POST", "/prompt", payload, timeout=60)
        prompt_id = resp.get("prompt_id")
        node_errors = resp.get("node_errors") or {}
        print("  prompt_id=%s node_errors=%s" % (prompt_id, json.dumps(node_errors, ensure_ascii=False)), flush=True)
        if not prompt_id:
            raise SystemExit("no prompt_id: %s" % resp)
        if node_errors:
            raise SystemExit("node_errors: %s" % node_errors)

        entry = wait_history(prompt_id, timeout_s=240.0)
        elapsed = time.time() - t0
        status = (entry or {}).get("status") or {}
        images = extract_images(entry or {})
        print("  status=%s elapsed=%.2fs images=%s" % (status.get("status_str"), elapsed, len(images)), flush=True)

        result = {
            "name": name,
            "seed": seed,
            "prefix": prefix,
            "prompt_text": edit_text,
            "prompt_id": prompt_id,
            "elapsed_seconds": round(elapsed, 2),
            "status": status,
            "images": images,
            "output_path": None,
            "pixel_size": None,
            "desktop_copy": None,
            "bytes": None,
        }

        if status.get("status_str") != "success" or not images:
            result["error"] = "generation failed or timed out"
            result["raw_status"] = status
            (LOG_DIR / ("official_qwen_%s_result.json" % name)).write_text(
                json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            results.append(result)
            raise SystemExit("job %s failed after %.2fs: %s" % (name, elapsed, json.dumps(status, ensure_ascii=False)[:2000]))

        out_path = resolve_output(images[0])
        if not out_path.is_file():
            raise SystemExit("output missing on disk: %s" % out_path)
        size = png_size(out_path)
        dest = DESKTOP_DIR / out_path.name
        shutil.copy2(out_path, dest)
        result["output_path"] = str(out_path)
        result["desktop_copy"] = str(dest)
        result["pixel_size"] = {"width": size[0], "height": size[1]} if size else None
        result["bytes"] = out_path.stat().st_size
        (LOG_DIR / ("official_qwen_%s_result.json" % name)).write_text(
            json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print("  saved %s %s %s bytes" % (out_path, size, result["bytes"]), flush=True)
        results.append(result)

    summary_path = LOG_DIR / "official_qwen_action_poses_summary.json"
    summary_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    desktop_summary = DESKTOP_DIR / "summary.json"
    desktop_summary.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print("DONE %s jobs. summary=%s" % (len(results), summary_path), flush=True)


if __name__ == "__main__":
    main()
