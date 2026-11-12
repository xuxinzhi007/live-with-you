# v8-game-screen-flow-and-skeleton-editor 决定

> 落 `specs/v8-game-screen-flow-and-skeleton-editor/decision.md`。规则在 `references/scope.md`。

- 级别：L3（按正规商业手游设计：**1. 游戏启动封面（Title Screen）→ 2. 纯净主大厅（Home Lobby，功能分屏不堆叠）→ 3. 独立的每套服装专属骨骼树与可视化关节拖拽校准工作台（Per-Costume Hierarchical Skeleton Rig & Bone Editor）**）
- 真正要解决的问题（基于真机截图 `image-93559ed5` 深度剖析）：
  1. **为什么看着还是杂乱？因为把「主大厅」「闯关横幅」「左右4个圆球」「衣橱列表」「底部5个Tab」全塞在同一张屏幕里了！**
     - 正常的手游（《奇迹暖暖》《闪耀暖暖》）从来不会在一张屏里同时塞满大厅、关卡、挂件球和衣橱！
     - 截图里「深海小鲸鱼女仆」的头顶甚至被上面的 `终章 星河·仲夏夜的许愿庆...` 横幅削掉了一截！
  2. **缺少正规游戏的「启动封面页（Title Screen）」与「场景状态机（Screen State Machine）」**：
     - 打开网页直接蹦进一个塞满按钮的面板，完全没有进入游戏的仪式感。
     - 正规游戏应该有：**【启动封面（Title Screen：Logo + 动态雯宝 + 点击进入游戏）】→【纯净主大厅（Home Lobby：全屏干净展示雯宝 + 极简入口按钮）】→ 点「换装衣橱」才展开衣橱抽屉 / 点「主题闯关」进入独立章节地图页**！
  3. **骨骼系统之前只是“写死的固定百分比点位”，没有按「每套生成的服装立绘（Per-Dress Skeleton）」独立建树，也不能直接在人身上拖拽关节（Joints）**：
     - 因为每次 ComfyUI 生成的新服装立绘（比如 Q 版大头 `original`、斜挥手的 `maid`、偏高挑的 `dress-apricot-tea`、`dress-rose-waltz`），头顶、刘海、左右手、腰部在画布里的位置都不同！
     - 如果所有衣服共用同一个死点位，换一套生成图，头饰就会飘到半空、手提篮就会悬空！
     - 必须实现一套**「每件服装独立保存的层级骨骼树（Per-Dress Hierarchical Skeleton Tree）+ 可视化骨骼关节拖拽校准器（Visual Bone Joint Editor）」**：
       - **层级父子骨骼（Hierarchical Bones）**：`root（根骨骼/脚底）` → `pelvis（骨盆/腰）` → `torso（胸腔）` → `neck（颈部）` → `head（头部中心）` → `crown（头顶插槽）/ hairSide（侧发夹插槽）`，以及 `torso` → `shoulderL / shoulderR` → `handL / handR（左右手插槽）`。
       - **直接在画面上拖动骨骼节点（Pointer Drag on Canvas）**：开启「🦴 骨骼校准模式」后，角色身上直接渲染出**可视化的骨骼连线（Bone Links）与可按住直接拖动的关节点（Draggable Joint Handles）**！
       - **每套生成立绘独立记忆骨骼 + 一键导出/复制骨骼 JSON + 生成 ComfyUI OpenPose 参考图**：你为任意一张新生成的衣服调好骨骼点后，这套衣服永远记住自己的头顶和左右手位置，而且可以把调好的骨架一键导出或作为后续生成新衣服的对位基准！

- 怎样算满足：
  1. **正规手游三层画面流（Screen Flow）**：
     - **① 游戏启动封面（`TitleScreen`）**：唯美全屏主视觉背景、飘落花瓣星尘、《雯宝 · 心境衣橱》徽标、版本号、以及呼吸闪烁的 **「✨ 点击开始游戏 (Tap to Start)」**。
     - **② 纯净主大厅（`LobbyScreen`）**：不把关卡横幅和衣橱硬塞在一起！主大厅中央 80% 面积完整展示雯宝全身与骨骼穿戴（**绝不削头顶！**），角色头顶有轻巧互动气泡，右侧仅放极简垂直功能入口（`👗 换装`、`👑 闯关`、`✨ 幻阁`、`🦴 骨骼校准`、`💬 密语`）。
     - **③ 换装衣橱模式（`WardrobeMode`）**：进入换装时，上半屏为无遮挡的全身试衣镜（拿掉挡头顶的关卡横幅和左右 4 个累赘圆球），下半屏为轻巧的分类衣架。
  2. **真正的「每套服装独立层级骨骼系统 + 可视化关节直接拖拽编辑器」（`src/mobile/world/skeleton-system.ts`）**：
     - 定义完整的父子骨骼树（`root` -> `torso` -> `neck` -> `head` -> `crown` / `hairSide`；`torso` -> `handL` / `handR`）。
     - 为现有的 5 套礼服（`dress-snow-white`、`dress-whale-maid`、`dress-apricot-tea`、`dress-rose-waltz`、`dress-starlight-dream`）各自预置贴合其原画构图的专属骨骼节点坐标！
     - 在「🦴 骨骼校准工坊」模式下：
       - 画面上用 SVG 实时绘制 **父子骨骼连线（青色/金色骨骼杆）+ 可直接用手指/鼠标按住拖动的关节圆环（`head`、`crown`、`hairSide`、`neck`、`torso`、`handL`、`handR`）**。
       - 拖动任意关节时，绑在该骨骼上的头饰/手持物实时跟随移动；支持调整该插槽的缩放 `scale` 与旋转角 `rotate`，并支持 **「📋 复制当前服装骨骼 JSON」**，方便后续批量生成图片时直接使用！
  3. `npm run test:mobile` 与 `npm run build` 100% 通过。

- 最小充分方案：
  1. 已拍板：按上述方案（1.新增正规游戏启动封面页 + 纯净主大厅，彻底拿掉挡住小鲸鱼头顶的关卡横幅和累赘圆球 2.实装每套衣服独立的父子骨骼树 + 可直接在画面上按住拖动关节点的「🦴 可视化骨骼校准系统」）执行。

- 风险：零数据丢失，完全兼容现有衣橱与关卡存档。
