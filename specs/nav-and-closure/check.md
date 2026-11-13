exit 0

# nav-and-closure 核对

- verify.log：`specs/nav-and-closure/verify.log`，命令 `npm run test:mobile && npm run build`，第一行 `exit 0`
- 工作树动过（`gate_check=ok`，见 `specs/nav-and-closure/evidence.log`）

## 一、验收条件逐条核对

### A1 密语有底栏入口 + 底栏与代码一致 → 通过

- 命令：`node tools/audit/docs-links.mjs --verify-claims`
- 验的用例：
  - `底栏七项与代码一致`（读 `WorldApp.tsx` 的 `<nav className="nk-nav">` 区块，7 个 `<small>` 与文档一致）
  - `密语有底栏入口`（源码里有 `setScreen("chat")`、`<nav>` 里有「密语」、`docs/现行状态.md` 里 `chat` 行不再写「无入口」）
- 期望输出：`claims ok 7/7`、`broken 0`、`orphan 0`
- 实际输出：`broken 0` / `orphan 0` / `claims ok 7/7`
- 另加渲染级验证：`tests/screens/WorldApp.nav.test.tsx`
  - 期望：底栏 7 个 button、有「密语」、点击后出现「和雯宝私语」
  - 实际：`Test Files 1 passed`、`Tests 1 passed`

### A2 动作帧放置 → 通过（作为「不做」项核对）

- 验的用例：`sit / sleep 从不渲染`
- 期望：`src/mobile/WorldApp.tsx` 里没有 `activeSkin.sit` / `activeSkin.sleep`，且 `docs/现行状态.md` 写着「从未渲染」
- 实际：`✓ sit / sleep 从不渲染`
- 另有 `docs/待办-动作帧.md` 顶部标注「状态：放置（2026-11-13 夜）」

### A3 回归不破 → 通过

- 命令：`npm test`
- 验的用例：`tests/mobile-engine.test.mjs` 19 条 + vitest 4 个文件（新增 `WorldApp.nav.test.tsx`）
- 期望输出：`# fail 0` 且 vitest 全绿
- 实际输出：`Test Files 4 passed`、`Tests 23 passed`、`# tests 19 / # pass 19 / # fail 0`

### A4 类型与构建 → 通过

- 命令：`npx tsc --noEmit` → exit 0
- 命令：`npm run build` → `built in 187ms`，`dist/assets/index-RjYXA8tb.js 312.80 kB`
- 生产包验证：`grep -c "裁缝铺" dist/assets/*.js` → `0`（`import.meta.env.DEV` 分支已被摇掉）
- `grep -c "密语" dist/assets/*.js` → 1（压缩成一行，存在）

## 二、diff 是否超出 decision

在范围内：

1. `src/mobile/WorldApp.tsx`：底栏第 7 项「💬 密语」；两处角色立绘 `onError`；裁缝铺按钮与面板用 `import.meta.env.DEV` 包住；图鉴标签 `原画 (n%)` → `图鉴 n%`
2. `src/mobile/world/skins.ts`：新增 `getLocalCharacterSkin()`（未 resolve 的本地帧）
3. `src/mobile/world.css`：`.nk-nav button small` 字号 9.5px → 9px，加 `max-width/overflow`（7 项防溢出）
4. `tools/audit/docs-links.mjs`：底栏断言 6→7，新增「密语有底栏入口」「角色图 onError 回退已接线」，共 7 条
5. 文档：`docs/现行状态.md`（§2 表格、§3 断点重写 + 「本轮已修」表）、`docs/game-direction.md`（底栏七项、验收）、`docs/product-charter.md`（去掉「无入口」）、`docs/服务端接线.md`（DEV 门）、`README.md`（导航七项、裁缝铺说明）、`docs/architecture-map.md`（技术债 4 行）、`docs/待办-动作帧.md`（放置）、`docs/README.md`（断点数）

超出 / 与决定对不上的地方：

1. 新增了 `tests/screens/WorldApp.nav.test.tsx`（决定没写要加测试）。原因：只有源码断言不能证明「点得开」，而这是本轮最核心的一条。
2. 改了 `tests/setup.ts`（决定没写）：加 `scrollIntoView` 空实现，否则 jsdom 里 `ChatScreen` 一挂载就抛错，回归测试跑不起来。
3. 图鉴标签从「原画 (n%)」改成「图鉴 n%」：决定只说「底栏 7 项、防溢出」，改标签是为了 7 项在 360px 下不挤。属实现细节，但确实动了 UI 文案。

没有改动：`netlify/`、`vite.config.ts`、`.env`、`package.json`、`public/assets`（动作帧按放置处理，未换图）、任何存档结构。

## 三、未验成 / 未覆盖

- **视觉未在真机或浏览器里看过**：只做了 jsdom 渲染（DOM 结构正确）+ 构建产物检查。底栏 7 项在 360/390/430px 的实际观感、`图鉴 100%` 是否被裁，属于**没验成**，需要你刷一次 `npm run dev` 看。
- 裁缝铺在 dev 下是否仍可点开，只做了源码与构建产物检查，没有真的调 8188 出图（需要本机 ComfyUI 在跑）。
- 小世界与主经济互通、dataURL → IndexedDB 按决定「这次不做」。

## 四、对应 decision 的哪条条件

| 本文条件 | 对应 decision |
| --- | --- |
| A1（密语入口 + 底栏七项 + broken/orphan 0） | 「怎样算满足 1」 |
| A2（动作帧放置） | 「这次不做」第一条 |
| A3（`npm test` 全绿） | 「怎样算满足 2」 |
| A4（tsc / build / 生产包无裁缝铺） | 「怎样算满足 3」 |
| 视觉未验成 | 「未知」里那条 360–430px 挤压风险 |
