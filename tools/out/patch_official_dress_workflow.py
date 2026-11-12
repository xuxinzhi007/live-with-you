#!/usr/bin/env python3
"""Write the locked clean-chain into the official dress workflow.

Backs up the live Comfy copy first, then edits it in place and writes a
canonical repo copy under tools/workflows/. Does not touch 姿势训练集_v2.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

LIVE = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"
    r"\ComfyUI\user\default\workflows\MeinaMix_雯宝LoRA_换装抠图.json"
)
REPO = Path(
    r"C:\Users\ZhuanZ1\Desktop\wenbebi\tools\workflows\MeinaMix_雯宝LoRA_换装抠图.json"
)
BACKUP_DIR = LIVE.parent / "_archive_20261111"
BACKUP_NAME = "MeinaMix_雯宝LoRA_换装抠图.json.bak-20261111-official-before-clean-chain"

POS = (
    "masterpiece, best quality, xiaoyan, full body, solo, 1girl, standing, "
    "front view, looking at viewer, arms at sides, wearing a plain white "
    "t-shirt and white shorts, short black hair, brown eyes, simple white "
    "background, soft even lighting, no props, feet visible, entire body in frame"
)
NEG = (
    "overexposed, blown out highlights, high-key, vignette, circle, oval, ring, "
    "halo, backdrop, spotlight, lantern, ornament, gourd, prop, object, scenery, "
    "furniture, chair, seat, pillar, doorway, door, curtain, frame, border, "
    "extra objects, wings, black dress, long skirt, dark background, complex "
    "background, window, shadow, floor, wooden floor, cropped, cropped feet, "
    "cut off, close-up, lowres, bad anatomy, bad hands, text, error, missing "
    "fingers, extra digit, worst quality, low quality, watermark, blurry, "
    "multiple girls, extra limbs, deformed, socks, stockings, red eyes"
)

NOTE = """# 官方换装管线 OFFICIAL DRESS（锁脸+锁姿+AnimeSharp；正式抠图走 isnet-anime）

文件名保持 `MeinaMix_雯宝LoRA_换装抠图`，供脚本/对接识别。
2026-11-11 已写入当前锁定链（默认白 T + 白短裤对照）。本轮不加 FaceDetailer。

## 阶段（按图从左到右）
1. **底模 + 角色 LoRA**：meinamix_v12Final + `xiaoyan.safetensors`（0.80 / 0.80）。本轮暂不改名为 wenbao。
2. **锁脸 IPAdapter**：`standby-bust-white.png` + PLUS FACE，权重 0.80。
3. **锁姿 OpenPose + ControlNet**：姿势参考默认 `xiaoyan_pose_stand_clean_padded.png`（头、脚留边），强度 0.85、end=1.0；先看「骨架预览」再出图。
4. **采样出图**（512×640，dpmpp_2m / karras / 26 / cfg 6.8）→ 保存 **Wenbao_Raw**。
5. **4x-AnimeSharp**：UpscaleModelLoader `4x-AnimeSharp.pth` + ImageUpscaleWithModel → **Wenbao_Official_AnimeSharp4x**，再 lanczos 到 1024×1280 → **Wenbao_Official_AnimeSharp2x**。
6. **正式抠图（官方后处理，不在本图内跑）**：颜色键/洪水填充已停用，不当正式抠图。
   ```
   python tools/official-isnet-rematte.py --src <AnimeSharp4x或2x RAW> --stem <name>
   ```
   使用 rembg `isnet-anime`（不是 u2net）铺纯白底，并由 `tools/run-official-dress.mjs` 在出图后自动调用。

## 提示词约定
- 默认衣服：白 T 恤 + 白短裤；正向要求 full body、feet visible、entire body in frame。
- 背景用温和的 `simple white background`，不要用 `(plain solid white background:1.6)`（会把人物曝掉）。
- 负向要挡门/柱/框/家具/地面/椭圆/背景板；**不要**把 `shorts` 写进负向。

## 不是什么
- 颜色键 Cutout 节点已静音，仅留档，不当正式衣柜源。
- 无锁脸/锁姿的纯 API 临时覆盖 = unofficial，不当正式对照。
- 详见 `tools/PIPELINE-OFFICIAL.md`
"""


def core_props(name: str) -> dict:
    return {"Node name for S&R": name, "cnr_id": "comfy-core", "ver": "0.28.0"}


def make_node(
    nid: int,
    typ: str,
    *,
    pos,
    size,
    order: int,
    title: str,
    inputs: list,
    outputs: list,
    widgets,
) -> dict:
    return {
        "id": nid,
        "type": typ,
        "pos": list(pos),
        "size": list(size),
        "flags": {},
        "order": order,
        "mode": 0,
        "inputs": inputs,
        "outputs": outputs,
        "title": title,
        "properties": core_props(typ),
        "widgets_values": widgets,
    }


def main() -> None:
    if not LIVE.is_file():
        raise SystemExit(f"missing live official workflow: {LIVE}")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    bak_archive = BACKUP_DIR / BACKUP_NAME
    bak_beside = LIVE.with_name(BACKUP_NAME)
    if not bak_archive.exists():
        shutil.copy2(LIVE, bak_archive)
        print(f"backup {bak_archive}")
    else:
        print(f"backup already exists {bak_archive}")
    if not bak_beside.exists():
        shutil.copy2(LIVE, bak_beside)
        print(f"backup {bak_beside}")
    else:
        print(f"backup already exists {bak_beside}")

    data = json.loads(LIVE.read_text(encoding="utf-8"))
    nodes = {n["id"]: n for n in data["nodes"]}

    # Prompts, titles, face/pose refs
    if 11 in nodes:
        nodes[11]["widgets_values"] = [NOTE]
        nodes[11]["title"] = "官方换装 OFFICIAL（LoRA+锁脸+锁姿+AnimeSharp；isnet-anime 后处理）"
        nodes[11]["size"] = [820, 700]
    if 6 in nodes:
        nodes[6]["widgets_values"] = [POS]
        nodes[6]["title"] = "正向（白T+白短裤；全身入画；温和白底）"
    if 7 in nodes:
        nodes[7]["widgets_values"] = [NEG]
        nodes[7]["title"] = "负向（挡门/框/家具/椭圆；不含 shorts）"
    if 21 in nodes:
        nodes[21]["widgets_values"] = ["standby-bust-white.png", "image"]
        nodes[21]["title"] = "锁脸参考图（standby-bust-white.png）"
    if 23 in nodes:
        nodes[23]["widgets_values"] = ["xiaoyan_pose_stand_clean_padded.png", "image"]
        nodes[23]["title"] = "锁姿参考图（xiaoyan_pose_stand_clean_padded.png，头脚留边）"
    if 9 in nodes:
        nodes[9]["title"] = "保存 512 原图 (Wenbao_Raw)"

    # Mute and unlink the color-key draft cutout; keep nodes as archive only.
    cutout_ids = {14, 15, 16, 17, 18, 19}
    titles = {
        14: "DEPRECATED 颜色键蒙版（已停用；正式抠图走 isnet-anime）",
        15: "DEPRECATED 反转蒙版（已停用）",
        16: "DEPRECATED 颜色键 Alpha（已停用）",
        17: "DEPRECATED 颜色键 Cutout（已停用）",
        18: "DEPRECATED GrowMask（已停用）",
        19: "DEPRECATED FeatherMask（已停用）",
    }
    for cid in cutout_ids:
        n = nodes[cid]
        n["mode"] = 2  # Never / muted
        n["title"] = titles[cid]
        for inp in n.get("inputs") or []:
            if "link" in inp:
                inp["link"] = None
        for out in n.get("outputs") or []:
            out["links"] = None

    # AnimeSharp chain: new unique ids 40-44 (do not reuse 10).
    n40 = make_node(
        40,
        "UpscaleModelLoader",
        pos=[2000, 200],
        size=[320, 80],
        order=18,
        title="8. 加载 4x-AnimeSharp",
        inputs=[
            {
                "localized_name": "模型名称",
                "name": "model_name",
                "type": "COMBO",
                "widget": {"name": "model_name"},
                "link": None,
            }
        ],
        outputs=[
            {
                "localized_name": "UPSCALE_MODEL",
                "name": "UPSCALE_MODEL",
                "type": "UPSCALE_MODEL",
                "slot_index": 0,
                "links": None,
            }
        ],
        widgets=["4x-AnimeSharp.pth"],
    )
    n41 = make_node(
        41,
        "ImageUpscaleWithModel",
        pos=[2360, 80],
        size=[300, 80],
        order=19,
        title="9. AnimeSharp 4x 放大",
        inputs=[
            {"localized_name": "放大模型", "name": "upscale_model", "type": "UPSCALE_MODEL", "link": None},
            {"localized_name": "图像", "name": "image", "type": "IMAGE", "link": None},
        ],
        outputs=[
            {
                "localized_name": "图像",
                "name": "IMAGE",
                "type": "IMAGE",
                "slot_index": 0,
                "links": None,
            }
        ],
        widgets=[],
    )
    n42 = make_node(
        42,
        "SaveImage",
        pos=[2700, 80],
        size=[380, 300],
        order=20,
        title="保存 AnimeSharp 4x (Wenbao_Official_AnimeSharp4x)",
        inputs=[
            {"localized_name": "图片", "name": "images", "type": "IMAGE", "link": None},
            {
                "localized_name": "文件名前缀",
                "name": "filename_prefix",
                "type": "STRING",
                "widget": {"name": "filename_prefix"},
                "link": None,
            },
        ],
        outputs=[{"localized_name": "images", "name": "images", "type": "IMAGE", "links": None}],
        widgets=["Wenbao_Official_AnimeSharp4x"],
    )
    n43 = make_node(
        43,
        "ImageScale",
        pos=[2360, 260],
        size=[300, 200],
        order=21,
        title="lanczos 到 1024x1280 预览",
        inputs=[
            {"localized_name": "图像", "name": "image", "type": "IMAGE", "link": None},
            {
                "localized_name": "放大方法",
                "name": "upscale_method",
                "type": "COMBO",
                "widget": {"name": "upscale_method"},
                "link": None,
            },
            {
                "localized_name": "宽度",
                "name": "width",
                "type": "INT",
                "widget": {"name": "width"},
                "link": None,
            },
            {
                "localized_name": "高度",
                "name": "height",
                "type": "INT",
                "widget": {"name": "height"},
                "link": None,
            },
            {
                "localized_name": "裁剪",
                "name": "crop",
                "type": "COMBO",
                "widget": {"name": "crop"},
                "link": None,
            },
        ],
        outputs=[
            {
                "localized_name": "图像",
                "name": "IMAGE",
                "type": "IMAGE",
                "slot_index": 0,
                "links": None,
            }
        ],
        widgets=["lanczos", 1024, 1280, "disabled"],
    )
    n44 = make_node(
        44,
        "SaveImage",
        pos=[2700, 420],
        size=[380, 300],
        order=22,
        title="保存 AnimeSharp 2x (Wenbao_Official_AnimeSharp2x)",
        inputs=[
            {"localized_name": "图片", "name": "images", "type": "IMAGE", "link": None},
            {
                "localized_name": "文件名前缀",
                "name": "filename_prefix",
                "type": "STRING",
                "widget": {"name": "filename_prefix"},
                "link": None,
            },
        ],
        outputs=[{"localized_name": "images", "name": "images", "type": "IMAGE", "links": None}],
        widgets=["Wenbao_Official_AnimeSharp2x"],
    )
    for extra in (n40, n41, n42, n43, n44):
        nodes[extra["id"]] = extra

    # Rebuild live links: keep generation + pose + raw save, drop color-key, add AnimeSharp.
    links = []
    lid = 1

    def link(src, src_slot, dst, dst_slot, typ):
        nonlocal lid
        links.append([lid, src, src_slot, dst, dst_slot, typ])
        lid += 1

    link(4, 0, 12, 0, "MODEL")
    link(4, 1, 12, 1, "CLIP")
    link(12, 0, 20, 0, "MODEL")
    link(12, 1, 10, 0, "CLIP")
    link(10, 0, 6, 0, "CLIP")
    link(10, 0, 7, 0, "CLIP")
    link(20, 0, 22, 0, "MODEL")
    link(20, 1, 22, 1, "IPADAPTER")
    link(21, 0, 22, 2, "IMAGE")
    link(22, 0, 3, 0, "MODEL")
    link(6, 0, 27, 0, "CONDITIONING")
    link(7, 0, 27, 1, "CONDITIONING")
    link(23, 0, 24, 0, "IMAGE")
    link(24, 0, 25, 0, "IMAGE")
    link(25, 0, 27, 3, "IMAGE")
    link(26, 0, 27, 2, "CONTROL_NET")
    link(25, 0, 28, 0, "IMAGE")
    link(27, 0, 3, 1, "CONDITIONING")
    link(27, 1, 3, 2, "CONDITIONING")
    link(5, 0, 3, 3, "LATENT")
    link(3, 0, 8, 0, "LATENT")
    link(4, 2, 8, 1, "VAE")
    link(8, 0, 9, 0, "IMAGE")
    # AnimeSharp
    link(40, 0, 41, 0, "UPSCALE_MODEL")
    link(8, 0, 41, 1, "IMAGE")
    link(41, 0, 42, 0, "IMAGE")
    link(41, 0, 43, 0, "IMAGE")
    link(43, 0, 44, 0, "IMAGE")

    data["links"] = links
    data["nodes"] = list(nodes.values())
    data["last_node_id"] = max(n["id"] for n in data["nodes"])
    data["last_link_id"] = max(L[0] for L in links)
    data["id"] = "wenbao-official-dress-lora-ipadapter-openpose-animesharp-isnet"

    out_map: dict[tuple[int, int], list[int]] = {}
    in_map: dict[tuple[int, int], int] = {}
    for L in links:
        lid_, src, ss, dst, ds, _ = L
        out_map.setdefault((src, ss), []).append(lid_)
        in_map[(dst, ds)] = lid_

    for n in data["nodes"]:
        for i, out in enumerate(n.get("outputs") or []):
            out["links"] = out_map.get((n["id"], i))
        for i, inp in enumerate(n.get("inputs") or []):
            if "link" in inp:
                inp["link"] = in_map.get((n["id"], i))

    text = json.dumps(data, ensure_ascii=False, indent=2)
    LIVE.write_text(text, encoding="utf-8")
    print(f"wrote live official JSON {LIVE}")
    REPO.parent.mkdir(parents=True, exist_ok=True)
    REPO.write_text(text, encoding="utf-8")
    print(f"wrote repo canonical copy {REPO}")
    print(f"nodes={len(data['nodes'])} links={len(links)} last_node={data['last_node_id']} last_link={data['last_link_id']}")


if __name__ == "__main__":
    main()
