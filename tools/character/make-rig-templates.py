#!/usr/bin/env python3
"""画角色 rig 参考图。纯几何，不需要美术资源。

两张图：
  standard-template-390.png   5.0 / 6.0 两列骨架 + 关键点
  face-readability-390.png    52px 脸可读性测试

关键点数值全部从 tools/character/spec.json 算，不手填。改 spec 重跑即可。

Run:
  python3 tools/character/make-rig-templates.py
  python3 tools/character/make-rig-templates.py --print   # 只打印关键点 JSON
"""

from __future__ import annotations

import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPEC_PATH = os.path.join(ROOT, "tools", "character", "spec.json")
OUT_DIR = os.path.join(ROOT, "spark-output", "audit", "character-rig")
CHARS = os.path.join(ROOT, "public", "assets", "characters")

FONT_CJK = "/System/Library/Fonts/Hiragino Sans GB.ttc"
FONT_MONO = "/System/Library/Fonts/Supplemental/Menlo.ttc"

INK = (52, 48, 44)
MUTED = (140, 132, 124)
GRID = (222, 214, 204)
PAPER = (250, 247, 242)
BOX = (255, 255, 255)
ACCENT = (196, 96, 74)
BASELINE = (86, 132, 168)
CENTER = (108, 160, 120)

# 关键点相对「下巴→脚底」的比例。头身比变了，颈肩会跟着移，所以要按身体算。
# 基准值由 docs/standard-character-plan.md §2.2 的 5.0 / 6.0 两组实测反推取均值。
BODY_RATIOS = [
    ("颈", 0.0256),
    ("肩", 0.0537),
    ("腰", 0.2763),
    ("胯", 0.3614),
    ("膝", 0.6335),
    ("踝", 0.9184),
]


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def cjk(size: int) -> ImageFont.FreeTypeFont:
    return font(FONT_CJK, size)


def mono(size: int) -> ImageFont.FreeTypeFont:
    """等宽字体。Menlo 没有中文字形，只能用于纯 ASCII。"""
    return font(FONT_MONO, size)


def label(size: int) -> ImageFont.FreeTypeFont:
    """含中文的标签走 CJK 字体，否则会渲染成方块。"""
    return cjk(size)


def load_spec() -> dict:
    with open(SPEC_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def keypoints(spec: dict, heads: float) -> dict:
    """从 spec 算出某个头身比下的关键点。唯一计算入口。"""
    baseline = spec["frame"]["baselineY"]
    visible = 720.0
    top = baseline - visible
    head_h = visible / heads
    chin = top + head_h
    body = baseline - chin

    points = {"头顶": top, "下巴": chin}
    for name, ratio in BODY_RATIOS:
        points[name] = chin + body * ratio
    points["脚底"] = baseline
    return {"top": top, "headHeight": head_h, "chin": chin, "points": points}


def draw_frame(draw, x, y, size, spec, kp, heads, title, subtitle):
    """画一列：画布框 + 脚底线 + 中心线 + 关键点。"""
    canvas = spec["frame"]["canvas"]
    s = size / canvas
    baseline_y = y + spec["frame"]["baselineY"] * s
    center_x = x + spec["frame"]["centerX"] * s

    draw.rectangle([x, y, x + size, y + size], fill=BOX, outline=GRID)

    # 可见区域
    draw.rectangle(
        [x + 1, y + kp["top"] * s, x + size - 1, baseline_y],
        outline=GRID,
    )

    draw.line([x, baseline_y, x + size, baseline_y], fill=BASELINE, width=2)
    draw.line([center_x, y, center_x, y + size], fill=CENTER, width=1)

    draw.text((x + 8, y + 6), title, font=cjk(15), fill=INK)
    draw.text((x + 8, y + 26), subtitle, font=label(11), fill=MUTED)

    # 头高标识
    head_top = y + kp["top"] * s
    head_chin = y + kp["chin"] * s
    draw.rectangle(
        [center_x - 14, head_top, center_x + 14, head_chin],
        outline=ACCENT,
        width=2,
    )

    # 躯干轮廓：头（圆）、颈、肩、腰、胯、腿。宽度按 5.0 基准等比缩。
    # 头宽取 0.72×头高（人体头像常用比例）；肩宽/头宽 ≈ 1.64，与 §2.2 的 170/104 一致。
    pts = kp["points"]
    k = kp["headHeight"] / 144.0  # 144 = 5.0 头身头高
    head_w = kp["headHeight"] * 0.72
    head_cy = (pts["头顶"] + pts["下巴"]) / 2
    draw.ellipse(
        [
            center_x - head_w / 2 * s,
            y + (head_cy - kp["headHeight"] / 2) * s,
            center_x + head_w / 2 * s,
            y + (head_cy + kp["headHeight"] / 2) * s,
        ],
        outline=MUTED,
        width=1,
    )

    widths = {
        "肩": 170.0 * k,
        "腰": 110.0 * k,
        "胯": 140.0 * k,
        "膝": 76.0 * k,
        "踝": 44.0 * k,
    }
    spine = ["肩", "腰", "胯", "膝", "踝"]
    for a, b in zip(spine, spine[1:]):
        aw, bw = widths[a] / 2 * s, widths[b] / 2 * s
        ay, by = y + pts[a] * s, y + pts[b] * s
        draw.line([center_x - aw, ay, center_x - bw, by], fill=MUTED, width=1)
        draw.line([center_x + aw, ay, center_x + bw, by], fill=MUTED, width=1)
    # 颈：下巴到肩
    neck_w = 30.0 * k / 2 * s
    draw.line(
        [center_x - neck_w, y + pts["下巴"] * s, center_x - widths["肩"] / 2 * s, y + pts["肩"] * s],
        fill=MUTED, width=1,
    )
    draw.line(
        [center_x + neck_w, y + pts["下巴"] * s, center_x + widths["肩"] / 2 * s, y + pts["肩"] * s],
        fill=MUTED, width=1,
    )
    # 踝到脚底
    aw = widths["踝"] / 2 * s
    draw.line([center_x - aw, y + pts["踝"] * s, center_x - aw, baseline_y], fill=MUTED, width=1)
    draw.line([center_x + aw, y + pts["踝"] * s, center_x + aw, baseline_y], fill=MUTED, width=1)

    for name, py in kp["points"].items():
        sy = y + py * s
        long = name in ("头顶", "下巴", "脚底")
        tick = 26 if long else 14
        draw.line([center_x - tick, sy, center_x + tick, sy], fill=INK, width=2 if long else 1)
        text = f"{name} {py:.0f}"
        f = label(11) if long else label(10)
        anchor_x = center_x + tick + 4
        # 颈/肩挤在一起，交替左右摆放避免叠字。
        if name in ("颈", "踝"):
            anchor_x = center_x - tick - 46
        elif anchor_x + 46 > x + size:
            anchor_x = center_x - tick - 46
        dy = -11 if name == "颈" else -4
        draw.text((anchor_x, sy + dy), text, font=f, fill=INK if long else MUTED)

    return baseline_y, center_x


def make_standard_template(spec: dict) -> str:
    head_levels = [5.0, 6.0]
    cell = 390
    gap = 16
    pad = 18
    header = 64
    footer = 62
    width = pad * 2 + cell * 2 + gap
    height = header + cell + footer

    img = Image.new("RGB", (width, height), PAPER)
    draw = ImageDraw.Draw(img)

    draw.text((pad, 14), "标准比例骨架对位模板", font=cjk(19), fill=INK)
    draw.text(
        (pad, 40),
        f"画布 {spec['frame']['canvas']}×{spec['frame']['canvas']}  "
        f"脚底 y={spec['frame']['baselineY']}  中心 x={spec['frame']['centerX']}  "
        f"站立可见高 720",
        font=label(12),
        fill=MUTED,
    )

    summary = []
    for index, heads in enumerate(head_levels):
        kp = keypoints(spec, heads)
        x = pad + index * (cell + gap)
        y = header
        draw_frame(
            draw, x, y, cell, spec, kp, heads,
            f"{heads:.1f} 头身",
            f"头高 {kp['headHeight']:.0f}px  下巴 {kp['chin']:.0f}px",
        )
        summary.append((heads, kp))

    # 底部差异表。固定列宽，避免 CJK 与等宽字体宽度不同造成错位。
    fy = header + cell + 14
    draw.line([pad, fy - 6, pad + 372, fy - 6], fill=GRID)
    col_x = [pad, pad + 56, pad + 130, pad + 218]
    cols = ["头身", "头高", "下巴 y", "头宽"]
    for cx, col in zip(col_x, cols):
        draw.text((cx, fy), col, font=cjk(11), fill=MUTED)
    for heads, kp in summary:
        head_w = kp["headHeight"] * 0.72
        row = [
            f"{heads:.1f}",
            f"{kp['headHeight']:.0f}px",
            f"{kp['chin']:.0f}",
            f"{head_w:.0f}px",
        ]
        for cx, value in zip(col_x, row):
            draw.text((cx, fy + 18), value, font=mono(11), fill=INK)

    draw.text(
        (pad + 380, fy),
        "注意：换头身比必须同步重标定家具（见 plan §5）。",
        font=cjk(10),
        fill=ACCENT,
    )
    draw.text(
        (pad + 380, fy + 18),
        "只放大角色、家具不动，会让角色相对家具显矮。",
        font=cjk(10),
        fill=ACCENT,
    )

    path = os.path.join(OUT_DIR, "standard-template-390.png")
    img.save(path)
    return path


# 各姿态的头部裁切高度（帧内 px），按 original 实测。
# react 抬手后 bbox 顶会上移，sleep 是团坐，都不能用统一的 53.6%。
HEAD_CROP = {
    "idle": 386,
    "react": 386,
    "sleep": 330,
}


def crop_head(src: str, alpha_threshold: int, pose: str) -> Image.Image:
    """裁出头部。用 alpha 阈值口径与 verify.py 一致。"""
    img = Image.open(src).convert("RGBA")
    alpha = img.getchannel("A")
    bbox = alpha.point(lambda v: 255 if v > alpha_threshold else 0).getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    head_h = min(HEAD_CROP.get(pose, 386), y1 - y0)
    return img.crop((x0, y0, x1, y0 + head_h))


def make_face_readability(spec: dict) -> str:
    """三档头高 × 三个表情的矩阵。判据：同一档里能否区分三种表情。"""
    threshold = spec["measure"]["alphaThreshold"]
    # 现有资产：idle=中性、react=笑、sleep=困。用它们当三个表情。
    expressions = [
        ("中性", "idle"),
        ("笑", "react"),
        ("困", "sleep"),
    ]
    targets = [
        ("125px", 125, "现状 chibi 1.87 头身"),
        ("52px", 52, "5.0 头身下限"),
        ("39px", 39, "6.0 身体不变（已排除）"),
    ]

    cell_w = 150
    label_w = 54
    row_h = 118
    pad = 18
    header = 82
    footer = 46
    gap = 10
    width = pad * 2 + label_w + cell_w * 3 + gap * 2
    height = header + row_h * 3 + footer

    img = Image.new("RGB", (width, height), PAPER)
    draw = ImageDraw.Draw(img)

    draw.text((pad, 14), "脸可读性测试：52px 还能认出表情吗", font=cjk(19), fill=INK)
    draw.text(
        (pad, 40),
        "同一张脸 × 三个表情 × 三档头高，100% 缩放。横向比同一档里三个表情是否可区分。",
        font=cjk(11),
        fill=MUTED,
    )

    # 列标题
    for ci, (label_text, px, note) in enumerate(targets):
        cx = pad + label_w + ci * (cell_w + gap)
        draw.text((cx, header - 30), f"{label_text}", font=mono(13), fill=INK)
        draw.text((cx, header - 13), note, font=cjk(9), fill=MUTED)

    for ri, (expr_name, asset) in enumerate(expressions):
        row_y = header + ri * row_h
        draw.text((pad, row_y + row_h // 2 - 8), expr_name, font=cjk(12), fill=INK)

        head = crop_head(os.path.join(CHARS, "original", f"{asset}.webp"), threshold, asset)

        for ci, (label_text, px, note) in enumerate(targets):
            cx = pad + label_w + ci * (cell_w + gap)
            draw.rectangle(
                [cx, row_y, cx + cell_w - 2, row_y + row_h - 6],
                fill=BOX, outline=GRID,
            )
            scale = px / head.height
            size = (max(1, round(head.width * scale)), px)
            small = head.resize(size, Image.LANCZOS)
            img.paste(
                small,
                (cx + (cell_w - 2 - small.width) // 2, row_y + (row_h - 6 - px) // 2),
                small,
            )

    fy = header + row_h * 3 + 6
    draw.line([pad, fy, width - pad, fy], fill=GRID)
    draw.text(
        (pad, fy + 6),
        "注意：用现有 chibi 的头裁切，只回答「多少 px 能看清」，不代表新底模也能看清。",
        font=cjk(10),
        fill=ACCENT,
    )
    draw.text(
        (pad, fy + 24),
        "判读：某一行横向三个脸若看不出差别，该档头高就不可用。",
        font=cjk(10),
        fill=ACCENT,
    )

    path = os.path.join(OUT_DIR, "face-readability-390.png")
    img.save(path)
    return path


def main() -> int:
    spec = load_spec()

    if "--print" in sys.argv:
        out = {}
        for heads in (5.0, 6.0):
            kp = keypoints(spec, heads)
            out[f"{heads}"] = {
                "headHeight": round(kp["headHeight"], 1),
                "points": {k: round(v, 1) for k, v in kp["points"].items()},
            }
        print(json.dumps(out, indent=2, ensure_ascii=False))
        return 0

    os.makedirs(OUT_DIR, exist_ok=True)
    a = make_standard_template(spec)
    b = make_face_readability(spec)
    for p in (a, b):
        print(f"OK   {os.path.relpath(p, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
