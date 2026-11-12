# v8-game-screen-flow-and-skeleton-editor 核对

## 跑了什么

```text
exit 0
cmd npm run test:mobile && npm run build
```

- `npm run test:mobile`：`pass 9 / fail 0`（新增 `V8 per-dress hierarchical skeleton tree and cascade joint dragging` 单测，验证不同生成服装的独立骨骼树、拖动父关节 `head` / `torso` 时子关节 `crown` / `hairSide` / `handL` / `handR` 级联平移、以及插槽缩放旋转）。
- `npm run build`：`tsc --noEmit && vite build` 通过，exit 0。
- 完整输出见 `specs/v8-game-screen-flow-and-skeleton-editor/verify.log`。

## 验收条件核对

| # | 条件（来自 `decision.md`） | 结果 |
| --- | --- | --- |
| 1 | 正规手游三层画面流（启动封面 `TitleScreen` → 纯净主大厅 `Lobby` → 独立换装/闯关/骨骼子屏） | **达到**。打开游戏首先呈现唯美全屏启动封面页（`screen === "title"`，含「✨ 点击进入小屋 · TAP TO START」）；进入主大厅（`screen === "lobby"`）后彻底移除了削掉小鲸鱼女仆头顶的关卡横幅与左右 4 个累赘圆球，中间 85% 纯净展示雯宝全身穿搭。 |
| 2 | 每套生成的服装拥有独立的父子层级骨骼树（`Per-Dress Hierarchical Skeleton Tree`） | **达到**。新增 `src/mobile/world/skeleton-system.ts`，建立 `root -> torso -> head -> crown / hairSide` 及 `torso -> handL / handR` 层级树，为 5 套不同头身比/姿势的礼服分别标定了专属骨架，并支持每套衣服独立保存骨骼修改。 |
| 3 | 可视化骨骼连线与直接在角色身上按住拖动关节手柄（`🦴 骨骼校准` 工作台） | **达到**。进入 `screen === "rig"` 后，角色身上渲染 SVG 骨骼连线与 7 个彩色可拖拽关节手柄（Pointer Capture 实时拖动），拖动父关节自动带动子关节级联平移，并支持一键 `📋 导出JSON`。 |

## diff 有没有超出 `decision.md`

未超出 `decision.md` 声明范围。
