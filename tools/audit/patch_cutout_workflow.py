#!/usr/bin/env python3
"""Patch MeinaMix_雯宝LoRA_换装抠图.json: GrowMask+FeatherMask, prompt cleanup, notes."""
from __future__ import annotations

import json
from pathlib import Path

WF = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"
    r"\ComfyUI\user\default\workflows\MeinaMix_雯宝LoRA_换装抠图.json"
)

NOTE = """这是专为《雯宝 · Live With You》搭建的同角色换装工作流（文件名保持不变）：

1. 底模 meinamix_v12Final + 角色 LoRA `xiaoyan.safetensors`（强度约 0.80）。
2. 正向只写 `xiaoyan` + 姿势/服装/白底；长相交给 LoRA，不要写发型/瞳色。
3. **草稿透明**：ImageColorToMask(白) → InvertMask → GrowMask(-2) → FeatherMask(2) → JoinImageWithAlpha → Wenbao_Cutout。
   白裙子/白袜仍可能被颜色键咬掉，**不当正式衣柜源**。
4. **正式 dress**：保存 Wenbao_Raw 后，在项目里跑
   `python tools/deliver-dress-frame.py <Wenbao_Raw.png> --name dress-xxx.png --check-spec`
   （四边洪水抠图 + tools/character/spec.json 的 760×760 对齐）。
5. 本机无 RMBG/BiRefNet/rembg/LayerDiffuse；Bria 云端抠图不作默认依赖。
"""

POS = (
    "masterpiece, best quality, xiaoyan, chibi, full body, solo, 1girl, "
    "wearing an elegant dusty rose velvet evening dress with lace collar, "
    "standing, front view, looking at viewer, (white background:1.4), simple background"
)


def main() -> None:
    data = json.loads(WF.read_text(encoding="utf-8"))
    nodes = {n["id"]: n for n in data["nodes"]}
    links = data["links"]

    # Update note + positive prompt
    if 11 in nodes:
        nodes[11]["widgets_values"] = [NOTE]
        nodes[11]["title"] = "雯宝 LoRA 换装抠图（草稿 RGBA；正式交付用 deliver-dress-frame）"
    if 6 in nodes:
        nodes[6]["widgets_values"] = [POS]
        nodes[6]["title"] = "正向提示词（xiaoyan + 服装/姿势；长相靠 LoRA）"

    # Remove old link 15->16 (mask) if present: [15, 15, 0, 16, 1, 'MASK']
    links = [L for L in links if not (L[0] == 15 and L[3] == 16 and L[4] == 1)]
    # Also drop any existing 18/19 links we may re-add
    links = [L for L in links if L[0] not in (18, 19, 20) and L[1] not in (18, 19)]

    # Drop previous Grow/Feather nodes if re-running
    data["nodes"] = [n for n in data["nodes"] if n["id"] not in (18, 19)]

    grow = {
        "id": 18,
        "type": "GrowMask",
        "pos": [1680, 420],
        "size": [270, 110],
        "flags": {},
        "order": 11,
        "mode": 0,
        "inputs": [
            {"localized_name": "mask", "name": "mask", "type": "MASK", "link": 15},
            {
                "localized_name": "expand",
                "name": "expand",
                "type": "INT",
                "widget": {"name": "expand"},
                "link": None,
            },
            {
                "localized_name": "tapered_corners",
                "name": "tapered_corners",
                "type": "BOOLEAN",
                "widget": {"name": "tapered_corners"},
                "link": None,
            },
        ],
        "outputs": [
            {
                "localized_name": "MASK",
                "name": "MASK",
                "type": "MASK",
                "slot_index": 0,
                "links": [18],
            }
        ],
        "title": "收缩蒙版去白边 (GrowMask -2)",
        "properties": {"Node name for S&R": "GrowMask", "cnr_id": "comfy-core", "ver": "0.28.0"},
        "widgets_values": [-2, True],
    }

    feather = {
        "id": 19,
        "type": "FeatherMask",
        "pos": [1980, 420],
        "size": [280, 150],
        "flags": {},
        "order": 12,
        "mode": 0,
        "inputs": [
            {"localized_name": "mask", "name": "mask", "type": "MASK", "link": 18},
            {"localized_name": "left", "name": "left", "type": "INT", "widget": {"name": "left"}, "link": None},
            {"localized_name": "top", "name": "top", "type": "INT", "widget": {"name": "top"}, "link": None},
            {"localized_name": "right", "name": "right", "type": "INT", "widget": {"name": "right"}, "link": None},
            {"localized_name": "bottom", "name": "bottom", "type": "INT", "widget": {"name": "bottom"}, "link": None},
        ],
        "outputs": [
            {
                "localized_name": "MASK",
                "name": "MASK",
                "type": "MASK",
                "slot_index": 0,
                "links": [19],
            }
        ],
        "title": "羽化蒙版边缘 (FeatherMask 2)",
        "properties": {"Node name for S&R": "FeatherMask", "cnr_id": "comfy-core", "ver": "0.28.0"},
        "widgets_values": [2, 2, 2, 2],
    }

    # Fix InvertMask output links to point to GrowMask
    inv = next(n for n in data["nodes"] if n["id"] == 15)
    inv["outputs"][0]["links"] = [15]
    inv["title"] = "反转蒙版（草稿路径）"

    join = next(n for n in data["nodes"] if n["id"] == 16)
    # alpha input link -> 19
    for inp in join["inputs"]:
        if inp["name"] == "alpha":
            inp["link"] = 19
    join["title"] = "合成草稿 Alpha（正式请用 deliver-dress-frame）"

    save_cut = next(n for n in data["nodes"] if n["id"] == 17)
    save_cut["title"] = "保存草稿透明抠图 (Wenbao_Cutout)"

    # link 15: InvertMask(15) -> GrowMask(18)
    # Already have [15, 15, 0, 16, 1] removed; recreate as 15->18
    # Find if link id 15 still exists pointing elsewhere
    links = [L for L in links if L[0] != 15]
    links.append([15, 15, 0, 18, 0, "MASK"])
    links.append([18, 18, 0, 19, 0, "MASK"])
    links.append([19, 19, 0, 16, 1, "MASK"])

    data["nodes"].extend([grow, feather])
    data["links"] = links
    data["last_node_id"] = max(n["id"] for n in data["nodes"])
    data["last_link_id"] = max(L[0] for L in links)

    # Re-order lightly
    for n in data["nodes"]:
        if n["id"] == 16:
            n["order"] = 13
        if n["id"] == 17:
            n["order"] = 14

    WF.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Patched {WF}")
    print(f"nodes={len(data['nodes'])} links={len(data['links'])} last_node={data['last_node_id']} last_link={data['last_link_id']}")


if __name__ == "__main__":
    main()
