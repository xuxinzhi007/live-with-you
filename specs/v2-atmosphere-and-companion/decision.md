# v2-atmosphere-and-companion 决定

> 落 `specs/v2-atmosphere-and-companion/decision.md`。规则在 `references/scope.md`。

- 级别：L1（在现有 `src/mobile/world/` 边界内增强时段光影氛围与接入已有的 `companion-scene` 同源接口，不改存档 schema）
- 真正要解决的问题：
  1. **时段只剩顶栏文字，场景无光影氛围（`docs/current-state-and-next.md` §3）**：`WorldApp.tsx:29` 计算了 `dayPart(hour)`（清晨/上午/午后/下午/傍晚/夜里/深夜），但 Pixi 舞台全年全天都是同一个亮度和色温，街区路灯（`street-lamp`）在傍晚/夜里也不会亮起暖光。
  2. **仓库内已有的 `companion-scene` Ollama 陪伴能力在 V2 中被闲置**：`netlify/functions/companion-scene.mjs`、`vite.config.ts:companionDevPlugin` 与 `src/game/companion.js` 已经完备，支持根据结构化状态生成 `{"line","storyTitle","journalCopy"}` 以及检查 `/api/tags` 状态，但 V2 `WorldApp` 完全未接入，点雯宝和生活小记全靠静态写死的三句话。

- 怎样算满足：
  1. **场景时段光影氛围（纯函数 + Pixi 轻量色调与路灯暖光）**：
     - 在 `src/mobile/world/state.ts` 新增纯函数 `lightingForHour(hour: number)`，返回当前时段的色温 `tint`（如清晨柔光、白昼原色、傍晚暖琥珀色、夜间静谧蓝紫）与 `lampGlow`（傍晚/夜间/深夜开启路灯与室内暖光晕），方便单测。
     - `WorldView.tsx` 接收 `hour` 属性，将 `tint` 应用于房间背景层，并在 `lampGlow` 为真时在街区路灯（`lamp`）或小屋书桌（`desk`）上方绘制柔和暖光晕（`Graphics` 椭圆渐变光圈），不引入重型 Shader。
  2. **接入 `companion-scene` 陪伴生成与无感回退链**：
     - 新增 `src/mobile/world/companion-bridge.ts`，复用同源 `/.netlify/functions/companion-scene`（GET 状态探测 + POST 场景陪伴生成），内置本地降级函数 `fallbackCompanionScene(state, hour)`，保证 **Ollama 未启动或网络失败时 100% 零报错回退到本地细腻文案**（严格遵守 `.cursor/skills/ollama-mini-host/SKILL.md`「模型不可用时回退本地文案，不阻塞游戏」）。
     - 在 `WorldApp.tsx` 中：
       - **点击雯宝本人（`handleTapPlayer`）**：先即时给出本地状态反馈，若陪伴模型在线则异步请求一句当下状态的贴心话并可选择记入生活小记。
       - **「手账（生活小记）」抽屉**：顶部新增「写下此刻小记」轻量入口（调用 `companion-scene` 生成当下 `line` + `journalCopy` 写入 `state.journal`，离线时用本地情境组合生成，绝不失败），并在「更多」抽屉展示陪伴模型连接状态（已连接模型名 / 本地静默模式）。
  3. `npm run test:mobile` 与 `npm run build` 全部通过，并补齐 `lightingForHour` 与 `fallbackCompanionScene` 的单测。

- 现有能力：
  - `netlify/functions/companion-scene.mjs:handleCompanion`、`vite.config.ts:companionDevPlugin`（已证实：同源 `/.netlify/functions/companion-scene` 已挂载到 Vite dev 与 Netlify）
  - `src/mobile/world/useWorldGame.ts`（已证实：可扩展 `appendJournal(text)` 写入 `state.journal`）
  - `src/mobile/world/WorldView.tsx`（已证实：可对 `this.bg.tint` 赋值并在 `sortable` / `groundFx` 绘制路灯暖光晕）
  - 没有出处的词：无。

- 旧决定：遵循 `.cursor/skills/ollama-mini-host/SKILL.md` 边界（浏览器只调同源 `/.netlify/functions/companion-scene`，不直连 11434，模型不可用时回退本地文案，不阻塞游戏）。

- 最小充分方案：
  1. 已拍板：按上述 2 项（1.场景时段光影色温与傍晚/夜间暖光晕 2.接入 `companion-scene` 陪伴台词/手账小记生成与离线无缝回退）执行本次 `v2-atmosphere-and-companion`。
  2. 修改 `src/mobile/world/state.ts`、`src/mobile/world/companion-bridge.ts`（新增）、`src/mobile/world/useWorldGame.ts`、`src/mobile/world/WorldView.tsx`、`src/mobile/WorldApp.tsx`、`src/mobile/world.css` 与 `tests/mobile-engine.test.mjs`。

- 为什么更小的做法不够：
  - 只改背景 `tint` 不点亮路灯/书桌暖光，夜晚画面只会变暗发灰，缺少温暖的生活感。
  - 只在「更多」里放个模型状态而不把生成结果接进「点雯宝」和「手账（生活小记）」，玩家感知不到陪伴模型带来的鲜活变化。

- 相关的债：
  - **A 现在偿还**：打通 V2 与仓库内闲置的 `companion-scene` 后端函数，补齐 `current-state-and-next.md` §3 的「时段与天气」与「小记日常片段」两项差距。
  - **C 暂缓**：女仆皮肤缺失的 `sit`/`sleep` 原画帧涉及美术资产生成，留待美术管线单独处理。

- 这次不做：
  - 不新增聊天窗口覆盖场景（保持产品宪章「界面不是后台面板，不遮挡角色」）。
  - 不修改 `netlify/functions/companion-scene.mjs` 服务端协议。

- 风险：不碰契约、持久化 schema、权限、状态机、回滚。
