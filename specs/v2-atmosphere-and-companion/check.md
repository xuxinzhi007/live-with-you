# v2-atmosphere-and-companion 核对

## 跑了什么

```text
exit 0
cmd npm run test:mobile && npm run build
```

- `npm run test:mobile`：`pass 26 / fail 0`。
- `npm run build`：`tsc --noEmit && vite build` 通过，exit 0。
- 完整输出见 `specs/v2-atmosphere-and-companion/verify.log`。

## 验收条件核对

| # | 条件（来自 `decision.md`） | 结果 |
| --- | --- | --- |
| 1 | 场景时段光影色温与傍晚/夜间暖光晕 | **达到**。`state.ts:lightingForHour` 按小时输出 `period`、`label`、`bgTint` 与 `lampGlow`；`WorldView.tsx:updateLighting` 对背景层应用色温 `tint`，并在傍晚/夜间/深夜为街区路灯（`lamp`）与小屋书桌（`desk`）绘制柔和暖光晕。 |
| 2 | 接入 `companion-scene` 陪伴生成与无感回退链 | **达到**。新增 `src/mobile/world/companion-bridge.ts`，通过同源 `/.netlify/functions/companion-scene` 探测模型与请求当下情境台词/小记，离线或超时时 100% 静默回退到 `fallbackCompanionScene`；`WorldApp.tsx` 在点击雯宝、手账「记下此刻」与更多面板「陪伴状态」中完整接入。 |
| 3 | 单测与构建全部通过 | **达到**。26 项单测与生产构建全部 `exit 0`。 |

## diff 有没有超出 `decision.md`

| 文件 | 对应决定 |
| --- | --- |
| `src/mobile/world/state.ts` | 新增 `lightingForHour` 纯函数 |
| `src/mobile/world/companion-bridge.ts` | 新增 `companion-scene` 同源调用与 `fallbackCompanionScene` 本地情境回退 |
| `src/mobile/world/useWorldGame.ts` | 新增 `appendJournal` 供手账「记下此刻」写入小记 |
| `src/mobile/world/WorldView.tsx` | 接入 `hour`、`bg.tint` 与 `lampGlowFx` 暖光晕 |
| `src/mobile/WorldApp.tsx` | 点雯宝情境回应、手账「记下此刻」、更多面板「陪伴状态」 |
| `src/mobile/world.css` | `.world-journal-bar` 与 `.world-journal-btn` 样式 |
| `tests/mobile-engine.test.mjs` | 新增 `lightingForHour` 与 `fallbackCompanionScene` 单测 |

未超出 `decision.md` 声明范围，未改动存档 schema。
