#!/usr/bin/env python3
"""
V6 · 雯宝专属 LoRA 同角色礼服生成 + 全套服饰/配饰高精度边缘连通域透明抠图脚本

核心能力：
1. 自动确保 ComfyUI/models/loras/wenbao.safetensors 存在（从 xiaoyan.safetensors 复制，不改原文件）。
2. 调用本机 ComfyUI (http://127.0.0.1:8188) 挂载 `meinamix_v12Final.safetensors` + `wenbao.safetensors` (LoRA 0.78)，
   按同一 Q 版雯宝比例生成 3 套全身新礼服（纯白底 `white background:1.4`）：
   - dress-apricot-tea (杏仁奶昔针织裙)
   - dress-rose-waltz (暮色蔷薇圆舞曲)
   - dress-starlight-dream (星河眠云轻纱裙)
3. 对生成的 3 套全身礼服 + 17 件可穿戴配饰（头饰、手持物、香氛）执行【四边连通域洪水填充抠图 + 1.5px 消白边 + 高斯柔化】，
   输出 100% 透明底 `.webp` 到 `public/assets/nikki/cutout/`，供前端 Paper-Doll 多层骨骼直接穿戴上身！
"""

from __future__ import annotations

import io
import json
import os
import shutil
import time
import urllib.parse
import urllib.request
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NIKKI_DIR = os.path.join(ROOT, "public", "assets", "nikki")
CUTOUT_DIR = os.path.join(NIKKI_DIR, "cutout")

COMFY_URL = os.environ.get("COMFY_BASE_URL", "http://127.0.0.1:8188").rstrip("/")
COMFY_LORAS_DIR = r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\models\loras"
CHECKPOINT = "meinamix_v12Final.safetensors"

# 确保 wenbao.safetensors 存在（不破坏原 xiaoyan.safetensors）
SRC_LORA = os.path.join(COMFY_LORAS_DIR, "xiaoyan.safetensors")
DST_LORA = os.path.join(COMFY_LORAS_DIR, "wenbao.safetensors")
if os.path.exists(SRC_LORA) and not os.path.exists(DST_LORA):
    shutil.copy2(SRC_LORA, DST_LORA)
    print(f"Created {DST_LORA} from {SRC_LORA}")

LORA_NAME = "wenbao.safetensors" if os.path.exists(DST_LORA) else "xiaoyan.safetensors"

NEGATIVE_LORA = (
    "wings, black dress, dark background, complex background, scenery, outdoors, indoors, "
    "furniture, window, shadow, gray floor, ground, cropped, close-up, lowres, bad anatomy, "
    "bad hands, text, error, missing fingers, extra digit, worst quality, low quality, "
    "watermark, blurry, multiple girls"
)

# 雯宝同角色 Q 版全身礼服生成任务（挂载 LoRA + 纯白背景便于 100% 干净抠图）
WENBAO_DRESS_JOBS = [
    {
        "id": "dress-apricot-tea",
        "raw_file": "dress-apricot-tea.png",
        "cutout_file": "dress-apricot-tea.webp",
        "seed": 2026110101,
        "prompt": (
            "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, black hair, "
            "short hair, bob cut, bangs, brown eyes, cute gentle smile, wearing a cozy warm apricot "
            "cream knitted sweater dress with caramel ribbon bow and white stockings, standing, "
            "front view, looking at viewer, (white background:1.4), simple background"
        ),
    },
    {
        "id": "dress-rose-waltz",
        "raw_file": "dress-rose-waltz.png",
        "cutout_file": "dress-rose-waltz.webp",
        "seed": 2026110102,
        "prompt": (
            "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, black hair, "
            "short hair, bob cut, bangs, brown eyes, sweet smile, wearing an elegant dusty rose "
            "pink frilly tea party dress with white lace collar and rose corset ribbon, standing, "
            "front view, looking at viewer, (white background:1.4), simple background"
        ),
    },
    {
        "id": "dress-starlight-dream",
        "raw_file": "dress-starlight-dream.png",
        "cutout_file": "dress-starlight-dream.webp",
        "seed": 2026110103,
        "prompt": (
            "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, black hair, "
            "short hair, bob cut, bangs, sparkling brown eyes, wearing a dreamy pastel lavender "
            "and starlight blue layered chiffon princess dress with golden star ribbons, standing, "
            "front view, looking at viewer, (white background:1.4), simple background"
        ),
    },
]

# 17 件可穿戴配饰文件清单（头饰、手持物、香氛）
WEARABLE_ITEMS = [
    "item-daisy-clip.png",
    "item-lace-ribbon.png",
    "item-plush-bunny.png",
    "item-whale-beret.png",
    "item-pearl-tiara.png",
    "item-sunflower-hat.png",
    "item-teacup.png",
    "item-cookie-basket.png",
    "item-sunflower-bouquet.png",
    "item-music-box.png",
    "item-whale-globe.png",
    "item-pocket-watch.png",
    "item-morning-breeze.png",
    "item-honey-amber.png",
    "item-rose-petals.png",
    "item-ocean-bubbles.png",
    "item-starlight-firefly.png",
]


def query_installed_loras() -> list[str]:
    url = f"{COMFY_URL}/object_info/LoraLoader"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=10) as resp:
        doc = json.loads(resp.read().decode("utf-8"))
    return doc["LoraLoader"]["input"]["required"]["lora_name"][0]


def generate_with_wenbao_lora(job: dict, active_lora: str) -> Image.Image:
    graph = {
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": CHECKPOINT},
        },
        "12": {
            "class_type": "LoraLoader",
            "inputs": {
                "model": ["4", 0],
                "clip": ["4", 1],
                "lora_name": active_lora,
                "strength_model": 0.78,
                "strength_clip": 0.78,
            },
        },
        "10": {
            "class_type": "CLIPSetLastLayer",
            "inputs": {"clip": ["12", 1], "stop_at_clip_layer": -2},
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": job["prompt"], "clip": ["10", 0]},
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": NEGATIVE_LORA, "clip": ["10", 0]},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 512, "height": 640, "batch_size": 1},
        },
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": job["seed"],
                "steps": 24,
                "cfg": 6.8,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0,
                "model": ["12", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0],
            },
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["3", 0], "vae": ["4", 2]},
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": "wenbao_lora", "images": ["8", 0]},
        },
    }

    payload = json.dumps({"client_id": "wenbao-lora-builder", "prompt": graph}).encode("utf-8")
    req = urllib.request.Request(
        f"{COMFY_URL}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        prompt_id = json.loads(resp.read().decode("utf-8"))["prompt_id"]

    start = time.time()
    while time.time() - start < 180:
        time.sleep(0.8)
        with urllib.request.urlopen(f"{COMFY_URL}/history/{prompt_id}", timeout=10) as hresp:
            hist = json.loads(hresp.read().decode("utf-8"))
        if prompt_id not in hist:
            continue
        outputs = hist[prompt_id].get("outputs", {})
        for node_out in outputs.values():
            images = node_out.get("images", [])
            if images:
                im_info = images[0]
                q = urllib.parse.urlencode(
                    {
                        "filename": im_info["filename"],
                        "subfolder": im_info.get("subfolder", ""),
                        "type": im_info.get("type", "output"),
                    }
                )
                with urllib.request.urlopen(f"{COMFY_URL}/view?{q}", timeout=15) as vresp:
                    raw_bytes = vresp.read()
                return Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
    raise RuntimeError(f"Timeout generating {job['id']}")


def smart_border_cutout(img: Image.Image, color_tol: float = 38.0) -> Image.Image:
    """
    自适应四边连通域洪水填充抠图（Border-Connected Flood-Fill Alpha Matting）：
    - 采样画布四边像素的背景主色，从四周边框向内 BFS 洪水填充，只抠除与外部相连的背景色；
    - 角色内部（即使穿白衬衫/白袜子）只要被发丝或轮廓线包围，均完好保留；
    - 对蒙版执行 1px 腐蚀 + 高斯羽化，彻底消除白边锯齿。
    """
    rgba = img.convert("RGBA")
    arr = np.asarray(rgba, dtype=np.float32)
    rgb = arr[..., :3]
    h, w, _ = rgb.shape

    visited = np.zeros((h, w), dtype=bool)
    is_bg = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    # 将四条边框像素加入种子队列
    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
        visited[0, x] = True
        visited[h - 1, x] = True
    for y in range(h):
        if not visited[y, 0]:
            q.append((y, 0))
            visited[y, 0] = True
        if not visited[y, w - 1]:
            q.append((y, w - 1))
            visited[y, w - 1] = True

    # 计算边框平均背景色
    border_pixels = np.concatenate([rgb[0, :], rgb[h - 1, :], rgb[:, 0], rgb[:, w - 1]], axis=0)
    bg_median = np.median(border_pixels, axis=0)

    # 局部梯度与全局背景色双约束 BFS
    step_tol = 18.0
    while q:
        cy, cx = q.popleft()
        is_bg[cy, cx] = True
        cur_c = rgb[cy, cx]
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                nxt_c = rgb[ny, nx]
                # 相邻色差小，且距离边框背景色不超过容差（或极高亮白底）
                diff_step = np.linalg.norm(nxt_c - cur_c)
                diff_global = np.linalg.norm(nxt_c - bg_median)
                is_near_white = nxt_c[0] > 232 and nxt_c[1] > 232 and nxt_c[2] > 232
                if (diff_step <= step_tol and diff_global <= color_tol) or is_near_white:
                    visited[ny, nx] = True
                    q.append((ny, nx))

    alpha = np.where(is_bg, 0, 255).astype(np.uint8)
    alpha_img = Image.fromarray(alpha, mode="L")
    # 消除 1px 边缘白边并柔化抗锯齿
    alpha_img = alpha_img.filter(ImageFilter.MinFilter(3))
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(0.75))

    out = rgba.copy()
    out.putalpha(alpha_img)

    # 裁剪透明边距并居中对齐到画布
    bbox = alpha_img.point(lambda v: 255 if v > 12 else 0).getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def align_character_canvas(trimmed: Image.Image, canvas: int = 760, target_h: int = 690, baseline_y: int = 742) -> Image.Image:
    """将抠好图的全身雯宝立绘统一缩放到 760x760 画布、脚底对齐 y=742，和 original/maid 完全一致！"""
    factor = target_h / max(1, trimmed.height)
    new_w = max(1, round(trimmed.width * factor))
    new_h = max(1, round(trimmed.height * factor))
    scaled = trimmed.resize((new_w, new_h), Image.LANCZOS)

    frame = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    dx = (canvas - new_w) // 2
    dy = baseline_y - new_h
    frame.alpha_composite(scaled, (dx, max(0, dy)))
    return frame


def align_item_canvas(trimmed: Image.Image, canvas: int = 360) -> Image.Image:
    """将抠好图的头饰/手持物/香氛居中放入 360x360 透明画布，方便直接穿戴在角色骨骼锚点上。"""
    max_dim = max(trimmed.width, trimmed.height, 1)
    target = int(canvas * 0.84)
    factor = target / max_dim
    new_w = max(1, round(trimmed.width * factor))
    new_h = max(1, round(trimmed.height * factor))
    scaled = trimmed.resize((new_w, new_h), Image.LANCZOS)

    # 为配饰加上柔和圆形边缘衰减，防止方形背景残留硬边
    arr = np.asarray(scaled).copy()
    h, w, _ = arr.shape
    yy, xx = np.ogrid[:h, :w]
    cy, cx = h / 2.0, w / 2.0
    rx, ry = w / 2.0, h / 2.0
    dist = np.sqrt(((xx - cx) / max(1.0, rx)) ** 2 + ((yy - cy) / max(1.0, ry)) ** 2)
    radial_fade = np.clip((1.06 - dist) / 0.22, 0.0, 1.0)
    arr[..., 3] = (arr[..., 3].astype(np.float32) * radial_fade).astype(np.uint8)
    feathered = Image.fromarray(arr, mode="RGBA")

    frame = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    dx = (canvas - new_w) // 2
    dy = (canvas - new_h) // 2
    frame.alpha_composite(feathered, (dx, dy))
    return frame


def main() -> None:
    os.makedirs(CUTOUT_DIR, exist_ok=True)
    installed = query_installed_loras()
    active_lora = "wenbao.safetensors" if "wenbao.safetensors" in installed else "xiaoyan.safetensors"
    print(f"Using ComfyUI LoRA: {active_lora}")

    # 1. 用雯宝 LoRA 生成 3 套同角色 Q 版全身礼服 + 透明抠图
    for job in WENBAO_DRESS_JOBS:
        print(f"Generating same-character Wenbao dress [{job['id']}] with LoRA {active_lora}...")
        raw_img = generate_with_wenbao_lora(job, active_lora)
        raw_path = os.path.join(NIKKI_DIR, job["raw_file"])
        raw_img.save(raw_path, "PNG")

        trimmed = smart_border_cutout(raw_img, color_tol=44.0)
        aligned = align_character_canvas(trimmed)
        cutout_path = os.path.join(CUTOUT_DIR, job["cutout_file"])
        aligned.save(cutout_path, "WEBP", quality=92, method=6)
        print(f"  -> Saved transparent cutout: {cutout_path} ({os.path.getsize(cutout_path)/1024:.1f} KiB)")

    # 2. 对全部 17 件配饰/手持物/香氛生成透明抠图图层
    for filename in WEARABLE_ITEMS:
        src_path = os.path.join(NIKKI_DIR, filename)
        if not os.path.exists(src_path):
            print(f"  WARN: missing {src_path}")
            continue
        img = Image.open(src_path)
        trimmed = smart_border_cutout(img, color_tol=52.0)
        aligned = align_item_canvas(trimmed, canvas=360)
        webp_name = os.path.splitext(filename)[0] + ".webp"
        out_path = os.path.join(CUTOUT_DIR, webp_name)
        aligned.save(out_path, "WEBP", quality=90, method=6)
        print(f"  -> Cutout wearable item: {webp_name} ({os.path.getsize(out_path)/1024:.1f} KiB)")

    print("ALL WENBAO LORA DRESSES & TRANSPARENT CUTOUTS READY.")


if __name__ == "__main__":
    main()
