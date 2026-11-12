#!/usr/bin/env python3
"""Rewrite official dress template into 7 labeled groups.

Face standard is FEATURE identity from 待机状态 / standby-bust-white.png
(齐刘海, large round brown eyes, slight smile, same girl) — NOT a chibi
or Q-version proportion lock. Image 2 only locks clothes (white T + shorts).

Does not overwrite earlier 20261111 backups. Does not touch 姿势训练集_v2.
"""
from __future__ import annotations

import json
import shutil
from copy import deepcopy
from pathlib import Path

LIVE = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"
    r"\ComfyUI\user\default\workflows\MeinaMix_雯宝LoRA_换装抠图.json"
)
REPO = Path(
    r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\workflows\MeinaMix_雯宝LoRA_换装抠图.json"
)
BACKUP_NAME = (
    "MeinaMix_雯宝LoRA_换装抠图.json.bak-20261111-official-before-seven-group-features"
)

POS = (
    "masterpiece, best quality, xiaoyan, full body, solo, 1girl, standing, "
    "front view, looking at viewer, arms at sides, wearing a plain white "
    "t-shirt and white shorts, short black hair, straight bangs, 齐刘海, "
    "large round brown eyes, slight smile, simple white background, "
    "soft even lighting, no props, feet visible, entire body in frame"
)
NEG = (
    "overexposed, blown out highlights, high-key, vignette, circle, oval, ring, "
    "halo, backdrop, spotlight, lantern, ornament, gourd, prop, object, scenery, "
    "furniture, chair, seat, pillar, doorway, door, curtain, frame, border, "
    "extra objects, wings, black dress, long skirt, dark background, complex "
    "background, window, shadow, floor, wooden floor, cropped, cropped feet, "
    "cut off, close-up, lowres, bad anatomy, bad hands, text, error, missing "
    "fingers, extra digit, worst quality, low quality, watermark, blurry, "
    "multiple girls, extra limbs, deformed, socks, stockings, red eyes, "
    "colored rim light, orange stain, orange lighting, color contamination, "
    "extra hair clumps, stray hair, floating hair, hair fragment, "
    "narrow eyes, lidded eyes, messy bangs, side-swept bangs"
)
IP_WEIGHT = 0.9

NOTE = """# 官方换装管线 OFFICIAL DRESS（7 组逐步对照）

文件名保持 `MeinaMix_雯宝LoRA_换装抠图`。8GB 显存请按组逐步跑，或用 `tools/run-official-dress.mjs`（官方 runner 会分组执行并在每组存中间图）。不要一次把 7 组全部送进同一张显存。

## 脸的标准（特征，不是 Q 版比例模具）
`待机状态.png` / `standby-bust-white.png` 是**特征参考**，用来锁同一位角色：齐刘海、圆棕眼、浅笑、能认出是同一个人。
不是把全身改成 Q 版/chibi，也不用头身比当过门条件。图2只锁衣服（白 T + 白短裤）。

## 七组
1. **锁身份特征**：LoRA `xiaoyan.safetensors` 0.8/0.8 + IPAdapter PLUS FACE {ip}（脸部特征，不是全身风格迁移）+ 参考 `standby-bust-white.png`。中间图：身份参考图。
2. **锁衣服与姿势**：白 T + 白短裤，全身、脚在画面内；OpenposePreprocessor → ControlNet 0.85 end=1.0；姿势 `xiaoyan_pose_stand_clean_padded.png`。中间图：骨架预览。
3. **生成 512×640 底图**：meinamix_v12Final，CLIP skip -2，dpmpp_2m / karras / 26 / cfg 6.8。中间图：512 原图。
4. **AnimeSharp 放大**：`4x-AnimeSharp.pth` + lanczos 1024×1280。中间图：4x 与 2x。
5. **放大后面部特征精修**：FaceDetailer，**引导/参考必须是待机状态 / standby-bust-white.png**（经 IPAdapter 锁在精修模型上）。禁止把已漂的生成脸再当参考。只修面部特征，不把身子改成 Q 版。中间图：精修后全身。
6. **铺纯白底**：本机 Comfy **没有** rembg/isnet 节点。正式后处理：
   `python tools/official-isnet-rematte.py --src <精修图或 AnimeSharp RAW> --stem <name>`
   rembg `isnet-anime`（不是 u2net）。由官方 runner 在本组自动调用。颜色键节点 14–19 保持停用。
7. **去橙红光渍**：本机没有稳定、保守的标准去渍 Comfy 节点（只有 ImageBlend / ImageSharpen，不当去渍器）。本组是标记过的钩子：runner 会留下带组名的中间图，并写明是否只是透传第 6 组结果。

对照只写到 `tools/out/wenbao-assets/_compare/`，不入库、不上 :8788、不动四层。
""".replace("{ip}", str(IP_WEIGHT))

NOTE6 = """# 第 6 组 · 铺纯白底（官方后处理，不在本图内跑）

本机 Comfy 没有 rembg / isnet 节点，不要假装有。

正式命令（官方 runner 出图后会调用）：
```
python tools/official-isnet-rematte.py --src <FaceDetailer或AnimeSharp RAW> --stem <name> --outdir tools/out/wenbao-assets/_compare
```
使用 rembg `isnet-anime` 铺纯白。颜色键/洪水填充已停用（节点 14–19 muted）。
"""

NOTE7 = """# 第 7 组 · 去橙红光渍（钩子）

本机已装标准节点里，没有稳定、保守的去橙红光渍工具。不要用 ImageSharpen 冒充去渍。

本组是官方流水线里的标记钩子：在 isnet 铺白之后执行。当前 runner 会保存一张带 `_07_stain_removal` 文件名的中间图；若没有可用去渍节点，该图为第 6 组白底的透传，并在 meta 里如实说明。
"""


def core_props(name: str, cnr: str = "comfy-core") -> dict:
    return {"Node name for S&R": name, "cnr_id": cnr, "ver": "0.28.0"}


def backup(path: Path, also_archive: bool = False) -> None:
    if not path.is_file():
        raise SystemExit(f"missing {path}")
    bak = path.with_name(BACKUP_NAME)
    if not bak.exists():
        shutil.copy2(path, bak)
        print(f"backup {bak} ({bak.stat().st_size} bytes)")
    else:
        print(f"backup already exists {bak}")
    if also_archive:
        archive = path.parent / "_archive_20261111" / BACKUP_NAME
        archive.parent.mkdir(parents=True, exist_ok=True)
        if not archive.exists():
            shutil.copy2(path, archive)
            print(f"backup {archive}")


def make_node(nid, typ, *, pos, size, order, title, inputs, outputs, widgets, props=None, mode=0):
    n = {
        "id": nid,
        "type": typ,
        "pos": list(pos),
        "size": list(size),
        "flags": {},
        "order": order,
        "mode": mode,
        "inputs": inputs,
        "outputs": outputs,
        "title": title,
        "properties": props or core_props(typ),
        "widgets_values": widgets,
    }
    return n


def w_in(name, typ, localized=None):
    return {
        "localized_name": localized or name,
        "name": name,
        "type": typ,
        "widget": {"name": name},
        "link": None,
    }


def l_in(name, typ, localized=None):
    return {
        "localized_name": localized or name,
        "name": name,
        "type": typ,
        "link": None,
    }


def out(name, typ, slot=0):
    return {
        "localized_name": name,
        "name": name,
        "type": typ,
        "slot_index": slot,
        "links": None,
    }


def patch_existing(n, **kwargs):
    n = deepcopy(n)
    for k, v in kwargs.items():
        n[k] = v
    return n


def main() -> None:
    backup(LIVE, also_archive=True)
    backup(REPO, also_archive=False)

    data = json.loads(LIVE.read_text(encoding="utf-8"))
    nodes = {n["id"]: n for n in data["nodes"]}

    # --- update existing nodes: titles, widgets, positions ---
    if 11 in nodes:
        nodes[11] = patch_existing(
            nodes[11],
            title="官方换装 OFFICIAL（7组：特征锁脸，不是Q版模具；白T白短裤；isnet后处理）",
            widgets_values=[NOTE],
            pos=[40, 0],
            size=[1760, 420],
        )
    if 4 in nodes:
        nodes[4] = patch_existing(nodes[4], title="1. 加载动漫底模 (MeinaMix)", pos=[40, 500], order=1)
    if 12 in nodes:
        nodes[12] = patch_existing(
            nodes[12],
            title="1. 角色 LoRA xiaoyan 0.8/0.8",
            widgets_values=["xiaoyan.safetensors", 0.8, 0.8],
            pos=[400, 500],
            order=6,
        )
    if 10 in nodes:
        nodes[10] = patch_existing(nodes[10], title="CLIP Skip (-2)", pos=[760, 520], order=9)
    if 21 in nodes:
        nodes[21] = patch_existing(
            nodes[21],
            title="1. 身份特征参考（standby-bust-white.png＝待机状态胸像，特征不是比例模具）",
            widgets_values=["standby-bust-white.png", "image"],
            pos=[40, 720],
            order=3,
        )
    if 20 in nodes:
        nodes[20] = patch_existing(
            nodes[20],
            title="1. 脸部特征模型 (IPAdapter PLUS FACE)",
            pos=[400, 720],
            order=8,
        )
    if 22 in nodes:
        wv = list(nodes[22].get("widgets_values") or [0.9, 0, 1, "standard"])
        wv[0] = IP_WEIGHT
        nodes[22] = patch_existing(
            nodes[22],
            title=f"1. 套用待机状态面部特征 (IPAdapter {IP_WEIGHT}，不当Q版风格迁移)",
            widgets_values=wv,
            pos=[760, 720],
            order=11,
        )
    if 6 in nodes:
        nodes[6] = patch_existing(
            nodes[6],
            title="正向（齐刘海+圆棕眼+浅笑+白T白短裤；全身入画；不强制chibi）",
            widgets_values=[POS],
            pos=[1120, 500],
            order=12,
            size=[460, 240],
        )
    if 7 in nodes:
        nodes[7] = patch_existing(
            nodes[7],
            title="负向（挡门框椭圆/色渍/乱刘海；不含 shorts；不强制Q版身材）",
            widgets_values=[NEG],
            pos=[1120, 760],
            order=13,
            size=[460, 240],
        )

    # Group 2 pose
    if 23 in nodes:
        nodes[23] = patch_existing(
            nodes[23],
            title="2. 锁姿参考（xiaoyan_pose_stand_clean_padded.png，头脚留边）",
            widgets_values=["xiaoyan_pose_stand_clean_padded.png", "image"],
            pos=[40, 1280],
            order=4,
        )
    if 24 in nodes:
        nodes[24] = patch_existing(nodes[24], title="2. 姿势图缩到长边 768", pos=[420, 1300], order=7)
    if 25 in nodes:
        nodes[25] = patch_existing(nodes[25], title="2. 提取 OpenPose 骨架", pos=[800, 1280], order=10)
    if 26 in nodes:
        nodes[26] = patch_existing(nodes[26], title="2. OpenPose ControlNet 模型", pos=[1160, 1320], order=5)
    if 27 in nodes:
        nodes[27] = patch_existing(
            nodes[27],
            title="2. 按骨架约束姿势 (0.85 end=1.0)",
            widgets_values=[0.85, 0, 1],
            pos=[1540, 1280],
            order=15,
        )
    if 28 in nodes:
        nodes[28] = patch_existing(
            nodes[28],
            title="2. 保存衣服/姿势中间图（骨架预览）",
            widgets_values=["Wenbao_Official_02_ClothesPose"],
            pos=[1540, 1560],
            order=14,
        )

    # Group 3 generate
    if 5 in nodes:
        nodes[5] = patch_existing(
            nodes[5],
            title="3. 画布 512x640",
            widgets_values=[512, 640, 1],
            pos=[40, 2060],
            order=2,
        )
    if 3 in nodes:
        # keep sampler settings; do not force a compare seed into the template default
        wv = list(nodes[3].get("widgets_values") or [0, "randomize", 26, 6.8, "dpmpp_2m", "karras", 1])
        if len(wv) >= 7:
            wv[2], wv[3], wv[4], wv[5], wv[6] = 26, 6.8, "dpmpp_2m", "karras", 1
        nodes[3] = patch_existing(
            nodes[3],
            title="3. 采样生成（dpmpp_2m / karras / 26 / cfg 6.8）",
            widgets_values=wv,
            pos=[400, 2040],
            order=16,
        )
    if 8 in nodes:
        nodes[8] = patch_existing(nodes[8], title="3. VAE 解码", pos=[760, 2040], order=17)
    if 9 in nodes:
        nodes[9] = patch_existing(
            nodes[9],
            title="3. 保存 512 底图中间图",
            widgets_values=["Wenbao_Official_03_Raw512"],
            pos=[760, 2160],
            order=18,
        )

    # Group 4 AnimeSharp — keep unique ids 40-44, never reuse 10
    if 40 in nodes:
        nodes[40] = patch_existing(nodes[40], title="4. 加载 4x-AnimeSharp", pos=[40, 2660], order=19)
    if 41 in nodes:
        nodes[41] = patch_existing(nodes[41], title="4. AnimeSharp 4x 放大", pos=[400, 2660], order=20)
    if 42 in nodes:
        nodes[42] = patch_existing(
            nodes[42],
            title="4. 保存 AnimeSharp 4x 中间图",
            widgets_values=["Wenbao_Official_04_AnimeSharp4x"],
            pos=[760, 2660],
            order=21,
        )
    if 43 in nodes:
        nodes[43] = patch_existing(
            nodes[43],
            title="4. lanczos 到 1024x1280",
            widgets_values=["lanczos", 1024, 1280, "disabled"],
            pos=[400, 2820],
            order=22,
        )
    if 44 in nodes:
        nodes[44] = patch_existing(
            nodes[44],
            title="4. 保存 AnimeSharp 2x 中间图",
            widgets_values=["Wenbao_Official_04_AnimeSharp2x"],
            pos=[760, 2820],
            order=23,
        )

    # Keep color-key muted, parked outside the 7 official groups
    cutout_titles = {
        14: "DEPRECATED 颜色键蒙版（已停用；正式抠图走 isnet-anime）",
        15: "DEPRECATED 反转蒙版（已停用）",
        16: "DEPRECATED 颜色键 Alpha（已停用）",
        17: "DEPRECATED 颜色键 Cutout（已停用）",
        18: "DEPRECATED GrowMask（已停用）",
        19: "DEPRECATED FeatherMask（已停用）",
    }
    cutout_pos = {
        14: [1900, 2060],
        15: [2200, 2060],
        16: [2500, 2060],
        17: [2500, 2200],
        18: [1900, 2200],
        19: [2200, 2200],
    }
    for cid, title in cutout_titles.items():
        if cid in nodes:
            n = nodes[cid]
            n["mode"] = 2
            n["title"] = title
            n["pos"] = cutout_pos[cid]
            for inp in n.get("inputs") or []:
                if "link" in inp:
                    inp["link"] = None
            for o in n.get("outputs") or []:
                o["links"] = None

    # --- new nodes ---
    nodes[45] = make_node(
        45,
        "SaveImage",
        pos=[400, 1000],
        size=[360, 280],
        order=24,
        title="1. 保存身份特征参考中间图",
        inputs=[l_in("images", "IMAGE", "图片"), w_in("filename_prefix", "STRING", "文件名前缀")],
        outputs=[{"localized_name": "images", "name": "images", "type": "IMAGE", "links": None}],
        widgets=["Wenbao_Official_01_IdentityRef"],
    )

    nodes[50] = make_node(
        50,
        "UltralyticsDetectorProvider",
        pos=[40, 3260],
        size=[320, 80],
        order=25,
        title="5. 人脸检测 bbox/face_yolov8m",
        inputs=[w_in("model_name", "COMBO", "模型")],
        outputs=[
            out("BBOX_DETECTOR", "BBOX_DETECTOR", 0),
            out("SEGM_DETECTOR", "SEGM_DETECTOR", 1),
        ],
        widgets=["bbox/face_yolov8m.pt"],
        props=core_props("UltralyticsDetectorProvider", "comfyui-impact-subpack"),
    )
    nodes[51] = make_node(
        51,
        "SAMLoader",
        pos=[400, 3260],
        size=[340, 110],
        order=26,
        title="5. SAM sam_vit_b（AUTO，省显存）",
        inputs=[w_in("model_name", "COMBO", "模型"), w_in("device_mode", "COMBO", "设备")],
        outputs=[out("SAM_MODEL", "SAM_MODEL", 0)],
        widgets=["sam_vit_b_01ec64.pth", "AUTO"],
        props=core_props("SAMLoader", "comfyui-impact-pack"),
    )

    fd_inputs = [
        l_in("image", "IMAGE", "图像"),
        l_in("model", "MODEL", "模型"),
        l_in("clip", "CLIP", "CLIP"),
        l_in("vae", "VAE", "VAE"),
        w_in("guide_size", "FLOAT", "guide_size"),
        w_in("guide_size_for", "BOOLEAN", "guide_size_for"),
        w_in("max_size", "FLOAT", "max_size"),
        w_in("seed", "INT", "种子"),
        w_in("steps", "INT", "步数"),
        w_in("cfg", "FLOAT", "cfg"),
        w_in("sampler_name", "COMBO", "采样器"),
        w_in("scheduler", "COMBO", "调度器"),
        l_in("positive", "CONDITIONING", "正面条件"),
        l_in("negative", "CONDITIONING", "负面条件"),
        w_in("denoise", "FLOAT", "降噪"),
        w_in("feather", "INT", "feather"),
        w_in("noise_mask", "BOOLEAN", "noise_mask"),
        w_in("force_inpaint", "BOOLEAN", "force_inpaint"),
        w_in("bbox_threshold", "FLOAT", "bbox_threshold"),
        w_in("bbox_dilation", "INT", "bbox_dilation"),
        w_in("bbox_crop_factor", "FLOAT", "bbox_crop_factor"),
        w_in("sam_detection_hint", "COMBO", "sam_detection_hint"),
        w_in("sam_dilation", "INT", "sam_dilation"),
        w_in("sam_threshold", "FLOAT", "sam_threshold"),
        w_in("sam_bbox_expansion", "INT", "sam_bbox_expansion"),
        w_in("sam_mask_hint_threshold", "FLOAT", "sam_mask_hint_threshold"),
        w_in("sam_mask_hint_use_negative", "COMBO", "sam_mask_hint_use_negative"),
        w_in("drop_size", "INT", "drop_size"),
        l_in("bbox_detector", "BBOX_DETECTOR", "bbox_detector"),
        w_in("wildcard", "STRING", "wildcard"),
        w_in("cycle", "INT", "cycle"),
        l_in("sam_model_opt", "SAM_MODEL", "sam_model_opt"),
        w_in("inpaint_model", "BOOLEAN", "inpaint_model"),
        w_in("noise_mask_feather", "INT", "noise_mask_feather"),
        w_in("tiled_encode", "BOOLEAN", "tiled_encode"),
        w_in("tiled_decode", "BOOLEAN", "tiled_decode"),
    ]
    # seed widget includes control_after_generate in widgets_values
    fd_widgets = [
        512,           # guide_size
        True,          # guide_size_for = bbox
        1024,          # max_size
        0,             # seed (runner overrides)
        "fixed",       # control_after_generate (UI only)
        20,            # steps
        6.8,           # cfg
        "dpmpp_2m",
        "karras",
        0.45,          # denoise: feature pull, not full restyle
        5,
        True,
        True,
        0.5,
        10,
        3.0,
        "center-1",
        0,
        0.93,
        0,
        0.7,
        "False",
        10,
        "",
        1,
        False,         # inpaint_model
        20,            # noise_mask_feather
        False,
        False,
    ]
    nodes[52] = make_node(
        52,
        "FaceDetailer",
        pos=[800, 3240],
        size=[360, 900],
        order=27,
        title="5. FaceDetailer 面部特征精修（参考待机状态特征，不把全身改成Q版）",
        inputs=fd_inputs,
        outputs=[
            out("image", "IMAGE", 0),
            out("cropped_refined", "IMAGE", 1),
            out("cropped_enhanced", "IMAGE", 2),
            out("alpha", "MASK", 3),
        ],
        widgets=fd_widgets,
        props=core_props("FaceDetailer", "comfyui-impact-pack"),
    )
    nodes[53] = make_node(
        53,
        "SaveImage",
        pos=[1200, 3240],
        size=[380, 320],
        order=28,
        title="5. 保存面部精修中间图",
        inputs=[l_in("images", "IMAGE", "图片"), w_in("filename_prefix", "STRING", "文件名前缀")],
        outputs=[{"localized_name": "images", "name": "images", "type": "IMAGE", "links": None}],
        widgets=["Wenbao_Official_05_FaceDetailer"],
    )

    nodes[60] = make_node(
        60,
        "MarkdownNote",
        pos=[40, 4000],
        size=[1200, 320],
        order=29,
        title="6. 铺纯白底（官方脚本 official-isnet-rematte.py，本机无 isnet 节点）",
        inputs=[],
        outputs=[],
        widgets=[NOTE6],
        props={"Node name for S&R": "MarkdownNote"},
    )
    nodes[61] = make_node(
        61,
        "MarkdownNote",
        pos=[40, 4440],
        size=[1200, 300],
        order=30,
        title="7. 去橙红光渍（钩子：无稳定标准去渍节点，透传并如实记录）",
        inputs=[],
        outputs=[],
        widgets=[NOTE7],
        props={"Node name for S&R": "MarkdownNote"},
    )

    # --- links (no color-key) ---
    links = []
    lid = 1

    def link(src, ss, dst, ds, typ):
        nonlocal lid
        links.append([lid, src, ss, dst, ds, typ])
        lid += 1

    # Group 1 identity
    link(4, 0, 12, 0, "MODEL")
    link(4, 1, 12, 1, "CLIP")
    link(12, 0, 20, 0, "MODEL")
    link(12, 1, 10, 0, "CLIP")
    link(10, 0, 6, 0, "CLIP")
    link(10, 0, 7, 0, "CLIP")
    link(20, 0, 22, 0, "MODEL")
    link(20, 1, 22, 1, "IPADAPTER")
    link(21, 0, 22, 2, "IMAGE")
    link(21, 0, 45, 0, "IMAGE")  # identity intermediate
    # Group 2 pose / CN
    link(6, 0, 27, 0, "CONDITIONING")
    link(7, 0, 27, 1, "CONDITIONING")
    link(23, 0, 24, 0, "IMAGE")
    link(24, 0, 25, 0, "IMAGE")
    link(25, 0, 27, 3, "IMAGE")
    link(26, 0, 27, 2, "CONTROL_NET")
    link(25, 0, 28, 0, "IMAGE")
    # Group 3 gen
    link(22, 0, 3, 0, "MODEL")
    link(27, 0, 3, 1, "CONDITIONING")
    link(27, 1, 3, 2, "CONDITIONING")
    link(5, 0, 3, 3, "LATENT")
    link(3, 0, 8, 0, "LATENT")
    link(4, 2, 8, 1, "VAE")
    link(8, 0, 9, 0, "IMAGE")
    # Group 4 upscale (from VAE decode; runner may also reload saved raw)
    link(40, 0, 41, 0, "UPSCALE_MODEL")
    link(8, 0, 41, 1, "IMAGE")
    link(41, 0, 42, 0, "IMAGE")
    link(41, 0, 43, 0, "IMAGE")
    link(43, 0, 44, 0, "IMAGE")
    # Group 5 FaceDetailer: image is 2x upscale; model is IPAdapter-locked (待机状态 features)
    # NEVER use the generated face as the IPAdapter/reference image.
    link(43, 0, 52, 0, "IMAGE")
    link(22, 0, 52, 1, "MODEL")
    link(10, 0, 52, 2, "CLIP")
    link(4, 2, 52, 3, "VAE")
    link(6, 0, 52, 12, "CONDITIONING")  # will fix by name after if slots differ
    link(7, 0, 52, 13, "CONDITIONING")
    link(50, 0, 52, 28, "BBOX_DETECTOR")
    link(51, 0, 52, 31, "SAM_MODEL")
    link(52, 0, 53, 0, "IMAGE")

    # Fix FaceDetailer input slots by name (safer than hard-coded indices)
    # Rebuild FD links properly below after we know input indices.
    # Remove the tentative FD links and redo by name.
    def is_fd_link(L):
        return L[3] in (52, 53) or (L[1] == 52)

    links = [L for L in links if not is_fd_link(L)]
    fd = nodes[52]
    name_to_slot = {inp["name"]: i for i, inp in enumerate(fd["inputs"])}

    def fd_link(src, ss, inp_name, typ):
        link(src, ss, 52, name_to_slot[inp_name], typ)

    fd_link(43, 0, "image", "IMAGE")
    fd_link(22, 0, "model", "MODEL")
    fd_link(10, 0, "clip", "CLIP")
    fd_link(4, 2, "vae", "VAE")
    fd_link(6, 0, "positive", "CONDITIONING")
    fd_link(7, 0, "negative", "CONDITIONING")
    fd_link(50, 0, "bbox_detector", "BBOX_DETECTOR")
    fd_link(51, 0, "sam_model_opt", "SAM_MODEL")
    link(52, 0, 53, 0, "IMAGE")

    # Groups
    groups = [
        {"id": 1, "title": "1. 锁身份特征（待机状态特征参考，不是Q版比例模具）", "bounding": [20, 460, 1620, 720], "color": "#3f789e", "flags": {}},
        {"id": 2, "title": "2. 锁衣服与姿势（白T+白短裤，padded 站姿）", "bounding": [20, 1220, 1920, 700], "color": "#3f789e", "flags": {}},
        {"id": 3, "title": "3. 生成 512×640 底图", "bounding": [20, 1980, 1200, 540], "color": "#3f789e", "flags": {}},
        {"id": 4, "title": "4. AnimeSharp 放大（4x + lanczos 1024×1280）", "bounding": [20, 2580, 1200, 520], "color": "#3f789e", "flags": {}},
        {"id": 5, "title": "5. 放大后面部特征精修（FaceDetailer，参考待机状态特征）", "bounding": [20, 3180, 1640, 760], "color": "#3f789e", "flags": {}},
        {"id": 6, "title": "6. 铺纯白底（官方脚本 tools/official-isnet-rematte.py）", "bounding": [20, 3940, 1640, 420], "color": "#3f789e", "flags": {}},
        {"id": 7, "title": "7. 去橙红光渍（钩子；无稳定标准节点则透传并记录）", "bounding": [20, 4380, 1640, 400], "color": "#3f789e", "flags": {}},
    ]

    data["nodes"] = list(nodes.values())
    data["links"] = links
    data["groups"] = groups
    data["last_node_id"] = max(n["id"] for n in data["nodes"])
    data["last_link_id"] = max(L[0] for L in links)
    data["id"] = "wenbao-official-dress-seven-group-feature-lock"

    out_map = {}
    in_map = {}
    for L in links:
        lid_, src, ss, dst, ds, _ = L
        out_map.setdefault((src, ss), []).append(lid_)
        in_map[(dst, ds)] = lid_
    for n in data["nodes"]:
        for i, o in enumerate(n.get("outputs") or []):
            o["links"] = out_map.get((n["id"], i))
        for i, inp in enumerate(n.get("inputs") or []):
            if "link" in inp:
                inp["link"] = in_map.get((n["id"], i))

    text = json.dumps(data, ensure_ascii=False, indent=2)
    # safety: official positive must not force chibi proportions
    pos_now = nodes[6]["widgets_values"][0].lower()
    banned = ["chibi proportions", "q-version", "large head"]
    # 'chibi' as a hard lock word should also be absent
    if "chibi" in pos_now or any(b in pos_now for b in banned):
        raise SystemExit(f"refusing to write chibi/q-version lock into official positive: {nodes[6]['widgets_values'][0]}")
    LIVE.write_text(text, encoding="utf-8")
    REPO.parent.mkdir(parents=True, exist_ok=True)
    REPO.write_text(text, encoding="utf-8")
    print(f"wrote live {LIVE} ({LIVE.stat().st_size} bytes)")
    print(f"wrote repo {REPO} ({REPO.stat().st_size} bytes)")
    print(f"nodes={len(data['nodes'])} links={len(links)} groups={len(groups)} last_node={data['last_node_id']}")
    print("POSITIVE:", nodes[6]["widgets_values"][0])
    print("IPAdapter:", nodes[22]["widgets_values"][0], "face:", nodes[21]["widgets_values"][0])
    print("FD image source: node 43 (2x upscale); FD model: node 22 IPAdapter + standby-bust-white.png")


if __name__ == "__main__":
    main()
