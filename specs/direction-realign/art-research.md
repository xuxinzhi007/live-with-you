# 美术与换装系统的可行性调研（跳出当前仓库）

> 目的：不基于现有实现判断「该怎么改」，而是先确认 2026 年这个品类该长什么样，再回头决定仓库怎么调整。
> 取证时间：本次会话。所有结论标注证据来源级别。

## 0. 当前仓库的实测事实（只作为起点，不作为结论依据）

| 事实 | 数据 | 取法 |
| --- | --- | --- |
| 25 张 nikki 原画全部是 **RGB，无 alpha** | `png` IHDR color type = 2 | 读 IHDR 字节 |
| dress / card 尺寸 | 512×640 | 同上 |
| item 尺寸 | 512×512 | 同上 |
| 角色立绘 | 760×760 | webp 头解析 |
| 三房间背景 + 13 物件 + 花圃四阶段 | 21 张 webp，**齐全** | 目录枚举 |

**根因（已证实）**：所谓"抠图"不是资产层的透明通道，而是运行时用 `paper-doll-rig.ts:loadCutoutImage` 做四边连通域洪水填充，临时算出一张 dataURL。这意味着：

1. 每件衣服的正确性**取决于背景是否纯色**。实测 `dress-rose-waltz.png` 背景是浅灰渐变纸纹，洪水填充会产生锯齿和残留。
2. 同一张图既是「卡面」（要有背景和氛围）又是「纸偶部件」（必须全透明），**一个资产承担两个互斥职责**。这是当前美术问题的结构性原因。

## 1. 关键一手证据

### 1.1 ComfyUI 已经能原生输出透明通道（已证实）

来源：`https://docs.comfy.org/tutorials/image/qwen/qwen-image-2-1.md`

> "**Alpha channel support**: the VAE carries four channels, so transparent-background images can be generated and edited directly **instead of being cut out afterwards**"

> "The background removal workflow depends on this: the transparent background is generated into the alpha channel rather than cut out afterwards."

**结论**：2026 年已经不需要「生成 → 再抠图」这条两步管线。可以直接生成带 alpha 的立绘。当前仓库的洪水填充抠图是**上一个时代的解法**，它存在的前提（模型只能出 RGB）已经不成立。

同一文档还给出：

> "**Native 2K output**: generate at up to 2048x2048 directly instead of upscaling a smaller result"

当前资产是 512×640，**分辨率只有原生能力的 1/16**。

### 1.2 角色一致性已有专门模型（已证实）

来源：`https://docs.comfy.org/tutorials/flux/flux-1-kontext-dev.md`

> "**Character Consistency**: Preserves unique elements in images across multiple scenes and environments, such as reference characters or objects in the image."
> "ensuring that key elements such as character features and composition layout remain stable even after **multiple iterative edits**"

来源：`https://docs.comfy.org/tutorials/image/qwen/qwen-image-edit-2511.md`（文档索引列出）
> "stronger **character and multi-person consistency**, built-in LoRAs, and **material replacement**"

以及 Qwen-Image-2.1 的多图参考：
> "reference images are spliced into the text encoder in slot order... accepts up to 16 slots. `image_1` is the image being edited and the rest supply content, so the prompt addresses them by index"

**结论**：`image_1` = 角色本体，`image_2..N` = 服装参考图 → **「同一角色换不同服装」这件事模型原生支持**，且有 16 个参考槽位。当前仓库用"同一 Luna 立绘 + clipPath 切片"模拟换装，是把模型已经能做好的事用工程手段硬凑。

### 1.3 局部重绘已有标准解法（已证实）

来源：`https://docs.comfy.org/tutorials/basic/inpaint.md`

> "we need to tell the artist **which areas to adjust (mask)**, then let them repaint (inpaint)"
> "**Detail Optimization**: Precisely adjusting local elements (like modifying clothing textures, adjusting facial expressions)"

来源：`https://docs.comfy.org/tutorials/basic/outpaint.md`（扩图）

**结论**：改一件配饰的颜色、给裙子换花纹，不需要重新生成整张图，只需 mask + inpaint。这直接对应「升星改外观」「染色」「改款」这类暖暖类核心玩法，成本是整图重绘的几分之一。

### 1.4 商业作品的分层方案叫 slot + skin（已证实）

来源：`https://esotericsoftware.com/spine-runtime-skins`（Spine 官方运行时文档）

> "Skins are used to control what attachments a skeleton uses at runtime. A Skin is a map where the key is a **slot** and a name, while the value is an **attachment**."

> "This allows code and animations to set attachments by skin placeholder name, **without having to reference a specific attachment**."

> "Code and animations change the attachment using the name `head`, but which attachment is shown for the head depends on the skeleton's current **skin**."

> "consider a skeleton that can have a dog head or a snake head, and can have feathered wings or burning wings. Creating a skin for every combination... would be tedious... Instead, a skin can be created programmatically with the desired head, wings, and other attachments."

**结论（本次调研最重要的一条）**：

商业 2D 换装的通行结构是 **slot（槽位）/ skin（皮肤组合）/ attachment（具体贴图）** 三层。动画和代码只认 slot 名，永远不认具体图片。

当前仓库的 `nikki-wardrobe.ts` 有 `WardrobeSlot` 和 `EquippedOutfit`——**已经对了 70%**。缺的是：attachment 层没有"一个 slot 对应多张可切换贴图"的概念，而是每个 slot 只有一件，且贴图是整张人像（含身体），不是该槽位单独的一层。

这解释了为什么 `computeHumanoidPartSlices` 需要用 `polygon(...)` 百分比切矩形区域去伪造分层——**因为资产没有分层，只能在运行时切**。切出来的手臂/腿/躯干是矩形选区，不是真实轮廓，所以旋转时必然穿模。

## 2. 当前做法的三个结构性错误（推断，依据上面 1.1–1.4）

| # | 错误 | 具体表现 | 一手依据 |
| --- | --- | --- | --- |
| E1 | 用运行时抠图代替资产层 alpha | 洪水填充+1px 消白边；背景有渐变就失败 | 1.1 模型原生出 alpha |
| E2 | 用矩形切片伪造分层 | `clipPath: polygon(18% ..., 50.5% ..., ...)` 硬编码百分比 | 1.4 slot/skin/attachment |
| E3 | 一张图兼扮卡面与纸偶部件 | 卡面要背景氛围，纸偶要全透明，二者互斥 | 1.1 |
| E4 | 分辨率取模型能力的 1/16 | 512×640 vs 原生 2048×2048 | 1.1 |

## 3. 不适合的方向（明确排除）

- **不做 Live2D / Spine 全套商业管线**：需要专门软件授权 + 逐部件绘制 + 绑定师。单人 + AI 产出，做不了。Spine 的 *思路*（slot/skin）要学，*工具*不要用。
- **不做全 3D**：与 AI 2D 出图路线冲突，资产复用率为 0。
- **不做逐部件手工绘制**：这正是 AI 生成要替代掉的部分。

## 4. 待确认

- 目标平台优先级（纯 Web / 是否要上架安卓 iOS）会影响分辨率与包体取舍。
- 是否允许"同一件衣服不同颜色只靠 inpaint 换色"作为升星的唯一表现，还是要真的换款式（后者需要更多模型调用）。
- 现网是否已有真实用户存档（决定 #3 修复的紧迫程度）。

## 5. 来源清单

| 编号 | URL | 类型 |
| --- | --- | --- |
| S1 | https://docs.comfy.org/tutorials/image/qwen/qwen-image-2-1.md | 一手官方文档 |
| S2 | https://docs.comfy.org/tutorials/flux/flux-1-kontext-dev.md | 一手官方文档 |
| S3 | https://docs.comfy.org/tutorials/basic/inpaint.md | 一手官方文档 |
| S4 | https://docs.comfy.org/tutorials/basic/outpaint.md | 一手官方文档 |
| S5 | https://esotericsoftware.com/spine-runtime-skins | 一手官方文档 |
| S6 | https://docs.comfy.org/_llms/en/tutorials.txt | 官方文档索引 |
