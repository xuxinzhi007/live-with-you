# v2-tech-debt-cleanup 决定

> 落 `specs/v2-tech-debt-cleanup/decision.md`。规则在 `references/scope.md`。

- 级别：L1（在现有 `src/mobile/` 边界内清理性能与交互技术债，不改存档 schema、不新增外部依赖）
- 真正要解决的问题：
  1. **撤回点普通物件走近自动触发**：用户反馈点物件走过去立刻自动触发体验不好，应恢复产品宪章「点物件 → 走近停在物件前 → 由底部单一情境按钮决定是否触发（门除外，点门走近即切房间）」。
  2. **切房间全量销毁重建 Pixi Application 与重复解码贴图（DEBT-1）**：`src/mobile/world/WorldView.tsx:663-702` 的挂载 `useEffect` 依赖 `[roomId, spawn.x, spawn.y]`，每次进出门都会执行 `renderer.destroy()` 销毁 WebGL 上下文与 Canvas，再重新 `new Application()` 并重新解码 13 张角色帧与场景贴图；而 `WorldRuntime.setRoom`（`runtime.ts:150`）写好后一直闲置未用。
  3. **HUD 无条件每秒强制整树重渲染（DEBT-3）**：`src/mobile/WorldApp.tsx:104-107` 挂载了一个无条件的 `setInterval(() => setNow(Date.now()), 1000)`，即使没有任何花圃在生长、也没有任何冷却倒计时，每秒也会强制整个 `WorldApp` React 树重渲染。

- 怎样算满足：
  1. **恢复走近停住 + 情境按钮确认**：`runtime.ts:requestProp` 中仅 `prop.doorTo` 在走近后自动触发；普通交互物件（床、书桌、花圃、花摊等）远距离点击时只走过去停在物件前，亮起底部情境按钮，由玩家点击按钮（或已站在跟前时再点物件）触发。
  2. **跨房间复用单个 Pixi Application + 全局贴图缓存**：
     - `WorldView.tsx` 的 `loadTexture` 增加模块级 `Map<string, Promise<Texture>>` 缓存，同一贴图全局只解码一次，且 `destroy` 时不销毁缓存贴图。
     - `WorldRenderer` 新增 `setRoom(roomId, spawn)`：调用 `this.runtime.setRoom(getRoom(roomId), spawn)`，清理旧房间物件精灵并加载新房间背景/物件，复用同一个 Pixi `Application`、Canvas 与已加载好的角色帧，切房间零闪白。
  3. **按需驱动 `WorldApp` 时钟**：`WorldApp.tsx` 仅在「存在未成熟花圃（`stage === 1 || stage === 2`）」或「当前靠近的物件处于冷却中（`cooldownLeftMs > 0`）」或「打开了背包抽屉看花圃倒计时」时才启用 1s 定时器；其余空闲状态改为 60s 更新一次（仅用于顶部时段文案），消除无意义的每秒整树重渲染。
  4. `npm run test:mobile` 与 `npm run build` 全部通过。

- 现有能力：
  - `src/mobile/world/runtime.ts:setRoom`（已证实：已实现重置玩家坐标、球状态、相机跟随，当前未被 `WorldView.tsx` 调用）
  - `src/mobile/world/WorldView.tsx:loadRoom`、`loadTexture`（已证实：可拆出房间级精灵清理与模块级 Texture 缓存）
  - `src/mobile/WorldApp.tsx`（已证实：可通过 `useMemo` 判断是否需要秒级 tick）
  - 没有出处的词：无。

- 旧决定：上轮 `v2-ux-painpoints` 中将 `autoOnArrival` 改成了 `Boolean(prop.doorTo || prop.action)`；经用户实测反馈「自动触发不是很好」，本轮明确撤回该条，恢复 `Boolean(prop.doorTo)`。

- 最小充分方案：
  1. 已拍板：按上述 3 项（1.撤回普通物件自动触发、恢复走近后点按钮 2.切房间复用 Pixi 实例与全局贴图缓存 3.收敛 HUD 每秒无条件重渲染）执行本次 `v2-tech-debt-cleanup`。
  2. 只改 `src/mobile/world/runtime.ts`、`src/mobile/world/WorldView.tsx`、`src/mobile/WorldApp.tsx` 与 `tests/mobile-engine.test.mjs`。

- 为什么更小的做法不够：
  - 只加贴图缓存不改 `useEffect([roomId])`，切房间依然会销毁重建 WebGL `Application` 和 Canvas DOM。
  - 只改 `WorldView` 不改 `WorldApp` 的每秒 `setInterval`，静止待机时 React 仍每秒重算整棵组件树。

- 相关的债：
  - **A 现在偿还**：DEBT-1（切房间销毁重建 Pixi 实例 + 贴图无缓存）与 DEBT-3（HUD 每秒强制重渲染）。
  - **C 暂缓**：DEBT-2（旧版 `?legacy` / `?desktop` 历史代码归档或移除）涉及大面积删除文件，暂缓不在本轮混入，保持回滚入口可用。

- 这次不做：
  - 不删 `?legacy` 和 `?desktop` 的旧代码目录。
  - 不改存档数据结构。

- 风险：不碰契约、持久化 schema、权限、状态机、回滚。注意 Pixi `app.destroy` 时不要销毁全局缓存的 `TextureSource`。
