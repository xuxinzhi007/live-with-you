#!/usr/bin/env python3
"""Add a short deprecation/redirect MarkdownNote blurb to overlapping workflows."""
from __future__ import annotations

import json
from pathlib import Path

BASE = Path(
    r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable"
    r"\ComfyUI\user\default\workflows"
)

REDIRECTS = {
    "MeinaMix_同角色换姿势.json": (
        "【归档提示】与「小燕_姿势训练集_v2」高度重复。"
        "采训练图请用姿势训练集_v2；正式礼服请用「MeinaMix_雯宝LoRA_换装抠图」（已含 LoRA+锁脸+锁姿+草稿抠图）"
        "+ tools/deliver-dress-frame.py。"
    ),
    "MeinaMix_小燕_成长后站姿_solo02.json": (
        "【归档提示】单姿势特化短图。正式礼服改用「MeinaMix_雯宝LoRA_换装抠图」，"
        "只换锁姿参考图即可。"
    ),
    "MeinaMix_小燕LoRA.json": (
        "【Experimental / unofficial】纯 LoRA 文生，无锁脸锁姿。"
        "可试提示词；正式帧请走「MeinaMix_雯宝LoRA_换装抠图」+ deliver-dress-frame。"
    ),
    "MeinaMix_文生图.json": (
        "【Experimental】早期短图。正式角色/礼服勿用。"
    ),
    "MeinaMix_图生图.json": (
        "【Experimental】早期短图。正式角色/礼服勿用。"
    ),
}


def main() -> None:
    for name, blurb in REDIRECTS.items():
        path = BASE / name
        if not path.exists():
            print("skip missing", name)
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        notes = [n for n in data["nodes"] if n.get("type") == "MarkdownNote"]
        if notes:
            n = notes[0]
            old = n.get("widgets_values", [""])[0]
            if "【归档提示】" in old or "【Experimental" in old:
                print("already annotated", name)
                continue
            n["widgets_values"] = [blurb + "\n\n" + old]
        else:
            nid = max(x["id"] for x in data["nodes"]) + 1
            data["nodes"].append(
                {
                    "id": nid,
                    "type": "MarkdownNote",
                    "pos": [40, -200],
                    "size": [520, 160],
                    "flags": {},
                    "order": 0,
                    "mode": 0,
                    "inputs": [],
                    "outputs": [],
                    "title": "管线说明",
                    "properties": {},
                    "widgets_values": [blurb],
                }
            )
            data["last_node_id"] = nid
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print("annotated", name)


if __name__ == "__main__":
    main()
