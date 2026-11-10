# 并行任务分派

基线分支：`feature/asset-pipeline-realign`
所有 agent 在同一工作区工作，靠**文件独占**避免冲突。不要碰不属于自己的文件。

## 波 1（三路并行）

### Agent A —— 资产管线

**独占**：`tools/generate-comfy-assets.mjs`、`tools/audit/`、`package.json` 的 `scripts` 段
**禁止碰**：`src/**` 任何文件

任务：
1. 读 `tools/generate-comfy-assets.mjs`。已有 `LAYERDIFFUSE` 开关（约 393 行），当前默认关且节点参数是猜的。
2. 现状问题（已证实）：所有输出 512×640 / 512×512，且 PNG color type=2（无 alpha）。抠图靠运行时洪水填充。
3. 改：
   - 分辨率提到模型原生能力（Qwen/MeinaMix 原生 2K；先用 1024×1280 / 1024×1024 稳妥）。
   - 让输出**带 alpha**。优先查本机 ComfyUI `/object_info` 真实节点名再写，不要沿用猜测的 `LayerDiffuseApply`。若本机没有 layerdiffuse，改用输出后用清晰纯色背景 + 独立后处理脚本生成 alpha 的方式，并把该脚本写成 `tools/postprocess-alpha.mjs`（也是你的独占文件）。
   - 加**生成后验收**：产出必须有 alpha、尺寸达阈值、非全透明/非全白。失败要报错退出非 0，不能静默写盘。参照 `item-plush-bunny.png`（内容为四团白色椭圆）这种失败案例。
4. `package.json` 加 `"audit:assets": "node tools/audit/asset-audit.mjs"`，并写 `tools/audit/asset-audit.mjs`：扫描 `public/assets/nikki/*` 报告尺寸、是否有 alpha、透明像素占比，异常列出。
5. 不要真的去调用 ComfyUI（本机不一定开着）。脚本要能在无 ComfyUI 时给清晰错误。

**交付**：改完跑 `node tools/audit/asset-audit.mjs`，把输出贴进 `specs/direction-realign/agent-a.md`。

### Agent B —— 渲染层去矩形切片

**独占**：`src/mobile/world/skeleton-system.ts`、`src/mobile/world/paper-doll-rig.ts`
**禁止碰**：`src/mobile/WorldApp.tsx`、`tests/**`、`tools/**`

任务：
1. 读 `skeleton-system.ts:521 computeHumanoidPartSlices`。它用 6 处硬编码百分比 `polygon(...)` 把整张人像切成矩形选区。**矩形不是轮廓，旋转必然穿模。**
2. 改为 slot 叠加模型（依据 Spine 官方 slot/skin/attachment 三层结构，见 `art-research.md` 1.4）：
   - 角色本体作为**单一 sprite**，整体做 transform（缩放/位移/轻微旋转），不再切部位。
   - 各槽位（dress / hairAcc / handheld / aura）作为**独立图层**叠加，各自有自己的锚点偏移与缩放。
   - 不再需要 `clipPath`。
3. **保持 `computeHumanoidPartSlices` 导出存在且签名不变**，让它返回空数组 `[]`，并在注释里写明已废弃、由 slot 叠加替代。这样 `WorldApp.tsx` 不改也能编译，调用点由后续 Agent C 统一删。**这是硬要求，否则并行会冲突。**
4. `paper-doll-rig.ts` 的 `loadCutoutImage` 洪水填充：保留函数签名，但改为**优先直接使用资产自带 alpha**。仅当资产无 alpha 时退回洪水填充，并在控制台 warn 一次。
5. 不改 `tests/`。V9 测试断言 `slices.length === 6` 会失败——那是 Agent D 的职责，你在 `agent-b.md` 里写明这个测试需要改成期望空数组。

**交付**：`npx tsc --noEmit` 必须过。写入 `specs/direction-realign/agent-b.md`。

### Agent D —— #3 存档断链 + 测试

**独占**：`src/mobile/world/nikki-wardrobe.ts`、`tests/mobile-engine.test.mjs`、`specs/direction-realign/agent-d.md`
**禁止碰**：`WorldApp.tsx`、`skeleton-system.ts`、`paper-doll-rig.ts`、`tools/**`

任务：
1. 在 `nikki-wardrobe.ts` 新增纯函数 `normalizeNikkiSave(raw: unknown): SavedNikkiState`：
   - `equipped` 每个槽位用 `WARDROBE_SLOTS` 校验；非法或已下架的 id 落回该槽位默认值。
   - `itemStars` 值 clamp 到 1..5 整数，非数字丢弃。
   - `coupons` clamp 到 0..999999 整数。
   - `unlockedIds` 去重、过滤掉不在 `WARDROBE_ITEMS` 里的 id、并并入 `DEFAULT_UNLOCKED_ITEM_IDS`。
   - `clearedStages` / `customImages` / `dressSkeletons` 做类型守卫。
2. **注意**：`SavedNikkiState` 接口目前定义在 `WorldApp.tsx:73`，不在 wardrobe 里。把它移到 `nikki-wardrobe.ts` 并导出，`WorldApp.tsx` 改为 import。**这是一个跨文件改动，C 会用到，你在 `agent-d.md` 里写清改了哪些行，C 负责收尾。**
3. 测试文件里：
   - 新增 `normalizeNikkiSave` 的测试：非法槽位、下架 id、`NaN` 价格、负数星级、重复 unlocked。
   - 新增**存档迁移链测试**：模拟 v4/v5/v6/v7/v8 各形状的数据都能正常读，且不会静默丢失礼券。
   - 修改 V9 测试：`slices.length` 断言从 6 改为 0（Agent B 把切片废弃了）。
4. 跑 `npm run test:mobile` 必须全绿。

**交付**：`specs/direction-realign/agent-d.md` 写清测试前后数量与结果。

## 波 2（波 1 全部完成后）

### Agent C —— 小世界 UI 挂载 + 清理调用点
**独占**：`src/mobile/WorldApp.tsx`、`src/mobile/world.css`、`src/mobile/world/runtime.ts`

- 删 `partSlices` 相关调用（`WorldApp.tsx:37, 360, 828+`）。
- 收尾 Agent D 的 `SavedNikkiState` 引用。
- 挂载小世界：复用 `ROOMS` / `applyPropAction` / `useWorldGame` 已有返回值，新增场景屏幕。
- 由主 agent 先做，确保 A/B/D 都已合入。

## 验收（主 agent 统一做）

每个波次后跑：`npx tsc --noEmit` → `npm run build` → `npm run test:mobile` → 实际渲染截图比对。
任何一步非 0 就停，不进入下一波。
