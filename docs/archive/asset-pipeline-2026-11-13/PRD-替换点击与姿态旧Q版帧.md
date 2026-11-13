# 雯宝资产管线 · 替换点击与姿态旧 Q 版帧（PRD）

- 日期：2026-11-13（Asia/Shanghai）
- 作者：小燕资产管线
- 范围：只覆盖默认皮肤 `original` 里仍在使用的旧 Q 版姿势帧（点击 / 坐下 / 躺下）如何按现行官方线补图、去底、对齐，以及过目后再换进舞台。不替代 Live With You 的客户端 PRD，不替代 comfyui 的出图执行说明。
- 本机工程：`C:\Users\ZhuanZ1\Desktop\wenbebi`，活动分支 `featurle/xinzhi_feat`
- 配套：资产契约见同目录既有文档；产品侧资源清理见 `docs/wenbao-product/PRD-资源清理与新方案.md`；产品侧姿势方案见 `docs/wenbao-product/PRD-剩余姿势换新图.md`。
- 状态：**动作图按官方 Qwen 线可以先出；去底与 760 对齐在新图到位之后做；换进 `public/assets` 必须目视过审后再执行。本稿不提交、不改官方 Qwen JSON、不直接换帧。**

用户最新指示是：先出需要的动作图，再做方案与替换。本方案按此顺序，**不把官方出图卡在本 PRD 评审通过之后**。

---

## 结论（先看这里）

1. **点击看到的还是旧 Q 版。** 默认衣服 `dress-snow-white`（`skinId: "original"`）在大厅点角色时，会走 `playStageMotion("react")`，约 720 毫秒内把舞台立绘切到 `assets/characters/original/react.webp`。该文件仍是 2026-11-09 的 Q 版：大头、双手高举的跳跃、白 T 看起来像连体裙、赤脚，和已经换上的官方站立形象不是同一条线。`sit.webp`、`sleep.webp` 同样是当天留下的旧 Q 版帧。
2. **已换新的只有待机、呼吸、走路、头像。** 2026-11-13 已把 `idle.webp`、`avatar.webp`、`breathe-1..4.webp`、`walk-1..4.webp` 换成官方站立母图的去底对齐件（以及由新待机程序派生的呼吸 / 走路）。女仆皮肤全程未动。已过审的 10 张 Qwen 衍生图全是站姿或视角变化，**没有点击、坐下、躺下**，不能硬顶这三个槽位。
3. **本轮建议只补 `react` / `sit` / `sleep` 三张。** 先按下文姿势简报走官方 Qwen 线出图（母图 + 自然语言姿势提示，不挂角色 LoRA，保持白 T、白短裤、白鞋和正常比例）。图出来后再做 isnet-anime 去底和 760 对齐；过目通过后再替换对应文件。呼吸和走路虽然是程序派生、不是过审走姿真图，但不在本轮替换范围内，以免把点击问题再摊成另一场换图。

---

## 1. 问题

用户反馈：点角色时仍会跳出历史上的 Q 版图，要求换成新的官方形象；先写方案，后续再评审替换。同时已明确：**需要的动作图可以先出。**

本机 2026-11-13 核对，默认皮肤三个槽位仍是旧帧：

| 槽位 | 客户端路径 | 文件 mtime | 体积 | 画布 | 可见框（alpha>8） | 现状 |
|------|------------|------------|------|------|-------------------|------|
| 点击 / 短交互 | `public/assets/characters/original/react.webp` | 2026-11-09 22:21:24 | 49 856 B | 760×760 RGBA | 429×593，bbox (166,156)–(594,748)，中心 x=380，脚底 y=748 | 旧 Q 版，双手高举跳跃、赤脚 |
| 坐下 | `public/assets/characters/original/sit.webp` | 2026-11-09 22:21:24 | 64 016 B | 760×760 RGBA | 429×715，bbox (166,34)–(594,748)，中心 x=380，脚底 y=748 | 旧 Q 版，抱膝托腮眨眼、赤脚 |
| 躺下 | `public/assets/characters/original/sleep.webp` | 2026-11-09 22:21:24 | 40 560 B | 760×760 RGBA | 429×443，bbox (166,306)–(594,748)，中心 x=380，脚底 y=748 | 旧 Q 版，侧躺蜷睡、赤脚，头侧有闪光点 |

对照已换新的待机：`idle.webp` mtime 2026-11-13 03:27:17，44 798 B，可见约 239×732，bbox (261,17)–(499,748)，中心 x=380，脚底 y=748。这是官方比例的白 T、白短裤、白鞋站立，和上面三张 Q 版大头图一眼就能分开。

`public/assets/characters/metrics.json` 里 `react` / `sit` / `sleep` 的量测仍是旧图数据；换图后必须按新图重测，不能继续用 429 宽、Q 版头身去卡新官方帧。

---

## 2. 库存与客户端引用

### 2.1 默认皮肤 `original`（`public/assets/characters/original/`）

量测口径与 `tools/character/spec.json` 一致：画布 760，alpha>8 为可见，脚底目标 y=748，中心目标 x=380。

| 文件 | mtime | 体积 | 可见（宽×高） | 脚底 / 中心 | 来源判断 |
|------|-------|------|----------------|-------------|----------|
| `idle.webp` | 2026-11-13 03:27:17 | 44 798 B | 239×732 | 748 / 380 | 新官方站立，已替换 |
| `avatar.webp` | 2026-11-13 03:27:17 | 11 670 B | 160×160 裁切 | — | 新官方头像，已替换 |
| `breathe-1.webp` | 2026-11-13 03:27:17 | 44 656 B | 239×732 | 748 / 380 | 由新待机程序派生 |
| `breathe-2.webp` | 2026-11-13 03:27:17 | 45 072 B | 239×735 | 746 / 380 | 同上；脚底略偏离 748 |
| `breathe-3.webp` | 2026-11-13 03:27:17 | 45 356 B | 239×738 | 745 / 380 | 同上；脚底略偏离 748 |
| `breathe-4.webp` | 2026-11-13 03:27:17 | 45 218 B | 239×735 | 747 / 380 | 同上；脚底略偏离 748 |
| `walk-1.webp` | 2026-11-13 03:27:17 | 46 754 B | 254×728 | 748 / 379.5 | 由新待机程序派生，轻微摆动 |
| `walk-2.webp` | 2026-11-13 03:27:17 | 45 896 B | 239×732 | 748 / 380 | 同上 |
| `walk-3.webp` | 2026-11-13 03:27:17 | 46 818 B | 252×725 | 748 / 379.5 | 同上 |
| `walk-4.webp` | 2026-11-13 03:27:17 | 45 896 B | 239×732 | 748 / 380 | 同上 |
| `react.webp` | 2026-11-09 22:21:24 | 49 856 B | 429×593 | 748 / 380 | **旧 Q 版，本轮要换** |
| `sit.webp` | 2026-11-09 22:21:24 | 64 016 B | 429×715 | 748 / 380 | **旧 Q 版，本轮要换** |
| `sleep.webp` | 2026-11-09 22:21:24 | 40 560 B | 429×443 | 748 / 380 | **旧 Q 版，本轮要换** |

目录里没有 `body.png` / `head.png` / `arms-front.png`。分层四件套仍暂停（`PHASE1_LAYERED_OUTFIT_IDS = []`），本轮不补这些层。

### 2.2 客户端实际会请求哪张图

`src/mobile/world/skins.ts` 中 `original` 的槽位与文件一一对应：

- `idle` → `assets/characters/original/idle.webp`
- `breathe` → `breathe-1.webp` … `breathe-4.webp`
- `react` → `assets/characters/original/react.webp`
- `walk` → `walk-1.webp` … `walk-4.webp`
- `sit` → `assets/characters/original/sit.webp`
- `sleep` → `assets/characters/original/sleep.webp`
- `avatar` → `assets/characters/original/avatar.webp`

默认衣服 `dress-snow-white`（`src/mobile/world/nikki-wardrobe.ts`）使用 `image: "assets/characters/original/idle.webp"`，`skinId: "original"`。封面预载同样是这张新待机（`index.html` preload）。封面和大厅待机走 `heroSpriteSrc`：未在反应状态时用呼吸帧（缺则回落 `idle`），**点角色后 `reacting === true` 时改用 `activeSkin.react`**。大厅头像走已换新的 `avatar.webp`。

点击路径（大厅）：`handleTapCharacter` → `playStageMotion("react")` → 约 720 ms（`MOTION_DURATION_MS.react`）内显示 `react.webp`，然后回到呼吸 / 待机。装备等短交互也会把舞台动作切到 `react`。

`sit` / `sleep` 已在皮肤表里接好，注释写明：`sit` 缺失时回落到 `react`，`sleep` 缺失时回落到 `sit`。本机核到的现状是：大厅和封面的 `heroSpriteSrc` **不会**选用 `sit` / `sleep`；小世界屏幕 `WorldScreen.tsx` 目前只画房间背景和物件，不画角色。因此用户此刻看到的旧 Q 版，主要就是点击切出的 `react.webp`。但这两个文件仍是默认皮肤的正式槽位，后面若有界面或物件交互用上它们，会再次跳回旧形象，所以本轮与 `react` 一起补图，不留缺口。

女仆皮肤 `maid` 的 `idle` / `breathe` / `walk` / `react` / `avatar` 仍全部是 2026-11-09 22:21:24 的旧帧（`spec.json` 中该皮肤约 2.06 头身）。本轮明确不动女仆。

### 2.3 其它遗留图（本轮不替换，只登记）

`public/assets/` 根目录仍有 2026-08-13 的历史图：`idle.png` / `idle.webp`、`jump.png` / `jump.webp`、`rest.png` / `rest.webp`、`sleep.png` / `sleep.webp`、`wenbebi.png` / `wenbebi.webp`。现行 `skins.ts`、衣橱和封面都不引用这些路径；只在旧设计文档里出现过 `public/assets/idle.webp`。它们不是这次换槽对象，也不建议在换姿势帧时顺手删。

旧 `original` 整套帧的回滚备份在：

`D:\lora_train\xiaoyan\kept-local-from-repo\original-frames-before-20261113-stand-swap\`

其中 `react.webp` / `sit.webp` / `sleep.webp` 的体积与当前舞台文件一致（49 856 / 64 016 / 40 560）。需要回退时从这里取，不要把备份写回应用，除非用户明确要求恢复。

---

## 3. 候选来源：没有现成的点击 / 坐下 / 躺下

过审 Qwen 衍生图（尚未去做底、不能直接进 `public/assets`）在两处内容一致，各 10 张 PNG + 10 份 caption：

- `D:\lora_train\xiaoyan\derived_qwen_20261112_accepted\`
- 仓库干净副本：`tools/wenbao-assets/official/accepted\`

同目录还有母图 `Wenbao_redraw_00001_.png`（205 412 B，mtime 2026-10-30 01:30:22）及已对齐的 `mother_stand_760.png`（与当前 `idle` 同源，mtime 2026-11-13 03:27:17）。

| 文件 | caption 要点 | 能否顶本轮槽位 |
|------|----------------|----------------|
| `wenbao_q4_walk_00001_.png` | walking, one foot forward, left chest pocket | 否。这是走姿候选，不是点击 / 坐 / 躺；本轮不拿来换 `react` |
| `wenbao_q4_hands_behind_00001_.png` | standing, left hand in pocket, right arm at side, right chest pocket | 否。站姿细节，不是点击回应 |
| `wenbao_q4_head_turn_00001_.png` | standing, three-quarter from left, facing left, left chest pocket | 否 |
| `wenbao_q4_hands_hips_00001_.png` | standing, hands on hips, left chest pocket | 否。叉腰不能当作点击 |
| `wenbao_q4_weight_shift_00001_.png` | standing, weight on right leg, left chest pocket | 否 |
| `wenbao_q4_left34_00001_.png` | standing, three-quarter from left, looking at viewer | 否。多角度站姿 |
| `wenbao_q4_right34_00001_.png` | standing, three-quarter from right, right chest pocket | 否 |
| `wenbao_q4_left_profile_00001_.png` | left profile, standing | 否 |
| `wenbao_q4_right_profile_00001_.png` | right profile, back pocket | 否 |
| `wenbao_q4_back34_00001_.png` | from behind, looking back | 否 |

**结论：不存在可直接映射到点击、坐下、躺下的过审图。** 不要把叉腰、挥手感接近、或走姿硬改文件名顶上去。这三张必须用母图走官方 Qwen 图像编辑新出。

另外，`D:\lora_train\xiaoyan\derived_qwen_20261112_held_aside\` 里有已隔离的拒收图（含 `wenbao_q4_wave_00001_.png` 等），无 caption，不能当正式来源，更不能拿「挥手」去顶点击槽。

过审衍生图仍不得写入 `D:\lora_train\xiaoyan\10_xiaoyan`。训练保持关闭。

---

## 4. 姿势简报（官方 Qwen 可先出图）

出图约定（已锁定，不改官方 JSON）：

- 工作流：现行 `Qwen_Image_Edit_2509_Q4_官方出图.json`
- 母图：`Wenbao_redraw_00001_.png`（白 T、白短裤、白鞋，正面站立全身，白底）
- 只改姿势 / 动作，保持同一人、同一套衣服、正常比例
- 不挂 `wenbao_v1` / `xiaoyan`，不写 chibi / Q 版 / 大头，不重开 MeinaMix
- 官方输出按既有契约为 512×768 RGB 白底；**先出图、过目构图，再去做底和对齐**

下面三份简报依据当前旧帧的动作语义改写，目标是「同一件事的官方比例版本」，不是把 Q 版大头描下来。

### 4.1 点击 / `react`

**旧帧在做什么：** 正面，整个人离地小跳，双臂向两侧上举、五指张开，嘴张开笑着看向画面外，膝部并拢。衣服是偏长的白 T，几乎看不见短裤，赤脚。头身是 Q 版大头，头发周围有闪光描边。可见高度 593，明显矮于站立，是因为整个人缩成跳跃团块，不是官方比例。

**建议新图：** 同一人、白 T（按画面实际标胸袋左右）、白短裤、白鞋，正常比例，全身、正面、白底。动作是被点到时的短促开心回应：双臂上举或略向外扬起，开朗微笑（可比待机更开心，但不要夸张到另一个人），允许轻轻离地或踮脚，脚和鞋子仍要完整可见。不要 Q 版大头跳，不要改成连体裙，不要赤脚（除非评审改口，见第 9 节）。

**提示词草案（可直接给官方编辑用，只改姿势）：**

> Keep the same girl and the same outfit: white t-shirt, white shorts, white shoes. Normal non-chibi body proportions, full body, front view, looking at the viewer, simple white background. Change only the pose: a short happy reaction, a small hop or lifted heels, both arms raised with open hands, a bright smile. Do not change her face, hair, or clothes. No chibi, no large head, no Q-version proportions.

### 4.2 坐下 / `sit`

**旧帧在做什么：** 坐在画面底部，双膝收起，赤脚，脚底朝向观者偏右；角色的左手托着左侧脸颊，轻轻眨眼（画面右侧那只眼闭上），嘴角微笑。白 T 加白短裤。头仍然是 Q 版大头，所以可见高度被抬到 715，几乎接近站立，这是旧图的头身问题，不能当作新图的目标高度。

**建议新图：** 同一人、同一套官方衣服（默认仍保留白鞋），正常比例，全身、白底。坐在地上或低处，双膝收起，一只手托腮，轻轻眨眼加微笑，面向观者。坐下后整身必须明显矮于官方站立（732），不要为了「坐满画布」再把头画大。不要椅坐、侧坐或盘腿，除非评审改口。

**提示词草案：**

> Keep the same girl and the same outfit: white t-shirt, white shorts, white shoes. Normal non-chibi body proportions, full body, simple white background. Change only the pose: sitting on the ground with knees drawn up, one hand supporting her cheek, a gentle wink and a small smile, looking at the viewer. The seated figure should be clearly shorter than the standing pose. Do not change her face, hair, or clothes. No chibi, no large head, no Q-version proportions.

### 4.3 躺下 / `sleep`

**旧帧在做什么：** 侧躺蜷着，头在画面右侧，脚在左侧；双眼闭合，微笑，双手收在脸颊附近；白 T、赤脚；头旁有散落的闪光点。可见高度 443，符合「明显矮于站立」的躺姿区间。

**建议新图：** 同一人、同一套官方衣服（默认仍保留白鞋），正常比例，全身、白底。侧躺休息，身体略蜷，闭眼、安稳微笑，双手靠近脸颊或枕于头侧；头朝画面右侧、脚朝左侧，与旧帧方向一致，便于舞台锚点习惯。整身必须明显矮于站立。先不要加 Zzz、闪光或星星等装饰，避免去底时把装饰当成衣服或背景残留。不要俯卧或仰躺，除非评审改口。

**提示词草案：**

> Keep the same girl and the same outfit: white t-shirt, white shorts, white shoes. Normal non-chibi body proportions, full body, simple white background. Change only the pose: lying on her side in a curled resting pose, eyes closed, a gentle smile, hands near her cheek; head toward the right of the frame, feet toward the left. The lying figure should be clearly shorter than the standing pose. No extra sparkles or sleep symbols. Do not change her face, hair, or clothes. No chibi, no large head, no Q-version proportions.

### 4.4 出图时共同避免

- 不把旧 Q 版三帧当 img2img 底图去「修一修」。
- 不把 10 张过审站姿改名顶槽。
- 不写 chibi / Q 版 / large head / super deformed。
- 白底保持干净，方便后续 isnet-anime 去底。

---

## 5. 替换契约（图到位之后才做）

与已通过的官方舞台契约一致，本轮不另开规格：

1. 去底只用约定的 rembg `isnet-anime`，**不用洪水填充**。白 T、白短裤、白鞋加白底会被洪水打穿。
2. 对齐到 760×760 RGBA，脚底（或躺姿的身体最低点）约 y=748，水平中心约 x=380。口径以 `tools/character/spec.json` 为准。
3. 入库后客户端不得再二次裁切或运行时抠图。App 只换文件、走现有皮肤槽位。
4. 保持官方默认衣服和五官身份：短黑发、齐刘海、圆棕眼、轻轻笑着，正常比例。
5. `spec.json` 里 `react` 与站立共用基准区间（可见高 706–736）。若通过的点击图是小跳，可见高可以略低于站立，但脚或最低点仍应对到 y=748，中心 x≈380；不要用旧 Q 版 593 / 715 / 443 去卡新图。坐、躺按新图实测写入 `metrics.json`：坐应明显矮于 732，躺继续落在「明显矮于站立」的区间（现行 lie 为 180–520）。
6. **本轮范围只含 `react` / `sit` / `sleep`。** 呼吸和走路虽是程序派生，且部分呼吸帧脚底有 1–3 像素偏离，过审走姿真图 `wenbao_q4_walk_00001_.png` 也还没去做底——这些另开一轮，避免和点击换图绑在一起。

---

## 6. 建议阶段

| 阶段 | 做什么 | 谁来做 | 是否等待本 PRD 评审 |
|------|--------|--------|----------------------|
| A. 先出图 | 按第 4 节简报，用母图 + 官方 Qwen 线出 `react` / `sit` / `sleep`，不改官方 JSON，不挂 LoRA | comfyui | **不等待。** 用户已要求先出动作图 |
| B. 构图过目 | 看 512×768 白底原图：是否同一人、同一套衣服、正常比例、姿势是否就是点击 / 坐下 / 躺下 | 用户；资产管线协助对照母图 | 原图未过目，不做去底，更不上舞台 |
| C. 去底与对齐 | isnet-anime 去底，对齐 760×760，出预览对照表（白棋盘 / 深底 / 品红），检查白衣是否打穿 | 小燕资产管线 | 在 B 通过之后 |
| D. 量测 | 跑 `tools/character/verify.py`，按新图更新量测；需要时修订 `spec.json` 的 sit / lie 说明，不拿旧 Q 版头身卡关 | 小燕资产管线 | 在 C 之后 |
| E. 换文件（仍先不提交） | 过目通过后，才替换 `public/assets/characters/original/{react,sit,sleep}.webp`；旧文件以既有备份为准，不删备份 | 小燕资产管线配合仓库侧 | **必须过目后再换**，且不提交，除非用户明确说提交 |
| F. 客户端核对 | 刷新后确认点击不再出现 Q 版；核对准入路径仍指向同名文件；若有界面已经或即将使用 sit / sleep，一并看新图 | Live With You | 换文件之后 |

训练、四层生成 / 拆层、写入 `:8788` 正式库，全部保持暂停。

---

## 7. 风险

- **用站姿衍生图冒充点击：** 叉腰、侧身、走姿都不是「被点到」的短互动，换上去会让点击语义发空，也解决不了「还是旧动作」的预期。本方案禁止这种顶替。
- **点击图风格打架：** 即便是官方线，如果跳得太高、手画得过大，仍会像另一套卡通，和已上的站立待机不统一。出图和过目都要对照现行 `idle.webp` / 母图。
- **坐下、躺下是新动作，没有成图参考：** 只有旧 Q 版语义，没有过审官方坐躺。这两张比点击更依赖第 4 节简报和用户过目，失败就按同一契约重出，不要退回旧帧修修补补。
- **坐躺是否保留白鞋：** 旧三帧都是赤脚，官方身份却包含白鞋。若去鞋，衣服契约会松；若留鞋，侧躺时鞋底朝向可能别扭。默认先留白鞋，见第 9 节。
- **量测仍是旧图：** 现在的 `metrics.json` 不能用来验收新图。小跳的可见高也不应被强行拉到 732。
- **sit / sleep 的大厅接线：** 当前大厅点击只切 `react`。如果只换文件、不核对以后要用坐躺的界面，问题会在下一处再冒出来。换图本身不改客户端逻辑，但需要 Live With You 说明哪些界面会用到这两张。
- **不要删除旧帧再换新图：** 回滚以 `original-frames-before-20261113-stand-swap` 为准。未过目的新图不得覆盖舞台文件。

---

## 8. 明确先不做

- 不改官方 Qwen JSON，不重开已归档的 MeinaMix 官方线。
- 不挂角色 LoRA，不开训，不把新图或过审图写入 `10_xiaoyan`。
- 不恢复四层，不写 `:8788` 正式库，不把姿势帧改指资源库。
- 本轮不替换女仆皮肤，不清理 `public/assets/` 根目录 8 月历史图，不把程序派生的呼吸 / 走路换成过审走姿。
- 不把已过审的 10 张站姿、或 `held_aside` 拒收图，改名顶到点击 / 坐下 / 躺下。
- 新图过目之前，不替换 `public/assets`，不删除旧帧，不提交仓库。
- 资产管线不改客户端槽位逻辑；若接线有缺口，作为需求交给 Live With You。

---

## 9. 请评审拍板的问题

1. **点击动作：** 是否同意「轻轻离地或踮脚 + 双手上举的开心回应」，而不是把旧 Q 版大头跳原样放大？若希望只站着举手、完全不离地，请直接说。
2. **白鞋还是赤脚：** 坐、躺是否仍穿白鞋？建议默认留白鞋，以锁官方衣服身份。
3. **坐下细节：** 抱膝 + 托腮 + 眨眼是否就是目标坐姿？还是改成更端正的坐法？
4. **躺下细节：** 头右脚左的侧躺蜷姿是否就是目标？要不要加睡眠符号（建议先不加）？
5. **请 Live With You 确认：** 除大厅点击的 `react` 外，当前是否已有界面真正画出 `sit` / `sleep`？换同名文件后，客户端是否只需刷新、不必改槽位？
6. **请 comfyui 确认：** 第 4 节提示词草案是否可直接用于现行官方 Qwen 编辑；若要微调措辞，保持「只改姿势、不写 Q 版」即可，不必改 JSON。
7. **呼吸 / 走路：** 是否同意本轮不动，另开一轮再考虑用过审走姿真图替换程序帧？

拍板后，出图可以按第 4 节继续或微调提示词；换进舞台仍以目视过审为门禁。
