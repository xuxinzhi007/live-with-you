# v9-fk-mesh-skeleton-rigging 决定

> 落 `specs/v9-fk-mesh-skeleton-rigging/decision.md`。规则在 `references/scope.md`。

- 级别：L3（把简单的“坐标点贴图”升级为真正的 **Spine / Live2D / Blender 2D Cutout 级分层正运动学（FK）+ 关节切割蒙皮（Layered Articulated Cutout Rig）系统**）
- 真正要解决的问题（基于你的截图 `image-1b853986` 与 Blender / Live2D / Spine 原理对比）：
  1. **为什么之前那个看着像“基础定位点”而不是真正的骨骼？**
     - 之前只是在一张死板的整图上面画了几个圆点，拖动圆点只是在平移头饰贴纸，**雯宝本人的头不能歪、手臂不能挥动、身体各部位没有分成独立图层绕关节枢轴（Pivot）旋转**！
     - 在 **Blender (Grease Pencil / Cutout)、Spine、Live2D、LÖVE 2D (Spine Runtime)** 中，真正的 2D 纸片人骨骼绑定包含 4 个核心要素：
       1. **分层切片（Layered Part Slicing / Slots）**：把角色拆分为独立的部位层（`hairBack 后发` → `body 躯干与裙子` → `armL 左臂` → `armR 右臂` → `head 头部` → `hairAcc 头饰插槽` → `handheld 手持插槽`），并且每个部位沿着关节枢轴（Pivot：颈部、左肩、右肩、腰部）做平滑羽化切割。
       2. **骨骼树与正运动学变换矩阵（Forward Kinematics, FK Matrix）**：每根骨骼（**楔形骨骼棒 Octahedral/Tapered Bone**，有粗头 Base Pivot 和尖端 Tip，像 Blender 的 Bone 一样，而不是一条虚线！）拥有 **静止绑定姿态（Rest Pose / Setup Mode）** 与 **动作姿态（Pose Mode：旋转角 `rotation`、位移 `tx, ty`、缩放 `scale`）**。当旋转父骨骼（比如旋转 `torso 胸腔` 弯腰，或旋转 `head 脖子` 歪头）时，子骨骼和绑在上面的部件（头发、发夹、手臂、手提篮）通过 **2D 仿射变换矩阵级联旋转（Cascade FK Rotation）**！
       3. **双模式切换（像 Blender / Spine 一样的 `🔧 绑定模式 Setup Mode` vs `🎬 姿态动画模式 Pose Mode`）**：
          - **绑定模式（Setup / Edit Bones）**：针对不同 ComfyUI 生成的立绘，调整骨骼关节的基准位置（Rest Pose Pivot），让骨骼对齐这张图的脖子、肩膀、手腕，系统自动按骨骼位置对立绘进行**分层切片蒙皮（Auto-Slice Skinning）**！
          - **姿态模式（Pose / Animate Mode）**：拖动骨骼尖端或滑块，**直接让雯宝歪头、挥左手、挥右手、弯腰呼吸、摆 Pose 拍照**！
       4. **物理弹簧头发/配饰摆动（Spring Bone / Live2D Physics）**：当雯宝歪头或做呼吸/挥手动作时，头饰、发梢和手持物带有阻尼弹簧跟随摆动。

- 网上（Spine / Live2D / Godot Cutout / LÖVE 2D）的标准实现架构（本轮直接落地）：
  1. **构建真正的 Canvas/WebGL 分层骨骼蒙皮渲染器（`src/mobile/world/fk-skeleton-rig.ts`）**：
     - **自动部位分层切割（Auto-Part Slicing with Feather Seam）**：给定任意一张透明抠图的雯宝立绘，根据当前衣服的 `Setup` 骨骼关节点（`neck 颈部`、`shoulderL 左肩`、`shoulderR 右肩`、`hip 腰胯`），在内存中将单张立绘自动切分为 **4 个带柔化接缝的独立部位图层（`Torso/Skirt 躯干裙摆层`、`Head 头部层`、`LeftArm 左臂层`、`RightArm 右臂层`）**，并用背景色/衣领色自动补齐旋转时的接缝防穿帮！
     - **FK 级联矩阵求值（World Transform Matrix）**：
       $$M_{\text{world}}(\text{bone}) = M_{\text{world}}(\text{parent}) \cdot T(\text{pivot}) \cdot R(\theta_{\text{pose}} + \theta_{\text{anim}}) \cdot S(s) \cdot T(-\text{pivot})$$
       当 `head` 骨骼旋转 $+15^\circ$（歪头）时，雯宝的**整个头部图层 + 头顶皇冠插槽 + 侧发夹插槽**一起绕着脖子枢轴（`neck`）自然歪头旋转 $+15^\circ$！当 `armR` 骨骼旋转 $-30^\circ$（抬右手）时，雯宝的**右臂图层 + 右手花篮插槽**一起绕着右肩枢轴（`shoulderR`）抬起！
     - **Blender 风格锥形骨骼可视化器（Tapered Bone Gizmo）**：
       不再画丑陋的大字圆球和蓝虚线！改用 Blender / Spine 标准的**半透明锥形骨骼棒（从关节根部粗端指向子关节尖端的菱形/锥形骨骼）+ 旋转弧线手柄**！
     - **内置骨骼动作预设（Idle 呼吸摇摆 / Wave 挥手问好 / Tilt 歪头卖萌 / Cheer 欢呼雀跃）**：所有生成出来的静态立绘，一旦绑定这套骨骼，立刻就能做出真正的歪头、挥手、呼吸等骨骼动画！

- 怎样算满足：
  1. 新增 `src/mobile/world/fk-skeleton-rig.ts`：实现完整的 **FK 骨骼树矩阵计算、单张立绘自动 4 部位分层切割蒙皮（Head / Torso / ArmL / ArmR）、雙模式（`Setup 骨骼对位模式` vs `Pose 动作摆姿模式`）与 4 套骨骼关键帧动画（呼吸、歪头、挥手、欢呼）**。
  2. 升级 `WorldApp.tsx` 的「🦴 骨骼工坊」：
     - 绘制 **Blender / Spine 标准锥形骨骼（Tapered Bones）**，去掉遮挡脸部的大圆球文字。
     - 支持切换 **「🔧 骨骼对位（Setup：针对不同生成图调整脖子/肩膀/手腕枢轴点）」** 与 **「🎬 动作摆姿（Pose：直接拖动骨骼让雯宝歪头、抬手、转身，或一键播放『歪头卖萌 / 挥手 / 欢呼』骨骼动画）」**！
  3. `npm run test:mobile` 与 `npm run build` 100% 通过。

- 最小充分方案：
  1. 已拍板：按标准二次元人体全身骨骼架构（Biped Humanoid Rig：包含骨盆 `pelvis`、胸腔 `torso`、颈/头 `head`、头顶/侧发插槽 `crown/hairSide`、左右上臂与手腕 `armL/handL`、`armR/handR`、**左右大腿与小腿脚踝 `legL/footL`、`legR/footR`** 共 6 大身体分层部位 + 11 根完整人体锥形骨骼）执行本次升级：
     - 自动将任意生成的全身立绘按关节切割为 **6 个独立蒙皮图层（Head 头部、Torso 躯干裙摆、ArmL 左臂、ArmR 右臂、LegL 左腿、LegR 右腿）**；
     - 实装完整的全身 FK 正运动学旋转矩阵（可歪头、挥左右手、**迈左右腿走路/踢腿/欢呼跳跃**）；
     - 提供 Blender/Spine 风格全身锥形骨骼棒 + `🔧 骨骼绑定 (Setup)` / `🎬 动作摆姿 (Pose)` 双模式与 5 套全身骨骼动画（待机呼吸、歪头卖萌、挥手问好、轻快踏步 Walk、开心雀跃 Cheer）。

- 风险：纯前端 Canvas 2D 分层蒙皮与 FK 矩阵变换，60FPS 流畅运行，不依赖付费 Spine 插件。
