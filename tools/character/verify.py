#!/usr/bin/env python3
"""量测并校验角色帧，产出 metrics.json。

两件事：
  1. 用统一口径（spec.measure.alphaThreshold）量每个帧的 bbox。
  2. 对照 spec.tolerance 校验，越界则退出码非 0。

量测口径只在这里实现一次。别处不要重复写 alpha 阈值或 bbox 逻辑。

Run:
  python3 tools/character/verify.py            # 校验 + 写 metrics.json
  python3 tools/character/verify.py --json     # 只打印 metrics，不校验
"""

from __future__ import annotations

import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPEC_PATH = os.path.join(ROOT, "tools", "character", "spec.json")
ASSET_ROOT = os.path.join(ROOT, "public", "assets", "characters")
METRICS_PATH = os.path.join(ASSET_ROOT, "metrics.json")
TS_PATH = os.path.join(ROOT, "src", "mobile", "world", "character-metrics.ts")

# 每个皮肤要量哪些帧。缺帧不算错（maid 没有 sit / sleep）。
FRAME_KINDS = ("idle", "react", "sit", "sleep")


def load_spec() -> dict:
    with open(SPEC_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def measure(path: str, alpha_threshold: int) -> dict | None:
    """唯一量测口径。返回 None 表示图里没有可见像素。"""
    img = Image.open(path).convert("RGBA")
    alpha = img.getchannel("A")
    bbox = alpha.point(lambda v: 255 if v > alpha_threshold else 0).getbbox()
    if not bbox:
        return None
    x0, y0, x1, y1 = bbox
    return {
        "w": x1 - x0,
        "h": y1 - y0,
        "x0": x0,
        "y0": y0,
        "x1": x1 - 1,
        "y1": y1 - 1,
        "cx": (x0 + x1 - 1) // 2,
        "feet": y1 - 1,
        "canvas": img.width,
    }


def collect(spec: dict) -> dict:
    threshold = spec["measure"]["alphaThreshold"]
    out: dict = {}
    for skin_id in spec["skins"]:
        skin_dir = os.path.join(ASSET_ROOT, skin_id)
        if not os.path.isdir(skin_dir):
            continue
        frames: dict = {}
        for kind in FRAME_KINDS:
            path = os.path.join(skin_dir, f"{kind}.webp")
            if not os.path.exists(path):
                continue
            m = measure(path, threshold)
            if m is None:
                continue
            frames[kind] = m
        if "idle" not in frames:
            continue
        out[skin_id] = {
            "visibleHeight": frames["idle"]["h"],
            "visibleWidth": frames["idle"]["w"],
            "baseline": frames["idle"]["feet"] / spec["frame"]["canvas"],
            "frames": frames,
        }
    return out


def check(spec: dict, metrics: dict) -> list[str]:
    fails: list[str] = []
    tol = spec["tolerance"]
    canvas = spec["frame"]["canvas"]
    baseline = spec["frame"]["baselineY"]
    center = spec["frame"]["centerX"]

    for skin_id, entry in metrics.items():
        frames = entry["frames"]
        idle = frames["idle"]

        if abs(idle["feet"] - baseline) > tol["feetY"]:
            fails.append(f"{skin_id}.idle feet {idle['feet']} != {baseline}")

        if abs(idle["cx"] - center) > tol["centerX"]:
            fails.append(f"{skin_id}.idle cx {idle['cx']} != {center}")

        for kind, m in frames.items():
            if m["canvas"] != canvas:
                fails.append(f"{skin_id}.{kind} canvas {m['canvas']} != {canvas}")
            if abs(m["feet"] - baseline) > tol["feetY"]:
                fails.append(f"{skin_id}.{kind} feet {m['feet']} != {baseline}")

        stand = spec["poses"]["stand"]["visibleHeight"]
        if not (stand[0] <= idle["h"] <= stand[1]):
            fails.append(
                f"{skin_id}.idle height {idle['h']} outside stand range {stand}"
            )

        skin_spec = spec["skins"].get(skin_id) or {}
        heads = skin_spec.get("heads")
        head_h = skin_spec.get("headHeight")
        if heads and head_h:
            measured = idle["h"] / head_h
            if abs(measured - heads) > tol["heads"]:
                fails.append(
                    f"{skin_id} heads {measured:.2f} != {heads} (headHeight {head_h})"
                )

        if skin_id in spec["skins"]:
            want_h = spec["skins"][skin_id].get("visibleHeight")
            if want_h is not None and abs(idle["h"] - want_h) > tol["visibleHeight"]:
                fails.append(
                    f"{skin_id}.idle height {idle['h']} != declared {want_h}"
                )

    return fails


def write_ts(metrics: dict) -> None:
    """生成 skins.ts 读取的类型化 metrics。不要手改，改 spec 后重跑本脚本。"""
    lines = [
        "// 由 tools/character/verify.py 从 public/assets/characters/metrics.json 生成。",
        "// 不要手改。改 tools/character/spec.json 后重跑：python3 tools/character/verify.py",
        "",
        "export interface FrameMetrics {",
        "  w: number;",
        "  h: number;",
        "  cx: number;",
        "  feet: number;",
        "}",
        "",
        "export interface SkinMetrics {",
        "  visibleHeight: number;",
        "  visibleWidth: number;",
        "  baseline: number;",
        "}",
        "",
        "export const CHARACTER_METRICS: Record<string, SkinMetrics> = {",
    ]
    for skin_id, entry in metrics.items():
        lines.append(f"  {skin_id}: {{")
        lines.append(f"    visibleHeight: {entry['visibleHeight']},")
        lines.append(f"    visibleWidth: {entry['visibleWidth']},")
        lines.append(f"    baseline: {entry['baseline']},")
        lines.append("  },")
    lines.append("};")
    lines.append("")
    with open(TS_PATH, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def main() -> int:
    spec = load_spec()
    metrics = collect(spec)

    if "--json" in sys.argv:
        print(json.dumps(metrics, indent=2, ensure_ascii=False))
        return 0

    fails = check(spec, metrics)

    for skin_id, entry in metrics.items():
        idle = entry["frames"]["idle"]
        print(
            f"{skin_id:10s} idle {idle['w']}x{idle['h']} cx={idle['cx']} "
            f"feet={idle['feet']} frames={','.join(sorted(entry['frames']))}"
        )

    if fails:
        print()
        for line in fails:
            print(f"FAIL {line}")
        print(f"\n{len(fails)} failed")
        return 1

    with open(METRICS_PATH, "w", encoding="utf-8") as fh:
        json.dump(metrics, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    write_ts(metrics)
    print(f"\nOK   metrics -> {os.path.relpath(METRICS_PATH, ROOT)}")
    print(f"     typed  -> {os.path.relpath(TS_PATH, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
