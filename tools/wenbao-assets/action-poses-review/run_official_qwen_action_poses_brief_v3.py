#!/usr/bin/env python3
# Brief-v3 replacement batch: react + sleep only. New seeds. Do not touch sit.
from __future__ import annotations

import json
import shutil
import sys
import time
import urllib.request
from copy import deepcopy
from pathlib import Path

API = "http://127.0.0.1:8188"
CLIENT_ID = "wenbebi-qwen-official-action-poses-brief-v3"
COMFY_ROOT = Path(r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI")
DESKTOP_DIR = Path(r"C:\Users\ZhuanZ1\Desktop\wenbao_qwen_action_poses")
LOG_DIR = Path(r"D:\lora_train\wenbao_v1\tmp_scripts")
SMOKE_JSON = LOG_DIR / "official_qwen_smoke_prompt.json"
FORBIDDEN = ("meinamix", "wenbao_v1", "xiaoyan.safetensors")
FORBIDDEN_SEEDS = {
    20261113010701, 20261113032101,
    20261113035001, 20261113035002, 20261113035003,
    20261113040101, 20261113040102, 20261113040103,
    20261113040701, 20261113040703,
}

JOBS = {
    "react": {
        "name": "react",
        "seed": 20261113222701,
        "retry_seed": 20261113222801,
        "prefix": "wenbao_qwen_edit_official/wenbao_q4_react",
        "prompt": (
            "Keep the same girl and the same outfit: white t-shirt, white shorts, white shoes. "
            "Normal non-chibi body proportions, full body, front view, looking at the viewer, simple white background. "
            "Change only the pose: a short happy reaction, a small hop or just lifted heels (not a high jump), "
            "both arms raised with open hands, a bright smile. "
            "Keep the exact same head-to-body ratio as the standing input image; do not enlarge the head or hands; "
            "hands must stay naturally sized, not oversized cute hands. Keep her large brown eyes visible. "
            "Do not change her face, hair, or clothes. No chibi, no large head, no Q-version or super-deformed proportions."
        ),
    },
    "sleep": {
        "name": "sleep",
        "seed": 20261113222703,
        "retry_seed": 20261113222803,
        "prefix": "wenbao_qwen_edit_official/wenbao_q4_sleep",
        "prompt": (
            "Keep the same girl and the same outfit: white t-shirt, white shorts, white shoes. "
            "Normal non-chibi body proportions, full body, simple white background. "
            "Change only the pose: lying on her side in a curled resting pose, eyes closed, a gentle smile, "
            "hands near her cheek; head toward the right of the frame, feet toward the left. "
            "The character's head must be on the right side of the picture, and her feet must be on the left side. "
            "The lying figure should be clearly shorter than the standing pose. "
            "Keep the white shorts clean, fitted, and the same length as the standing input, not baggy or long like cropped pants. "
            "No extra sparkles, stars, glitter, Zzz, stickers, or sleep symbols. "
            "Keep the same head-to-body ratio as the input image. "
            "Do not change her face, hair, or clothes. No chibi, no large head, no Q-version proportions."
        ),
    },
}


def http_json(method, path, payload=None, timeout=30):
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        return json.loads(raw.decode("utf-8")) if raw else {"status_code": resp.status}


def png_size(path: Path):
    import struct
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    w, h = struct.unpack(">II", data[16:24])
    return w, h


def build_prompt(base, edit_text, seed, prefix):
    prompt = deepcopy(base)
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
    blob = json.dumps(prompt).lower()
    for token in FORBIDDEN:
        if token in blob:
            raise RuntimeError("forbidden token: %s" % token)
    return prompt


def wait_history(prompt_id, timeout_s=240.0, interval=3.0):
    deadline = time.time() + timeout_s
    last = None
    while time.time() < deadline:
        last = http_json("GET", "/history/" + prompt_id, timeout=15)
        entry = last.get(prompt_id) if isinstance(last, dict) else None
        if entry:
            status = entry.get("status") or {}
            outputs = entry.get("outputs") or {}
            has_images = any((n.get("images") if isinstance(n, dict) else None) for n in outputs.values())
            if status.get("status_str") == "success" and has_images:
                return entry
            if status.get("status_str") == "error":
                return entry
        time.sleep(interval)
    return last.get(prompt_id) if isinstance(last, dict) else last


def run_job(base, job, seed, tag):
    name, prefix, edit_text = job["name"], job["prefix"], job["prompt"]
    if int(seed) in FORBIDDEN_SEEDS:
        raise SystemExit("refusing reused seed %s" % seed)
    payload = {"client_id": CLIENT_ID, "prompt": build_prompt(base, edit_text, seed, prefix)}
    (LOG_DIR / ("official_qwen_%s_brief_v3_%s_prompt.json" % (name, tag))).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("=" * 72, flush=True)
    print("BRIEF-V3 %s tag=%s seed=%s" % (name, tag, seed), flush=True)
    t0 = time.time()
    resp = http_json("POST", "/prompt", payload, timeout=60)
    prompt_id = resp.get("prompt_id")
    print("  prompt_id=%s node_errors=%s" % (prompt_id, resp.get("node_errors")), flush=True)
    if not prompt_id or resp.get("node_errors"):
        raise SystemExit(resp)
    entry = wait_history(prompt_id)
    elapsed = time.time() - t0
    status = (entry or {}).get("status") or {}
    images = []
    for nid, node in ((entry or {}).get("outputs") or {}).items():
        if isinstance(node, dict):
            for img in node.get("images") or []:
                images.append(img)
    finished = time.strftime("%Y-%m-%d %H:%M:%S %z")
    print("  status=%s elapsed=%.2fs images=%s finished=%s" % (
        status.get("status_str"), elapsed, len(images), finished), flush=True)
    if status.get("status_str") != "success" or not images:
        raise SystemExit("job %s failed: %s" % (name, json.dumps(status, ensure_ascii=False)))
    img = images[0]
    out_path = COMFY_ROOT / "output" / (img.get("subfolder") or "") / img["filename"]
    size = png_size(out_path)
    dest = DESKTOP_DIR / out_path.name
    if dest.name in {
        "wenbao_q4_react_00001_.png",
        "wenbao_q4_sleep_00001_.png",
        "wenbao_q4_sit_00001_.png",
        "wenbao_q4_sit_00002_.png",
        "wenbao_q4_sit_brief.png",
    }:
        raise SystemExit("refusing to overwrite kept file: %s" % dest)
    shutil.copy2(out_path, dest)
    result = {
        "set": "brief-v3",
        "name": name,
        "tag": tag,
        "seed": int(seed),
        "prefix": prefix,
        "prompt_text": edit_text,
        "prompt_id": prompt_id,
        "elapsed_seconds": round(elapsed, 2),
        "finished_local": finished,
        "output_path": str(out_path),
        "desktop_copy": str(dest),
        "pixel_size": {"width": size[0], "height": size[1]} if size else None,
        "bytes": out_path.stat().st_size,
        "filename": out_path.name,
    }
    (LOG_DIR / ("official_qwen_%s_brief_v3_%s_result.json" % (name, tag))).write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("  saved %s %s %s bytes" % (out_path, size, result["bytes"]), flush=True)
    print("  desktop_copy %s" % dest, flush=True)
    return result


def main():
    args = sys.argv[1:]
    use_retry = False
    names = []
    for a in args:
        if a in ("--retry", "retry"):
            use_retry = True
        elif a in JOBS:
            names.append(a)
        else:
            raise SystemExit("unknown arg: %s" % a)
    if not names:
        names = ["react", "sleep"]
    stats = http_json("GET", "/system_stats", timeout=8)
    dev = (stats.get("devices") or [{}])[0]
    print("comfyui", (stats.get("system") or {}).get("comfyui_version"), "vram_free", dev.get("vram_free"), flush=True)
    http_json("POST", "/free", {"unload_models": False, "free_memory": True}, timeout=30)
    stats = http_json("GET", "/system_stats", timeout=8)
    dev = (stats.get("devices") or [{}])[0]
    print("after /free vram_free", dev.get("vram_free"), flush=True)
    base = json.loads(SMOKE_JSON.read_text(encoding="utf-8"))["prompt"]
    results = []
    for name in names:
        job = JOBS[name]
        seed = job["retry_seed"] if use_retry else job["seed"]
        tag = "retry" if use_retry else "try1"
        results.append(run_job(base, job, seed, tag))
    out = LOG_DIR / "official_qwen_action_poses_brief_v3_summary.json"
    if out.exists():
        prev = json.loads(out.read_text(encoding="utf-8"))
        if isinstance(prev, list):
            results = prev + results
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    (DESKTOP_DIR / "brief_v3_summary.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("DONE brief-v3", [r["name"] + ":" + r["filename"] for r in results], flush=True)


if __name__ == "__main__":
    main()
