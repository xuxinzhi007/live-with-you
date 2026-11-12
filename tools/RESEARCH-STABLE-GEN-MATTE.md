# 更稳的出图与抠图调研（灰环 / isnet 背景泄漏）

> 调研日期：2026-11-11（Asia/Shanghai）  
> 范围：只调研、不改官方工作流 JSON、不出对照、不开训、不入库。  
> 指派问题：① 512 底图不要再画出棚拍灰环/椭圆；② isnet-anime 不要再把棚拍背景当主体留下。  
> 身份锁定只作附注，不是本轮主实验。caption / 重训仍由「小燕资产管线」评估。

---

## 0. 已用本机测试裁定（不要再重复）

| 已试 | 结果 |
|------|------|
| 种子 202611110501 / 601 / 701，同一套官方换装 7 组模板 | 同一类失败：第 3 组 512×640 底图五官已漂，同时画出大灰椭圆/灰环；后处理救不回来 |
| 加重正向 `(plain solid white background:1.6)` | 白衣服被「打白 / 吹爆」，模型用一圈对比椭圆把人从白底里分开，灰环更明显 |
| 官方负向已含 `floor, shadow, complex background, scenery`（见 `official-align/run-official-dress.mjs`） | 仍画出灰环。只靠现有负向不够 |
| 历史稿还用过 `(medium gray background:1.8)` / `light gray background`（`finish-from-master.py`、`remaster-wenbao-sharp.py`） | 等于直接鼓励灰色无缝纸/棚底板，不要再走灰底 |
| 色键 / 四边洪水抠图 | 对灰色渐变失效，已废弃，不当正式抠图 |
| 正式抠图 `official-isnet-rematte.py`（box rembg venv，`isnet-anime`，不是 u2net） | 反复把灰环当主体留下。701 keep-mask ≈ 0.711；601 留下两块叠着的灰椭圆 |
| AnimeSharp | 只把错的脸和灰环修得更清楚 |
| FaceDetailer（放大后，参考待机状态 / `standby-bust-white.png`） | 只补了一点浅笑，刘海和眼睛拉不回来 |
| 第 7 组去光斑 | 仅挂钩，本机没有稳定去渍节点 |

本机约束（已核对）：Comfy 里没有 rembg / isnet / RMBG / BiRefNet / LayerDiffuse 节点；正式抠图是生成之后的脚本，venv 为 `/workspace/wenbao-pipeline/.venv-rembg`（rembg **2.0.87**）。显存 8GB（RTX 3070 Ti Laptop），7 组要分段跑。衣服（白 T + 白短裤）、脚入画、正常比例这几轮是对的。质量标准已放宽：特征正常、角色正确、画面干净；不要再强写 Q 版 / chibi。

---

## 1. 问题一：为什么会画出灰环，怎样在底图阶段停掉

### 判断

MeinaMix 本身偏「能出清晰、偏棚拍」的动漫混合模型，全身白底立绘很容易长出产品棚的无缝纸、地台、椭圆阴影。再叠两件事，灰环几乎是必然的：

1. **白衣服 + 高权重白底是对打的。** 模型需要对比才能把白 T / 白短裤从画布里分开，就会发明一圈灰椭圆。这和本机 1.6 白底「打白 + 对比椭圆」的观察一致。
2. **Danbooru 的 `white background` 并不保证平涂。** 该标签也包括「以白为主、带灰白渐变」的背景，所以把白底权重加到 1.4–1.6，模型完全可以合法地画出渐变棚纸，而不是一张死白。`simple background` 只表示背景空、没场景，**同样可以是渐变**；要平涂必须再加一个具体颜色标签，并把 `gradient background` 放进负向。

常见博客里的 `studio lighting` + 超高权重白底，对 MeinaMix 立绘是陷阱，不要当标准答案。

### 社区里实际在用、且不必新装节点的做法

**用「和白衣服、肤色都分开的平涂色」出底图，而不是再抢白底。** 典型写法（权重 1.0–1.2，不要到 1.6）：

- 正向：`simple background, light blue background`（或浅粉 `light pink background`；不要灰，不要再写 `(plain solid white background:1.6)`）
- 负向在现有 `floor, shadow` 上补：`grey background, gray background, gradient background, studio backdrop, backdrop, cyclorama, platform, oval, spotlight, drop shadow, photorealistic`

颜色一旦是平涂且和衣服色差够大，后面的抠图会容易得多；若真的平涂，以前失败的色键才有可能重新可用——但下一轮仍应先用语义抠图，不要把色键当正式方案。

### 若改提示词仍画出道具：LayerDiffuse（备选，不作为下一轮实验）

标准做法是生成时直接出 RGBA，从根上不画背景。

- 节点：[`huchenlei/ComfyUI-layerdiffuse`](https://github.com/huchenlei/ComfyUI-layerdiffuse)（实现自 [LayerDiffuse](https://github.com/layerdiffuse/sd-forge-layerdiffuse)）
- SD1.5 有独立的「只出透明前景」模型；边长必须是 64 的倍数（512×640 可以）
- 8GB：SD1.5 + 512 档在 6–8GB 上常见可跑，但**不能**和现有 LoRA + IPAdapter + ControlNet + AnimeSharp + FaceDetailer 叠在同一段显存里。本机目前没装这个节点。它还可能和 IPAdapter 抢条件、改变画风。只在提示词改完仍出灰环时再评估。

---

## 2. 问题二：isnet-anime 为什么留灰环，换什么

### 判断

`isnet-anime` 是显著目标 / 二分分割模型（IS-Net 动漫微调，rembg 会话名 `isnet-anime`）。它不管背景是什么颜色，只留「看起来像主体的那一块」。对比度很高的灰椭圆在画面里就是一个显眼地台，所以会被一起留下。701 的 keep-mask ≈ 0.711 符合「人 + 环」而不是整张都没抠（脚本里 `keep > 0.92` 的告警阈值偏松，拦不住这次泄漏）。

因此：**不要再换一个「显著目标」模型然后指望它主动丢掉地台。** 要换成「人 / 角色」模型，或用检测框把人单独抠出来。

### 推荐路径（优先走现有官方后处理脚本，不必先装 Comfy 节点）

当前 rembg 2.0.87 已经能直接换会话，不必改 Comfy 图：

| 会话 | 为什么适合 | 许可 / 资源 |
|------|------------|-------------|
| **`u2net_human_seg`** | 人体分割，不是显著目标。最可能主动丢掉地台。无新依赖 | 已在 venv 中 |
| **`birefnet-portrait`** | BiRefNet 人像专项，边缘通常更好，仍是「人」而不是「画面里最显眼的东西」 | MIT；官方称 1024² fp16 约 3.45GB，单独跑可进 8GB。建议在 Comfy 卸载后再跑，或继续在 box 的 `.venv-rembg` 里跑 |

这两个就是下一轮抠图实验的对象。在已有的 701 / 601 AnimeSharp 原图上换会话重抠即可，**不用再出一张对照**。

### 动漫边缘专项（第二优先，不进第一轮）

**ToonOut**：在 1228 张动漫图上微调的 BiRefNet，作者测试集像素精度 95.3% → 99.5%，对头发和线稿更稳。

- 论文：<https://arxiv.org/abs/2509.06839>
- 权重（MIT）：<https://huggingface.co/joelseytre/toonout>
- 代码：<https://github.com/MatteoKartoon/BiRefNet>
- 常见节点：[`1038lab/ComfyUI-RMBG`](https://github.com/1038lab/ComfyUI-RMBG) 自 v2.9.2 起带 `BiRefNet_toonOut`

注意：ToonOut 仍可能把「画进图里的道具」当角色附件留下。它更适合在灰环已经消失之后修头发边缘，而不是单独拿来赌 701 这种地台。

### 本机已有的另一条标准链：Impact Pack 人检测 + SAM

FaceDetailer 能跑，说明 **ComfyUI-Impact-Pack 已在本机**。常见用法是 `UltralyticsDetectorProvider`（`person_yolov8n-seg` 等）→ `SAMDetector`，得到的是「人」的掩膜，地台应被排除。显存要点：用 SAM `vit_b`，放在扩散模型卸载之后的独立一组里跑，不要和 7 组出图抢 8GB。若 rembg 换会话仍留环，再走这条，不必先装新插件。

### 可装但不是下一轮必须的节点

`ComfyUI-RMBG` 是目前最常见的抠图自定义节点（BiRefNet、ToonOut、lite、人像，带 `unload_model`）。8GB 上可以，但必须分段卸载，不要和 MeinaMix 全链路同段。正式路径继续用后处理脚本就够，不必为下一轮实验装它。

**不要**把 `bria-rmbg` / RMBG-2.0 当默认：权重许可偏非商用，而且偏大（有评测在 12GB 机器上 OOM）。与其装云端 `BriaRemoveImageBackground`，不如用上面的本地 MIT 模型。

---

## 3. 身份（只记录，不作为本轮实验）

501 / 601 / 701 的脸在 512 底图就已经漂了。放大后再 FaceDetailer 证明：后修救不回齐刘海和大圆棕眼。再调一次 FaceDetailer 不是正确的下一步。

社区里会在**底图阶段**用的标准做法（仅备忘）：

- 在 512 底图上先做一次更高 denoise 的脸部裁切重绘（ADetailer / FaceDetailer），而不是放到 AnimeSharp 之后
- 两段式：先出更近的半身/面部，再合成或局部重绘进全身潜空间
- 区域 IPAdapter / FaceID——在真实人脸上证据更多，动漫上不稳定

但当前 `xiaoyan.safetensors` 是在脏 caption 上训的（几乎都是白衬衫 + 黑长裙 + 翅膀，还有缺字）。三次同样的底图漂脸，更说明模型侧锁不住身份。**身份问题应等图集 / caption 评估（以及是否重训）再动**；出图侧这轮不要再为锁脸排同一条对照。

---

## 4. 建议的下一步（最多两个实验，现在先不要跑）

等小燕的 caption / LoRA 评估；在此之前不要再排官方或非官方对照，也不要改官方 JSON。下面两个实验互不抢路，也不依赖重训。

**实验 1（先做，只抠图，用现成 701 / 601 图）。**  
在已有 AnimeSharp 原图上，沿用 `official-isnet-rematte.py` 的路径，只把 `new_session("isnet-anime")` 分别换成 `u2net_human_seg` 和 `birefnet-portrait`。在 box 的 `.venv-rembg` 里跑（或本机先卸掉 Comfy 再跑），这样不占 8GB 出图显存。看 keep-mask 和灰环是否被丢掉。两个会话都留环，再考虑 Impact Pack 人检测 + SAM，或之后用 ToonOut 修边缘——不要一次开一串模型。

**实验 2（等评估结束、恢复出图时再做）。**  
只改第 3 组底图提示词：去掉高权重白底，改成中等权重的 `simple background, light blue background`，负向补上灰底 / 渐变 / 棚拍背景 / 地台。其它槽位（LoRA 0.8、IPAdapter、OpenPose、种子策略）先不动。目标很单一：512 底图不再出现灰环，背景尽量平涂。不要再用灰底，也不要回到 `(plain solid white background:1.6)`。若这次仍出道具，再评估 LayerDiffuse SD1.5，而不是继续加白底权重。

若实验 1 已经能从现有原图里干净地去掉灰环，实验 2 仍然值得做：干净的底图比「先画脏再抠掉」更稳，尤其是白衣服。

---

## 5. 来源

- rembg 模型列表（含 `isnet-anime`、`u2net_human_seg`、`birefnet-portrait` 等）：<https://github.com/danielgatis/rembg>
- BiRefNet 仓库与人像/通用权重：<https://github.com/ZhengPeng7/BiRefNet> · <https://huggingface.co/ZhengPeng7/BiRefNet>
- BiRefNet 1024² fp16 ≈ 3.45GB、MIT：<https://ki-heimlabor.de/en/models/birefnet/>
- ToonOut 论文与权重：<https://arxiv.org/abs/2509.06839> · <https://huggingface.co/joelseytre/toonout> · <https://github.com/MatteoKartoon/BiRefNet>
- ComfyUI-RMBG（含 v2.9.2 `BiRefNet_toonOut`、`unload_model`）：<https://github.com/1038lab/ComfyUI-RMBG>
- LayerDiffuse 节点与 SD1.5 说明：<https://github.com/huchenlei/ComfyUI-layerdiffuse> · <https://github.com/layerdiffuse/sd-forge-layerdiffuse>
- LayerDiffuse 透明出图教程（含 SD1.5、512×768）：<https://stable-diffusion-art.com/transparent-background/>
- Danbooru 背景标签（`white background` 可含灰白渐变；`simple background` 只表示空背景；平涂需具体颜色标签）：<https://danbooru.donmai.us/wiki_pages/white_background> · <https://danbooru.donmai.us/wiki_pages/simple_background> · <https://danbooru.donmai.us/wiki_pages/gradient_background>
- Impact Pack 检测器 + 人掩膜再抠图：<https://github.com/ltdrdata/ComfyUI-extension-tutorials/blob/Main/ComfyUI-Impact-Pack/tutorial/detectors.md> · <https://blog.otama-playground.com/en/posts/20240901/1725186131>
- MeinaMix 说明（少提示词、全身建议 hires 修远景脸）：<https://huggingface.co/Meina/MeinaMix>
- rembg 各模型许可与显存评测（RMBG-2.0 非商用、偏吃内存）：<https://www.creativeainews.com/articles/rembg-background-removal-models-tested-2026/>
- 本机已有说明：`PIPELINE-OFFICIAL.md`、`PIPELINE-DRESS.md`、`official-isnet-rematte.py`、`official-align/run-official-dress.mjs`
