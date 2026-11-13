# 雯宝 · 高定衣橱与心境物语（V5）

一款竖屏二次元**换装搭配闯关 + 心境羁绊卡牌收集 + AI 实时陪伴**手游（React 19 + TypeScript + Vite，纯 DOM/CSS，无 Pixi）。

- 游戏入口：`src/main.tsx` → `src/mobile/WorldApp.tsx`
- **先读**：[docs/现行状态.md](./docs/现行状态.md)（做到哪、链路闭环、待拍板）
- 文档地图：[docs/README.md](./docs/README.md)（现行 / 调研 / 归档三层）

---

## 1. 核心玩法

- **高定衣橱（5 槽位 · 27 件插画单品）**：主装扮、头饰、手持、香氛光环、心境羁绊卡。支持礼券升星（★1→★5，每星全属性 +15%）与未解锁单品的工坊定制。
- **主题搭配闯关（6 章 · 舞台技能 PK · C/B/A/S/SS/SSS）**：主副考核风格、对手分数线、2 项主动技能、羁绊卡被动与套装共鸣；结算发礼券、解锁下一章。
- **星愿幻阁**：单抽 5 券 / 五连 20 券（五连保底 SR+，重复自动升星），可切换衣服 / 配饰 / 羁绊分类。
- **骨骼工坊**：11 根锥形骨骼、6 部位蒙皮、Setup 对位 + Pose 摆姿，每套衣服独立骨骼树，随衣橱存档。
- **小世界**：三场景切换 + 14 个可交互物件 + 花圃种植（只画房间与道具，不画角色）。
- **密语（AI 陪伴）**：同源 `/.netlify/functions/companion-scene` 连局域网 Ollama，失败回退本地台词。**当前没有导航入口**，见现行状态 §3。

底部导航：大厅 / 小世界 / 衣橱 / 闯关 / 幻阁 / 图鉴（6 项）。

---

## 2. 本地运行

```bash
npm install
npm run dev          # http://127.0.0.1:5173/
npm run dev:lan      # 同局域网手机/模拟器访问
```

验证：

```bash
npx tsc --noEmit
npm test             # test:unit(vitest) + test:mobile(node --test)
npm run build
node tools/audit/docs-links.mjs --verify-claims
```

Node ≥ 22.6（`package.json` 的 `engines`）。

### 2.1 入口与资源

- **默认只用本仓库 `public/assets`**：`VITE_ASSET_BASE_URL` 留空时 `resolveAsset` 直接返回本地路径。
- 显式配置非空地址（如 `http://192.168.124.77:8788`）且探活成功后，才映射到 `/files/{dress|part|card|base|ui|world}/…`。
- 映射逻辑：`src/mobile/world/remote-assets.ts`；路径对照：`public/assets/manifest.json`。
- 图片加载失败的 onError 回退**尚未接到角色 `<img>`**（helper 已有、无人调用）。
- 改 `.env` 后必须重启 Vite。

---

## 3. 出图与美术资产

正式出图锁 **母图 + Qwen-Image-Edit-2509 Q4**，详情见 [docs/资产管线.md](./docs/资产管线.md) 与 [docs/comfy-official-qwen/execution-design.md](./docs/comfy-official-qwen/execution-design.md)。

- 母图：`tools/wenbao-assets/official/Wenbao_redraw_00001_.png`
- ComfyUI：`http://127.0.0.1:8188`（8GB 显存，Q4 + Lightning 8 步）
- 去底 `isnet-anime` → 760×760 RGBA、脚底 y≈748、中心 x≈380
- 旧 MeinaMix 线与角色 LoRA 已归档，禁止用于正式出图；本地脚本 `tools/generate-comfy-assets.mjs` 属旧线，不再产出正式资产。

### 3.1 纸偶与抠图

- 四边连通域洪水填充（`src/mobile/world/paper-doll-rig.ts` 的 `loadCutoutImage`）只用于仓库里不透明的 Comfy 整身图；正式交付资产必须是带 alpha 的透明图，不再二次抠图。
- 舞台叠加 4 层：光环（torso）→ 主躯干（dress）→ 头饰（头部骨骼）→ 手持（手部骨骼）；点「🔧 调饰品位置」用滑块微调并持久化。

### 3.2 游戏内实时重绘（**仅开发环境**）

`npm run dev` 时 `vite.config.ts` 提供 `/api/comfy/draw`：星愿幻阁 → 裁缝铺 → 输入描述 → 绘制。
生产环境没有对应 Netlify Function，点击会 404；生成图以 dataURL 存进 `localStorage`，有配额风险。见 [docs/服务端接线.md](./docs/服务端接线.md)。

---

## 4. 目录速览

```
src/mobile/
  WorldApp.tsx        屏幕路由 + 舞台 + 全部 handler（1705 行）
  store/              6 个分层 hook（screen/ui/nikki/rig/pavilion/chat）
  screens/            衣橱 / 闯关 / 图鉴 / 密语 四个独立屏
  world/              换装·骨骼·纸偶·动作·陪伴·资源解析（纯函数为主）
  engine/             存档与类型
public/assets/        本地资源（characters / nikki / scenes）
tools/                出图、抠图、校验脚本；audit/docs-links.mjs 文档体检
docs/                 现行 / 调研 / 归档
```

架构分层、依赖方向、数据模型与技术债见 [docs/architecture-map.md](./docs/architecture-map.md)。
