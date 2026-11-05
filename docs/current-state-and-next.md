# 《雯宝》当前实现与下一步（V5）

> 依据：[产品宪章 V5](./product-charter.md)
> 状态：现行产品是 **WorldApp 换装 / 舞台 / 纸偶 / 幻阁 / 密语**。V2 可走动 Pixi 小世界已归档，见 [archive/](./archive/README.md)。
> **不存在** `src/mobile/world/WorldView.tsx`；**没有** Pixi 运行时。

## 1. 现在是什么

入口：`src/main.tsx` 只挂载 `src/mobile/WorldApp.tsx`。

屏幕状态机：`title` → `lobby` / `wardrobe` / `rig` / `stages` / `pavilion` / `codex` / `chat`。

| 模块 | 位置 | 职责 |
| --- | --- | --- |
| 页面与 HUD | `src/mobile/WorldApp.tsx` | 屏幕路由、试衣镜、衣橱、闯关、幻阁、图鉴、密语、骨骼工坊 UI |
| 衣橱规则 | `src/mobile/world/nikki-wardrobe.ts` | 槽位、单品、套装、闯关、抽卡、升星；路径经 `resolveAsset` |
| 远端资源 | `src/mobile/world/remote-assets.ts` | `VITE_ASSET_BASE_URL` → `/files/{cat}/…`；空 env 回退本地相对路径 |
| 角色皮肤 | `src/mobile/world/skins.ts` | original / maid 帧表（760 画布）；经 `resolveAsset` |
| 纸偶叠加与抠图 | `src/mobile/world/paper-doll-rig.ts` | SVG 可穿戴叠加、`loadCutoutImage` 洪水填充抠图 |
| 骨骼系统 | `src/mobile/world/skeleton-system.ts` | 人体关节 FK、切片预览、动画片段、工坊标定 |
| 羁绊 / 陪伴动作 | `src/mobile/world/codex.ts`、`useWorldGame.ts` | bond 等级；`companionAct`（摸摸头等）写入世界存档 |
| 密语桥 | `src/mobile/world/companion-bridge.ts` | 探活与聊天；房间名等上下文仍读 `rooms.ts` |
| 存档 | `src/mobile/engine/storage.ts` | 世界 / bond 存档规范化 |
| 网关 | `server/ollama-gateway.py`、`netlify/functions/companion-scene.mjs` | 局域网 / 线上陪伴代理 |

历史 V2 模块（房间走动、碰撞、`assets.ts` 道具图映射、`poses`/`runtime` 等）若仍留在树中，**不是**当前 UI 主路径；清理见开发债清单。

## 2. 资源库（现行）

- 环境变量：`.env` / `.env.example` 中 `VITE_ASSET_BASE_URL=http://192.168.124.77:8788`。
- 解析器：`src/mobile/world/remote-assets.ts`（`mapLocalAsset` / `resolveAsset` / `isComfyDressSource`）。
- 分类：`dress` / `part` / `card` / `icon` / `base` / `ui` / `world`。管理页：同主机 `:8788`。
- 仓库 `public/assets/characters|nikki|scenes` **仍保留**作本地回退（env 为空时）。**尚未**实现图片加载失败的 onerror 自动切回本地。
- 对照表：`public/assets/manifest.json`。
- 三张 Comfy 主装扮目前仍为不透明 512×640；运行时对 `dress-*` 走洪水填充抠图。离线透明 760 规格资产是后续项，不是现状。

## 3. 已实现

- 五槽衣橱、套装共鸣、主题闯关评级、星愿幻阁抽卡与升星。
- 试衣镜：皮肤呼吸帧或 Comfy 套装抠图 + SVG 配件叠加；骨骼工坊可拖关节。
- 密语：同源 companion 函数 → 局域网 Ollama，失败离线回复。
- 本地衣橱存档键迁移（v4/v6 → v8）。
- 远端资源优先解析（需重启 dev 以读取 `.env`）。

## 4. 差距与下一步（优先序）

1. 文档与死代码岛清理（本轮）：对齐宪章、卸未用依赖、删无引用模块、合并骨骼锚点。
2. 运行时验证后再考虑是否删本地 `public/assets` 副本；先补加载失败回退更稳妥。
3. Comfy 套装离线抠成透明图并贴近 760 脚底规格，减少每次洪水填充。
4. 真机竖屏回归；可选评估 Live2D/Spine（调研见对应文档，**非当前运行时**）。
5. `main` 分支仍停留在桌面宠物入口时，合并策略与产品发布另议（本机以 `featurle/xinzhi_feat` 为准）。

## 5. 验证

```bash
npx tsc --noEmit
npm run test:mobile
npm run build
```

Node ≥ 22.6（见 `package.json` `engines`）。