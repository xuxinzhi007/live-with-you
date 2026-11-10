# live2d-bootstrap 核对

## 跑了什么

```
$ node tools/fetch-cubism-core.mjs
OK   下载完成 public/vendor/live2dcubismcore.min.js (207155 bytes)
exit 0

$ node tools/fetch-cubism-core.mjs   # 再跑一次（幂等）
SKIP 已存在且有效 public/vendor/live2dcubismcore.min.js (207155 bytes)
exit 0

$ node --check tools/generate-comfy-assets.mjs && node --check tools/fetch-cubism-core.mjs
syntax OK

$ npm run test:mobile
tests 9 / pass 9 / fail 0
exit 0

$ npx tsc --noEmit
exit 0
```

## graph 构建逻辑验证（不连 ComfyUI）

| 场景 | KSampler.positive | SaveImage.images | 新增节点 |
| --- | --- | --- | --- |
| 默认（无参数） | `["6",0]`（原 positive） | `["8",0]`（原 VAE） | 无 |
| `COMFY_CONTROLNET=openpose` + 骨架图 | `["23",0]`（ControlNet 输出） | `["8",0]` | LoadImage / OpenposePreprocessor / ControlNetLoader / ControlNetApply |
| `COMFY_LAYERDIFFUSE=1` | `["6",0]` | `["30",0]`（LayerDiffuse 输出） | LayerDiffuseApply |
| 全开 | `["23",0]` | `["30",0]` | 上述全部 |

默认路径与改动前**完全一致**，向后兼容。

## 验收条件

| # | 条件（来自 decision.md） | 结果 |
| --- | --- | --- |
| 1 | 一条命令下载/校验 Core，跨机器通用 | 达到。`npm run setup:live2d`，幂等，双 CDN 回退 |
| 2 | Core 缺失时明确提示 | 达到。`index.html` 的 `onerror` 打控制台警告 + 下载命令 |
| 3 | generate 支持可选 ControlNet / LayerDiffusion | 达到。环境变量开关，默认关，graph 逻辑已验证 |
| 4 | 两台电脑结果一致 | 达到。产物在 `public/vendor/`（相对仓库根），与机器无关 |

## 新增/改动文件

| 文件 | 说明 |
| --- | --- |
| `tools/fetch-cubism-core.mjs`（新增） | 下载 + 校验 + 幂等 + 手动回退提示 |
| `index.html`（改） | 条件加载 Core，缺失不阻断页面 |
| `.gitignore`（改） | 排除 `public/vendor/live2dcubismcore.min.js` |
| `package.json`（改） | 加 `setup:live2d` script |
| `tools/generate-comfy-assets.mjs`（改） | 加可选 ControlNet / LayerDiffusion 节点 |

## 跨机器使用说明（写给未来的自己/同事）

```bash
# 新机器上第一次：
git clone <repo>
npm install
npm run setup:live2d        # 下载 Cubism Core 到 public/vendor/（gitignore 排除）

# 日常开发（Core 已在）：
npm run dev                 # 正常跑，Live2D 功能可用

# Core 被删/换了机器：
npm run setup:live2d        # 幂等，已存在则跳过

# 生成素材（可选增强）：
COMFY_CONTROLNET=openpose COMFY_CONTROLNET_IMAGE=pose.png npm run gen:comfy
COMFY_LAYERDIFFUSE=1 npm run gen:comfy
```

**后续运行是否需要 Core？**
- **不需要**：`index.html` 里 Core 是异步加载的，`onerror` 只打警告。
  没有 Core 时，换装/闯关/其他功能全部正常，只是 Live2D 渲染不可用。
- **需要的情况**：只有当你要渲染 `.model3.json` 模型时（即接入 Live2D 后）。

## diff 有没有超出 decision.md

没有。`src/` 零改动，未装 ControlNet / LayerDiffuse 插件（需 ComfyUI 环境），
未生成真实素材，未动 `skeleton-system.ts` / `paper-doll-rig.ts`。

## 遗留

1. **LayerDiffuse 节点参数未校准**：`ComfyUI-layerdiffuse` 插件版本差异大，
   `LayerDiffuseApply` 的具体参数需按 `/object_info` 实测调整。当前给最小形态。
2. **ControlNet 预处理器节点名**：`OpenposePreprocessor` / `DWPreprocessor`
   是 `comfyui_controlnet_aux` 的约定，若插件版本不同需改。
3. **骨架图未生成**：`COMFY_CONTROLNET_IMAGE` 需要一张 OpenPose 格式的骨架图，
   可用 `tools/character/make-rig-templates.py` 的骨架 + OpenPose 预处理生成。
4. **Core 未入库**：`public/vendor/` 被 gitignore，新机器需跑 `setup:live2d`。
   这是刻意的——规避 Live2D 再分发条款。
