# 雯宝 · 高定衣橱与心境物语（V5）

一款竖屏二次元**换装搭配闯关 + 心境羁绊卡牌收集 + AI 实时陪伴**手游（React + TypeScript + Vite）。

---

## 1. 核心玩法（《奇迹暖暖 / 闪耀暖暖》式卡牌换装架构）

- **👗 高定衣橱（5 大槽位 · 27 件全插画单品）**：
  - 包含 **主装扮（`dress`）、头饰（`hairAcc`）、手持物（`handheld`）、香氛光环（`aura`）、心境羁绊卡（`memoryCard`）** 五大槽位。
  - 每件单品与卡牌均配有由本地 ComfyUI（`meinamix_v12Final.safetensors`）生成的**全幅二次元动漫原画卡面**，彻底告别廉价 Emoji 占位符。
  - 支持消耗礼券对已拥有单品进行 **⭐ 升星强化（`★1 → ★5`，每升 1 星全属性 +15%）**，或对未解锁单品进行 **🔨 工坊定制**。
- **👑 主题搭配闯关（6 大章节 · 舞台技能 PK · `C / B / A / S / SS / SSS` 评级）**：
  - 每个章节有专属剧情、对手分数线（如 `邻家学姐·苏苏`、`星夜女王·艾莉`）以及主副考核风格（**甜美 / 优雅 / 清纯 / 温暖 / 清凉**）。
  - 支持携带 2 项主动舞台技能（`😊 暖暖微笑`、`💖 迷人飞吻`、`🛡️ 优雅气场`、`✨ 星光绽放`），结合**心境羁绊卡被动加成**与**4 大典藏套装共鸣加成**，触发动态走秀滚分演出与金色评级印章。
- **✨ 星愿幻阁 & 🎨 本地 ComfyUI 实时动漫裁缝铺**：
  - 支持单抽与 **五连保底抽卡（必出 SR 或 SSR 典藏单品，重复单品自动升星）**。
  - 内置 **「本地 ComfyUI 动漫裁缝铺」**：开发或游玩时可直接输入提示词，实时调用本机 ComfyUI 为任意服饰/羁绊卡重绘专属二次元卡面！
- **💬 雯宝密语（Ollama 小主机陪伴 + 离线回退）**：
  - 通过同源 `/.netlify/functions/companion-scene` 连接局域网 Ollama 模型，离线时自动回退到本地高情商陪伴对话。

---

## 2. 本地运行与开发

```bash
npm install
npm run dev
```

手机或安卓模拟器处于同一局域网时，可使用：

```bash
npm run dev:lan
```

验证测试与生产构建：

```bash
npm run test:mobile
npm run build
```

---

## 3. 本地 ComfyUI 动漫美术资产生成管线

本项目的所有服饰原画、心境羁绊卡 CG 与配饰插画均通过本机 **ComfyUI** 自动生成，无需手工抠图或找外部素材。

### 3.1 环境与目录约定

- **本机 ComfyUI 便携版路径**：`D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable`
- **ComfyUI 默认监听地址**：`http://127.0.0.1:8188`
- **推荐二次元大模型（Checkpoint）**：`meinamix_v12Final.safetensors`（采样器：`dpmpp_2m`，调度器：`karras`，`CLIPSetLastLayer: -2`）
- **雯宝同角色专属 LoRA**：`xiaoyan.safetensors`（模型强度 `0.80`，CLIP 强度 `0.80`，正向触发词：`xiaoyan, chibi, full body, solo, 1girl, black hair, short hair, bob cut, bangs, brown eyes`）
- **新建的 ComfyUI 换装抠图工作流（不改动原工作流）**：
  `D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\user\default\workflows\MeinaMix_雯宝LoRA_换装抠图.json`
- **关联后端服务参考**：`C:\Users\ZhuanZ1\Desktop\moe_social\backend`（`POST http://127.0.0.1:8888/api/images/generate`，实现在 `internal/biz/media/comfy.go`）

### 3.2 2D 纸偶骨骼多层穿戴（Paper-Doll Rig）与自动透明抠图

- **四边连通域洪水填充抠图（`src/mobile/world/paper-doll-rig.ts:loadCutoutImage`）**：
  - 自动采样立绘与配饰图四周边框背景色，从四周向内做 BFS 连通域洪水填充，将外部纯白/浅色背景抠为 100% 透明，同时完整保留被轮廓线包裹的白色连衣裙与肤色，并对边缘做 1px 消白边柔化。
- **多层骨骼锚点穿戴与手动微调**：
  - 舞台中央的雯宝采用 4 层骨骼挂载：`Layer 10`（背后香氛光环 `aura`）、`Layer 20`（同角色透明抠图主躯干 `dress`）、`Layer 30`（头顶骨骼锚点 `hairAcc`）、`Layer 40`（手部骨骼锚点 `handheld`）。
  - 点击舞台右下角 **「🔧 调饰品位置」** 或直接点雯宝身上的头饰/手持物，即可通过滑块实时微调 `水平 X / 垂直 Y / 大小 / 角度` 并自动持久化保存。

### 3.2 一键批量生成 / 重新生成全套衣橱动漫原画

确保本机 ComfyUI (`127.0.0.1:8188`) 已启动后，在仓库根目录运行：

```bash
# 仅补齐缺失的插画资产（输出至 public/assets/nikki/*.png）
node tools/generate-comfy-assets.mjs

# 强制重新生成全部 25 张二次元礼服、羁绊卡 CG 与配饰原画
FORCE_REGEN=1 node tools/generate-comfy-assets.mjs
```

### 3.3 游戏内实时调用 ComfyUI 重绘卡面

在 `npm run dev` 开发模式下，`vite.config.ts` 已内置 `/api/comfy/draw` 本地代理中间件：
1. 打开游戏底部导航 **「✨ 星愿幻阁」**；
2. 滑到底部 **「🎨 本地 ComfyUI 动漫裁缝铺」**；
3. 输入画面描述并点击 **「✨ AI重绘」**，即可调用本机 `127.0.0.1:8188` 实时生成新卡面并应用到当前选中的单品上。
