# live2d-bootstrap 决定

- 级别：L2（构建/生成链路增强；不改运行时渲染逻辑，不碰存档契约）

- 真正要解决的问题：
  1. `live2dcubismcore.min.js` 是 Live2D 专有"Redistributable Code"，
     提交进公开仓库违反再分发条款。需要**构建期下载**规避，且用户**跨多台电脑开发**，
     下载脚本必须通用、幂等、可手动触发。
  2. `tools/generate-comfy-assets.mjs` 出图姿势漂移（无 ControlNet），
     且产物是白底整图（无 LayerDiffusion）。需要加这两层支持，
     让 11 件透明分件 + 固定骨架姿势成为可能。

- 怎样算满足：
  1. 有一条命令能下载/校验 Cubism Core，不依赖特定机器。
  2. `npm run dev` / `npm run build` 在 Core 缺失时给出**明确提示**而非静默失败。
  3. `generate-comfy-assets.mjs` 支持可选的 ControlNet（姿势约束）与
     LayerDiffusion（透明分层）参数；不传时行为与现在一致（不破坏现有流程）。
  4. 两台不同电脑执行同一命令，结果一致（幂等）。

## 现有边界

| 边界 | 管什么 | 证据 |
| --- | --- | --- |
| `package.json` scripts | dev/build/test/gen:comfy | 已证实 |
| `tools/generate-comfy-assets.mjs` | ComfyUI 出图（白底整图，无 ControlNet） | 已证实 |
| `.gitignore` | 无 cubism/live2d 相关条目 | 已证实 |
| `docs/live2d-11-parts-research.md` §3 | 接入步骤 + 4 个坑 | 已证实 |
| `docs/live2d-11-parts-research.md` §4.2 | 需装的 ControlNet / LayerDiffusion 仓库 | 已证实 |

- 无出处的词：无。

- 旧决定：无卡片。实现是否仍符合：无旧决定。

## 关键事实（已证实）

1. Cubism Core 下载地址稳定：`https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js`
   （207KB，HTTP 200，带 Live2D 专有许可头）。
2. 用户是 **General User**（个人项目、无售卖、销售额 < 1000 万日元），
   免费使用合法；唯一红线是**再分发**（提交进仓库）。
3. `untitled-pixi-live2d-engine` 的 `cubism` 子入口在**运行时**检测
   `window.Live2DCubismCore`，缺失则抛 `Could not find Cubism runtime`。
4. 现有 `generate-comfy-assets.mjs` 的 workflow JSON 是**硬编码**的
   KSampler 链，无 ControlNet 节点、无 LayerDiffusion 节点。

## 最小充分方案

### A. `tools/fetch-cubism-core.mjs`

- 下载到 `public/vendor/live2dcubismcore.min.js`（gitignore 排除）。
- **幂等**：已存在且非空则跳过；`--force` 强制重下。
- **校验**：HTTP 200 + 内容含 `Live2DCubismCore` 字样 + 大小 > 100KB。
- **失败给明确提示**：网络错/许可文件变了，告诉用户手动下载放哪。
- 不自动挂 `postinstall`（避免污染 `npm i`）；提供 `npm run setup:live2d` 手动触发。

### B. `index.html` 条件加载 Core

- 用 `<script src="/vendor/live2dcubismcore.min.js">` 加载；
  加载失败（`onerror`）在控制台打一条**可操作**的提示（跑哪条命令）。
- 不阻断页面：Core 缺失时 Live2D 功能不可用，但其他功能（换装闯关）正常。

### C. `tools/generate-comfy-assets.mjs` 加可选节点

- 读环境变量 `COMFY_CONTROLNET=openpose|dwpose|none`（默认 none，不破坏现状）。
- 读 `COMFY_LAYERDIFFUSE=1`（默认关）。
- 当开启时，在 workflow JSON 里**动态插入**对应节点；不开启则与现在完全一致。
- 节点参数（模型名、强度）从环境变量读，给默认值，写清注释。

## 为什么更小的做法不够

- 只写下载脚本不接入 `index.html`：Core 下到了但页面没加载，等于白下。
- 只改 `index.html` 不写下载脚本：新机器上用户不知道去哪下、放哪。
- 直接重写 `generate-comfy-assets.mjs` 强制开 ControlNet：破坏现有可跑的流程，
  且用户 ComfyUI 可能没装对应插件。

## 相关的债

- **A 现在偿还**：`.gitignore` 缺 cubism 条目，本次补上。
- **B 局部偿还**：`generate-comfy-assets.mjs` 的 workflow 是硬编码 JSON，
  本次只加"可选插入节点"能力，不重构成模板系统。
- **C 暂缓**：真实 11 件生成（需 ComfyUI 环境 + 装插件 + 试参数）。
- **D 不能带过**：无。

## 这次不做

- 不改 `src/` 下任何渲染代码。
- 不自动生成 11 件素材（需 ComfyUI 起服务 + 装插件）。
- 不写 Live2D 模型组装（需 Cubism Editor）。
- 不强制开 ControlNet / LayerDiffusion（默认关，向后兼容）。
- 不动 `skeleton-system.ts` / `paper-doll-rig.ts`。

## 风险

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| Live2D 改下载地址 | 脚本失效 | 失败时提示手动下载；脚本里写死备用 CDN |
| 用户 ComfyUI 没装 ControlNet 插件 | 生成报错 | 脚本先 `GET /object_info` 探测，缺插件则回退并提示 |
| 多电脑路径不一致 | Core 找不到 | 统一放 `public/vendor/`，相对仓库根，与机器无关 |
| Core 加载失败阻断页面 | 整个应用挂 | `onerror` 只打日志，不 throw |

- 不碰存档契约、权限、状态机。构建链路改动可回滚（删脚本即还原）。
