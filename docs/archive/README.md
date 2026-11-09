# docs/archive — 历史文档

本目录存放**不再代表当前运行时产品**的设计与调研材料。

## 当前产品（勿与本目录混淆）

- 入口：`src/main.tsx` → `src/mobile/WorldApp.tsx`
- 形态：竖屏换装搭配闯关 + 心境卡收集 + 星愿幻阁抽卡 + AI 密语（V5）
- 渲染：React DOM + CSS（纸偶叠加 / 骨骼工坊），**没有** `WorldView.tsx`，**没有** Pixi 运行时
- 有约束力的现行文档：仓库根目录 `docs/product-charter.md`、`docs/game-direction.md`、`docs/current-state-and-next.md`、`docs/mobile-architecture.md`，以及 `README.md`

## 本目录内容

| 文件 | 原定位 |
| --- | --- |
| `product-charter-v2-walkable-world.md` | V2「可走动小世界 / 禁抽卡」产品宪章全文 |
| `game-direction-v2-walkable-world.md` | V2 方向摘要 |
| `current-state-v2-walkable-world.md` | V2 实现现状（曾声称存在 Pixi `WorldView.tsx`） |
| `mobile-architecture-v2-pixi-world.md` | V2 模块表（WorldView / runtime / poses / assets） |
| `mobile-portrait-layout-research.md` | 更早的观察向竖屏布局调研 |
| `mobile-scene-scale-research.md` | 场景尺度 / Pixi 候选调研 |
| `multiplayer-portrait-scene-design.md` | 多人竖屏场景设计 |
| `feedback-backlog.md` | 可走动小屋的体验台账（镜头、家具、下雨） |
| `mobile-app-strategy-research.md` | 2026-10-20 桌面宠物如何包成 App |
| `pixel-furniture-plan.md` | 像素家具与旧 sprite 替换方案（原仓库根 `plan.md`） |
| `styles-mobile.css` | 未被任何页面引用的旧竖屏样式 |

冲突时以现行 `docs/*.md` 与运行时代码为准，不以本目录为准。