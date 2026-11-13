# -*- coding: utf-8 -*-
"""Rebuild MeinaMix_补全全身 without ComfyMathExpression (MCP API converter breaks values.a)."""
import json

WF_PATH = r"D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\user\default\workflows\MeinaMix_补全全身.json"

NOTE = """# 补全全身 OFFICIAL（自适应画布 + 整片留白重绘）

用途：半身/胸像 → 连贯全身。**禁止**写死 1184×1987，或只补底边 128px。

## 阶段（左→右）
1. **加载原图**（半身/胸像；默认测试图 `bust_test_for_fullbody.png`）
2. **限制最长边 512**（ImageScaleToMaxDimension）— 按原图实际比例缩放，不先贴巨幅白布
3. **铺到固定 512×768 中灰画布**，内容 **顶部左对齐贴上**（中灰 #808080，延续素底；比纯白更不易和白衣服打架）
4. **遮罩 = 画布上所有未被原图覆盖的像素**（整片留白，不是底边一条）：
   SolidMask 原图尺寸 → 从全图画布遮罩中 subtract → GrowMask(+16) 溶进身体下沿
5. **底模 + LoRA**：meinamix_v12Final + xiaoyan.safetensors ~0.80 + CLIP skip -2
6. **锁脸**：IPAdapter PLUS FACE，参考=原图，权重 ~0.65
7. **只重绘遮罩区** VAEEncodeForInpaint（grow≈20）+ denoise 1.0
8. **保存** Xiaoyan_full

## 提示词约定（重要）
- 正向：触发词 + 姿势/服装延续 + **simple/plain background**。不要写房间、街道、天空、道具场景
- 负向：scenery / complex background / furniture / cityscape / indoor / outdoor scenery / extra objects + 断层/白洞/多手脚
- 留白区必须续素底，禁止脑补新环境

## 预览
先看「铺画布预览」「重绘遮罩预览」：白区应盖住人物下方（及两侧）整片留白。

## 已知边界
- 缩放后宽度 < 512 时内容靠左（非水平居中）；常见半身图缩完后宽度多为 512，不受影响
- 已接近全身时只会补少量底边，不会缩成邮票
- RGBA 透明图建议先铺浅灰底再导入
"""

POS = (
    "xiaoyan, 1girl, solo, standing, full body, "
    "legs and feet naturally connected to the torso, "
    "matching the existing outfit and proportions, seamless body continuation, no gap, "
    "simple background, plain background, soft flat backdrop"
)
NEG = (
    "scenery, complex background, detailed background, outdoor scenery, indoor, room, "
    "furniture, cityscape, street, buildings, sky with clouds, trees, props, extra objects, "
    "white hole, blank torso, gap through body, disconnected limbs, floating legs, "
    "extra shoes, extra feet, extra person, multiple girls, cropped legs, missing legs, "
    "text, watermark, logo, border"
)

GRAY = 0x808080  # medium gray, matches ImagePadForOutpaint 0.5 feel


def node(id, type_, title, pos, size, widgets, inputs, outputs, order, properties=None, color=None, bgcolor=None):
    n = {
        "id": id, "type": type_, "pos": pos, "size": size, "flags": {}, "order": order, "mode": 0,
        "inputs": inputs, "outputs": outputs, "title": title,
        "properties": properties or {"Node name for S&R": type_, "cnr_id": "comfy-core", "ver": "0.28.0"},
        "widgets_values": widgets,
    }
    if color: n["color"] = color
    if bgcolor: n["bgcolor"] = bgcolor
    return n

def inp(name, type_, link=None, widget=False, shape=None, localized=None):
    d = {"localized_name": localized or name, "name": name, "type": type_, "link": link}
    if widget:
        d["widget"] = {"name": name}
    if shape is not None:
        d["shape"] = shape
    return d

def out(name, type_, slot_index=None, localized=None):
    d = {"localized_name": localized or name, "name": name, "type": type_, "links": []}
    if slot_index is not None:
        d["slot_index"] = slot_index
    return d

nodes = []
links = []
lid = [1]
by_id = {}

def add(n):
    nodes.append(n); by_id[n["id"]] = n; return n

def L(src, src_slot, dst, dst_slot, typ):
    i = lid[0]; lid[0] += 1
    links.append([i, src, src_slot, dst, dst_slot, typ])
    by_id[dst]["inputs"][dst_slot]["link"] = i
    by_id[src]["outputs"][src_slot]["links"].append(i)
    return i

add(node(1, "MarkdownNote", "流程说明（必读）", [40, 980], [740, 480], [NOTE], [], [], 0, properties={}, color="#432", bgcolor="#653"))

add(node(2, "LoadImage", "1. 原图（半身/胸像）", [40, 40], [320, 340],
    ["bust_test_for_fullbody.png", "image"],
    [inp("image", "COMBO", widget=True), inp("upload", "IMAGEUPLOAD", widget=True)],
    [out("IMAGE", "IMAGE", 0), out("MASK", "MASK", 1)], 1))

add(node(3, "ImageScaleToMaxDimension", "2. 最长边限制 512（按原图比例）", [400, 40], [300, 120],
    ["lanczos", 512],
    [inp("image", "IMAGE"), inp("upscale_method", "COMBO", widget=True), inp("largest_size", "INT", widget=True)],
    [out("IMAGE", "IMAGE", 0)], 2))

add(node(4, "GetImageSize", "3. 测量缩放后尺寸", [400, 200], [240, 110], [],
    [inp("image", "IMAGE")],
    [out("width", "INT", 0), out("height", "INT", 1), out("batch_size", "INT", 2)], 3))

add(node(5, "EmptyImage", "4. 512x768 中灰画布", [740, 40], [260, 170],
    [512, 768, 1, GRAY],
    [inp("width", "INT", widget=True), inp("height", "INT", widget=True),
     inp("batch_size", "INT", widget=True), inp("color", "INT", widget=True)],
    [out("IMAGE", "IMAGE", 0)], 4))

add(node(6, "ImageCompositeMasked", "5. 原图贴到画布顶部", [1060, 40], [280, 200],
    [0, 0, False],
    [inp("destination", "IMAGE"), inp("source", "IMAGE"),
     {"localized_name": "mask", "name": "mask", "shape": 7, "type": "MASK", "link": None},
     inp("x", "INT", widget=True), inp("y", "INT", widget=True), inp("resize_source", "BOOLEAN", widget=True)],
    [out("IMAGE", "IMAGE", 0)], 5))

add(node(7, "SolidMask", "6a. 全画布先标为重绘", [740, 250], [260, 140],
    [1.0, 512, 768],
    [inp("value", "FLOAT", widget=True), inp("width", "INT", widget=True), inp("height", "INT", widget=True)],
    [out("MASK", "MASK", 0)], 6))

add(node(8, "SolidMask", "6b. 原图占用区（尺寸随原图）", [740, 420], [280, 140],
    [1.0, 512, 368],
    [inp("value", "FLOAT", widget=True), inp("width", "INT", widget=True), inp("height", "INT", widget=True)],
    [out("MASK", "MASK", 0)], 7))

add(node(9, "MaskComposite", "7. 遮罩=整片留白（全图减原图区）", [1060, 280], [300, 180],
    [0, 0, "subtract"],
    [inp("destination", "MASK"), inp("source", "MASK"),
     inp("x", "INT", widget=True), inp("y", "INT", widget=True), inp("operation", "COMBO", widget=True)],
    [out("MASK", "MASK", 0)], 8))

add(node(10, "GrowMask", "8. 遮罩向身体下沿 +16", [1400, 280], [280, 130],
    [16, True],
    [inp("mask", "MASK"), inp("expand", "INT", widget=True), inp("tapered_corners", "BOOLEAN", widget=True)],
    [out("MASK", "MASK", 0)], 9))

add(node(11, "MaskToImage", "遮罩转预览", [1400, 440], [220, 70], [],
    [inp("mask", "MASK")], [out("IMAGE", "IMAGE", 0)], 10))

add(node(12, "PreviewImage", "铺画布预览", [1060, 500], [300, 300], [],
    [inp("images", "IMAGE")], [out("images", "IMAGE", 0)], 11))

add(node(13, "PreviewImage", "重绘遮罩预览（白=重绘）", [1400, 540], [300, 300], [],
    [inp("images", "IMAGE")], [out("images", "IMAGE", 0)], 12))

add(node(14, "CheckpointLoaderSimple", "9. 底模 MeinaMix", [40, 420], [320, 120],
    ["meinamix_v12Final.safetensors"],
    [inp("ckpt_name", "COMBO", widget=True)],
    [out("MODEL", "MODEL", 0), out("CLIP", "CLIP", 1), out("VAE", "VAE", 2)], 13))

add(node(15, "LoraLoader", "10. 角色 LoRA xiaoyan ~0.80", [400, 560], [320, 150],
    ["xiaoyan.safetensors", 0.8, 0.8],
    [inp("model", "MODEL"), inp("clip", "CLIP"),
     inp("lora_name", "COMBO", widget=True), inp("strength_model", "FLOAT", widget=True),
     inp("strength_clip", "FLOAT", widget=True)],
    [out("MODEL", "MODEL", 0), out("CLIP", "CLIP", 1)], 14))

add(node(16, "CLIPSetLastLayer", "11. CLIP Skip -2", [760, 700], [240, 90],
    [-2],
    [inp("clip", "CLIP"), inp("stop_at_clip_layer", "INT", widget=True)],
    [out("CLIP", "CLIP", 0)], 15))

add(node(17, "IPAdapterUnifiedLoader", "12. 脸部参考模型 PLUS FACE", [400, 750], [320, 110],
    ["PLUS FACE (portraits)"],
    [inp("model", "MODEL"),
     {"localized_name": "ipadapter", "name": "ipadapter", "shape": 7, "type": "IPADAPTER", "link": None},
     inp("preset", "COMBO", widget=True)],
    [out("model", "MODEL", 0), out("ipadapter", "IPADAPTER", 1)], 16,
    properties={"Node name for S&R": "IPAdapterUnifiedLoader"}))

add(node(18, "IPAdapter", "13. 用原图锁脸 (~0.65)", [760, 820], [300, 190],
    [0.65, 0.0, 1.0, "standard"],
    [inp("model", "MODEL"), inp("ipadapter", "IPADAPTER"), inp("image", "IMAGE"),
     {"localized_name": "attn_mask", "name": "attn_mask", "shape": 7, "type": "MASK", "link": None},
     inp("weight", "FLOAT", widget=True), inp("start_at", "FLOAT", widget=True),
     inp("end_at", "FLOAT", widget=True), inp("weight_type", "COMBO", widget=True)],
    [out("MODEL", "MODEL", 0)], 17,
    properties={"Node name for S&R": "IPAdapter"}))

add(node(19, "CLIPTextEncode", "14. 正向（角色+姿势+素底，不写场景）", [1100, 860], [500, 170],
    [POS],
    [inp("clip", "CLIP"), inp("text", "STRING", widget=True)],
    [out("CONDITIONING", "CONDITIONING", 0)], 18, color="#232", bgcolor="#353"))

add(node(20, "CLIPTextEncode", "15. 负向（禁场景/断层/多余物体）", [1620, 860], [500, 170],
    [NEG],
    [inp("clip", "CLIP"), inp("text", "STRING", widget=True)],
    [out("CONDITIONING", "CONDITIONING", 0)], 19, color="#322", bgcolor="#533"))

add(node(21, "VAEEncodeForInpaint", "16. 只编码遮罩区 (grow 20)", [1780, 40], [290, 140],
    [20],
    [inp("pixels", "IMAGE"), inp("vae", "VAE"), inp("mask", "MASK"), inp("grow_mask_by", "INT", widget=True)],
    [out("LATENT", "LATENT", 0)], 20))

add(node(22, "KSampler", "17. 采样（空区 denoise=1）", [1780, 220], [320, 330],
    [270783883006970, "randomize", 28, 7.0, "dpmpp_2m", "karras", 1.0],
    [inp("model", "MODEL"), inp("positive", "CONDITIONING"), inp("negative", "CONDITIONING"),
     inp("latent_image", "LATENT"),
     inp("seed", "INT", widget=True), inp("steps", "INT", widget=True), inp("cfg", "FLOAT", widget=True),
     inp("sampler_name", "COMBO", widget=True), inp("scheduler", "COMBO", widget=True),
     inp("denoise", "FLOAT", widget=True)],
    [out("LATENT", "LATENT", 0)], 21))

add(node(23, "VAEDecode", "18. 解码", [2140, 220], [230, 80], [],
    [inp("samples", "LATENT"), inp("vae", "VAE")],
    [out("IMAGE", "IMAGE", 0)], 22))

add(node(24, "SaveImage", "19. 全身成品 Xiaoyan_full", [2400, 180], [360, 420],
    ["Xiaoyan_full"],
    [inp("images", "IMAGE"), inp("filename_prefix", "STRING", widget=True)],
    [out("images", "IMAGE")], 23))

# wires
L(2, 0, 3, 0, "IMAGE")
L(3, 0, 4, 0, "IMAGE")
L(5, 0, 6, 0, "IMAGE")   # canvas -> composite dest
L(3, 0, 6, 1, "IMAGE")   # scaled -> composite source
L(4, 0, 8, 1, "INT")     # width -> subject SolidMask width (inputs: value=0, width=1, height=2)
L(4, 1, 8, 2, "INT")     # height -> subject SolidMask height
L(7, 0, 9, 0, "MASK")    # full canvas mask dest
L(8, 0, 9, 1, "MASK")    # subject mask source
L(9, 0, 10, 0, "MASK")
L(10, 0, 11, 0, "MASK")
L(6, 0, 12, 0, "IMAGE")  # padded preview
L(11, 0, 13, 0, "IMAGE") # mask preview
L(14, 0, 15, 0, "MODEL")
L(14, 1, 15, 1, "CLIP")
L(15, 1, 16, 0, "CLIP")
L(15, 0, 17, 0, "MODEL")
L(17, 0, 18, 0, "MODEL")
L(17, 1, 18, 1, "IPADAPTER")
L(2, 0, 18, 2, "IMAGE")
L(16, 0, 19, 0, "CLIP")
L(16, 0, 20, 0, "CLIP")
L(6, 0, 21, 0, "IMAGE")
L(14, 2, 21, 1, "VAE")
L(10, 0, 21, 2, "MASK")
L(18, 0, 22, 0, "MODEL")
L(19, 0, 22, 1, "CONDITIONING")
L(20, 0, 22, 2, "CONDITIONING")
L(21, 0, 22, 3, "LATENT")
L(22, 0, 23, 0, "LATENT")
L(14, 2, 23, 1, "VAE")
L(23, 0, 24, 0, "IMAGE")

wf = {
    "id": "wenbao-fullbody-outpaint-v2",
    "revision": 3,
    "last_node_id": 24,
    "last_link_id": lid[0] - 1,
    "nodes": nodes,
    "links": links,
    "groups": [
        {"id": 1, "title": "A. 自适应画布与整片留白遮罩", "bounding": [20, 0, 1720, 860], "color": "#3f789e", "font_size": 24, "flags": {}},
        {"id": 2, "title": "B. 模型 / LoRA / 锁脸 / 素底提示词", "bounding": [20, 400, 2140, 680], "color": "#88A", "font_size": 24, "flags": {}},
        {"id": 3, "title": "C. 只重绘留白 → 成品", "bounding": [1740, 0, 1080, 640], "color": "#b58b2a", "font_size": 24, "flags": {}},
    ],
    "config": {},
    "extra": {"ds": {"scale": 0.6, "offset": [40, 20]}, "frontendVersion": "1.45.21"},
    "version": 0.4,
}

with open(WF_PATH, "w", encoding="utf-8") as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)
print("Wrote", WF_PATH, "nodes", len(nodes), "links", len(links))
