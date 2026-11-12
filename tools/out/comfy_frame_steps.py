#!/usr/bin/env python3
"""Compare-only helpers: cache free, copy raw, AnimeSharp upscale. No FaceDetailer."""
from __future__ import annotations

import argparse
import json
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
COMPARE = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\out\wenbao-assets\_compare")
INPUT_DIR = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\input"
)
CLIENT_ID = "wenbao-frame-compare"
DEFAULT_STEM = "character-xiaoyan-frame-202611110401"


def request(method: str, path: str, data=None, timeout=60):
    body = None
    headers = {}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(COMFY + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            if not raw:
                return None
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", "replace")
        raise SystemExit(f"HTTP {e.code} {path}: {err}") from e


def free_cache():
    request("POST", "/free", {"unload_models": True, "free_memory": True})
    print("freed Comfy cache")


def queue_graph(graph: dict, timeout_s: int = 300) -> dict:
    submit = request("POST", "/prompt", {"client_id": CLIENT_ID, "prompt": graph})
    if not submit or "prompt_id" not in submit:
        raise SystemExit(f"no prompt_id: {submit}")
    if submit.get("node_errors"):
        raise SystemExit(f"node_errors: {json.dumps(submit['node_errors'], indent=2)}")
    prompt_id = submit["prompt_id"]
    print(f"queued {prompt_id}")
    start = time.time()
    while time.time() - start < timeout_s:
        time.sleep(1.5)
        try:
            hist = request("GET", f"/history/{urllib.parse.quote(prompt_id)}", timeout=30)
        except Exception as e:
            print(f"history poll error: {e}")
            continue
        record = (hist or {}).get(prompt_id)
        if not record:
            continue
        status = record.get("status") or {}
        if status.get("completed") is False and status.get("status_str") == "error":
            raise SystemExit(f"Comfy error: {json.dumps(status, indent=2)[:4000]}")
        outputs = record.get("outputs") or {}
        images = []
        for node_id, node_out in outputs.items():
            for img in node_out.get("images") or []:
                images.append({"nodeId": node_id, **img})
        if images:
            print(f"completed {prompt_id} in {time.time()-start:.1f}s, {len(images)} image(s)")
            return {"prompt_id": prompt_id, "record": record, "images": images}
        if status.get("status_str") == "error":
            raise SystemExit(f"Comfy error: {json.dumps(status, indent=2)[:4000]}")
    raise SystemExit(f"timeout waiting for {prompt_id}")


def download_image(img: dict, dest: Path) -> int:
    q = urllib.parse.urlencode(
        {
            "filename": img["filename"],
            "subfolder": img.get("subfolder") or "",
            "type": img.get("type") or "output",
        }
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(f"{COMFY}/view?{q}", timeout=120) as resp:
        data = resp.read()
    dest.write_bytes(data)
    print(f"saved {dest} ({len(data)} bytes) from {img['filename']} node {img.get('nodeId')}")
    return len(data)


def copy_raw(stem: str):
    raw_name = f"{stem}_raw.png"
    src = COMPARE / "raw" / raw_name
    if not src.is_file():
        raise SystemExit(f"missing raw: {src}")
    shutil.copy2(src, COMPARE / raw_name)
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, INPUT_DIR / raw_name)
    print(f"copied raw -> {COMPARE / raw_name}")
    print(f"copied raw -> {INPUT_DIR / raw_name}")


def upscale_graph(image_name: str) -> dict:
    # Unique ids; never reuse 10 for loader + save.
    return {
        "40": {"class_type": "LoadImage", "inputs": {"image": image_name}},
        "41": {"class_type": "UpscaleModelLoader", "inputs": {"model_name": "4x-AnimeSharp.pth"}},
        "42": {
            "class_type": "ImageUpscaleWithModel",
            "inputs": {"upscale_model": ["41", 0], "image": ["40", 0]},
        },
        "43": {
            "class_type": "ImageScale",
            "inputs": {
                "image": ["42", 0],
                "upscale_method": "lanczos",
                "width": 1024,
                "height": 1280,
                "crop": "disabled",
            },
        },
        "44": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": "Wenbao_FrameCompare_AnimeSharp4x", "images": ["42", 0]},
        },
        "45": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": "Wenbao_FrameCompare_AnimeSharp2x", "images": ["43", 0]},
        },
    }


def run_upscale(stem: str):
    raw_name = f"{stem}_raw.png"
    if not (INPUT_DIR / raw_name).is_file():
        raise SystemExit(f"missing input {INPUT_DIR / raw_name}")
    free_cache()
    time.sleep(1)
    result = queue_graph(upscale_graph(raw_name), timeout_s=240)
    saved = {}
    for img in result["images"]:
        if "AnimeSharp4x" in img["filename"] or img.get("nodeId") == "44":
            dest = COMPARE / f"{stem}_animesharp4x_raw.png"
            key = "4x"
        elif "AnimeSharp2x" in img["filename"] or img.get("nodeId") == "45":
            dest = COMPARE / f"{stem}_animesharp2x_raw.png"
            key = "2x"
        else:
            dest = COMPARE / f"{stem}_upscale_unknown_{img['filename']}"
            key = img["filename"]
        download_image(img, dest)
        saved[key] = str(dest)
    meta = {"prompt_id": result["prompt_id"], "saved": saved, "step": "animesharp-upscale", "stem": stem}
    meta_path = COMPARE / f"{stem}_upscale_meta.json"
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"upscale meta {meta_path}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("step", choices=["free", "copy-raw", "upscale"])
    p.add_argument("--stem", default=DEFAULT_STEM)
    args = p.parse_args()
    if args.step == "free":
        free_cache()
    elif args.step == "copy-raw":
        copy_raw(args.stem)
    elif args.step == "upscale":
        run_upscale(args.stem)


if __name__ == "__main__":
    main()
