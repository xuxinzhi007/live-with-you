# Agent A —— 资产管线

独占文件：`tools/generate-comfy-assets.mjs`、`tools/audit/asset-audit.mjs`、`src/mobile/world/../../package.json` 的 scripts 段
禁止碰：`src/**` 任何文件

## 已证实的事实（不要重新验证，直接用）

1. `public/assets/nikki/` 下 25 张 PNG，IHDR color type 全部 = 2（RGB，**无 alpha**）。
2. 尺寸：dress/card 512×640，item 512×512。
3. 所谓"抠图"是运行时 `paper-doll-rig.ts:loadCutoutImage` 的洪水填充，不是资产自带透明。
4. 存在**生成失败但被接收**的资产，例如 `item-plush-bunny.png` 实际内容为四团白色椭圆，不是兔子。
5. `tools/generate-comfy-assets.mjs` 里已有 `LAYERDIFFUSE` 开关（约 393 行），但节点参数是猜测值，未校准。

## 任务

### 1. 分辨率
把每个 job 的 width/height 提到现代模型原生能力。倾向 1024×1280（dress/card）、1024×1024（item）。在文件顶部注释写清为什么升。

### 2. 输出带 alpha
两条路线，按本机实际能力选一条，**不要猜节点名**：

- 路线 1：用 ComfyUI 的原生 alpha 输出（Qwen-Image 系列 VAE 是四通道）。先 `curl http://127.0.0.1:8188/object_info` 看真实节点清单再写图。
- 路线 2：若本机只有 Meinamix（SD1.5 三通道），则保持生成纯色背景，然后写 `tools/postprocess-alpha.mjs` 做独立后处理生成 alpha。

不管哪条，脚本必须：
- 明确打印走了哪条路线。
- ComfyUI 不可达时给清晰错误并非 0 退出，不要静默。

### 3. 生成后验收（这是重点）
新增 `tools/audit/asset-audit.mjs`，扫描 `public/assets/nikki/*`，输出表格：文件名、尺寸、是否带 alpha、透明像素占比、非透明像素占比。

判定规则：
- 无 alpha → 异常（打印 FAIL）
- 全透明或接近全透明（>99%）→ 异常
- 尺寸低于阈值 → 异常
- 有任何异常时 exit 1

这个脚本要能抓出 `item-plush-bunny.png` 这类问题——虽然它无法判断"画错了"，但至少能把"没有透明通道"这个结构问题拦下来。

### 4. package.json
在 `scripts` 加 `"audit:assets": "node tools/audit/asset-audit.mjs"`。不要动其他依赖。

## 硬约束

- 不要真的调用 ComfyUI 跑生成（本机不一定开着）。
- 不要改 `src/` 下任何文件。
- 保留现有代码风格：script 风格、少注释。
- 改完 `node --check tools/generate-comfy-assets.mjs` 必须过。

## 交付
把 `node tools/audit/asset-audit.mjs` 的实际输出贴进 `specs/direction-realign/agent-a.md`，并写明你选了哪条 alpha 路线、为什么。
