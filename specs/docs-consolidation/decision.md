# docs-consolidation 决定

> 落 `specs/docs-consolidation/decision.md`。规则在 `references/scope.md`。

- 级别：L1（只动 `docs/`、`tools/*.md`、`tools/audit/`；不碰 `src/`、不碰存档、契约、权限、状态机）
- 原话（一字不改）：先帮我进行整理需要当前的这个项目 文件 和 架构吧 查看当前的这里 链路是否是闭环的 ，以及现在的文档 合并 工作 和 冗余的 地方 需要进行调整
- 我理解你要的是：把「哪份文档算数」收敛成一条主线——现状、方向、架构、玩法、出图/服务端各留一份现行文档；重复的、和代码对不上的、已归档却仍挂在索引上的，合并或挪进 `archive/`。同时把「代码链路有没有闭环」的核查结论写进现行状态文档，让下一个人打开就能看到哪些通了、哪些断了。
- 可能理解错的地方：
  1. 「整理文件和架构」可能指改 `src/` 目录结构。我只整理文档、把代码架构写成文档，**没有动 `src/` 一个文件**；要动代码另开一次 `change`。
  2. 「合并」我按「每个主题只留一份现行文档 + 原件进 `archive/`」做，没有把几篇长文重写成一长篇（避免丢细节）。
  3. 文档与代码冲突的 6 条口径，我按**代码现状**写文档，没有改代码去迎合文档。
- 本质：文档入口过多且与代码不同步，读者无法判断哪份算数；且此前没有人用可执行的方式核实过 UI 链路是否真的闭环。
- 怎样算满足：
  1. 命令：`node tools/audit/docs-links.mjs`
     点名用例：`docs/` 下全部 `*.md` 的相对链接 + 索引入链
     期望输出：`broken 0`、`orphan 0`
     覆盖：验收条件 A1（索引唯一、无坏链、无零入链现行文档）
  2. 命令：`node tools/audit/docs-links.mjs --verify-claims`
     点名用例：6 条「文档口径 vs 代码」断言（8788 默认关闭 / MeinaMix 与 LoRA 不在现行线 / 底栏六项名称 / sit-sleep 未渲染 / 密语无入口 / 裁缝铺仅 dev）
     期望输出：`claims ok 6/6`
     覆盖：验收条件 A2（口径与代码一致）
  3. 命令：`npm test`
     点名用例：`tests/mobile-engine.test.mjs` 全部用例 + `tests/world/anim-clips.test.ts` + `tests/screens/{WardrobeScreen,CodexScreen}.test.tsx`
     期望输出：`# fail 0` 且 vitest `Tests  ... passed`
     覆盖：验收条件 A3（文档搬迁不改坏仓库测试入口）
- 未知：无。（唯一不确定的是是否要连 `src/` 一起改，已按上面「可能理解错的地方 1」写成假设；不影响文档方案。）
- 这次不做：
  - 不改 `src/` 任何代码（密语入口、`sit/sleep` 渲染、裁缝铺 `DEV` 保护、`applyLocalAssetFallback` 接线，全部留给下一次 `change`）
  - 不动 `specs/`（本机工作记录，gitignore 内）
  - 不重写 `docs/comfy-official-qwen/execution-design.md`（356 行 API 图技术规格，仍是现行，只补入口链接）
  - 不删 `docs/archive/` 里任何历史文档，只更新 `archive/README.md` 的口径
  - 不提交、不开 PR（按项目规则等你点头）
- 现有能力（审计结论，均为已证实）：
  - 入口可达：`src/main.tsx` → 30/31 个源文件可达，无孤立模块（脚本遍历 `src` 的 import 图）
  - 闭环 5 条：换装→v8 存档（`src/mobile/store/useNikkiState.ts:52`）；骨骼→`dressSkeletons`（`src/mobile/WorldApp.tsx:543`）；闯关发券→抽卡（`WorldApp.tsx:763`、`:770`）；资源解析双向（`src/mobile/world/remote-assets.ts:47` `mapLocalAsset` / `:94` `unmapRemoteAsset`）；Comfy dev 代理（`vite.config.ts:93`）
  - 断点 6 条：密语页零入口（`WorldApp.tsx:1638` 有分支，全文件无 `setScreen("chat")`）；`sit/sleep` 从不渲染（`src/mobile/world/skins.ts:85-86` 定义、`:120-121` resolve，`WorldApp.tsx:841` 只用 `react`）；`/api/comfy/draw` 仅 dev（`netlify/functions/` 只有 `companion-scene.mjs`）；小世界 v2 档与衣橱 v8 档不互通（`src/mobile/engine/storage.ts:12`）；`applyLocalAssetFallback` 零调用（`remote-assets.ts:132`）；devDeps 未安装导致 `test:unit`/`lint` 跑不了
  - 文档冗余：42 份 md/html，16 份零入链，16 处坏链；3 套「现状」、2 套「PRD/设计/架构」、2 份动作帧 PRD、4 个 `tools/*.bak`
  - 无出处的词：无
- 旧决定：无（`docs/archive/` 的 V2 宪章已被 `docs/product-charter.md` 取代，不引用卡片）
- 最小充分方案：
  1. 新增 `tools/audit/docs-links.mjs`：扫 `docs/**/*.md` 相对链接与索引入链，`--verify-claims` 跑 6 条口径断言
  2. `docs/现行状态.md` = `wenbao-product/交接-当前状态.md` + `current-state-and-next.md` + 闭环核查结论，一处写全；原两份留 3 行指针
  3. `docs/资产管线.md`（合并 `wenbao-asset-pipeline` 三份 + 现行结论）、`docs/待办-动作帧.md`（合并两份 PRD + `REVIEW.txt` 结论）、`docs/服务端接线.md`（vite 中间件 / netlify function / 8188 / 11434 / dev 与生产差异）
  4. `docs/wenbao-product/`（除指针）与 `docs/wenbao-asset-pipeline/` 原件、`docs/superpowers/`、`docs/mobile-architecture.md` 并入 `docs/archive/`；`_archive` 的 zip 删
  5. 修 6 条口径：`README.md`、`docs/game-direction.md`、`docs/README.md`、`docs/architecture-map.md`、`docs/product-charter.md`、`docs/archive/README.md`
  6. `tools/*.bak*` 4 个删除，`PIPELINE-DRESS/LAYERS` 移 `tools/_archive-docs/`
- 为什么更小的做法不够：只修 6 条口径的话，3 套「现状」和 2 套「三件套」还在，下一个人仍会打开过时的那份；只归档不建索引的话，零入链文档会继续堆积。
- 相关的债：B 局部偿还（只清这轮碰到的文档债；`WorldApp.tsx` 1705 行、`applyLocalAssetFallback`、`layered-stage` 死开关记在「这次不做」，留给代码那次）
- 风险：不碰契约、持久化、权限、状态、回滚。唯一实质性风险是文档路径搬迁导致旧链接失效 → 由 `tools/audit/docs-links.mjs` 的 `broken 0` 兜住，且所有被索引的旧路径保留指针文件。
