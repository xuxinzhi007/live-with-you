# lobby-world-p0p1 决定

> 落 `specs/lobby-world-p0p1/decision.md`。规则在 `references/scope.md`。
> 依据：`docs/产品分析-主大厅与小世界.md`（已入索引）。

- 级别：L1（渲染层 + 编排 + 开发环境出图试点；不碰存档结构、契约、权限、状态机）
- 原话（一字不改）：完成 p0 和 p1 实现 开发
- 我理解你要的是：把《产品分析-主大厅与小世界》里的 P0 两条和大厅四条全部做成代码——大厅「落进房间」（地板/影子/去金框去常驻星/装扮信息/行动带/她自发动），小世界「她在场」（世界坐标真正渲染、她站在出生点、点家具走过去再反应、标签降噪）；P1 的开发部分做完——舞台能吃竖版背景，并用本机 ComfyUI（已确认在线）走 `/api/comfy/draw` 出「家·白天」竖版背景试点供过目。
- 可能理解错的地方：
  1. 「完成 P1」可能指 17 张图全部出完入库。本轮只出**1 张试点**（家·白天），落 `tools/out/`（gitignore）等你过目；过目通过才替换 `public/assets`。家具 14 件需要去底管线与逐张过目，本轮只留提示词清单，不批量出图。理由：管线规则是「过目后再入库」，且每张 Qwen 约 3–4 分钟。
  2. 大厅装扮信息已有一个 `nk-suit-badge`（rarity·名字）。我做**增强**（加 ★ 与最高属性）而不是再叠一条新 pill，避免浮层更多。
  3. 小世界「走过去」用 CSS 位移 + walk 帧轮播的轻实现，不做寻路/A*；被家具挡住时直接到达（footprint 只存不用）。
- 本质：两个主屏的素材与数据都已存在，缺的是把「房间、她、家具」接起来的渲染与编排；本轮把这一层补上。
- 怎样算满足：
  1. 命令：`npx vitest run tests/screens/WorldScreen.test.tsx`
     点名用例：`渲染世界坐标道具` / `她在出生点` / `点家具她走过去并给出台词`
     期望输出：全部 pass
     覆盖：A2（小世界在场）
  2. 命令：`npm test`
     点名用例：既有 4 文件 23 例 + 新增用例
     期望输出：`# fail 0`
     覆盖：A3（回归）
  3. 命令：`node tools/audit/docs-links.mjs --verify-claims`
     期望输出：`broken 0 / orphan 0 / claims ok 7/7`
     覆盖：A4
  4. 命令：`npx tsc --noEmit && npm run build`
     期望输出：双 exit 0
     覆盖：A5
  5. 命令：`ls tools/out/lobby-world/`
     期望：至少 1 张竖版背景试点 PNG；`public/assets/` 未被本轮替换
     覆盖：A1（P1 试点）
- 未知：无。（大厅在大屏/桌面宽度的观感未验——本产品竖屏是唯一主线，桌面宽度按 max-width 收口处理。）
- 这次不做：
  - 家具 14 件批量重出（需去底管线 + 逐张过目，属 comfyui/小燕流程）
  - 背景替换 `public/assets`（等过目）
  - 寻路/碰撞、footprint 生效
  - 小世界与衣橱经济互通（仍需拍板）
  - dataURL → IndexedDB
  - 不提交、不开 PR
- 现有能力（已证实）：
  - `rooms.ts` 世界单位齐全：`worldW`、`defaultSpawn`、`approach`、每件家具 `x/y/w/h`（如 home：bed x=292 y=832 w=320 h=240；世界高 1000）
  - 背景图与世界宽高比吻合：home 1470×1500≈0.98 vs 980/1000；garden 0.96 vs 0.96 → `aspect-ratio: worldW/1000` 可整图显示
  - `walk-1..4` / `breathe-1..4` / `react` 帧齐备且已 760 对齐（`skins.ts`）
  - `/api/comfy/draw` dev 中间件可用，本机 ComfyUI `0.28.0` 在线（`/system_stats` 200）
  - 大厅已有 `nk-suit-badge`（`WorldApp.tsx:1187`）与 `reacting`/`LOBBY_LINES` 基建
  - 无出处的词：无
- 旧决定：无
- 最小充分方案：
  1. 大厅：`.nk-stage-floor` 地板带 + `.nk-hero-shadow` 接触阴影；删 `nk-stage-frame` 与常驻 sparkles；`.nk-paperdoll-rig` 去整卡 bob（保留标题页）；`m-expanded` 骨骼盒 336px → `min(52dvh, 480px)`；`nk-suit-badge` 增强为 `名字 · ★n · 最高属性`；右侧竖排按钮改舞台内底部行动带 `nk-lobby-actions`；新增 45–90s 自发反应（react 帧 + 台词）
  2. 小世界：`WorldScreen` 按 `aspect-ratio: worldW/1000` 渲染舞台；道具 `left/width = x,w/worldW`、`bottom = (1000-y)/1000`、`z-index = y/10`；地毯等无动作件变纯装饰；她渲染在 `defaultSpawn`（高 300/1000）；点家具先走到 `approach`（walk 帧轮播 + CSS 位移），到达后回调并播反应帧；标签只在她 1.5 身位内或选中时显示
  3. P1：dev server 起后台，`POST /api/comfy/draw` 出「家·白天」竖版试点 → `tools/out/lobby-world/`；`nk-stage-bg` 改 `object-position: center 62%` 对齐地平线，为竖版替换做好准备
  4. 文档：`产品分析` 与 `现行状态` 标注实施状态
- 为什么更小的做法不够：只做大厅不做小世界，「她不在场」的核心问题还在；只做小世界不做出图试点，剪纸家具与被裁背景仍是主要观感来源。
- 相关的债：B 局部偿还（本轮只接渲染层；footprint/寻路/经济互通继续挂起）
- 风险：不碰契约、持久化、权限、状态、回滚。出图走 dev 中间件，不写正式库、不进 `public/assets`，回滚 = 还原 diff。
