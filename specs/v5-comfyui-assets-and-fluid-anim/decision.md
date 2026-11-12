# v5-comfyui-assets-and-fluid-anim 决定

> 落 `specs/v5-comfyui-assets-and-fluid-anim/decision.md`。规则在 `references/scope.md`。

- 级别：L2（打通本地 ComfyUI `meinamix_v12Final.safetensors` 动漫美术资产自动生成管线 + 彻底告别 Emoji 图标与生硬静态页，升级为全插画卡片与电影级丝滑微交互动效 + 更新 `README.md`）
- 真正要解决的问题：
  1. **现有衣橱卡片全靠系统 Emoji 充数（🌼、🍵、🍰、🔥），看着像 AI 随便生成的廉价网页，且第 3 排底部卡片标签仍被容器裁切**：
     - 真机截图 `image-004624ba` 显示：「清晨草木微风」「焦糖暖阳烘焙香」底部的属性标签又被 `.nk-panel` 切掉了一半！
     - 除两张旧立绘外，其它礼服（杏仁奶昔裙、暮色蔷薇礼服、星河眠云纱裙）和配饰/心境羁绊卡全都没有真正的动漫美术图，只是用 `hue-rotate` 滤镜或 Emoji 硬凑。
  2. **缺乏真正的游戏级丝滑动画与交互反馈（生硬、死板）**：
     - 换装时图片直接瞬切，没有**换装闪光魔法阵 / 丝滑渐变过渡 / 立绘呼吸浮动 / 舞台视差飘落花瓣**。
     - 搭配对决（PK）点一下直接蹦出一个死板的静态结算框，没有**《奇迹暖暖》标志性的「舞台走秀灯光 → 五维进度条动态暴涨跳字 → 技能弹幕飞入 → 印章重重盖下」**的爽快演出动画！
  3. **本地现成的 ComfyUI（`http://127.0.0.1:8188`，已安装 `meinamix_v12Final.safetensors`）未被本仓库利用**：
     - 用户已跑起 ComfyUI 8188 端口与 `moe_social/backend`（8888 端口），需要将这套 `meinamix_v12Final.safetensors`（CLIP Skip -2，`dpmpp_2m` + `karras`）文生图流水线固化到 `tools/generate-comfy-assets.mjs` 并实打实生成一批高质量二次元礼服立绘、羁绊卡插画与配饰图标写入 `public/assets/nikki/`，同时更新 `README.md`。

- 怎样算满足：
  1. **实装本地 ComfyUI (`meinamix_v12Final.safetensors`) 美术资产生成脚本并生成全套真插画**：
     - 新增 `tools/generate-comfy-assets.mjs`（完全复刻 `moe_social/backend/internal/biz/media/comfy.go` 的 `realisticGraph` 节点结构：`CheckpointLoaderSimple: meinamix_v12Final.safetensors` → `CLIPSetLastLayer: -2` → `KSampler: dpmpp_2m + karras` → 自动转为高清 `.webp` 存入 `public/assets/nikki/`）。
     - 立即调用本地 `http://127.0.0.1:8188` 实打实生成核心动漫插画资产（含 **3 套新礼服角色插画**：杏仁奶昔针织裙、暮色蔷薇圆舞曲、星河眠云轻纱裙；**5 张唯美心境羁绊卡插画 CG**；以及核心配饰插画），彻底替换掉廉价 Emoji！
     - 在前端内置 **「🎨 AI 灵感工坊（实时连接本地 ComfyUI 生图）」**：玩家在游戏里也能直接输入描述或点一键生成，调用本地 ComfyUI 为雯宝实时定制新立绘/背景！
  2. **彻底重构丝滑动画与动效交互（消除“AI 生成模板感”）**：
     - **换装魔法过渡动效**：切换服装/配饰时触发**鎏金光环扩散 + 立绘柔光交叉淡入淡出 + 弹簧缩放反馈（Spring Physics）**。
     - **动态PK走秀演出**：点击「开始PK」不再直接弹死板结果，而是进入 **1.8 秒动态走秀计分演出（各维度分数从 0 飞速滚动飙升、技能光效飞入、最后 `SSS` 金印砸下震屏）**。
     - **彻底修复衣橱卡片底部标签裁切**：优化 `.nk-card` 与 `.nk-panel` 弹性高度，卡片采用「全幅插画底图 + 底部毛玻璃渐变铭牌（类似《闪耀暖暖》卡牌样式）」，绝不裁切任何文字。
  3. **更新 `README.md`**：完整记录 V5 奇迹暖暖式玩法架构、本地 ComfyUI (`D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable` / `8188`) 与 `moe_social/backend` (`8888`) 美术生成管线用法。
  4. `npm run test:mobile` 与 `npm run build` 100% 通过。

- 最小充分方案：
  1. 已拍板：按上述方案（1.立即调用你本机已启动的 ComfyUI `meinamix_v12Final` 生成全套礼服/羁绊卡真动漫插画 2.卡片升级为全幅插画毛玻璃卡面并修复底部裁切 3.加入换装魔法闪光动画与 PK 动态跳分走秀演出 4.更新 README）执行。

- 风险：本机 ComfyUI 生成动漫插画约需 30~60 秒 GPU 时间，生成后直接固化进 `public/assets/nikki/`。
