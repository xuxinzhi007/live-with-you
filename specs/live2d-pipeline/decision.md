# live2d-pipeline 决定

- 级别：L3（渲染层替换 + 素材生产链路重构；不碰存档契约，但改生成端与渲染端）

- 真正要解决的问题：角色动画现在靠「一整张平面图 + CSS `clip-path` 硬切 6 层」实现，
  硬边接缝必然穿帮；素材本身只有一张不透明整图（ComfyUI 出 512×640 RGB），
  被遮挡部位的像素不存在，任何切法都补不出来。要改成 Live2D 11 件分层模型。

- 怎样算满足：
  1. 有一条**可验证的链路**：11 件透明素材 → 对齐校验 → Live2D 模型 → 渲染。
  2. 渲染库在 Pixi v8 下能跑（现有 `pixi.js ^8.22.0`）。
  3. 生成端有一张**对齐基准图**，每件按它画，不靠手填坐标。
  4. 姿势一致性有机制保障（ControlNet），不再只靠提示词。
  5. 明确标出哪些环节无法自动化（Cubism 绑骨），避免误判工期。

## 现有边界

| 边界 | 管什么 | 证据 |
| --- | --- | --- |
| `tools/character/spec.json` | 画布 760 / 脚底 748 / 中心 380 / 容差 | 已证实 |
| `tools/character/verify.py` | 量测口径 + 校验 + 生成 metrics | 已证实 |
| `tools/character/make-rig-templates.py` | 骨架/脸可读性图（几何绘制） | 已证实 |
| `tools/generate-comfy-assets.mjs` | ComfyUI 出图（512×640 RGB，无 alpha） | 已证实 |
| `src/mobile/world/paper-doll-rig.ts` | 760×760 对位 + 运行时 BFS 抠图 | 已证实，引用 spec |
| `src/mobile/world/skeleton-system.ts` | 14 关节 + 6 层 clip-path 切割 | 已证实，硬边 |
| `pixi.js ^8.22.0` | package.json 依赖 | **已证实：代码已不再 import，是空位** |
| `docs/spine-integration.md` | 早期 Spine 思路，明确「绑骨必须在编辑器手工做」 | 已证实 |

- 无出处的词：无。

- 旧决定：无卡片。`docs/spine-integration.md` 是早期方案，**未被否决**，
  本次是同一目标（真骨骼）的另一种技术选型。实现是否仍符合：无旧决定。

## 关键事实（调研已证实）

1. **`guansss/pixi-live2d-display` 不能直接用**：peer 是 `@pixi/* ^6`，本项目 v8。
2. Pixi v8 可用替代三个，均活跃：
   - `untitled-pixi-live2d-engine@1.4.0`（MIT，Cubism 2/3/4/5，原生 v8 Render Pipe）
   - `@jannchie/pixi-live2d-display@1.4.0`（peer `pixi.js ^8`）
   - `@naari3/pixi-live2d-display@1.2.5`（peer `pixi.js ^8`）
3. **现有生成管线没有 ControlNet**（grep `controlnet|openpose|pose` 结果为空）——
   这是姿势漂移的根因，调提示词解决不了。
4. **LayerDiffusion** 是分层生成的核心：`layerdiffusion/LayerDiffusion`（入口页）、
   `huchenlei/ComfyUI-layerdiffuse`（ComfyUI 实现），均存在。

## 最小充分方案

本次只做三件**不依赖 ComfyUI 起服务**的事：

### A. 技术方案 `specs/live2d-pipeline/decision.md`（本文件）

### B. 11 件骨架对位图
扩展 `tools/character/make-rig-templates.py`，新增 `parts-template-390.png`：

- 按 `standard-character-plan.md` §3 的 11 个 slot 画分区 + z 序标注
- 每个 slot 给：边界框、枢轴点、左/右件名、与人体的关系
- 数值仍从 `spec.json` 算（复用 `keypoints()`），保持单一来源

### C. 渲染库 demo
装 `untitled-pixi-live2d-engine`，用官方 Cubism 样本模型验证：
- 能在 Pixi v8 下加载
- 能渲染、能做并行动作
- 记录 pack 后体积与首屏代价

demo 放在 `spark-output/audit/live2d-demo/`，不进 `src/`，不改现有渲染。

## 为什么更小的做法不够

- 只写方案不画对位图：生成端没有基准，11 件各画各的，对齐无从校验。
- 只装库不做 demo：Pixi v8 兼容性未验证，可能出现「方案写完发现库跑不了」。
- 继续用 clip-path：素材是整图，被遮挡像素不存在，这是信息缺失，不是算法问题。

## 相关的债

- **A 现在偿还**：姿势一致性无 ControlNet。本次在方案里定死做法，生成端改动留到下阶段。
- **B 局部偿还**：`skeleton-system.ts` 的 5 套 × 14 关节手填 70 个坐标，
  本次方案要求关节进 spec，脚本测出来。
- **C 暂缓**：`paper-doll-rig.ts` 运行时 BFS 抠图性能（换装频繁时可能掉帧）。
- **D 不能带过**：无。

## 这次不做

- 不改 `src/` 下任何渲染代码。
- 不装 ControlNet / LayerDiffusion（需 ComfyUI 环境）。
- 不生成真实 Live2D 模型（需 Cubism Editor 手工绑骨）。
- 不动 `skeleton-system.ts` / `paper-doll-rig.ts`。
- 不重写 `generate-comfy-assets.mjs`。

## 风险

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| Pixi v8 库不兼容 | 方案作废 | 本次 demo 先验证 |
| 11 件对齐不可行 | 链路断裂 | 对位图先定基准；verify.py 逐件校验 |
| Cubism 绑骨无法自动化 | 每套衣服 1–2 天 | 方案里显式标注，不按纯自动估工期 |
| 11 件 × 5 套 = 55 图层 | 工期爆炸 | 建议先做 4 件 × 1 套验证 |
| ComfyUI 一致性问题仍在 | 不同件不同脸 | ControlNet + 固定 LoRA + 固定 seed |

- 不碰存档契约、权限、状态机。渲染层替换可回滚（保留 `paper-doll-rig.ts`）。
