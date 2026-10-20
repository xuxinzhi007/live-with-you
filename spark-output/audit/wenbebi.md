# Audit — 《雯宝》移动端竖屏体验走查

- **生成时间**：2026-10-20T07:22:35Z
- **走查对象**：代码仓库 `/Users/xuxinzhi/Documents/gowork/live-with-you`（React + TS + Vite + 原生 Canvas/DOM 游戏运行时）
- **走查模式**：自动（代码静态走查）+ 用户口述卡点
- **用户口述核心卡点**：「玩法没有亮点，也没有让我游玩下去的动力」
- **走查维度**：Nielsen 10 原则 + responsive + performance（全 12 维度）

## 总览

| 严重度 | 数量 |
| --- | --- |
| 🔴 Blocker | 0 |
| 🟠 Major | 7 |
| 🟡 Minor | 9 |

**按维度分布**：

| 维度 | findings 数 |
| --- | --- |
| visibility | 3 |
| real-world-match | 1 |
| user-control | 2 |
| consistency | 1 |
| error-prevention | 1 |
| recognition | 1 |
| flexibility | 1 |
| aesthetic | 1 |
| error-recovery | 1 |
| help-docs | 1 |
| responsive | 1 |
| performance | 2 |

> 说明：走查发现的问题集中在**「反馈可见性」和「留存动机」**两个主题，与用户口述的「没亮点、没动力」高度吻合。移动端基础适配（safe-area、44px 触控目标、visualViewport 监听）已经做得不错，不是主要矛盾。

## 改版机会点（按优先级排序）

### 🥇 高优先级

**机会点 1：让每次互动都有「看得见」的差异化反馈（解决"没亮点"）**
- 关联 findings：audit-1、audit-2、audit-3
- 优先级理由：三个 finding 全部指向同一件事——雯宝对玩家操作的反应，玩家基本"看不见"。走路/挥手/张望共用同一张待机立绘，状态藏在抽屉里，天气时段毫无显式提示。玩家点完东西，只得到 1.5 秒消失的气泡和几个粒子。这是"没亮点"最直接的技术根因。
- 影响范围：点角色、点家具、拖球、今日片段、出行——几乎全部核心互动。

**机会点 2：给玩家「明天还想打开」的悬念与目标（解决"没动力玩下去"）**
- 关联 findings：audit-13、audit-9
- 优先级理由：首次引导只教"怎么操作"，没有一句讲"为什么值得明天再来"；可交互物件没有可发现提示，玩家靠试错。留存动力缺失不是数值不够，而是缺少"接下来会发生什么"的可见悬念（明天的天气/片段/访客/花开）。
- 影响范围：onboarding、今日片段、街区每日事件、阳台花园、回忆录。

### 🥈 中优先级

**机会点 3：移动端 HUD 收敛 + 单屏可见性 + 性能**
- 关联 findings：audit-7、audit-4、audit-14、audit-15
- 优先级理由：移动端同时挂着 6 套信息面（顶部 presence、右上背包、底部底栏、生活罗盘、今日片段卡片、手势提示），超过宪章定的 HUD 预算；「更多」抽屉里还混着开发者/引擎开关。世界宽 1120px 而屏幕只显示约 1/3，探索靠双指平移，成本高易迷失。fx canvas 每帧全画布重绘是常驻 GPU 负担。
- 影响范围：全屏 HUD 结构、摄像机/平移策略、渲染性能。

**机会点 4：拟人立绘的移动端可读性 + 美术/生图管线**
- 关联 findings：audit-11、audit-16
- 优先级理由：拟人立绘在移动端被缩到 118px（矮屏 88px），表情与动作细节不可读；动作切换靠换整张图、冷切换可能闪白，且多动作资源缺失（walk/wave/look 都只有 idle 一张）。需要成套多动作资源 + 稳定的同角色生图流程。这是用户明确提出的美术/生图诉求，但优先级排在体验结构之后。
- 影响范围：`public/assets`、`src/game/data/pet.js` 精灵映射、puppet/spine 渲染管线。

### 🥉 低优先级

**机会点 5：防错与细节（quick-win 包）**
- 关联 findings：audit-5、audit-6、audit-8、audit-12
- 优先级理由：都是小成本高确定性的修复：布置无撤销、删照片无确认、触屏禁用按钮无解释、失败提示无重试。
- 影响范围：布置模式、回忆录、街区事件弹窗。

## 完整 Findings 清单

### 维度 1：visibility（系统状态可见性）

1. **[major] 角色动作缺乏差异化视觉反馈**
   - 出现位置：`src/game/data/pet.js:5-15` —— `sprites` 映射中 `walk/idle`、`wave`、`look` 全部指向 `idle`，`sit→rest`、`happy→jump`。约 10 种语义状态只有 4 张立绘，多数动作玩家看到的是"站着不动 + 一句气泡"。
   - 修复建议：优先补齐 walk / wave / look / sit 的差异化资源（哪怕先用 2-3 帧差异）；在资源到位前，用缩放/位移/朝向等 transform 手段让动作可区分。
   - 修复成本：medium

2. **[major] 状态与需求反馈太弱**
   - 出现位置：`src/App.tsx:408-413`（pet-stats 藏在「更多」抽屉后）、`src/game/pet.js:87-104`（需求只显示头顶一个小 emoji）。心情/精力/饱腹在主视图不可见。
   - 修复建议：把需求表达并入角色本身（表情/动作/头顶气泡文案），而不是抽屉里的数字；数字面板降级为"更多"里的补充。
   - 修复成本：medium

3. **[minor] 天气与时段变化无显式提示**
   - 出现位置：`src/game/runtime.js:202-216 applyWeather / 606-621 applyPeriod` —— 只改 `body` class 背景，玩家可能完全无感。
   - 修复建议：天气/时段切换时给一条可忽略的轻提示（如生活罗盘文案变化），而非纯背景。
   - 修复成本：quick-win

### 维度 2：real-world-match（系统与现实世界匹配）

4. **[major] 开发者/引擎开关混入玩家菜单**
   - 出现位置：`src/App.tsx:414-420` ——「更多」抽屉里的「跟着鼠标/手指」「摄像机跟随」「左右纠正」是引擎调参，不属于玩家心智模型。
   - 修复建议：移到 `?studio` 调试区或开发环境专用面板，玩家菜单只留生活化入口。
   - 修复成本：quick-win

### 维度 3：user-control（用户控制与自由）

5. **[minor] 布置模式无撤销/重置**
   - 出现位置：`src/App.tsx:267-289 moveFurniture` 直接写 layout 并 debounce 存 localStorage，无 undo 通道。
   - 修复建议：加"撤销上一步"或"重置默认布局"。
   - 修复成本：medium

6. **[minor] 删除回忆照片无二次确认**
   - 出现位置：`src/App.tsx:229-239 removeMemory` 点 x 即删。
   - 修复建议：删除前加一步确认（照片是个人记忆，误删代价高）。
   - 修复成本：quick-win

### 维度 4：consistency（一致性与标准）

7. **[major] 移动端 HUD 信息面过多、互相争夺注意力**
   - 出现位置：`src/App.tsx:356-425` —— 顶部 presence、右上 life-bag、底部 desk-plate、life-compass、today-story 卡片、gesture tip 同时存在，超过宪章「HUD 预算」。
   - 修复建议：合并同类信息面，主视图只保留「角色 + 场景 + 一条生活线索 + 背包 + 底栏」，其余收进抽屉。
   - 修复成本：major-rework

### 维度 5：error-prevention（错误预防）

8. **[minor] 触屏上禁用按钮无解释**
   - 出现位置：`src/game/runtime.js:533-535` —— 零钱不够时按钮 `disabled` 且只在 `title`（hover）里说明，触屏无 hover。
   - 修复建议：禁用态用可见文案（如"零钱不够"）替代 title，或保留可点并弹出说明。
   - 修复成本：quick-win

### 维度 6：recognition（识别优于回忆）

9. **[minor] 可交互物件无"可点"提示**
   - 出现位置：`src/game/runtime.js:891-909 nearbyTouchSpot` 有触屏容错命中，但物件本身无可发现性线索；今日片段有 `is-story-spot` 高亮，日常物件没有。
   - 修复建议：在片段/新手期给物件轻量、短暂的高亮或波纹，之后自然淡出（与宪章"世界内发现"不冲突）。
   - 修复成本：medium

### 维度 7：flexibility（使用的灵活性与效率）

10. **[minor] 快捷键仅桌面，移动端无等效效率路径**
    - 出现位置：`src/game/runtime.js:1172-1183 keydown` 仅键盘。
    - 修复建议：暂不优先——单指游戏本就不强调效率，仅记录。
    - 修复成本：quick-win

### 维度 8：aesthetic（美学与极简设计）

11. **[major] 拟人立绘在移动端缩至 118px/88px，表情与动作不可读**
    - 出现位置：`styles.css:2013-2016`（`--pet-w:118px`）与 `styles.css:2254-2257`（矮屏 `--pet-w:88px`）。
    - 修复建议：拟人方向要求"小尺寸仍能读懂表情"，需要为小屏专门优化构图（脸部占比放大、动作剪影清晰），而非直接缩整图。
    - 修复成本：major-rework（依赖美术资源）

### 维度 9：error-recovery（帮助用户识别/诊断/修复错误）

12. **[minor] 失败提示无重试通道**
    - 出现位置：`src/App.tsx:220-226`（存储满提示）、`src/game/runtime.js:1346-1349`（立绘加载失败气泡）——都只告知，无重试。
    - 修复建议：立绘失败给"重试"入口；存储满引导去回忆录清理。
    - 修复成本：quick-win

### 维度 10：help-docs（帮助与文档）

13. **[minor] 首次引导只教操作，不钩动机**
    - 出现位置：`src/App.tsx:447-461 onboarding` 四步全是"点哪里"，没有一句"明天会发生什么、为什么要回来"。
    - 修复建议：onboarding 末屏埋一个"明天预告"钩子（如"明天阳台的花可能会开"）。
    - 修复成本：quick-win

### 维度 11：responsive（响应式适配）

14. **[major] 世界宽 1120px、屏幕只显示约 1/3，探索靠双指平移**
    - 出现位置：`src/game/runtime.js:641`（`world.w = mobile ? 1120 : 2200`）。角色走动靠摄像机跟随，但玩家想"看全房间"必须平移。
    - 修复建议：移动端房间内容收窄到 1-1.5 屏宽，或提供"缩略总览"而非纯平移。
    - 修复成本：major-rework

### 维度 12：performance（性能感知）

15. **[major] fx canvas 全画布每帧重绘**
    - 出现位置：`src/game/fx.js:8-13`（canvas 尺寸=世界尺寸）、`src/game/fx.js:42-44`（每帧 clearRect 整画布）。移动端世界宽 1120px 起，是常驻 GPU 负担。
    - 修复建议：canvas 只覆盖可视区并跟随摄像机，或缩小粒子画布分辨率。
    - 修复成本：medium

16. **[minor] 立绘冷切换可能闪白、多态资源预加载不足**
    - 出现位置：`index.html:16-19` 仅预加载 4 张；`src/game/renderers/image-pet-renderer.js:10-16` 动作切换时换 src；puppet 模式运行时 fetch 配置+多图。
    - 修复建议：预加载常用动作，或保持上一帧图直到新图 onload 再切换。
    - 修复成本：medium

## 已达标项（走查中确认无需改）

- 移动端 safe-area / `viewport-fit=cover` / `env(safe-area-inset-*)` 处理完整（`index.html:5`、`styles.css` 多处）。
- 触控目标基本 ≥44px（`styles.css:2152-2175`）。
- `visualViewport` resize/scroll 监听与键盘收起适配已做（`src/game/runtime.js:1191-1195`）。
- 存档多 key 均带 try/catch 降级，无痕模式不崩。

## 下一步建议

- **改版方向**：机会点 1、2 是用户口述卡点的直接对应，建议下一步走 Brief 把「差异化反馈 + 留存悬念」沉淀为一页纸改版策略。
- **修复优先**：机会点 5（quick-win 包）成本低、不依赖美术资源，可在改版工程启动前先清掉。
- **顺序提醒**：机会点 4（美术/生图）依赖美术资源产出，不应阻塞机会点 1/2/3 的结构性调整——用占位资源先验证交互，再替换美术。
