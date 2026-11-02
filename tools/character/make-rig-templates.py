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


# 11 个部件槽（z 序与命名取自 docs/standard-character-plan.md §3）。
# rect 是占 x0,y0,x1,y1 的比例（相对 720 可见高 + 380 中心），用于画分区。
PART_SLOTS = [
    # name, z, 中文名, 侧面, (左, 上, 右, 下) 比例: 左/右相对中心线, 上/下相对 720 可见高
    ("hair-back", 10, "后发", "back", (-0.30, -0.02, 0.30, 0.28), None),
    ("legs-back", 15, "后腿", "back", (-0.14, 0.52, 0.14, 1.00), "胯"),
    ("body", 20, "底层身体", "mid", (-0.18, 0.26, 0.18, 0.97), "胯"),
    ("arms-back", 25, "后臂", "back", (-0.26, 0.22, -0.14, 0.60), "肩"),
    ("outfit", 30, "服装", "mid", (-0.24, 0.24, 0.24, 0.95), "腰"),
    ("arms-front", 40, "前臂", "front", (0.14, 0.22, 0.26, 0.60), "肩"),
    ("head", 50, "头+颈", "mid", (-0.20, -0.02, 0.20, 0.22), "颈"),
    ("face", 55, "五官", "mid", (-0.10, 0.03, 0.10, 0.15), "颈"),
    ("hair-front", 60, "刘海", "front", (-0.21, -0.03, 0.21, 0.12), "头顶"),
    ("acc-head", 70, "头饰", "front", (-0.11, -0.07, 0.11, 0.02), "头顶"),
    ("acc-hand", 45, "手持物", "front", (0.24, 0.48, 0.40, 0.64), "手"),
]

SIDE_COLOR = {
    "back": (146, 132, 168),
    "mid": (108, 160, 120),
    "front": (196, 96, 74),
}


def make_parts_template(spec: dict) -> str:
    """11 件 Live2D 分层对位图：每件的占位框 + z 序 + 枢轴。"""
    heads = 5.0
    kp = keypoints(spec, heads)
    cell = 400
    pad = 20
    header = 76
    legend_h = 150
    width = pad * 2 + cell
    height = header + cell + legend_h

    img = Image.new("RGB", (width, height), PAPER)
    draw = ImageDraw.Draw(img)

    draw.text((pad, 14), "Live2D 11 件分层对位模板", font=cjk(20), fill=INK)
    draw.text(
        (pad, 42),
        f"画布 {spec['frame']['canvas']}×{spec['frame']['canvas']} · "
        f"脚底 y={spec['frame']['baselineY']} · 中心 x={spec['frame']['centerX']} · {heads:.1f} 头身",
        font=label(11),
        fill=MUTED,
    )

    draw.text((pad, 56), "每件按此框出一张与画布同尺寸的透明 PNG", font=label(10), fill=MUTED)

    x = pad
    y = header
    s = cell / spec["frame"]["canvas"]
    baseline_y = y + spec["frame"]["baselineY"] * s
    center_x = x + spec["frame"]["centerX"] * s
    top_y = y + kp["top"] * s
    vis_h = 720.0 * s

    draw.rectangle([x, y, x + cell, y + cell], fill=BOX, outline=GRID)
    draw.line([x, baseline_y, x + cell, baseline_y], fill=BASELINE, width=2)
    draw.line([center_x, y, center_x, y + cell], fill=CENTER, width=1)

    def slot_box(rx0, ry0, rx1, ry1):
        # rx 是相对中心线的偏移（负=左），ry 是从头顶算起的可见高比例
        bx0 = center_x + rx0 * vis_h
        bx1 = center_x + rx1 * vis_h
        by0 = top_y + ry0 * vis_h
        by1 = top_y + ry1 * vis_h
        return [min(bx0, bx1), by0, max(bx0, bx1), by1]

    # 框内只标编号（避免文字压住分区），完整清单放底部表格。
    for idx, (name, z, cn, side, rect, pivot) in enumerate(PART_SLOTS, start=1):
        color = SIDE_COLOR[side]
        box = slot_box(*rect)
        draw.rectangle(box, outline=color, width=2)
        bx = box[0] + 3
        by = box[1] + 3
        draw.rectangle([bx - 1, by - 1, bx + 15, by + 13], fill=BOX, outline=color)
        draw.text((bx + 1, by), f"{idx:02d}", font=mono(10), fill=color)
        if pivot and pivot in kp["points"]:
            py = y + kp["points"][pivot] * s
            draw.ellipse([center_x - 3, py - 3, center_x + 3, py + 3], outline=ACCENT, width=1)
        elif pivot == "手":
            hy = y + (kp["points"]["腰"] + 40) * s
            draw.ellipse([box[2] - 6, hy - 3, box[2], hy + 3], outline=ACCENT, width=1)

    # 图例 + 部件清单（三列，按 z 序）
    ly = header + cell + 10
    draw.line([pad, ly - 6, width - pad, ly - 6], fill=GRID)
    lx = pad
    for side, text in (("back", "back 层（藏在后面）"), ("mid", "mid 层（主体）"), ("front", "front 层（盖在上面）")):
        color = SIDE_COLOR[side]
        draw.rectangle([lx, ly, lx + 11, ly + 11], outline=color, width=2)
        draw.text((lx + 16, ly - 1), text, font=label(10), fill=INK)
        lx += 150

    cols = 2
    col_w = (width - pad * 2) // cols
    for idx, (name, z, cn, side, rect, pivot) in enumerate(PART_SLOTS, start=1):
        r = (idx - 1) // cols
        c = (idx - 1) % cols
        tx = pad + c * col_w
        ty = ly + 20 + r * 14
        draw.text((tx, ty), f"{idx:02d}", font=mono(9), fill=SIDE_COLOR[side])
        draw.text((tx + 20, ty), f"{name}", font=mono(9), fill=INK)
        draw.text((tx + 92, ty), f"z{z}", font=mono(9), fill=MUTED)
        draw.text((tx + 118, ty), cn, font=label(10), fill=MUTED)

    note_y = ly + 20 + ((len(PART_SLOTS) + cols - 1) // cols) * 14 + 8
    draw.text(
        (pad, note_y),
        "每件出一张与画布同尺寸的透明 PNG，空区保留用于对齐；关节位置由 spec.json 算出。",
        font=label(10),
        fill=ACCENT,
    )

    path = os.path.join(OUT_DIR, "parts-template-390.png")
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
    c = make_parts_template(spec)
    for p in (a, b, c):
        print(f"OK   {os.path.relpath(p, ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
