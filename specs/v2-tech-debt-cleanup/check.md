# v2-tech-debt-cleanup 核对

## 跑了什么

```text
exit 0
cmd npm run test:mobile && npm run build
```

- `npm run test:mobile`：`pass 25 / fail 0`。
- `npm run build`：`tsc --noEmit && vite build` 通过，exit 0。
- 完整输出见 `specs/v2-tech-debt-cleanup/verify.log`。

## 验收条件核对

| # | 条件（来自 `decision.md`） | 结果 |
| --- | --- | --- |
| 1 | 撤回普通物件走近自动触发，恢复走近停住 + 情境按钮确认（门除外） | **达到**。`runtime.ts:requestProp` 恢复 `autoOnArrival = Boolean(prop.doorTo)`，并在 `tests/mobile-engine.test.mjs` 验证远点床走近后停住等 `activateNearest()`，点门走近自动触发。 |
| 2 | 切房间复用单个 Pixi Application + 全局贴图缓存（DEBT-1） | **达到**。`WorldView.tsx` 新增 `TEXTURE_CACHE` 全局贴图缓存与 `renderer.setRoom(roomId, spawn)`，挂载 `useEffect` 改为 `[]`，房间切换仅清理旧房间物件精灵并调 `runtime.setRoom`，不再销毁重建 WebGL 上下文与 Canvas。 |
| 3 | 按需驱动 `WorldApp` 秒级时钟（DEBT-3） | **达到**。`WorldApp.tsx` 通过 `needsSecondTick` 仅在「靠近物件有冷却倒计时」或「花圃正在生长」时使用 `1000ms` 定时器，其余空闲状态使用 `60_000ms` 定时器。 |

## diff 有没有超出 `decision.md`

| 文件 | 对应决定 |
| --- | --- |
| `src/mobile/world/runtime.ts` | 恢复 `autoOnArrival = Boolean(prop.doorTo)` |
| `src/mobile/world/WorldView.tsx` | DEBT-1 全局 `TEXTURE_CACHE` + `setRoom` 热切换房间 |
| `src/mobile/WorldApp.tsx` | DEBT-3 `needsSecondTick` 按需秒级更新 |
| `tests/mobile-engine.test.mjs` | 验证普通物件走近停住等 CTA 确认、门走近自动触发 |

未超出 `decision.md` 声明范围。
