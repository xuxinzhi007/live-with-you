# direction-realign 决定

- 级别：L3（删除模块、删除产品文档、改产品方向、清 git 历史）
- 真正要解决的问题：仓库里同时存在两条互相否决的产品线（「可走动的小世界」与「暖暖式换装闯关抽卡」），宪章写的是一票否决另一条，代码做的是另一条。死代码、死资源、死文档共存，任何人（包括三个月后的作者）无法判断哪份是真实现。
- 怎样算满足：
  1. `docs/product-charter.md` 不存在；
  2. 入口递归闭包之外没有 `.ts/.tsx`；
  3. `git ls-files` 里没有 `public/assets/**/*.png`；
  4. 顶层依赖只剩实际 import 的；
  5. `npm run build` 与 `npm run test:mobile` 全绿；
  6. 新增一份「代码真实现状」文档，取代 README 里已失效的描述。

## 现有能力（证据）

### 已经死了但还挂在仓库里

| 项 | 证据 | 状态 |
| --- | --- | --- |
| `src/mobile/world/runtime.ts` (519 行) | 入口递归闭包不可达；仅 `poses.ts` 引用其 type，而 `poses.ts` 本身也不可达 | 已证实 |
| `src/mobile/world/poses.ts` (37 行) | 闭包不可达 | 已证实 |
| `src/mobile/world/assets.ts` (43 行) | 闭包不可达（仅被死文件 poses 引用） | 已证实 |
| `src/mobile/world/WorldView.tsx` | `git log --diff-filter=D` 显示已在 6a4ce5c 删除，但 `docs/current-state-and-next.md` 仍以它为主力架构 | 已证实 |
| `pixi.js@^8.22.0` | `grep -rn "from \"pixi" src` 零命中，`dist` 里无 pixi chunk | 已证实 |
| `styles-mobile.css` (352 行) | 无任何 `.tsx` 引用 | 已证实 |
| `public/assets/**/*.png` 共 30 个 | 已跟踪 9.2 MB；`.webp` 同名兄弟文件也在仓库；`index.html` preload 的是 webp | 已证实 |
| `docs/current-state-and-next.md` | 描述的房间/花圃/踢球/点地走动，其实现 `runtime.ts` 已不可达 | 存在冲突（与代码冲突） |

### 已经死了一半

| 项 | 证据 | 状态 |
| --- | --- | --- |
| `useWorldGame` 的 13 个返回值 | `WorldApp.tsx:157` 只解构 `{ state, setSkin, companionAct }`；`enterRoom/runProp/catchBall/recordKick/markIntroSeen/appendJournal/plantSeed/sellBouquet/wishGacha/chooseEncounter` 无外部调用方 | 已证实 |
| `codex.ts` (840 行) | `WorldApp` 只 import `getBondLevelInfo`；`CODEX_ENTRIES / STREET_ENCOUNTERS / drawFountainWish / COMPANION_WISHES / getCodexProgress / plantChosenFlower / sellFlowerBouquet` 全无渲染方 | 已证实 |
| `rooms.ts` (355 行) | 只被 `actions.ts` 与 `useWorldGame` 的 type 引用，而这两者的调用方都不在闭包里 | 已证实 |
| `actions.ts` (376 行) | 只被 `useWorldGame` 引用，`runProp/enterRoom/catchBall/recordKick` 无外部调用方 | 已证实 |
| 图鉴屏 `screen === "codex"` | `WorldApp.tsx:1340-1390` 渲染的是 `SUIT_DEFS`/`WARDROBE_ITEMS`（换装），与 `codex.ts` 的 18 条 CODEX_ENTRIES 无关——**同名不同物** | 已证实（命名陷阱） |

### 产品线冲突

| 项 | 证据 |
| --- | --- |
| 宪章禁止抽卡 | `docs/product-charter.md`「绝不做什么」第 6 条、参考作品「不借鉴…抽卡」 |
| 代码实现抽卡 | `nikki-wardrobe.ts:rollPavilionGacha`、`SUIT_DEFS` 共鸣、`itemStars` 升星、`coupons` 礼券经济、`STYLING_STAGES` 6 章闯关 |
| 宪章自设的死刑判决 | 「一票否决：移除雯宝和她的小屋后，这项功能仍可换皮成任意农场或放置手游」——`STYLING_STAGES` + `rollPavilionGacha` 换掉立绘即可成为任意暖暖类游戏 |

- 旧决定：无卡片（知识库 `docs/` 下无排查卡片目录）。
- 实现是否仍符合宪章：**不符合**，`src/mobile/world/nikki-wardrobe.ts:rollPavilionGacha`、`SUIT_DEFS`、`STYLING_STAGES`。

## 复核更正（需求方拍板后重查）

我第一版写「B 小世界线资产一件都没有」是**错的**。重新核对：

```
public/assets/scenes/  共 21 张 webp
  home.webp / garden.webp / street.webp        三房间背景，全部存在
  prop-bed/desk/shelf/plant/rug/ball/tree/     13 件物件贴图，全部存在
  lamp/fountain/stall/bench/door/crate/plot
  plot-bud/sprout/bloom-daisy/-rose/-sunflower 花圃四阶段，全部存在
```

`rooms.ts` 定义了 3 房间 18 个可交互物件，`actions.ts` 有 rest/read/sit/shelf/buySeed/wish/plot 七个真实分支。**B 线是完整的、有美术的、能跑的**，只是 UI 层被抽掉了。

同时 `nikki-wardrobe.ts:bgScene` 已经在用 `assets/scenes/home.webp / garden.webp / street.webp` —— **两条线本来就共用同一套场景资产**。

更正后的事实：两条线不是「资产互斥」，而是「UI 互斥」。

## 已确认的决定

**主线合并：换装 + 小世界，不二选一。** 需求方判定两者不冲突。复核后同意并更正上节。

合并的接缝已经存在，不新建抽象：

| 已有符号 | 位置 | 合并后角色 |
| --- | --- | --- |
| `ROOMS` | `rooms.ts:80` | 3 房间 × 18 物件 |
| `applyPropAction` | `actions.ts:113` | 物件交互 7 分支 |
| `useWorldGame` 未用的 10 个返回值 | `useWorldGame.ts:154` | 已写好，只缺调用方 |
| `bgScene` | `nikki-wardrobe.ts:108` | 两线共用场景贴图（已证实） |
| `nk-stage-card` | `WorldApp.tsx:744` | 舞台容器，两线都挂这里 |

**本轮做**：
1. `WorldApp.tsx:83` v7 断链修复 + 存档迁移测试（需求方指定 #3）。
2. 死代码铲除：`runtime.ts` / `poses.ts` / `assets.ts` / `pixi.js` / `styles-mobile.css` —— 这些对合并主线无用。
3. 文档矫正：删宪章、README 改为代码真实现状。

**本轮不做**：
- PNG 资产治理（需求方明确暂缓）。
- 小世界 UI 挂载（`runtime.ts` 已死，重新挂载需先决定用 DOM 还是 Pixi 重写，属下一刀）。
- `WorldApp.tsx` 拆分、动画循环去 setState、经济公式搬回纯函数。

## 下一刀（本刀之后的边界）

1. `WorldApp.tsx`(1574 行) 按屏幕拆成 `src/mobile/screens/*`，机械搬运不改逻辑。
2. 动画循环改 ref + 直接写 DOM，去掉每帧 `setState`。
3. 经济公式（`craftCost`/`upCost`）从 UI 回调搬回 `nikki-wardrobe.ts` 并补测试。

## 风险

- 碰到持久化：`engine/storage.ts` 的 `world` 存档归一化、`WorldApp.tsx:loadNikkiState` 的 v4/v6/v8 三层回退链（**缺 v7**）。删错会让老用户静默丢档，需在决定里写清保留哪条链。
- 删 git 历史不可回退，且影响所有协作者。需独立确认。

## #3 存档断链：三处缺陷（已证实）

| # | 缺陷 | 位置 | 后果 |
| --- | --- | --- | --- |
| 3a | 回退链 `v8 → v6 → v4` 缺 v7 | `WorldApp.tsx:85-88` | 只写过 v7 的用户存档读不到，静默从 40 礼券开局 |
| 3b | `equipped` 无槽位合法性校验，直接 spread | `WorldApp.tsx:105` | 旧档里已下架的 item id 被保留；`getWardrobeItem` 靠 `?? WARDROBE_ITEMS[0]` 兜底成**同槽位以外**的单品（`getWardrobeItem` 不校验 slot） |
| 3c | `itemStars` 值不过滤，`coupons` 只判 `typeof number` | `WorldApp.tsx:107,109` | `NaN` / 负数 / 小数入库，`coupons: NaN` 让所有购买判定永远失败 |

修法（不引入新抽象，复用 `nikki-wardrobe` 已有符号）：

- 回退链改为 `v8 → v7 → v6 → v5 → v4`（v5/v7 与 v8 形状兼容，都是同结构）。
- 每个槽位用 `WARDROBE_SLOTS` 校验；非法 id 落回该槽位的 `DEFAULT_EQUIPPED_OUTFIT[slot]`。
- `itemStars` 值 clamp 到 `1..5` 整数；`coupons` clamp 到 `0..999999`。
- 写进 `nikki-wardrobe.ts` 的纯函数 `normalizeNikkiSave(raw)`，`WorldApp` 只调它，测试直接测纯函数。

## 美术与换装的调研结论（详见 art-research.md）

调研跳出了本仓库，只取一手官方文档。四条硬证据推翻了当前实现的三处结构性前提：

1. **ComfyUI 已能原生输出 alpha 通道**（Qwen-Image-2.1）。"生成后抠图"的两步管线不再必要。
2. **角色一致性有专门模型**（FLUX.1 Kontext / Qwen-Image-Edit-2511），且支持 16 个参考图槽位。同一角色换装是模型原生能力。
3. **局部改款用 mask + inpaint**，不需要整图重绘。对应「升星改外观 / 染色」玩法。
4. **商业 2D 换装的通行结构是 slot / skin / attachment 三层**（Spine 官方文档）。动画只认 slot 名。

对应到当前仓库的三个结构性错误：

| # | 错误 | 证据 |
| --- | --- | --- |
| E1 | 用运行时洪水填充代替资产层 alpha | `paper-doll-rig.ts:419` 外框种子 BFS；25 张资产全是 RGB，color type=2 |
| E2 | 用矩形 `polygon()` 选区伪造分层 | `skeleton-system.ts` 6 处硬编码百分比 clipPath，切的是矩形不是轮廓，旋转必穿模 |
| E3 | 一张图兼扮卡面与纸偶部件 | 卡面要背景氛围，纸偶要全透明，二者互斥 |
| E4 | 分辨率取模型能力的 1/16 | 资产 512×640，模型原生 2024×2048 |

**结论**：美术问题不是「图不够好看」，是**资产层的分层与透明通道缺失**，被运行时代码硬凑了。补画质无意义，必须先改资产管线。

这也解释了为什么合并主线是对的：`ROOMS` 的场景资产（21 张 webp）是**已经做对的**——背景、物件、花圃各司其职，天然符合 slot 结构。而换装线恰恰是没做对的那条。合并的正确形态是：**用场景那套「资产各司其职」的思路，重做换装的资产层。**

## 下一刀的形态（本次调研后更新）

1. 资产管线改为一次出图带 alpha + 分层（dress / hairAcc / handheld / aura 各自独立透明层），而不是出一张整人像再切。
2. `skeleton-system` 的 `computeHumanoidPartSlices` 矩形切片**整个删掉**。角色本体作为单一 sprite，只做整体变换；各槽位作为独立图层叠加。这是 Spine 的 slot 思路，不需要绑骨。
3. 小世界 UI 挂载复用 `ROOMS` / `applyPropAction`，场景资产已就绪。

## 并行分工（按文件占用切，不按功能切）

并行只看一件事：两个 agent 改不改同一个文件。

| 波次 | Agent | 任务 | 独占文件 | 依赖 |
| --- | --- | --- | --- | --- |
| 波1 | **A** | 资产管线：开启 alpha，出分层，去失败验收 | `tools/generate-comfy-assets.mjs`、`tools/audit/`、`package.json:scripts` | 无 |
| 波1 | **B** | 删矩形切片，改为 slot 叠加 | `src/mobile/world/skeleton-system.ts`、`paper-doll-rig.ts` | 无 |
| 波1 | **D** | #3 存档断链 3a/3b/3c | `src/mobile/world/nikki-wardrobe.ts`、`tests/` | 无 |
| 波2 | **C** | 小世界 UI 挂载 | `src/mobile/WorldApp.tsx`、`world.css` | 需 A/B/D 落地后 |

**为什么 C 必须最后**：`WorldApp.tsx` 是 B 和 C 的公共文件，1574 行。B 要删 `partSlices.map(...)` 那段渲染；C 要新增小世界屏幕。同文件并行必冲突，且 C 依赖 B 之后的渲染形态。

**为什么 B 不碰 WorldApp.tsx**：B 只改 `skeleton-system.ts` 里 `computeHumanoidPartSlices` 的导出，保留同名空实现让 WorldApp 编译通过，由 C 统一删调用点。这样 B 与 C 不重叠。

验收由我在波 1 和波 2 之间、以及波 2 之后各做一次完整检查（tsc + build + test + 实际画面）。
