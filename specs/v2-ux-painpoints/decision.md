# v2-ux-painpoints 决定

> 落 `specs/v2-ux-painpoints/decision.md`。规则在 `references/scope.md`。

- 级别：L1（在现有 `src/mobile/world/` 边界内修复用户体验痛点，不改存档 schema、不新增外部依赖）
- 真正要解决的问题：
  1. **经济闭环死锁（UX-1）**：零钱（`coins`）只有初始 18 + 首次进房各 3（上限 24），买种（-6）和许愿（-1）消耗完后没有任何再生途径；且 `actions.ts:178` 提示「去喷泉边坐坐，或者明天再来」，但长椅（`sit`）和收花（`plot`）实际不给零钱，导致零钱归零后买种与许愿永久卡死。
  2. **点物件走过去后发呆（UX-2）**：`runtime.ts:254` 的 `requestProp` 仅在 `prop.doorTo` 或已在范围内时触发，导致玩家点击远处的床/书桌/花圃/长椅后，雯宝走过去只会停住发呆，必须再点一次底部按钮或再点一次物件。
  3. **收藏架与房间缺乏视觉留痕（UX-3）**：收花后 `world.collection` 增加，但小屋收藏架（`shelf`）在画面上没有任何变化，只弹文字 Toast。
  4. **宽屏/桌面默认掉进已废止的旧版（UX-5）**：`src/main.tsx:31` 仅在 `isMobile`（`<=768px` 或 coarse pointer）时进入 `WorldApp`，桌面或平板横屏默认打开已废止的 V0 `<App />`，与 `docs/game-direction.md`「竖屏移动端是唯一主线，桌面版只作为 `?desktop` 预览」矛盾。

- 怎样算满足：
  1. **零钱可再生、经济闭环不断**：收花时除留 1 颗种子外，获得 `+2` 零钱（首次收某品种额外 `+2`）；在街区长椅坐下（`sit`）或在小屋阅读（`read`）/休息（`rest`）时，若零钱不足 6（买不起花种），可在喷泉边长椅坐下捡到/获得 `+2` 零钱（兑现 `actions.ts:178`「去喷泉边坐坐」的文案承诺）。
  2. **点物件走近即触发**：玩家直接点击场景内的可交互物件（`requestProp`）时，`targetPropId` 设为 `prop.id`，抵达后自动触发动作（与点门一致）；而玩家点地面走动路过物件时，仍只亮底部情境按钮，不自动触发。
  3. **收藏架视觉留痕**：小屋收藏架（`shelf`）在 `WorldView.tsx` 中根据 `world.collection`（`daisy` / `rose` / `sunflower` 是否 `> 0`）在架子层板上叠加显示对应花朵贴图（复用已有的 `BLOOM_ASSETS`），让收过的花在小屋里真正看得见。
  4. **默认入口统一为 V2 `WorldApp`**：`src/main.tsx` 默认渲染 `<WorldApp />`；仅在显式携带 `?desktop` 时进入旧 `<App />`，`?legacy` 进入 `<LegacyMobile />`。
  5. `npm run test:mobile` 与 `npm run build` 全部通过，并补充对应的单测用例。

- 现有能力：
  - `src/mobile/world/actions.ts:applyPropAction`、`plotAction`（已证实：纯函数结算零钱、种子、花圃与冷却）
  - `src/mobile/world/runtime.ts:requestProp`、`updateMovement`（已证实：`targetPropId` 机制已支持抵达后自动调用 `triggerProp`，目前被 `Boolean(prop.doorTo)` 限制）
  - `src/mobile/world/WorldView.tsx:updatePlotVisuals`、`BLOOM_ASSETS`（已证实：已有按状态在 `sortable` 容器上挂载花朵贴图的能力）
  - `src/main.tsx:Root`（已证实：URL 参数分流入口）
  - 没有出处的词：无。

- 旧决定：无卡片。实现是否仍符合：无旧决定（对照 `docs/product-charter.md` 与 `docs/game-direction.md`）。

- 最小充分方案：
  1. 已拍板：一次性收敛上述 4 项已证实的 UX 痛点（经济闭环 + 走近即触发 + 收藏架视觉留痕 + 默认进 V2），并优化 UI 交互细节（点物件走过去途中的底部提示、物体靠近时的标签可读性）。
  2. 只改 `src/mobile/world/actions.ts`、`src/mobile/world/runtime.ts`、`src/mobile/world/WorldView.tsx`、`src/mobile/WorldApp.tsx`、`src/mobile/world.css`、`src/main.tsx`，并在 `tests/mobile-engine.test.mjs` 补齐断言。

- 为什么更小的做法不够：
  - 只改文案不补零钱来源，玩家花光 24 零钱后花摊和喷泉依然永久死锁。
  - 只改数值不改 `requestProp` 和收藏架视觉，玩家每次交互仍需点两次，且核心收集品在小屋内不可见，违背产品宪章「世界内操作」与「长期留痕」两大支柱。

- 相关的债：
  - **B 局部偿还**：消掉 `actions.ts:178` 文案与实际产出的不一致，以及 `main.tsx` 默认掉入 V0 旧版的入口债。
  - **C 暂缓**：切房间重建 Pixi Application（DEBT-1）、三代代码清理（DEBT-2）、HUD 每秒重渲染（DEBT-3）留到下一轮「技术债专项」change 处理，不混入本次 UX diff。

- 这次不做：
  - 不改存档 `GameState` / `WorldState` 的字段结构（保持 100% 存档兼容）。
  - 不在这轮做 Pixi 跨房间复用或删除 `?legacy` / `?desktop` 目录。
  - 不引入新的美术资源文件（收藏架直接复用 `BLOOM_ASSETS` 的三朵花贴图）。

- 风险：不碰契约、持久化 schema、权限、状态机、回滚。
