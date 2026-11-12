# v6-wenbao-lora-cutout-and-paperdoll 决定

> 落 `specs/v6-wenbao-lora-cutout-and-paperdoll/decision.md`。规则在 `references/scope.md`。

- 级别：L3（新建 ComfyUI「雯宝 LoRA + 抠图」专属工作流、用雯宝 LoRA 重新生成同角色全透明抠图立绘与可穿戴透明配饰图层、实装真正的「纸偶骨骼多层穿戴 + 手动位置/缩放微调系统」）
- 真正要解决的问题（基于真机截图 `image-913bf7ef`、`image-8b99b70d` 与 ComfyUI 截图 `image-b2b56633` 诊断）：
  1. **生成的礼服不是同一个角色（没挂雯宝的 LoRA），而且带着方形背景框没抠图，像一张扑克牌贴在画面中间**：
     - 截图里「杏仁奶昔针织裙」是一个写实比例的陌生女孩坐在窗前，带着整块方形背景框贴在舞台正中央，和「初雪白茶」「小鲸鱼」完全不是同一个角色。
  2. **头饰、手持物、香氛只是挂在左右两边的 4 个圆球里，根本没有穿戴到雯宝身上**：
     - 玩家点选了「奶油雏菊发夹」「向日葵花束」「清晨草木微风」，它们只显示在左右两侧的圆圈图标里，雯宝头顶、手上、身周没有任何变化，也不能调整位置和大小。
  3. **ComfyUI 工作流命名还是旧的「小燕」，且缺少独立的「雯宝 LoRA + 自动透明抠图」工作流**：
     - 用户要求：**不要改动原本的工作流**，新建一个按「雯宝」命名的工作流（如 `MeinaMix_雯宝LoRA_换装抠图.json`），同时复制/建立 `wenbao.safetensors` 模型文件，确保提示词和工作流统一叫「雯宝」。

- 网上成熟的 2D 角色换装（Paper-Doll / 骨骼锚点图层叠加）与抠图是怎么做的？
  1. **同角色一致性（LoRA + 固定姿态比例 + 纯白底色）**：
     - 挂载训练好的角色 LoRA（`wenbao.safetensors`，基于 `xiaoyan.safetensors` 复制命名，保留触发词兼容），配合 `(chibi, full body, standing, front view, looking at viewer, simple background, white background:1.4)`，保证每次生成的不同礼服都是**同一个短发棕眼 Q 版雯宝**！
  2. **高精度边缘洪水抠图 + 腐蚀去白边（Alpha Matting & Defringe）**：
     - 单纯按颜色阈值会把白色衣服抠漏！标准做法是**从画布四周边框向内做连通域洪水填充（Border-Connected Flood-Fill）+ 边缘 1.5px 最小滤波腐蚀去白边 + 高斯羽化 + 统一脚底基线（Baseline Alignment）**，输出 100% 透明底 `.webp`/`.png`，角色内部白色衣服完好无损，外部背景彻底透明！
  3. **真正的「多层纸偶骨骼锚点穿戴（Layered Paper-Doll Rig）」+「可拖拽/缩放装扮微调」**：
     - 角色舞台不再只放一张单图，而是按 **Z-Index 骨骼锚点分层挂载透明部件**：
       - **Layer 10（背景光环槽 `aura`）**：环绕在角色身后的透明香氛特效层（花瓣、星尘、海沫泡泡）。
       - **Layer 20（角色主躯干与礼服层 `dress`）**：经过透明抠图 + 呼吸/轻轻摇摆骨骼动画的同角色雯宝全身立绘。
       - **Layer 30（头顶锚点槽 `hairAcc`）**：锚定在 `headAnchor (x: 50%, y: 16%)` 的透明抠图头饰（发夹、兔耳、珍珠花冠、草帽），**直接戴在雯宝头上，并跟随雯宝呼吸一起上下轻轻起伏！**
       - **Layer 40（手部锚点槽 `handheld`）**：锚定在 `handAnchor (x: 68%, y: 58%)` 的透明抠图手持物（茶杯、花束、八音盒、水晶球），**直接拿在雯宝手边！**
     - **支持玩家自由调整穿戴位置与大小（配件微调模式）**：玩家可点击头饰或手持物，直接微调它的 **偏移坐标 `(dx, dy)`、缩放比例 `scale` 与旋转角度 `rotate`**，真正实现“把饰品戴在身上并随心调整”！

- 怎样算满足：
  1. **新建 ComfyUI 专属工作流（不改原文件）**：
     - 在 `D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\models\loras\` 下复制生成 `wenbao.safetensors`（不动原 `xiaoyan.safetensors`）。
     - 在 `...\ComfyUI\user\default\workflows\` 下**新建** `MeinaMix_雯宝LoRA_换装抠图.json`（内置 `meinamix_v12Final` + `wenbao.safetensors` LoRA + 纯色背景生成 + `ImageColorToMask` / `InvertMask` / `JoinImageWithAlpha` 透明通道合成节点），原 `MeinaMix_小燕LoRA.json` 保持原封不动。
  2. **用「雯宝 LoRA + 自动透明抠图管线」重新生成同角色礼服与透明可穿戴配饰**：
     - 编写并运行 `tools/build-wenbao-lora-cutout.py`：调用本机 ComfyUI (`127.0.0.1:8188`) 挂载 LoRA 生成**同角色 Q 版雯宝**的 3 套新礼服（杏仁奶昔裙、暮色蔷薇裙、星河眠云裙），并用连通域洪水抠图 + 去白边 + 760×760 脚底基线对齐，输出**完全透明底**的立绘！
     - 对所有头饰（`hairAcc`）、手持物（`handheld`）、香氛（`aura`）执行透明抠图生成 `public/assets/nikki/cutout/*.webp`。
  3. **舞台实装「真·上身多层穿戴（Paper-Doll Rig）+ 饰品位置/大小微调器」**：
     - 雯宝在舞台上不再有那个丑陋的方形白框，而是**完全透明抠图的同角色立绘**站在画卷中央！
     - 选中的**头饰直接戴在雯宝头顶**、**手持物直接拿在雯宝身侧手边**、**香氛光环围绕在雯宝身后**，且全部随呼吸骨骼同步浮动！
     - 新增 **「🔧 饰品位置微调」** 浮动控件：支持调整头饰/手持物的上下左右位置与缩放大小，并自动保存。
  4. 更新 `README.md` 详细说明「雯宝 LoRA 换装工作流、透明抠图脚本与纸偶骨骼锚点架构」。
  5. `npm run test:mobile` 与 `npm run build` 100% 通过。

- 最小充分方案：
  1. 已拍板：按上述方案（1.不改原工作流，新建 `MeinaMix_雯宝LoRA_换装抠图.json` 与 `wenbao.safetensors` 2.用雯宝 LoRA 重新生成同角色 Q 版礼服并做 100% 透明抠图，干掉方形背景框 3.头饰/手持物/香氛全部透明抠图并直接穿戴到雯宝头顶与手部锚点上，支持手动微调位置与大小）执行。

- 风险：零破坏风险，原 ComfyUI 工作流与模型文件完全保留。
