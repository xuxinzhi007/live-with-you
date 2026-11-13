exit 0

# lobby-world-p0p1 核对

- verify.log：`specs/lobby-world-p0p1/verify.log`，命令 `npm run test:mobile && npm run build`，第一行 `exit 0`
- 工作树动过（`gate_check=ok`）

## 一、验收条件逐条核对

### A1（P1 试点）→ 完成，其中一次失败如实记录

- `ls tools/out/lobby-world/`：
  - `home-vertical-pilot.png`（512×768）——**废稿**：官方编辑线源图固定是角色母图，「去掉人物」产出近全白，不可用
  - `home-anime-pilot.png`（1464×1496）——**可用**：保持原房间构图，重绘为暖光动漫插画
  - `garden-anime-pilot.png`（1440×1496）、`street-anime-pilot.png`（1768×1496）——已出，待过目
- `public/assets/` **未被本轮替换**（管线规则：过目后再入库）
- 对应 decision：「怎样算满足 5」

### A2（小世界在场）→ 通过

- 命令：`npx vitest run tests/screens/WorldScreen.test.tsx`
- 验的用例（5 条，全过）：
  - `她在出生点，道具按世界单位摆放`（床 bottom=16.8%、z=183；她 bottom=12%）
  - `地毯没有动作，渲染成纯装饰`
  - `标签降噪`（收藏架在 1.5 身位外不带 `m-near`）
  - `点家具：她先走过去，到达后才给出台词`（点击后 `onPropAction` 未立即调用，323ms 后调用且参数 `id="bed"`）
  - `点门：走到门口后切房间`（`onEnterRoom("garden")`）
- 对应 decision：「怎样算满足 1」

### A3（回归）→ 通过

- `npm test`：`Test Files 5 passed / Tests 28 passed`（新增 WorldScreen 5 例）+ node `19 pass / 0 fail`

### A4（口径断言）→ 通过

- `node tools/audit/docs-links.mjs --verify-claims` → `broken 0 / orphan 0 / claims ok 7/7`

### A5（类型与构建）→ 通过

- `npx tsc --noEmit` exit 0；`npm run build` 176ms，`index-DWnXeD1C.js 315.31 kB`

## 二、diff 是否超出 decision

在范围内：

1. `src/mobile/WorldApp.tsx`：地板层、删金框/常驻星、行动带、信息条徽章（`lookStar`/`topAttr`）、自发反应 effect、点按台词文案「右边→下方」
2. `src/mobile/world/WorldScreen.tsx`：按世界单位重写渲染 + 她（出生点/走路/反应帧）+ 标签近距显示
3. `src/mobile/world.css`：地板/阴影/行动带/气泡尾巴、删金框与星尘样式、rig 去 bob、`m-expanded` 骨骼盒 336→`min(52dvh,480px)`、小世界舞台/道具/她样式
4. `src/mobile/world/skins.ts`：无改动（走路帧从 `WorldScreen` 直读路径）
5. `vite.config.ts`：`/api/comfy/draw` 增加可选 `source` 参数（见下方「超出」第 1 条）
6. `tools/draw-scene.mjs`：新增出图脚本
7. `tests/screens/WorldScreen.test.tsx`：新增 5 例
8. 文档：`产品分析` 头部实施状态、`现行状态` §2 小世界行

超出 / 与决定对不上（如实）：

1. **`vite.config.ts` 加了 `source` 参数**。决定只写「用 /api/comfy/draw 出试点」；第一次试点产出白图后，根因是端点不能换源图，于是给中间件加了可选 `source`（只覆盖 LoadImage 输入，带路径白名单校验，不动其它参数）。这是 dev-only 中间件改动，生产构建不受影响（`grep -c 裁缝铺 dist` 仍为 0，本机构建通过）。
2. 试点出了 **3 张背景**而不是决定的 1 张：第 1 张失败后，为了让你能一次过目三个场景，把 garden/street 也出了。都在 `tools/out/`，未入库。
3. 决定说「`walk` 帧从 skins 取」——实际 `WorldScreen` 直接用本地路径 + `resolveAsset`，没动 `skins.ts` 导出。

没有改动：`public/assets/`、存档结构与键、`netlify/`、`package.json`、`nikki-wardrobe` 数值、密语页。

## 三、未验成 / 未覆盖

- **两块屏的真实观感没在手机/浏览器里看过**（本轮验证止于 jsdom 渲染 + 构建产物 + 源码断言）。需要你 `npm run dev` 看一眼：大厅地板带与角色比例、行动带是否挤、小世界她与家具的比例关系。
- 背景试点**未入库**，替换 `public/assets/scenes/*.webp` 需要转 webp（当前无转换工具链，PNG 1.6–2.6MB 偏大）——待过目后处理。
- 家具 14 件重出（P1 后半）不在本轮（决定「这次不做」）。
- footprint 阻挡、寻路按决定挂起；`WorldScreen` 走路是直线位移，可能穿过其它道具。
