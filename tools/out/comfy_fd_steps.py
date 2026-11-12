#!/usr/bin/env python3
"""Compare-only Comfy helpers: cache free, AnimeSharp upscale, FaceDetailer."""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

COMFY = "http://127.0.0.1:8188"
COMPARE = Path(r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\out\wenbao-assets\_compare")
RAW_NAME = "character-xiaoyan-fd-202611110302_raw.png"
STEM = "character-xiaoyan-fd-202611110302"
INPUT_DIR = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\input"
)
CLIENT_ID = "wenbao-fd-compare"

POS = (
    "masterpiece, best quality, xiaoyan, full body, solo, 1girl, standing, "
    "front view, looking at viewer, arms at sides, wearing a plain white "
    "t-shirt and white shorts, short black hair, brown eyes, simple white "
    "background, soft even lighting, no props"
)
NEG = (
    "overexposed, blown out highlights, high-key, vignette, circle, oval, ring, "
    "halo, backdrop, spotlight, lantern, ornament, gourd, prop, object, scenery, "
    "furniture, chair, seat, pillar, doorway, door, curtain, frame, border, "
    "extra objects, wings, black dress, long skirt, dark background, complex "
    "background, window, shadow, floor, wooden floor, cropped, close-up, lowres, "
    "bad anatomy, bad hands, text, error, missing fingers, extra digit, worst "
    "quality, low quality, watermark, blurry, multiple girls, extra limbs, "
    "deformed, socks, stockings, red eyes"
)
SEED = 202611110302


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
        # still running
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
    url = f"{COMFY}/view?{q}"
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as resp:
        data = resp.read()
    dest.write_bytes(data)
    print(f"saved {dest} ({len(data)} bytes) from {img['filename']} node {img.get('nodeId')}")
    return len(data)


def copy_raw_to_compare_and_input():
    src = COMPARE / "raw" / RAW_NAME
    if not src.is_file():
        raise SystemExit(f"missing raw: {src}")
    dst_compare = COMPARE / RAW_NAME
    shutil.copy2(src, dst_compare)
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    dst_input = INPUT_DIR / RAW_NAME
    shutil.copy2(src, dst_input)
    print(f"copied raw -> {dst_compare}")
    print(f"copied raw -> {dst_input}")
    return str(dst_compare)


def upscale_graph(image_name: str) -> dict:
    # Unique node ids; never reuse 10 for loader + save.
    return {
        "40": {
            "class_type": "LoadImage",
            "inputs": {"image": image_name},
        },
        "41": {
            "class_type": "UpscaleModelLoader",
            "inputs": {"model_name": "4x-AnimeSharp.pth"},
        },
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
            "inputs": {
                "filename_prefix": "Wenbao_FDCompare_AnimeSharp4x",
                "images": ["42", 0],
            },
        },
        "45": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": "Wenbao_FDCompare_AnimeSharp2x",
                "images": ["43", 0],
            },
        },
    }


def facedetailer_graph(image_name: str, prefix: str) -> dict:
    # Conservative Impact-like defaults. SAM device AUTO to spare 8GB VRAM.
    return {
        "50": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "meinamix_v12Final.safetensors"},
        },
        "51": {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["50", 0],
                "clip": ["50", 1],
                "lora_name": "xiaoyan.safetensors",
                "strength_model": 0.8,
                "strength_clip": 0.8,
            },
        },
        "52": {
            "class_type": "CLIPSetLastLayer",
            "inputs": {"clip": ["51", 1], "stop_at_clip_layer": -2},
        },
        "53": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": POS, "clip": ["52", 0]},
        },
        "54": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": NEG, "clip": ["52", 0]},
        },
        "55": {
            "class_type": "LoadImage",
            "inputs": {"image": image_name},
        },
        "56": {
            "class_type": "UltralyticsDetectorProvider",
            "inputs": {"model_name": "bbox/face_yolov8m.pt"},
        },
        "57": {
            "class_type": "SAMLoader",
            "inputs": {"model_name": "sam_vit_b_01ec64.pth", "device_mode": "AUTO"},
        },
        "58": {
            "class_type": "FaceDetailer",
            "inputs": {
                "image": ["55", 0],
                "model": ["51", 0],
                "clip": ["52", 0],
                "vae": ["50", 2],
                "guide_size": 512,
                "guide_size_for": True,
                "max_size": 1024,
                "seed": SEED,
                "steps": 20,
                "cfg": 6.8,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "positive": ["53", 0],
                "negative": ["54", 0],
                "denoise": 0.4,
                "feather": 5,
                "noise_mask": True,
                "force_inpaint": True,
                "bbox_threshold": 0.5,
                "bbox_dilation": 10,
                "bbox_crop_factor": 3.0,
                "sam_detection_hint": "center-1",
                "sam_dilation": 0,
                "sam_threshold": 0.93,
                "sam_bbox_expansion": 0,
                "sam_mask_hint_threshold": 0.7,
                "sam_mask_hint_use_negative": "False",
                "drop_size": 10,
                "bbox_detector": ["56", 0],
                "wildcard": "",
                "cycle": 1,
                "sam_model_opt": ["57", 0],
                "inpaint_model": False,
                "noise_mask_feather": 20,
                "tiled_encode": False,
                "tiled_decode": False,
            },
        },
        "59": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": prefix, "images": ["58", 0]},
        },
    }


def run_upscale():
    free_cache()
    time.sleep(1)
    result = queue_graph(upscale_graph(RAW_NAME), timeout_s=240)
    saved = {}
    for img in result["images"]:
        fn = img["filename"]
        if "AnimeSharp4x" in fn or img.get("nodeId") == "44":
            dest = COMPARE / f"{STEM}_animesharp4x_raw.png"
            key = "4x"
        elif "AnimeSharp2x" in fn or img.get("nodeId") == "45":
            dest = COMPARE / f"{STEM}_animesharp2x_raw.png"
            key = "2x"
        else:
            dest = COMPARE / f"{STEM}_upscale_unknown_{fn}"
            key = fn
        download_image(img, dest)
        saved[key] = str(dest)
        # also copy 2x into Comfy input for FaceDetailer
        if key == "2x":
            input_name = f"{STEM}_animesharp2x_raw.png"
            shutil.copy2(dest, INPUT_DIR / input_name)
            print(f"copied 2x raw -> {INPUT_DIR / input_name}")
        if key == "4x":
            input_name = f"{STEM}_animesharp4x_raw.png"
            shutil.copy2(dest, INPUT_DIR / input_name)
            print(f"copied 4x raw -> {INPUT_DIR / input_name}")
    meta_path = COMPARE / f"{STEM}_upscale_meta.json"
    meta = {"prompt_id": result["prompt_id"], "saved": saved, "step": "animesharp-upscale"}
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"upscale meta {meta_path}")
    return result


def run_facedetailer(which: str):
    if which == "2x":
        image_name = f"{STEM}_animesharp2x_raw.png"
        prefix = "Wenbao_FDCompare_FD2x"
        dest = COMPARE / f"{STEM}_animesharp2x_fd.png"
        timeout = 300
    elif which == "4x":
        image_name = f"{STEM}_animesharp4x_raw.png"
        prefix = "Wenbao_FDCompare_FD4x"
        dest = COMPARE / f"{STEM}_animesharp4x_fd.png"
        timeout = 360
    else:
        raise SystemExit(f"unknown fd target {which}")
    src = INPUT_DIR / image_name
    if not src.is_file():
        raise SystemExit(f"missing input for FaceDetailer: {src}")
    free_cache()
    time.sleep(2)
    result = queue_graph(facedetailer_graph(image_name, prefix), timeout_s=timeout)
    # FaceDetailer may also emit cropped face etc. Prefer the SaveImage node 59.
    chosen = None
    for img in result["images"]:
        if img.get("nodeId") == "59" or prefix in img["filename"]:
            chosen = img
            break
    if chosen is None:
        chosen = result["images"][0]
        print(f"WARNING: falling back to first image {chosen}")
    download_image(chosen, dest)
    # also stash other outputs for inspection
    extras = []
    for img in result["images"]:
        if img is chosen:
            continue
        extra = COMPARE / f"{STEM}_fd_{which}_node{img.get('nodeId')}_{img['filename']}"
        download_image(img, extra)
        extras.append(str(extra))
    meta_path = COMPARE / f"{STEM}_fd_{which}_meta.json"
    meta = {
        "prompt_id": result["prompt_id"],
        "target": which,
        "input": image_name,
        "saved": str(dest),
        "extras": extras,
        "settings": {
            "bbox_detector": "bbox/face_yolov8m.pt",
            "sam": "sam_vit_b_01ec64.pth AUTO",
            "guide_size": 512,
            "guide_size_for": "bbox",
            "max_size": 1024,
            "seed": SEED,
            "steps": 20,
            "cfg": 6.8,
            "sampler": "dpmpp_2m",
            "scheduler": "karras",
            "denoise": 0.4,
            "feather": 5,
            "bbox_threshold": 0.5,
            "bbox_dilation": 10,
            "bbox_crop_factor": 3.0,
            "sam_detection_hint": "center-1",
            "sam_threshold": 0.93,
            "cycle": 1,
            "noise_mask_feather": 20,
        },
    }
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"fd meta {meta_path}")
    return result


def main():
    p = argparse.ArgumentParser()
    p.add_argument("step", choices=["free", "copy-raw", "upscale", "fd-2x", "fd-4x"])
    args = p.parse_args()
    if args.step == "free":
        free_cache()
    elif args.step == "copy-raw":
        copy_raw_to_compare_and_input()
    elif args.step == "upscale":
        run_upscale()
    elif args.step == "fd-2x":
        run_facedetailer("2x")
    elif args.step == "fd-4x":
        run_facedetailer("4x")


if __name__ == "__main__":
    main()
