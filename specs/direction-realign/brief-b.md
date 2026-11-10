# Agent B —— 渲染层去矩形切片

独占文件：`src/mobile/world/skeleton-system.ts`、`src/mobile/world/paper-doll-rig.ts`
禁止碰：`src/mobile/WorldApp.tsx`、`tests/**`、`tools/**`

## 问题（已证实）

`skeleton-system.ts:521 computeHumanoidPartSlices` 用 6 处硬编码百分比 `polygon(...)` 把一整张人像切成矩形选区：

```ts
clipPath: `polygon(0% ${neckY - 2}%, ${shLX + 3}% ${neckY - 2}%, ${shLX + 1}% ${hipY + 4}%, 0% ${hipY + 4}%)`
```

切出来是**矩形**，不是人体轮廓。手臂一旋转，矩形边缘就露出来 → 穿模。这不是参数没调好，是方法本身错了。

商业 2D 换装的通行结构是 slot / skin / attachment 三层（Spine 官方文档）：
- 动画与代码只认 **slot 名**（如 `head`、`body`）
- 具体显示哪张贴图由当前 **skin** 决定
- 每个 slot 挂一张独立的 **attachment**（透明图层）

## 任务

### 1. 废弃矩形切片
把 `computeHumanoidPartSlices` 改为返回 `[]`，**保持函数签名与导出不变**（`WorldApp.tsx` 仍在 import 它）。

必须保留导出的原因：`WorldApp.tsx` 是另一个 agent 的独占文件，你不能改它。让它在编译期继续通过，调用点由后续 Agent C 统一删除。

函数上方加注释说明：已废弃，由 slot 叠加替代，原因见 art-research.md。

### 2. 建立 slot 叠加模型
在 `skeleton-system.ts` 新增（不要删已有的骨骼求解函数，它们还有用）：

- 角色本体作为**单一 sprite**，只做整体 transform（scale / translate / rotate），不再切部位。
- 各槽位（`dress` / `hairAcc` / `handheld` / `aura` / `memoryCard`）作为独立图层，各自带锚点偏移、缩放、z 序。
- 导出一个函数，输入 `EquippedOutfit` 的槽位状态，输出各图层的 style（left/top/scale/rotate/zIndex）。
- 不要引入 `clipPath`。

命名要贴合现有风格（现有是 `computeXxx` / `solveXxx` / `getXxx`）。

### 3. paper-doll-rig.ts
`loadCutoutImage` 保留签名，改为：
- 资产**自带 alpha** 时直接返回原图，不做任何处理。
- 资产无 alpha 时才退回现有洪水填充，并 `console.warn` 一次（不要每次调用都 warn）。

## 硬约束

- `npx tsc --noEmit` 必须过。
- 不改 `tests/`。现有 V9 测试断言 `slices.length === 6` 会失败，这是预期的，Agent D 会改。你在交付文档里写明。
- 少注释，代码自解释。

## 交付
写 `specs/direction-realign/agent-b.md`：改了什么、新导出的函数签名、`tsc` 结果、需要 C 删的调用点行号。
