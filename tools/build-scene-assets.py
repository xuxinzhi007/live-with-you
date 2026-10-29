#!/usr/bin/env python3
"""Generate the V2 room backgrounds and prop sprites.

Design goals:
- Every prop is drawn at its real world size (see src/mobile/world/rooms.ts),
  so a bed is ~1.1x the character height instead of a 32px icon.
- Backgrounds are layered by hand (wall / light / floor), not a 1px gradient
  stretched over the whole room.
- Output is deterministic: same script, same files.

Run:
  python3 tools/build-scene-assets.py
"""

from __future__ import annotations

import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "assets", "scenes")
SCALE = 1.5


def s(value: float) -> int:
    return max(1, int(round(value * SCALE)))


def vgrad(width: int, height: int, stops: list[tuple[float, tuple[int, int, int]]]) -> Image.Image:
    """Vertical gradient with arbitrary colour stops."""
    height = max(1, height)
    ys = np.linspace(0.0, 1.0, height, dtype=np.float32)
    arr = np.zeros((height, width, 3), dtype=np.float32)
    for index in range(len(stops) - 1):
        t0, c0 = stops[index]
        t1, c1 = stops[index + 1]
        mask = (ys >= t0) & (ys <= t1)
        if not mask.any():
            continue
        local = (ys[mask] - t0) / max(1e-6, t1 - t0)
        for channel in range(3):
            arr[mask, :, channel] = c0[channel] + (c1[channel] - c0[channel]) * local[:, None]
    arr[ys <= stops[0][0]] = stops[0][1]
    arr[ys >= stops[-1][0]] = stops[-1][1]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def noise(img: Image.Image, amount: float = 5.0, seed: int = 7) -> Image.Image:
    rng = np.random.default_rng(seed)
    arr = np.asarray(img.convert("RGB")).astype(np.float32)
    grain = rng.normal(0, amount, (arr.shape[0], arr.shape[1], 1))
    arr = np.clip(arr + grain, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def soft_shadow(size: tuple[int, int], box: tuple[int, int, int, int], blur: int, alpha: int) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(box, fill=(40, 28, 18, alpha))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def rrect(draw: ImageDraw.ImageDraw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def wood_texture(draw: ImageDraw.ImageDraw, box, base: str, grain: str, rng: random.Random, vertical=False):
    draw.rounded_rectangle(box, radius=s(6), fill=base)
    x0, y0, x1, y1 = box
    count = max(3, (y1 - y0) // s(18) if not vertical else (x1 - x0) // s(22))
    for i in range(count):
        t = i / max(1, count - 1)
        if vertical:
            x = int(x0 + (x1 - x0) * t)
            jitter = rng.randint(-s(2), s(2))
            draw.line([(x + jitter, y0 + s(3)), (x + jitter, y1 - s(3))], fill=grain, width=1)
        else:
            y = int(y0 + (y1 - y0) * t)
            jitter = rng.randint(-s(2), s(2))
            draw.line([(x0 + s(3), y + jitter), (x1 - s(3), y + jitter)], fill=grain, width=1)


def paste(base: Image.Image, layer: Image.Image, xy: tuple[int, int]) -> None:
    base.alpha_composite(layer, xy)


def home_background(room_w: int = 980) -> Image.Image:
    w, h = s(room_w), s(1000)
    img = vgrad(w, h, [(0, (244, 234, 220)), (0.55, (235, 220, 202)), (0.68, (226, 208, 188)), (0.69, (196, 166, 128)), (1, (168, 132, 92))]).convert("RGBA")

    draw = ImageDraw.Draw(img, "RGBA")
    # Wall panels
    for x in range(s(46), s(room_w), s(104)):
        draw.line([(x, s(60)), (x, s(660))], fill=(205, 184, 160, 70), width=s(2))
    draw.rectangle([0, s(60), w, s(72)], fill=(255, 255, 255, 45))
    # Wainscot
    draw.rectangle([0, s(548), w, s(668)], fill=(236, 221, 201, 255))
    draw.line([(0, s(548)), (w, s(548))], fill=(202, 178, 150, 255), width=s(3))
    draw.line([(0, s(560)), (w, s(560))], fill=(255, 252, 244, 120), width=s(2))
    for x in range(s(20), s(room_w), s(78)):
        draw.rectangle([x, s(574), x + s(58), s(650)], outline=(214, 193, 168, 190), width=s(2))

    def window(cx: int, top: int, ww: int, wh: int) -> None:
        nonlocal draw
        x0, y0 = s(cx - ww / 2), s(top)
        x1, y1 = s(cx + ww / 2), s(top + wh)
        # soft daylight on the wall
        glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse([x0 - s(90), y0 - s(50), x1 + s(90), y1 + s(130)], fill=(255, 238, 196, 54))
        img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(s(28))))
        # outer frame
        rrect(draw, [x0 - s(12), y0 - s(12), x1 + s(12), y1 + s(12)], s(10), fill=(176, 137, 96, 255), outline=(124, 92, 62, 255), width=s(3))
        inner = vgrad(x1 - x0, y1 - y0, [(0, (168, 210, 233)), (0.55, (207, 231, 242)), (1, (238, 246, 240))]).convert("RGBA")
        idraw = ImageDraw.Draw(inner, "RGBA")
        # distant hills + cloud inside window
        idraw.ellipse([s(ww * 0.1), s(wh * 0.54), s(ww * 0.62), s(wh * 0.84)], fill=(158, 190, 148, 210))
        idraw.ellipse([s(ww * 0.42), s(wh * 0.6), s(ww * 0.98), s(wh * 0.9)], fill=(178, 204, 160, 220))
        idraw.ellipse([s(ww * 0.12), s(wh * 0.16), s(ww * 0.42), s(wh * 0.31)], fill=(255, 255, 255, 190))
        idraw.ellipse([s(ww * 0.3), s(wh * 0.12), s(ww * 0.56), s(wh * 0.27)], fill=(255, 255, 255, 170))
        img.alpha_composite(inner, (x0, y0))
        # muntins
        draw = ImageDraw.Draw(img, "RGBA")
        mx = (x0 + x1) // 2
        my = (y0 + y1) // 2
        for box in (
            [mx - s(3), y0, mx + s(3), y1],
            [x0, my - s(3), x1, my + s(3)],
        ):
            draw.rectangle(box, fill=(196, 165, 128, 255))
            draw.rectangle([box[0], box[1], box[2], box[1] + s(2)], fill=(255, 248, 232, 150))
        # curtains
        for side in (-1, 1):
            cx0 = x0 - s(34) if side < 0 else x1 + s(2)
            cx1 = x0 + s(2) if side < 0 else x1 + s(34)
            draw.polygon(
                [(cx0, y0 - s(16)), (cx1, y0 - s(10)), (cx1, y1 + s(10)), (cx0, y1 + s(24))],
                fill=(246, 236, 218, 235),
            )
            draw.line([(cx0 + s(10), y0), (cx0 + s(16), y1 + s(6))], fill=(220, 203, 180, 220), width=s(3))
        # sill
        draw.rectangle([x0 - s(26), y1 + s(10), x1 + s(26), y1 + s(26)], fill=(188, 151, 110, 255))
        draw.rectangle([x0 - s(26), y1 + s(10), x1 + s(26), y1 + s(13)], fill=(232, 205, 168, 255))

    window(292, 246, 192, 300)
    window(700, 246, 192, 300)

    # Picture frames
    for (x, y, fw, fh, col) in [
        (432, 292, 86, 112, (168, 143, 113)),
        (548, 360, 64, 78, (176, 150, 118)),
    ]:
        draw.rectangle([s(x), s(y), s(x + fw), s(y + fh)], fill=col)
        draw.rectangle([s(x + 7), s(y + 7), s(x + fw - 7), s(y + fh - 7)], fill=(244, 236, 220))
        draw.ellipse([s(x + 18), s(y + 26), s(x + fw - 18), s(y + fh - 24)], fill=(196, 205, 180))

    # Ceiling shadow + baseboard
    draw.rectangle([0, 0, w, s(58)], fill=(214, 192, 166, 180))
    draw.rectangle([0, s(58), w, s(63)], fill=(255, 249, 238, 130))
    draw.rectangle([0, s(658), w, s(680)], fill=(186, 146, 105, 255))
    draw.rectangle([0, s(658), w, s(664)], fill=(228, 198, 160, 255))
    draw.rectangle([0, s(680), w, s(688)], fill=(118, 88, 60, 80))

    # Floor planks
    for y in range(s(688), h, s(54)):
        draw.line([(0, y), (w, y)], fill=(120, 88, 58, 70), width=s(2))
        draw.line([(0, y + s(3)), (w, y + s(3))], fill=(240, 214, 178, 45), width=s(2))
    for x in range(s(30), w, s(170)):
        draw.line([(x, s(688)), (x + s(26), h)], fill=(120, 88, 58, 40), width=s(2))
    # Light pools on the floor
    for cx in (292, 700):
        pool = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        pd = ImageDraw.Draw(pool)
        pd.ellipse([s(cx - 120), s(680), s(cx + 120), s(840)], fill=(255, 238, 196, 62))
        img.alpha_composite(pool.filter(ImageFilter.GaussianBlur(s(22))))

    # Vignette
    vig = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vig)
    vd.rectangle([0, 0, w, h], outline=(70, 48, 30, 90), width=s(18))
    img.alpha_composite(vig.filter(ImageFilter.GaussianBlur(s(26))))
    return noise(img.convert("RGB"), 3.2, 11).convert("RGB")


def garden_background(room_w: int = 960) -> Image.Image:
    w, h = s(room_w), s(1000)
    img = vgrad(w, h, [(0, (154, 207, 230)), (0.42, (204, 231, 238)), (0.6, (233, 243, 224)), (0.62, (142, 184, 116)), (1, (92, 134, 76))]).convert("RGBA")
    draw = ImageDraw.Draw(img, "RGBA")

    # Sun
    sun = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sun)
    sd.ellipse([s(room_w - 180), s(72), s(room_w - 60), s(192)], fill=(255, 244, 196, 150))
    sd.ellipse([s(room_w - 150), s(102), s(room_w - 90), s(162)], fill=(255, 252, 226, 220))
    img.alpha_composite(sun.filter(ImageFilter.GaussianBlur(s(12))))

    # Clouds
    rng = random.Random(4)
    for cx, cy, cw, ch in [(150, 130, 220, 70), (520, 90, 260, 76), (760, 170, 190, 58)]:
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        for i in range(4):
            ld.ellipse([s(cx - cw / 2 + i * cw * 0.18), s(cy - ch * (0.4 + rng.random() * 0.3)), s(cx - cw / 2 + cw * 0.55 + i * cw * 0.18), s(cy + ch * 0.6)], fill=(255, 255, 255, 165))
        img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(s(6))))

    # Distant hills
    draw.polygon([(0, s(560)), (s(room_w * 0.18), s(486)), (s(room_w * 0.36), s(548)), (s(room_w * 0.52), s(500)), (s(room_w * 0.7), s(556)), (s(room_w * 0.86), s(508)), (s(room_w), s(552)), (s(room_w), s(640)), (0, s(640))], fill=(156, 186, 137))
    draw.polygon([(0, s(600)), (s(room_w * 0.14), s(556)), (s(room_w * 0.3), s(598)), (s(room_w * 0.5), s(566)), (s(room_w * 0.68), s(606)), (s(room_w * 0.84), s(570)), (s(room_w), s(602)), (s(room_w), s(650)), (0, s(650))], fill=(128, 164, 112))

    # Fence
    fy = s(610)
    draw.rectangle([0, fy, w, fy + s(8)], fill=(206, 181, 146))
    for x in range(s(8), w, s(46)):
        draw.rectangle([x, s(586), x + s(20), s(650)], fill=(226, 204, 170), outline=(176, 146, 110), width=s(2))
        draw.polygon([(x, s(586)), (x + s(10), s(574)), (x + s(20), s(586))], fill=(226, 204, 170), outline=(176, 146, 110))

    # Grass texture
    for _ in range(520):
        x = rng.randint(0, w)
        y = rng.randint(s(650), h)
        length = rng.randint(s(4), s(12))
        shade = rng.choice([(80, 120, 64, 80), (118, 160, 86, 90), (64, 100, 56, 70)])
        draw.line([(x, y), (x + rng.randint(-s(4), s(4)), y - length)], fill=shade, width=1)

    # Path
    path = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(path)
    pd.rounded_rectangle([s(60), s(856), s(room_w - 60), s(936)], radius=s(40), fill=(198, 184, 152, 120))
    img.alpha_composite(path.filter(ImageFilter.GaussianBlur(s(10))))

    # Flower specks
    for _ in range(46):
        x = rng.randint(0, w)
        y = rng.randint(s(660), s(980))
        col = rng.choice([(247, 224, 138), (238, 170, 186), (250, 248, 238)])
        draw.ellipse([x, y, x + s(5), y + s(5)], fill=col)
        draw.line([(x + s(2), y + s(4)), (x + s(2), y + s(12))], fill=(94, 132, 72), width=1)

    vig = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vig)
    vd.rectangle([0, 0, w, h], outline=(48, 76, 48, 70), width=s(18))
    img.alpha_composite(vig.filter(ImageFilter.GaussianBlur(s(30))))
    return noise(img.convert("RGB"), 3.0, 21)


def street_background(room_w: int = 1180) -> Image.Image:
    w, h = s(room_w), s(1000)
    img = vgrad(w, h, [(0, (172, 213, 235)), (0.5, (224, 237, 234)), (0.58, (232, 225, 202)), (0.59, (202, 193, 172)), (0.68, (173, 165, 148)), (0.69, (120, 116, 108)), (1, (96, 94, 88))]).convert("RGBA")
    draw = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(9)

    # Distant buildings
    facades = [
        (0, 250, 260, 690, (205, 184, 160)),
        (240, 300, 190, 690, (188, 172, 154)),
        (410, 220, 240, 690, (214, 196, 174)),
        (630, 286, 210, 690, (196, 178, 158)),
        (820, 240, 220, 690, (208, 188, 166)),
        (1030, 306, 150, 690, (190, 174, 156)),
    ]
    for x, y, bw, bh, col in facades:
        draw.rectangle([s(x), s(y), s(x + bw), s(y + bh)], fill=col)
        draw.rectangle([s(x - 6), s(y - 12), s(x + bw + 6), s(y + 6)], fill=(146, 120, 98))
        # windows
        cols = max(1, bw // 70)
        rows = max(1, (bh - 80) // 90)
        for cx in range(cols):
            for cy in range(rows):
                wx = s(x + 24 + cx * 70)
                wy = s(y + 40 + cy * 92)
                draw.rectangle([wx, wy, wx + s(34), wy + s(46)], fill=(240, 224, 184, 210), outline=(150, 126, 102), width=s(2))
                draw.rectangle([wx, wy, wx + s(34), wy + s(18)], fill=(255, 250, 224, 170))
        # awning
        draw.rectangle([s(x + 14), s(y + bh - 92), s(x + bw - 14), s(y + bh - 58)], fill=(180, 108, 92))
        for stripe in range(0, int(bw - 28), 28):
            draw.rectangle([s(x + 14 + stripe), s(y + bh - 92), s(x + 14 + stripe + 14), s(y + bh - 58)], fill=(238, 214, 184, 210))

    # Sidewalk + curb + road
    draw.rectangle([0, s(690), w, s(764)], fill=(202, 192, 170))
    draw.line([(0, s(690)), (w, s(690))], fill=(150, 140, 122), width=s(3))
    for x in range(0, w, s(120)):
        draw.line([(x, s(696)), (x + s(12), s(760))], fill=(170, 160, 140, 90), width=s(2))
    draw.rectangle([0, s(764), w, s(776)], fill=(160, 154, 142))
    draw.rectangle([0, s(776), w, h], fill=(112, 110, 104))
    for x in range(s(30), w, s(150)):
        draw.rectangle([x, s(884), x + s(74), s(894)], fill=(226, 220, 200, 150))
    # manhole + stones
    draw.ellipse([s(240), s(842), s(300), s(880)], fill=(88, 86, 82), outline=(146, 142, 134), width=s(2))

    # Lamp glows baked softly (lamp prop sits on top)
    for cx in (246, 900):
        glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse([s(cx - 120), s(380), s(cx + 120), s(700)], fill=(255, 232, 170, 30))
        img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(s(26))))

    # Vignette
    vig = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vig)
    vd.rectangle([0, 0, w, h], outline=(56, 54, 46, 80), width=s(18))
    img.alpha_composite(vig.filter(ImageFilter.GaussianBlur(s(28))))
    return noise(img.convert("RGB"), 3.4, 31)


def canvas(w: int, h: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGBA", (s(w), s(h)), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img, "RGBA")


def finish(img: Image.Image, name: str) -> None:
    path = os.path.join(OUT, name)
    img.save(path, "WEBP", quality=88, method=6)
    size = os.path.getsize(path) / 1024
    print(f"  {name:22s} {img.width:4d}x{img.height:<4d} {size:7.1f} KiB")


def prop_door() -> Image.Image:
    img, d = canvas(138, 340)
    w, h = img.size
    d.rectangle([0, 0, w, h], fill=(158, 118, 84, 255))
    d.rectangle([s(6), s(6), w - s(6), h - s(6)], fill=(186, 144, 108, 255))
    d.rectangle([s(14), s(14), w - s(14), h - s(14)], fill=(166, 124, 90, 255))
    # panels
    d.rounded_rectangle([s(26), s(30), w - s(26), s(150)], radius=s(8), fill=(196, 154, 116, 255), outline=(140, 102, 74, 255), width=s(3))
    d.rounded_rectangle([s(26), s(170), w - s(26), s(300)], radius=s(8), fill=(196, 154, 116, 255), outline=(140, 102, 74, 255), width=s(3))
    # glass
    d.rounded_rectangle([s(38), s(44), w - s(38), s(132)], radius=s(6), fill=(188, 216, 228, 255))
    d.line([(s(38), s(88)), (w - s(38), s(88))], fill=(226, 208, 184, 255), width=s(4))
    d.line([(w // 2, s(44)), (w // 2, s(132))], fill=(226, 208, 184, 255), width=s(4))
    # knob
    d.ellipse([w - s(42), s(196), w - s(26), s(212)], fill=(226, 188, 96, 255), outline=(150, 118, 52, 255), width=s(2))
    # threshold
    d.rectangle([0, h - s(10), w, h], fill=(126, 92, 62, 255))
    d.rectangle([0, h - s(10), w, h - s(7)], fill=(214, 176, 132, 255))
    return img


def prop_bed() -> Image.Image:
    img, d = canvas(320, 240)
    w, h = img.size
    # headboard
    d.rounded_rectangle([0, s(18), s(46), h - s(18)], radius=s(14), fill=(156, 110, 88, 255))
    d.rounded_rectangle([s(8), s(28), s(38), h - s(28)], radius=s(8), fill=(186, 136, 108, 255))
    # mattress
    d.rounded_rectangle([s(30), s(96), w - s(10), s(190)], radius=s(18), fill=(238, 226, 208, 255), outline=(198, 178, 152, 255), width=s(3))
    # blanket
    d.rounded_rectangle([s(96), s(104), w - s(14), s(190)], radius=s(16), fill=(206, 132, 118, 255))
    d.rounded_rectangle([s(96), s(104), w - s(14), s(132)], radius=s(14), fill=(224, 156, 140, 255))
    for x in range(s(130), w - s(30), s(46)):
        d.line([(x, s(136)), (x, s(186))], fill=(186, 112, 100, 130), width=s(2))
    # pillow
    d.rounded_rectangle([s(52), s(72), s(142), s(132)], radius=s(18), fill=(250, 242, 226, 255), outline=(220, 204, 182, 255), width=s(3))
    d.line([(s(70), s(102)), (s(124), s(102))], fill=(226, 210, 190, 160), width=s(2))
    # frame + legs
    d.rectangle([s(24), s(188), w - s(6), s(206)], fill=(140, 96, 70, 255))
    for x in (s(30), w - s(40)):
        d.rectangle([x, s(206), x + s(12), h - s(4)], fill=(116, 78, 56, 255))
    # sheet fold
    d.line([(s(100), s(104)), (s(100), s(188))], fill=(246, 236, 220, 180), width=s(3))
    return img


def prop_desk() -> Image.Image:
    img, d = canvas(220, 210)
    w, h = img.size
    # top
    d.rounded_rectangle([0, s(58), w, s(84)], radius=s(6), fill=(196, 154, 112, 255), outline=(150, 112, 78, 255), width=s(3))
    d.rectangle([0, s(58), w, s(64)], fill=(226, 190, 146, 255))
    # legs
    for x in (s(12), w - s(30)):
        d.rectangle([x, s(84), x + s(18), h - s(10)], fill=(166, 122, 84, 255))
        d.rectangle([x + s(3), s(84), x + s(7), h - s(10)], fill=(202, 162, 120, 140))
    # drawer
    d.rounded_rectangle([s(40), s(92), w - s(48), s(140)], radius=s(5), fill=(178, 134, 96, 255), outline=(140, 102, 72, 255), width=s(2))
    d.ellipse([s(96), s(112), s(112), s(126)], fill=(224, 186, 98, 255))
    # book + cup + paper
    d.rounded_rectangle([s(24), s(38), s(78), s(58)], radius=s(3), fill=(122, 146, 108, 255))
    d.rectangle([s(26), s(40), s(76), s(46)], fill=(236, 226, 204, 255))
    d.ellipse([s(150), s(34), s(176), s(58)], fill=(246, 240, 226, 255), outline=(200, 180, 156, 255), width=s(2))
    d.arc([s(170), s(38), s(188), s(54)], start=-80, end=80, fill=(200, 180, 156, 255), width=s(3))
    d.rounded_rectangle([s(100), s(34), s(142), s(56)], radius=s(3), fill=(224, 212, 186, 255))
    d.line([(s(108), s(42)), (s(134), s(42))], fill=(176, 160, 136, 180), width=s(2))
    d.line([(s(108), s(48)), (s(128), s(48))], fill=(176, 160, 136, 180), width=s(2))
    return img


def prop_shelf() -> Image.Image:
    img, d = canvas(156, 300)
    w, h = img.size
    d.rounded_rectangle([0, 0, w, h], radius=s(8), fill=(160, 118, 84, 255), outline=(120, 84, 58, 255), width=s(4))
    d.rectangle([s(8), s(8), w - s(8), h - s(8)], fill=(196, 158, 118, 255))
    for i, y in enumerate((s(48), s(126), s(204), s(282))):
        d.rectangle([s(10), y, w - s(10), y + s(10)], fill=(142, 100, 70, 255))
        d.rectangle([s(10), y, w - s(10), y + s(4)], fill=(222, 184, 140, 255))
        if i < 3:
            # small objects on each shelf
            for x, col, hh in [(s(26), (214, 122, 118), s(28)), (s(60), (226, 194, 118), s(24)), (s(96), (124, 160, 128), s(30))]:
                d.rounded_rectangle([x, y - hh, x + s(24), y - s(2)], radius=s(4), fill=col)
    # flower vase + memento on lower shelf
    d.rounded_rectangle([s(30), s(222), s(58), s(278)], radius=s(6), fill=(214, 200, 178, 255))
    for dx, col in [(-6, (226, 138, 152)), (4, (244, 214, 120)), (14, (232, 158, 132))]:
        d.ellipse([s(38 + dx), s(196), s(54 + dx), s(216)], fill=col)
    d.ellipse([s(92), s(244), s(128), s(280)], fill=(226, 194, 128), outline=(170, 136, 74), width=s(2))
    return img


def prop_plant() -> Image.Image:
    img, d = canvas(100, 160)
    w, h = img.size
    d.rounded_rectangle([s(16), s(102), w - s(16), h - s(8)], radius=s(10), fill=(188, 112, 84, 255), outline=(148, 82, 58, 255), width=s(3))
    d.rectangle([s(14), s(98), w - s(14), s(112)], fill=(214, 142, 108, 255))
    for dx, dy, rw, rh, col in [
        (-16, -30, 42, 30, (94, 142, 82)),
        (16, -42, 46, 34, (108, 158, 92)),
        (-2, -62, 42, 32, (124, 174, 104)),
        (-24, -52, 30, 26, (84, 130, 76)),
        (22, -22, 32, 28, (118, 166, 98)),
    ]:
        d.ellipse([w // 2 + s(dx - rw / 2), s(96 + dy - rh / 2), w // 2 + s(dx + rw / 2), s(96 + dy + rh / 2)], fill=col)
    d.line([(w // 2, s(100)), (w // 2 - s(4), s(40))], fill=(70, 108, 62), width=s(4))
    return img


def prop_rug() -> Image.Image:
    img, d = canvas(820, 100)
    w, h = img.size
    d.rounded_rectangle([0, 0, w, h], radius=s(26), fill=(206, 170, 136, 255), outline=(176, 138, 104, 255), width=s(4))
    d.rounded_rectangle([s(14), s(12), w - s(14), h - s(12)], radius=s(18), fill=(228, 196, 160, 255), outline=(190, 152, 118, 255), width=s(4))
    d.rounded_rectangle([s(28), s(24), w - s(28), h - s(24)], radius=s(14), fill=(214, 176, 142, 255))
    # symmetric motifs
    for x in range(s(48), w - s(60), s(96)):
        d.ellipse([x, s(32), x + s(28), h - s(32)], fill=(240, 212, 178, 230), outline=(188, 150, 118, 200), width=s(2))
        d.ellipse([x + s(8), s(38), x + s(20), h - s(38)], fill=(206, 150, 130, 200))
    return img


def prop_plot_base() -> Image.Image:
    img, d = canvas(142, 96)
    w, h = img.size
    d.rounded_rectangle([0, s(10), w, h], radius=s(10), fill=(146, 104, 70, 255), outline=(112, 76, 50, 255), width=s(4))
    d.rectangle([s(8), s(18), w - s(8), h - s(8)], fill=(104, 76, 56, 255))
    for _ in range(90):
        x = random.randint(s(12), w - s(12))
        y = random.randint(s(24), h - s(10))
        r = random.randint(s(1), s(3))
        d.ellipse([x, y, x + r, y + r], fill=(78, 56, 42, 180) if random.random() < 0.5 else (132, 96, 68, 160))
    d.line([(s(8), s(12)), (w - s(8), s(12))], fill=(196, 154, 112, 255), width=s(4))
    return img


def prop_plot_stage(stage: str, kind: str | None = None) -> Image.Image:
    img, d = canvas(142, 130)
    w, h = img.size
    base_y = h - s(6)
    if stage == "sprout":
        d.line([(w // 2, base_y), (w // 2, base_y - s(26))], fill=(88, 132, 72), width=s(4))
        d.ellipse([w // 2 - s(26), base_y - s(44), w // 2 - s(4), base_y - s(26)], fill=(108, 158, 88))
        d.ellipse([w // 2 + s(4), base_y - s(52), w // 2 + s(28), base_y - s(32)], fill=(124, 176, 100))
    elif stage == "bud":
        d.line([(w // 2, base_y), (w // 2, base_y - s(58))], fill=(82, 126, 68), width=s(5))
        d.ellipse([w // 2 - s(28), base_y - s(50), w // 2 - s(2), base_y - s(26)], fill=(96, 148, 80))
        d.ellipse([w // 2 + s(2), base_y - s(64), w // 2 + s(28), base_y - s(38)], fill=(112, 164, 92))
        d.ellipse([w // 2 - s(12), base_y - s(84), w // 2 + s(12), base_y - s(58)], fill=(196, 150, 150 if kind == "rose" else 176))
        d.ellipse([w // 2 - s(6), base_y - s(78), w // 2 + s(6), base_y - s(64)], fill=(236, 190, 190 if kind == "rose" else 214))
    else:
        palette = {
            "daisy": ((246, 240, 222), (232, 184, 78)),
            "rose": ((224, 128, 142), (178, 82, 100)),
            "sunflower": ((244, 196, 76), (170, 116, 34)),
        }
        petal, center = palette.get(kind or "daisy", palette["daisy"])
        d.line([(w // 2, base_y), (w // 2, base_y - s(66))], fill=(82, 126, 68), width=s(5))
        d.ellipse([w // 2 - s(30), base_y - s(52), w // 2 - s(4), base_y - s(28)], fill=(96, 148, 80))
        d.ellipse([w // 2 + s(4), base_y - s(68), w // 2 + s(30), base_y - s(42)], fill=(112, 164, 92))
        cx, cy = w // 2, base_y - s(84)
        for i in range(8):
            angle = i * math.pi / 4
            px = cx + math.cos(angle) * s(22)
            py = cy + math.sin(angle) * s(22)
            d.ellipse([px - s(13), py - s(13), px + s(13), py + s(13)], fill=petal)
        d.ellipse([cx - s(14), cy - s(14), cx + s(14), cy + s(14)], fill=center)
    return img


def prop_stall() -> Image.Image:
    img, d = canvas(340, 330)
    w, h = img.size
    # posts
    for x in (s(18), w - s(32)):
        d.rectangle([x, s(96), x + s(14), h - s(8)], fill=(146, 106, 74, 255))
    # counter
    d.rounded_rectangle([s(10), s(214), w - s(10), s(270)], radius=s(8), fill=(178, 136, 96, 255), outline=(134, 98, 68, 255), width=s(3))
    d.rectangle([s(10), s(214), w - s(10), s(224)], fill=(214, 174, 128, 255))
    # awning
    d.polygon([(s(6), s(88)), (w - s(6), s(88)), (w - s(22), s(150)), (s(22), s(150))], fill=(202, 124, 108, 255))
    for i, x in enumerate(range(s(18), w - s(34), s(34))):
        col = (242, 220, 190, 235) if i % 2 == 0 else (198, 118, 102, 235)
        d.polygon([(x, s(88)), (x + s(34), s(88)), (x + s(28), s(150)), (x + s(6), s(150))], fill=col)
    d.rectangle([s(6), s(84), w - s(6), s(92)], fill=(150, 110, 80, 255))
    # buckets + flowers
    for x, col in [(s(52), (232, 148, 164)), (s(130), (242, 204, 96)), (s(208), (236, 168, 136)), (s(276), (222, 138, 152))]:
        d.polygon([(x, s(264)), (x + s(48), s(264)), (x + s(40), s(300)), (x + s(8), s(300))], fill=(174, 140, 110, 255))
        for dx in (s(10), s(22), s(34)):
            d.line([(x + dx, s(264)), (x + dx - s(2), s(232))], fill=(94, 138, 78), width=s(2))
            d.ellipse([x + dx - s(7), s(222), x + dx + s(7), s(238)], fill=col)
    # small sign
    d.rounded_rectangle([s(118), s(160), s(222), s(204)], radius=s(6), fill=(244, 234, 214, 255), outline=(176, 146, 110, 255), width=s(2))
    d.line([(s(134), s(176)), (s(206), s(176))], fill=(168, 144, 116, 180), width=s(3))
    d.line([(s(134), s(190)), (s(188), s(190))], fill=(186, 164, 136, 160), width=s(3))
    return img


def prop_bench() -> Image.Image:
    img, d = canvas(210, 140)
    w, h = img.size
    for x in (s(16), w - s(28)):
        d.rectangle([x, s(78), x + s(12), h - s(6)], fill=(128, 90, 60, 255))
        d.rectangle([x - s(4), s(70), x + s(16), s(82)], fill=(154, 112, 76, 255))
    for y, col in [(s(28), (196, 152, 106)), (s(48), (206, 162, 114)), (s(68), (186, 142, 98))]:
        d.rounded_rectangle([s(6), y, w - s(6), y + s(16)], radius=s(5), fill=col, outline=(148, 108, 74, 255), width=s(2))
    d.rectangle([s(12), s(86), w - s(12), s(98)], fill=(176, 132, 92, 255))
    d.rectangle([s(12), s(86), w - s(12), s(90)], fill=(214, 176, 132, 255))
    return img


def prop_fountain() -> Image.Image:
    img, d = canvas(340, 250)
    w, h = img.size
    d.ellipse([s(10), s(150), w - s(10), h - s(8)], fill=(170, 160, 144, 255), outline=(132, 122, 108, 255), width=s(4))
    d.ellipse([s(26), s(160), w - s(26), h - s(22)], fill=(126, 190, 204, 255))
    d.ellipse([s(40), s(170), w - s(40), h - s(38)], fill=(158, 212, 222, 255))
    # pillar
    d.rounded_rectangle([w // 2 - s(22), s(66), w // 2 + s(22), s(186)], radius=s(8), fill=(186, 178, 164, 255), outline=(140, 132, 118, 255), width=s(3))
    d.ellipse([w // 2 - s(54), s(48), w // 2 + s(54), s(84)], fill=(196, 188, 174, 255), outline=(146, 138, 124, 255), width=s(3))
    # water
    for dx, height, width_px in [(-30, 62, 10), (-10, 88, 12), (12, 76, 10), (32, 54, 8)]:
        d.line([(w // 2 + s(dx), s(72)), (w // 2 + s(dx * 1.5), s(72 + height))], fill=(198, 232, 240, 220), width=s(width_px // 4 + 2))
    d.ellipse([s(72), s(182), s(118), s(202)], fill=(214, 240, 244, 170))
    d.ellipse([s(218), s(188), s(262), s(206)], fill=(214, 240, 244, 150))
    return img


def prop_lamp() -> Image.Image:
    img, d = canvas(82, 380)
    w, h = img.size
    d.rectangle([w // 2 - s(6), s(40), w // 2 + s(6), h - s(10)], fill=(92, 98, 96, 255))
    d.rectangle([w // 2 - s(10), h - s(14), w // 2 + s(10), h - s(4)], fill=(70, 74, 72, 255))
    d.polygon([(w // 2 - s(30), s(42)), (w // 2 + s(30), s(42)), (w // 2 + s(20), s(10)), (w // 2 - s(20), s(10))], fill=(74, 80, 78, 255))
    d.rounded_rectangle([w // 2 - s(22), s(30), w // 2 + s(22), s(58)], radius=s(7), fill=(255, 232, 160, 255))
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([w // 2 - s(52), s(6), w // 2 + s(52), s(110)], fill=(255, 232, 154, 90))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(s(12))))
    return img


def prop_tree() -> Image.Image:
    img, d = canvas(320, 520)
    w, h = img.size
    d.polygon([(w // 2 - s(26), h - s(10)), (w // 2 + s(26), h - s(10)), (w // 2 + s(14), s(250)), (w // 2 - s(14), s(250))], fill=(126, 90, 62, 255))
    d.line([(w // 2 - s(6), s(300)), (w // 2 - s(18), s(170))], fill=(106, 74, 50, 255), width=s(10))
    d.line([(w // 2 + s(8), s(320)), (w // 2 + s(24), s(200))], fill=(106, 74, 50, 255), width=s(8))
    clusters = [
        (-70, 170, 110, 96, (78, 118, 68)),
        (50, 150, 120, 104, (86, 128, 74)),
        (-10, 90, 130, 110, (96, 140, 82)),
        (-92, 80, 96, 84, (88, 132, 76)),
        (72, 60, 92, 82, (104, 148, 88)),
        (10, 190, 120, 92, (74, 112, 64)),
    ]
    for dx, dy, rw, rh, col in clusters:
        d.ellipse([w // 2 + s(dx - rw / 2), s(dy - rh / 2), w // 2 + s(dx + rw / 2), s(dy + rh / 2)], fill=col)
    for dx, dy, rw, rh, col in [(-40, 100, 54, 34, (122, 166, 102)), (36, 78, 58, 36, (132, 176, 108)), (-8, 150, 46, 28, (112, 154, 94))]:
        d.ellipse([w // 2 + s(dx - rw / 2), s(dy - rh / 2), w // 2 + s(dx + rw / 2), s(dy + rh / 2)], fill=col)
    return img


def prop_crate() -> Image.Image:
    img, d = canvas(96, 96)
    w, h = img.size
    d.rounded_rectangle([0, 0, w, h], radius=s(6), fill=(166, 124, 86, 255), outline=(120, 86, 58, 255), width=s(4))
    for i in range(3):
        y = s(14 + i * 24)
        d.rectangle([s(4), y, w - s(4), y + s(16)], fill=(190, 148, 106, 255), outline=(136, 98, 66, 255), width=s(2))
    d.line([(s(6), s(8)), (w - s(6), h - s(8))], fill=(142, 104, 72, 255), width=s(6))
    return img


def prop_ball() -> Image.Image:
    img, d = canvas(64, 64)
    w, h = img.size
    d.ellipse([s(4), s(4), w - s(4), h - s(4)], fill=(214, 108, 92, 255), outline=(160, 76, 64, 255), width=s(3))
    d.ellipse([s(10), s(10), s(26), s(24)], fill=(244, 190, 170, 180))
    d.arc([s(8), s(8), w - s(8), h - s(8)], start=30, end=150, fill=(246, 230, 204, 220), width=s(3))
    d.arc([s(8), s(8), w - s(8), h - s(8)], start=210, end=330, fill=(246, 230, 204, 220), width=s(3))
    return img


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    print("backgrounds")
    finish(home_background(980), "home.webp")
    finish(garden_background(960), "garden.webp")
    finish(street_background(1180), "street.webp")

    print("props")
    for name, builder in [
        ("door", prop_door),
        ("bed", prop_bed),
        ("desk", prop_desk),
        ("shelf", prop_shelf),
        ("plant", prop_plant),
        ("rug", prop_rug),
        ("plot", prop_plot_base),
        ("stall", prop_stall),
        ("bench", prop_bench),
        ("fountain", prop_fountain),
        ("lamp", prop_lamp),
        ("tree", prop_tree),
        ("crate", prop_crate),
        ("ball", prop_ball),
    ]:
        finish(builder(), f"prop-{name}.webp")

    print("garden stages")
    for stage in ("sprout", "bud"):
        finish(prop_plot_stage(stage), f"plot-{stage}.webp")
    for kind in ("daisy", "rose", "sunflower"):
        finish(prop_plot_stage("bloom", kind), f"plot-bloom-{kind}.webp")


if __name__ == "__main__":
    main()