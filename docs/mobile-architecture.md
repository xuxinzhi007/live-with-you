# 移动版结构与扩展约定（V5）

> 现行入口：`src/main.tsx` → `src/mobile/WorldApp.tsx`。
> **没有** `WorldView.tsx`，**没有** Pixi 运行时。V2 Pixi 小世界模块表见 [archive/mobile-architecture-v2-pixi-world.md](./archive/mobile-architecture-v2-pixi-world.md)。

手机竖屏是唯一主线。玩家在试衣镜与舞台上换装、闯关、抽卡与密语。

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `src/mobile/WorldApp.tsx` | 屏幕状态机、HUD、试衣镜、衣橱、闯关、幻阁、图鉴、密语、骨骼工坊 UI |
| `src/mobile/world/nikki-wardrobe.ts` | 衣橱数据与规则；导出路径经 `resolveAsset` |
| `src/mobile/world/remote-assets.ts` | 远端 / 本地资源 URL 解析 |
| `src/mobile/world/skins.ts` | 角色皮肤帧表 |
| `src/mobile/world/paper-doll-rig.ts` | SVG 可穿戴叠加、`loadCutoutImage` |
| `src/mobile/world/skeleton-system.ts` | 关节 FK、切片、动画、（合并后的）插槽锚点 |
| `src/mobile/world/useWorldGame.ts` | 世界存档钩子；UI 使用 `state` / `setSkin` / `companionAct` |
| `src/mobile/world/codex.ts` | bond 与陪伴动作等纯函数 |
| `src/mobile/world/companion-bridge.ts` | 密语探活与发送 |
| `src/mobile/world/rooms.ts` | 房间元数据（密语上下文等仍引用） |
| `src/mobile/world/state.ts` / `actions.ts` | 世界状态与动作结算（bond 路径仍用；走动 UI 已非主线） |
| `src/mobile/engine/storage.ts` / `types.ts` | 存档与类型 |

规则模块避免写 DOM；`WorldApp` 避免内联复制衣橱数值规则。

## 资源约定

- `VITE_ASSET_BASE_URL`：非空则 `resolveAsset` 指向小主机 `/files/...`；空字符串则本地 `public` 路径。
- 分类映射见 `remote-assets.ts` 与 `public/assets/manifest.json`。
- 可穿戴**舞台叠加**以 `paper-doll-rig.ts` 内 SVG 为准；图鉴卡面可用 `nikki/item-*.png`。
- Comfy `dress-*` 仍可能不透明；`isComfyDressSource` 识别 `assets/nikki/dress-` 与 `/files/dress/`。

## 角色皮肤

- id：`original`（默认）、`maid`。
- 帧规格：`760×760`，脚底 y=748（`tools/character/spec.json`）。
- 现行 UI 主要用 `idle` / `breathe*` / `react` / `avatar`；`walk` / `sit` / `sleep` 仍在资源表中但非 V5 主路径。

## 存档

- 衣橱：`wenbebi-nikki-wardrobe-v8`（兼容读取 v6/v4）。
- 世界 / bond：既有 `wenbebi-mobile-game-v2` 键路径，经 `normalizeGameState`。
- 新增字段只补默认值，不删旧键。

## 验证

```bash
npx tsc --noEmit
npm run test:mobile
npm run build
```