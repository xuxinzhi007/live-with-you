# Live2D 11 件方案调研

> **定位：未来 / 可选，不是当前运行时。** 现行产品是 `WorldApp` DOM 纸偶与 `skeleton-system`；仓库已卸除 `pixi.js` 运行时依赖。若日后接入 Live2D，需重新引入兼容的渲染依赖并完成 Cubism 许可流程。
> 状态：调研完成，链路曾在 Pixi 8 下验证。日期：2026-11-02
> 验收证据：`spark-output/audit/live2d-demo/report.json`、`live2d-canvas.png`

## 0. 结论

1. **运行时可用**：`untitled-pixi-live2d-engine@1.4.0` 在 Pixi **8.22.0** 下实测跑通，
   渲染 760×760 出图，52–61 fps，模型加载 ~100ms。
2. **必须用 Cubism 5 Core**（`live2dcubismcore.min.js`，207KB）。它是 **Live2D 官方专有文件，
   不在 npm 上**，不能随包分发，有许可约束。
3. **`guansss/pixi-live2d-display` 不可用**：peer 是 `@pixi/* ^6`，本项目 v8。
4. **姿势漂移的根因是缺 ControlNet**，不是提示词。现有管线 grep `controlnet|openpose|pose` 为空。
5. **分层生成本身可做**（LayerDiffusion），但**绑骨不能自动化**（必须 Cubism Editor 手工）。

## 1. 运行时选型（实测）

| 库 | 版本 | Pixi v8 | Cubism | 实测 |
| --- | --- | --- | --- | --- |
| `untitled-pixi-live2d-engine` | 1.4.0 | ✅ peer `^8.13.1` | 2/3/4/5 | **✅ 跑通** |
| `@jannchie/pixi-live2d-display` | 1.4.0 | ✅ peer `^8.0.0` | 3/4 | 未测 |
| `@naari3/pixi-live2d-display` | 1.2.5 | ✅ peer `^8.0.0` | 3/4 | 未测 |
| `guansss/pixi-live2d-display` | 0.4.0 | ❌ peer `^6` | 2/4 | 排除 |
| `pixi-live2d-display-webgal` | 0.5.19 | ❌ peer `^6` | — | 排除 |

推荐 `untitled-pixi-live2d-engine`，理由：MIT、原生 v8 Render Pipe、Texture LOD、
并行动作（上半身换装动作 + 下半身走路）、末帧冻结、自动高精度遮罩。

## 2. 实测数据

```
pixi                8.22.0
engine              1.4.0
Cubism Core         5.1.0
模型加载             99–167 ms  （Haru 1965×4018，2 张 2048 贴图）
渲染               60 帧 / 1158 ms ≈ 52 fps（SwiftShader 软渲染）
像素探测            192/256 采样点不透明 → 确实画出内容
动作 Idle/0         ✅
表情 expression(0)  ✅
并行动作            ✅ parallelMotion([Idle, TapBody])
```

## 3. 接入步骤（已踩过的坑）

```html
<!-- 1. 必须先加载 Cubism Core，用普通 script，不是 module -->
<script src="/live2dcubismcore.min.js"></script>
```

```js
// 2. 三项都从 cubism 子入口取（主入口 index 要求 Cubism 2 runtime）
import { Live2DModel, Live2DPlugin, configureCubismSDK }
  from "untitled-pixi-live2d-engine/cubism";

// 3. 必须在 Application.init() 之前注册插件
extensions.add(Live2DPlugin);
await app.init({ ... });

// 4. 读 getBounds() 可强制完成布局，否则首帧可能是空白
const b = model.getBounds();
```

**四个坑，每一个都会导致静默空白**：

| 坑 | 症状 | 原因 |
| --- | --- | --- |
| 用主入口 `Live2DPlugin` | `Could not find Cubism 2 runtime` | index 入口默认走 Cubism 2 |
| 用主入口 `Live2DModel` | 同上 | 同上 |
| 在 `app.init()` 之后注册插件 | 画面空白 + 一条 deprecation 警告 | v8 的 Render Pipe 必须在 renderer 之前挂 |
| 不读 `getBounds()` | 首帧空白，后续可能恢复 | 布局未触发 |

## 4. 素材链路

```
spec.json ──→ 11 件对位模板 (parts-template-390.png)  ← 已有
     │
     ├─→ ControlNet OpenPose ── 固定骨架，保证 11 件同姿势
     │
     ├─→ LayerDiffusion ────── 直接出透明 PNG（不是白底再抠）
     │
     ├─→ verify.py ─────────── 量测对齐，越界拒收
     │
     └─→ Cubism Editor ─────── 绑骨 / 网格 / 权重（手工，不可自动化）
                │
                └─→ .model3.json ──→ untitled-pixi-live2d-engine
```

### 4.1 11 件清单（取自 `standard-character-plan.md` §3）

| # | slot | z | 层 | 枢轴 |
| --- | --- | ---: | --- | --- |
| 01 | `hair-back` | 10 | back | — |
| 02 | `legs-back` | 15 | back | 胯 |
| 03 | `body` | 20 | mid | 胯 |
| 04 | `arms-back` | 25 | back | 肩 |
| 05 | `outfit` | 30 | mid | 腰 |
| 06 | `arms-front` | 40 | front | 肩 |
| 07 | `head` | 50 | mid | 颈 |
| 08 | `face` | 55 | mid | 颈 |
| 09 | `hair-front` | 60 | front | 头顶 |
| 10 | `acc-head` | 70 | front | 头顶 |
| 11 | `acc-hand` | 45 | front | 手 |

对位图：`spark-output/audit/character-rig/parts-template-390.png`

### 4.2 后端正向调整（解决姿势漂移）

现有 `tools/generate-comfy-assets.mjs` 只用文字 prompt 描述姿势。要加：

| 组件 | 仓库 | 作用 |
| --- | --- | --- |
| `Fannovel16/comfyui_controlnet_aux` | ✅ 存在 | OpenPose/DWPose 预处理 |
| `Kosinkadink/ComfyUI-Advanced-ControlNet` | ✅ 存在 | 精细 ControlNet 调度 |
| `huchenlei/ComfyUI-layerdiffuse` | ✅ 存在 | 透明分层生成 |

做法：**一张固定骨架图 → 所有 11 件都用它做 OpenPose 约束**，
再加固定 seed + 固定 LoRA 强度。这样姿势由骨架图锁死，不再看提示词心情。

## 5. 硬约束（必须让决策者知道）

### 5.1 绑骨不可自动化

Live2D 的 `.model3.json` 包含**变形网格顶点、权重、遮罩顺序、参数绑定**。
这些必须用 **Cubism Editor 的 GUI** 做，没有可靠的开源自动绑骨工具
（我查了 `live2d-auto-rig` 等，均 404 或不存在）。

`docs/spine-integration.md` 对 Spine 说过同样的话：

> Spine 编辑器：导入角色分层图、创建骨骼、绘制权重、制作动作。这是真正的骨骼绑定，必须在这里完成。

**Live2D 同理。**开源库只负责**加载和播放**，不负责**生成模型**。

### 5.2 工作量

| 环节 | 谁做 | 自动化 |
| --- | --- | --- |
| 11 件透明 PNG | ComfyUI + LayerDiffusion | ✅ |
| 对齐校验 | `verify.py` | ✅ |
| **绑骨 + 网格 + 权重** | **Cubism Editor** | ❌ 每套 1–2 天人天 |
| 加载渲染 | `untitled-pixi-live2d-engine` | ✅ |

现有 5 套裙子 × 11 件 = **55 个图层**。按每套 1–2 天算，**2–3 个月**。

### 5.3 许可

- `untitled-pixi-live2d-engine`：MIT ✅
- `live2dcubismcore.min.js`：**Live2D 专有许可**。免费版有营收门槛，
  商用需确认。**不能提交进仓库**（会侵犯分发条款），应在构建时下载或由使用者自备。

## 6. 建议路径

### 阶段一：4 件 × 1 套（1–2 周）

只做 `body` / `outfit` / `head` / `arms-front`，验证：

1. LayerDiffusion 能否出对齐的透明件
2. ControlNet 能否锁死姿势
3. Cubism Editor 绑 4 件的实际耗时
4. 渲染出来的接缝质量

**过了再投 11 件。** 不过就退回程序化（`paper-doll-rig.ts` 的 SVG 配饰已能覆盖）。

### 阶段二：11 件模板化

阶段一验证后，把 11 件做成模板（骨架图 + 每件的 prompt 模板），
新套衣服只填差异件。

## 7. 复现方式

```bash
# demo 目录（临时，未进仓库）
cd /tmp/l2ddemo && npx vite --port 5231
node verify.mjs

# 产出
#   out/report.json        含 ok / model / render 三项实测
#   out/live2d-canvas.png  渲染结果
```

脚本已归档到 `spark-output/audit/live2d-demo/`（`demo-main.js`、`verify.mjs`）。
Cubism Core 与 Haru 模型未入库（许可 + 体积）。

## 8. 参考

- [untitled-pixi-live2d-engine](https://github.com/Untitled-Story/untitled-pixi-live2d-engine)
- [Live2D Cubism SDK for Web](https://www.live2d.com/en/sdk/download/web/)
- [CubismWebSamples](https://github.com/Live2D/CubismWebSamples)
- [LayerDiffusion](https://github.com/layerdiffusion/LayerDiffusion)
- [ComfyUI-layerdiffuse](https://github.com/huchenlei/ComfyUI-layerdiffuse)
- [comfyui_controlnet_aux](https://github.com/Fannovel16/comfyui_controlnet_aux)
- `docs/standard-character-plan.md` §3（11 件 slot 定义）
- `docs/spine-integration.md`（早期 Spine 思路，同为「绑骨必须手工」）
