#!/usr/bin/env python3
"""Upgrade MeinaMix_雯宝LoRA_换装抠图 into official multi-stage dress pipeline.

Merges face lock + pose lock from 姿势训练集_v2 into the cutout workflow,
keeps Lora + draft RGBA cutout, documents post-process 760 deliver.
"""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

WF = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"
    r"\ComfyUI\user\default\workflows\MeinaMix_雯宝LoRA_换装抠图.json"
)
POSE_V2 = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"
    r"\ComfyUI\user\default\workflows\MeinaMix_小燕_姿势训练集_v2.json"
)

NOTE = """# 官方礼服管线 OFFICIAL DRESS（多阶段，非纯文生）

文件名保持 `MeinaMix_雯宝LoRA_换装抠图`，供脚本/对接识别。

## 阶段（按图从左到右）
1. **底模 + 角色 LoRA**：meinamix_v12Final + `xiaoyan.safetensors`（~0.80）
2. **锁脸 IPAdapter**：`待机状态.png` + PLUS FACE，权重 ~0.80（长相靠参考+LoRA，正向不要写发型瞳色）
3. **锁姿 OpenPose + ControlNet**：姿势参考默认 `xiaoyan_pose_stand_clean.png`，强度 ~0.85；先看「骨架预览」再出图
4. **采样出图** → 保存 **Wenbao_Raw**（RGB 原图）
5. **草稿抠图** ImageColorToMask→Invert→GrowMask(-2)→FeatherMask(2)→JoinAlpha → **Wenbao_Cutout**
   - 白裙/白袜仍可能被颜色键咬掉，**不当正式衣柜源**
6. **正式 760 RGBA**（仓库脚本，不在本图里跑完）：
   ```
   python tools/deliver-dress-frame.py <Wenbao_Raw.png> --name dress-xxx.png --check-spec
   ```
   输出 `tools/out/wenbao-assets/dress/`（脚底≈748，中心x≈380）

## 不是什么
- 无锁脸/锁姿的纯文生 = unofficial，不当正式帧
- card 走独立 512×640 CG，不当衣服层
- 详见 `tools/PIPELINE-DRESS.md` / `tools/PIPELINE-OFFICIAL.md`
"""

POS = (
    "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, "
    "wearing an elegant dusty rose velvet evening dress with lace collar, "
    "standing, front view, looking at viewer, (white background:1.4), simple background"
)

NEG = (
    "wings, black dress, dark background, complex background, scenery, furniture, "
    "window, shadow, floor, cropped, close-up, lowres, bad anatomy, bad hands, text, "
    "error, missing fingers, extra digit, worst quality, low quality, watermark, blurry, "
    "multiple girls, extra limbs, deformed"
)


def node_template(src_nodes: dict[int, dict], nid: int, **overrides) -> dict:
    n = deepcopy(src_nodes[nid])
    n.update(overrides)
    return n


def main() -> None:
    data = json.loads(WF.read_text(encoding="utf-8"))
    pose = json.loads(POSE_V2.read_text(encoding="utf-8"))
    pose_nodes = {n["id"]: n for n in pose["nodes"]}

    # Drop any previous 20-29 / 30 skeleton nodes if re-running
    data["nodes"] = [n for n in data["nodes"] if n["id"] not in set(range(20, 31))]
    nodes = {n["id"]: n for n in data["nodes"]}

    # Update note + prompts + latent size stay 512x640 for dress plate
    if 11 in nodes:
        nodes[11]["widgets_values"] = [NOTE]
        nodes[11]["title"] = "官方礼服 OFFICIAL（LoRA+锁脸+锁姿+草稿抠图；760 用脚本）"
        nodes[11]["size"] = [820, 420]
    if 6 in nodes:
        nodes[6]["widgets_values"] = [POS]
        nodes[6]["title"] = "正向（xiaoyan + 服装/姿势；长相靠 LoRA/IPAdapter）"
    if 7 in nodes:
        nodes[7]["widgets_values"] = [NEG]
    if 5 in nodes:
        nodes[5]["widgets_values"] = [512, 640, 1]
        nodes[5]["title"] = "画布 512x640（dress 原图；正式再对齐 760）"

    # --- Face lock nodes from pose v2 ---
    n20 = node_template(pose_nodes, 20, pos=[420, 460], order=3, title="3. 脸部参考模型 (IPAdapter PLUS FACE)")
    n21 = node_template(pose_nodes, 21, pos=[40, 560], order=4, title="锁脸参考图（待机状态.png）")
    n21["widgets_values"] = ["待机状态.png", "image"]
    n22 = node_template(pose_nodes, 22, pos=[800, 480], order=5, title="4. 套用小燕脸 (IPAdapter 0.8)")
    n22["widgets_values"] = [0.8, 0, 1, "standard"]

    # --- Pose lock ---
    n23 = node_template(pose_nodes, 23, pos=[40, 780], order=6, title="锁姿参考图（xiaoyan_pose_stand_clean.png）")
    n23["widgets_values"] = ["xiaoyan_pose_stand_clean.png", "image"]
    n24 = node_template(pose_nodes, 24, pos=[420, 800], order=7, title="姿势图缩到长边 768")
    n25 = node_template(pose_nodes, 25, pos=[800, 780], order=8, title="5. 提取 OpenPose 骨架")
    n26 = node_template(pose_nodes, 26, pos=[1120, 820], order=9, title="OpenPose ControlNet 模型")
    n27 = node_template(pose_nodes, 27, pos=[1480, 760], order=10, title="6. 按骨架约束姿势 (0.85)")
    n27["widgets_values"] = [0.85, 0, 1]
    n28 = node_template(pose_nodes, 19, id=28, pos=[1120, 980], order=11, title="保存骨架预览")
    n28["widgets_values"] = ["Wenbao_Dress_PoseSkel"]

    # Fix Lora title
    if 12 in nodes:
        nodes[12]["title"] = "2. 角色 LoRA xiaoyan (~0.80)"
        nodes[12]["widgets_values"] = ["xiaoyan.safetensors", 0.8, 0.8]

    # Sampler title
    if 3 in nodes:
        nodes[3]["title"] = "7. 采样生成（吃 LoRA+脸+骨架）"

    extra = [n20, n21, n22, n23, n24, n25, n26, n27, n28]
    data["nodes"] = list(nodes.values()) + extra

    # Rebuild links carefully
    # Keep non-model/conditioning core links; rewrite model+cond+new chains
    keep_types_skip = set()  # rebuild all for clarity
    links = []
    lid = 1

    def link(src, src_slot, dst, dst_slot, typ):
        nonlocal lid
        links.append([lid, src, src_slot, dst, dst_slot, typ])
        lid += 1

    # Checkpoint -> Lora
    link(4, 0, 12, 0, "MODEL")
    link(4, 1, 12, 1, "CLIP")
    # Lora MODEL -> IPAdapterUnifiedLoader
    link(12, 0, 20, 0, "MODEL")
    # Lora CLIP -> CLIPSkip
    link(12, 1, 10, 0, "CLIP")
    # CLIPSkip -> prompts
    link(10, 0, 6, 0, "CLIP")
    link(10, 0, 7, 0, "CLIP")
    # IPAdapter loader -> IPAdapter apply
    link(20, 0, 22, 0, "MODEL")
    link(20, 1, 22, 1, "IPADAPTER")
    link(21, 0, 22, 2, "IMAGE")
    # IPAdapter model -> KSampler
    link(22, 0, 3, 0, "MODEL")
    # Prompts -> ControlNetApplyAdvanced
    link(6, 0, 27, 0, "CONDITIONING")
    link(7, 0, 27, 1, "CONDITIONING")
    # Pose chain
    link(23, 0, 24, 0, "IMAGE")
    link(24, 0, 25, 0, "IMAGE")
    link(25, 0, 27, 3, "IMAGE")
    link(26, 0, 27, 2, "CONTROL_NET")
    link(25, 0, 28, 0, "IMAGE")
    # ControlNet out -> KSampler
    link(27, 0, 3, 1, "CONDITIONING")
    link(27, 1, 3, 2, "CONDITIONING")
    # Latent
    link(5, 0, 3, 3, "LATENT")
    # Decode
    link(3, 0, 8, 0, "LATENT")
    link(4, 2, 8, 1, "VAE")
    # Raw save
    link(8, 0, 9, 0, "IMAGE")
    # Draft cutout chain (already present nodes 14-19,16,17)
    link(8, 0, 14, 0, "IMAGE")
    link(14, 0, 15, 0, "MASK")
    link(15, 0, 18, 0, "MASK")
    link(18, 0, 19, 0, "MASK")
    link(8, 0, 16, 0, "IMAGE")
    link(19, 0, 16, 1, "MASK")
    link(16, 0, 17, 0, "IMAGE")

    data["links"] = links
    data["last_node_id"] = max(n["id"] for n in data["nodes"])
    data["last_link_id"] = max(L[0] for L in links)
    data["id"] = "wenbao-official-dress-lora-ipadapter-openpose-cutout"

    # Sync link arrays on outputs/inputs roughly (Comfy UI uses both)
    # Clear and set output links
    out_map: dict[tuple[int, int], list[int]] = {}
    in_map: dict[tuple[int, int], int] = {}
    for L in links:
        lid_, src, ss, dst, ds, _ = L
        out_map.setdefault((src, ss), []).append(lid_)
        in_map[(dst, ds)] = lid_

    for n in data["nodes"]:
        for i, out in enumerate(n.get("outputs") or []):
            out["links"] = out_map.get((n["id"], i), None)
            if out["links"] is not None and len(out["links"]) == 0:
                out["links"] = None
        for i, inp in enumerate(n.get("inputs") or []):
            if "link" in inp:
                inp["link"] = in_map.get((n["id"], i))

    # Fix IPAdapterUnifiedLoader / IPAdapter input link indices by name where possible
    # pose v2 templates already have correct input order

    WF.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Upgraded official dress workflow: {WF}")
    print(f"nodes={len(data['nodes'])} links={len(links)}")
    types = sorted({n['type'] for n in data['nodes']})
    print("types:", ", ".join(types))


if __name__ == "__main__":
    main()
