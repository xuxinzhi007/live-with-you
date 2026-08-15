# Spine 接入方案

## 目标

使用 Spine 作为角色渲染层，保留 `Pet` 的状态、移动、交互、存档和摄像机系统。

## 接入时机

角色设定、服装和主要动作稳定后再开始。当前阶段继续使用位图立绘，避免美术返工。

## 谁负责什么

- **Spine 编辑器**：导入角色分层图、创建骨骼、绘制权重、制作动作。这是真正的骨骼绑定，必须在这里完成。
- **网页项目**：加载导出资源，将游戏状态对应到 Spine 中已命名的动作。网页不应提供逐骨骼拖拽编辑器。
- **配置文件**：`src/game/data/spine.js`。只填写资源路径、皮肤、缩放与动作名映射；它不是绑定工具。
- **角色部件工坊**：访问 `?studio`。它用于配置图片部件、锚点、层级与父级关系，并导出 JSON；它当前是轻量网页纸片骨骼预览，不替代 Spine 的网格权重、IK 和曲线动画功能。
- **部件运行时**：将工坊导出的文件命名为 `public/assets/characters/wenbebi/puppet.json`。游戏会自动尝试加载它；加载失败时继续使用原有位图角色。

## 操作步骤

1. 在 Spine 中把角色拆成独立图层，例如身体、头发、眼睛、左右手臂、裙摆。
2. 创建骨骼并绘制权重，至少完成 `idle`、`walk`、`sit`、`sleep`、`jump`、`wave`、`happy` 与 `look`。
3. 动作名称保持和 `src/game/data/spine.js` 右侧一致；若 Spine 内名称不同，只改该文件的字符串即可。
4. 从 Spine 导出 `.skel`、`.atlas` 和贴图，放入 `public/assets/characters/wenbebi/`。
5. 骨骼资源稳定后，新增 `SpinePetRenderer` 并在 `src/game/renderers/index.js` 中启用它。角色移动、互动、家具与存档无需修改。

## 资源要求

- Spine 导出文件：`.skel` 或 `.json`、`.atlas`、贴图。
- 按角色 ID 放入 `public/assets/characters/<id>/`；雯宝对应 `public/assets/characters/wenbebi/`。
- 动画至少提供：`idle`、`walk`、`sit`、`sleep`、`jump`、`wave`、`happy`、`look`。

## 代码边界

新增 `src/game/renderers/PetRenderer` 接口，由 `ImagePetRenderer` 和 `SpinePetRenderer` 分别实现。`Pet` 仅调用状态和朝向方法，不直接操作图片元素；现有 `wenbebi.sprites` 配置会替换为动画名映射。

## 性能要求

- 限制每个房间一个 Spine 角色实例。
- 页面隐藏时暂停渲染与动画状态更新。
- 移动端优先使用压缩贴图与 1x/2x 尺寸分级。
