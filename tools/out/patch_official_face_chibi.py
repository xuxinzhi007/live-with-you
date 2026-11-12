#!/usr/bin/env python3
"""Small official-template identity lock: raise IPAdapter, restore chibi/Q-version.

Face standard is 待机状态 (Q-version / chibi), not image 2.
Image 2 only locked clothes (white T + white shorts).
Backs up live + repo copies before writing. Does not touch 姿势训练集_v2.
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
BACKUP_NAME = "MeinaMix_雯宝LoRA_换装抠图.json.bak-20261111-official-before-face-chibi-relock"

POS = (
    "masterpiece, best quality, xiaoyan, chibi, q-version, chibi proportions, "
    "large head, full body, solo, 1girl, standing, front view, looking at viewer, "
    "arms at sides, wearing a plain white t-shirt and white shorts, short black hair, "
    "straight bangs, brown eyes, simple white background, soft even lighting, no props, "
    "feet visible, entire body in frame"
)
NEG = (
    "realistic, photorealistic, realistic proportions, realistic face, adult body, "
    "small head, long legs, tall, western cartoon, "
    "overexposed, blown out highlights, high-key, vignette, circle, oval, ring, "
    "halo, backdrop, spotlight, lantern, ornament, gourd, prop, object, scenery, "
    "furniture, chair, seat, pillar, doorway, door, curtain, frame, border, "
    "extra objects, wings, black dress, long skirt, dark background, complex "
    "background, window, shadow, floor, wooden floor, cropped, cropped feet, "
    "cut off, close-up, lowres, bad anatomy, bad hands, text, error, missing "
    "fingers, extra digit, worst quality, low quality, watermark, blurry, "
    "multiple girls, extra limbs, deformed, socks, stockings, red eyes, "
    "colored rim light, orange stain, orange lighting, color contamination, "
    "extra hair clumps, stray hair, floating hair, hair fragment"
)
# IPAdapter PLUS FACE: modest raise for identity, not 1.0
IP_WEIGHT = 0.9


def backup(path: Path) -> Path | None:
    if not path.is_file():
        print("missing", path)
        return None
    bak = path.with_name(BACKUP_NAME)
    if not bak.exists():
        shutil.copy2(path, bak)
        print(f"backup {bak} ({bak.stat().st_size} bytes)")
    else:
        print(f"backup already exists {bak}")
    archive = path.parent / "_archive_20261111" / BACKUP_NAME
    if path == LIVE:
        archive.parent.mkdir(parents=True, exist_ok=True)
        if not archive.exists():
            shutil.copy2(path, archive)
            print(f"backup {archive}")
    return bak


def patch(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    nodes = {n["id"]: n for n in data["nodes"]}
    if 6 in nodes:
        nodes[6]["widgets_values"] = [POS]
        nodes[6]["title"] = "正向（待机状态Q版比例+白T白短裤；全身入画）"
    if 7 in nodes:
        nodes[7]["widgets_values"] = [NEG]
        nodes[7]["title"] = "负向（挡写实比例/门框/色渍；不含 shorts）"
    if 21 in nodes:
        # keep official face ref: tight bust crop of 待机状态
        nodes[21]["widgets_values"] = ["standby-bust-white.png", "image"]
        nodes[21]["title"] = "锁脸参考图（standby-bust-white.png＝待机状态胸像）"
    if 22 in nodes:
        wv = list(nodes[22]["widgets_values"])
        wv[0] = IP_WEIGHT
        nodes[22]["widgets_values"] = wv
        nodes[22]["title"] = f"4. 套用待机状态脸 (IPAdapter {IP_WEIGHT})"
    if 11 in nodes:
        note = nodes[11].get("widgets_values") or [""]
        text = note[0] if note else ""
        header = (
            "2026-11-11 脸部回锁：脸与头身比以「待机状态」Q版/chibi 为标准，"
            f"不是图2。图2只锁衣服（白T+白短裤）。IPAdapter PLUS FACE 权重 {IP_WEIGHT}，"
            "参考仍为 standby-bust-white.png（待机状态白底胸像）。本轮不加 FaceDetailer。\n\n"
        )
        if "脸部回锁" not in text:
            nodes[11]["widgets_values"] = [header + text]
            nodes[11]["title"] = "官方换装 OFFICIAL（锁脸=待机状态Q版；衣服=白T白短裤；AnimeSharp；isnet）"
    data["nodes"] = list(nodes.values())
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {path}")


def main() -> None:
    backup(LIVE)
    backup(REPO)
    if LIVE.is_file():
        patch(LIVE)
    if REPO.is_file():
        patch(REPO)
    # verify
    for label, p in (("live", LIVE), ("repo", REPO)):
        data = json.loads(p.read_text(encoding="utf-8"))
        nodes = {n["id"]: n for n in data["nodes"]}
        print(
            label,
            "ip",
            nodes[22]["widgets_values"][0],
            "face",
            nodes[21]["widgets_values"][0],
            "pos starts",
            nodes[6]["widgets_values"][0][:80],
        )


if __name__ == "__main__":
    main()
