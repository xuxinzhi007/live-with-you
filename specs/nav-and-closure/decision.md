# nav-and-closure 决定

> 落 `specs/nav-and-closure/decision.md`。规则在 `references/scope.md`。

- 级别：L1（UI 入口 + 加载失败回退 + 构建期隐藏；不碰存档结构、契约、权限、状态机）
- 原话（一字不改）：补充当前断掉的 6 个  密语：加回导航项  动作帧 暂时放置  使用当前工作流中合适的 skill 进行处理
- 我理解你要的是：把「已经写好但玩家点不到、或线上点不了」的能力接上线——密语页加回底栏入口；裁缝铺在生产环境不再露出（避免必 404）；角色立绘加载失败时回退本地图。动作帧（`sit`/`sleep`）这一轮不动。6 个断点里，凡是需要改存档或需要产品口径的先不动，写清理由。
- 可能理解错的地方：
  1. 「补充当前断掉的 6 个」可能是指 6 个全部要修。我按「不碰存档契约」筛选：本轮修 3 个（#1 密语入口、#3 裁缝铺生产、#5 加载失败回退），#6 已在上一轮 `npm install` 恢复；#2 动作帧是你明确要求的放置；#4 小世界与主经济互通要改两套存档与货币口径，属产品决定，放置。
  2. 底栏从 6 项变 7 项，我没有换成「替换小世界」的排法（你说的是「加回」），并据此改文档与断言。
  3. 动作帧「暂时放置」= 不改 `skins.ts`、不接坐下/躺下交互、不换 `public/assets` 的图；只在现行状态里标「放置」。
- 本质：能力已经存在但入口/环境/兜底缺失，导致「做了却用不到」，且文档曾把这种状态写成「已实现」。
- 怎样算满足：
  1. 命令：`node tools/audit/docs-links.mjs --verify-claims`
     点名用例：新增断言「密语有底栏入口」（源码里存在 `setScreen("chat")` 且 `<nav>` 里 7 项含「密语」）、保留「底栏与代码一致」
     期望输出：`claims ok 7/7`、`broken 0`、`orphan 0`
     覆盖：A1 / A2
  2. 命令：`npm test`
     点名用例：`tests/mobile-engine.test.mjs` 19 条 + vitest 3 个文件 22 例
     期望输出：`# fail 0` 且 `Tests 22 passed`
     覆盖：A3
  3. 命令：`npx tsc --noEmit` 与 `npm run build`
     点名用例：`WorldApp.tsx` 的 `<nav>` 增项、`import.meta.env.DEV` 判断、`onError` 回退
     期望输出：exit 0，`dist` 产出
     覆盖：A4
- 未知：无。（底栏 7 项在 360–430px 是否挤压属视觉判断：`flex:1` 等比 + 字号 9.5px，「高定衣橱」约 38px < 360/7≈51px，推断不溢出；实机仍要看一眼。）
- 这次不做：
  - 动作帧：`sit` / `sleep` 交互与换图（你要求放置）
  - 小世界与主经济互通（改 `wenbebi-mobile-game-v2` 与 `wenbebi-nikki-wardrobe-v8` 的货币口径，需产品拍板）
  - dataURL 改 IndexedDB（持久化改造，另立 L2）
  - `GameScreen` 类型去重、`layered-stage` 死开关、12 个 V2 遗留资源（与本次主题无关）
  - 不提交、不开 PR
- 现有能力（已证实）：
  - `ChatScreen` 与 `screen === "chat"` 分支已存在（`WorldApp.tsx:1638`），缺的是入口
  - `applyLocalAssetFallback`（`remote-assets.ts:132`）已实现、零调用
  - `/api/comfy/draw` 只在 `vite.config.ts:93`，`netlify/functions/` 无对应函数
  - `vite-env.d.ts` 已引 `vite/client`，`import.meta.env.DEV` 可用
  - 无出处的词：无
- 旧决定：无
- 最小充分方案：
  1. 底栏加第 7 项「💬 密语」→ `setScreen("chat")`；`ChatScreen` 已自带返回底栏能力，不改其内部
  2. 裁缝铺入口与面板用 `import.meta.env.DEV` 包住（生产不渲染），并保留一句开发提示
  3. 角色立绘 `<img>` 接 `onError` → 本地帧；为此在 `skins.ts` 导出 `getLocalCharacterSkin`（返回未 resolve 的本地路径）
  4. 同步文档：`docs/现行状态.md` §2/§3、`docs/game-direction.md` 底栏、`README.md` 导航、`docs/服务端接线.md` 裁缝铺一行
  5. 更新 `tools/audit/docs-links.mjs` 的底栏断言（6→7）并新增「密语有入口」断言
- 为什么更小的做法不够：只加导航项的话，生产裁缝铺仍 404、角色图失败仍白屏，断点 3/5 还在；只改代码不清文档的话，`--verify-claims` 会在下次翻红。
- 相关的债：B 局部偿还（只接本次三处）；`WorldApp.tsx` 1705 行、存档互通、IndexedDB 记入「这次不做」
- 风险：不碰契约、持久化、权限、状态、回滚。碰了 UI 入口与构建期分支，回滚 = 还原这几处 diff。
