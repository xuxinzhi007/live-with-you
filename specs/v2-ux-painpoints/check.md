# v2-ux-painpoints 核对

## 跑了什么

```text
exit 0
cmd npm run test:mobile && npm run build
```

- `npm run test:mobile`：`pass 25 / fail 0`（含新增的远距离点击物件自动走近触发、收花奖励零钱、零钱不足时街区长椅补贴零钱断言）。
- `npm run build`：`tsc --noEmit && vite build` 通过，exit 0。
- 完整输出见 `specs/v2-ux-painpoints/verify.log`。

## 验收条件核对

| # | 条件（来自 `decision.md`） | 结果 |
| --- | --- | --- |
| 1 | 零钱可再生、经济闭环不断 | **达到**。`actions.ts:plotAction` 收花奖励零钱（首次品种 +4、常规 +2）；`actions.ts:applyPropAction("sit")` 在 `coins < 6` 时坐下给 +2 零钱，兑现 `actions.ts:178` 文案。 |
| 2 | 点物件走近即触发，点地面路过只亮情境按钮 | **达到**。`runtime.ts:requestProp` 将 `autoOnArrival` 扩展为 `Boolean(prop.doorTo || prop.action)`；`moveTo` 地面移动仍保持 `targetPropId = null`。 |
| 3 | 小屋收藏架视觉留痕 | **达到**。`WorldView.tsx:updateShelfVisuals` 根据 `world.collection` 在小屋 `shelf` 的三层搁板上挂载 `BLOOM_ASSETS` 花朵贴图。 |
| 4 | 默认入口统一进 V2 `WorldApp` | **达到**。`src/main.tsx` 默认渲染 `<WorldApp />`，旧桌面端仅通过 `?desktop` 访问，旧移动端仅通过 `?legacy` 访问。 |
| 5 | UI 交互细节优化 | **达到**。`WorldView.tsx:drawWalkRing` 为移动落点与走向的目标物件绘制柔和光圈反馈；`WorldApp.tsx:ctaLabel` 与 `world.css:.world-cta-tag` 将 `prop.tagged` 物件名胶囊展示在底部情境按钮内。 |

## diff 有没有超出 `decision.md`

| 文件 | 对应决定 |
| --- | --- |
| `src/mobile/world/actions.ts` | UX-1 零钱再生闭环 |
| `src/mobile/world/runtime.ts` | UX-2 点物件走近自动触发 + 暴露 `walkTarget` / `pendingProp` |
| `src/mobile/world/WorldView.tsx` | UX-3 收藏架花朵贴图展示 + 走动目标地面光圈反馈 |
| `src/mobile/WorldApp.tsx` | 传递 `collection` + 情境按钮展示 `tagged` 物件名胶囊 |
| `src/mobile/world.css` | `.world-cta-tag` 胶囊样式 |
| `src/main.tsx` | UX-5 默认入口统一为 `WorldApp` |
| `tests/mobile-engine.test.mjs` | 新增与更新 3 处 UX 闭环单测 |

未超出 `decision.md` 声明的范围，未改动存档 schema。
