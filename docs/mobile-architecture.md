# 移动版结构与扩展约定

移动版是手机玩家的主体验。桌面版 `App` 暂时保留为独立预览和功能参考；新增移动玩法优先进入 `src/mobile/`，不要继续把移动端专属逻辑塞进桌面运行时。

## 模块职责

- `src/layouts/MobileLayout.tsx`：页面组合、事件转发和视图状态，不保存游戏规则。
- `src/mobile/data/scenes.ts`：地点、背景、家具位置、可用动作，以及家具互动的资源效果。
- `src/mobile/data/pet-actions.ts`：动作名称、情绪、动画时长和角色状态变化。
- `src/mobile/data/pixel-sprites.ts`：家具像素素材映射。
- `src/mobile/engine/types.ts`：持久游戏状态和临时界面状态的类型。
- `src/mobile/engine/game-rules.ts`：不依赖 React 的游戏规则，可单独测试。
- `src/mobile/engine/storage.ts`：存档校验、旧档兼容和本地读写。
- `src/mobile/engine/GameEngine.ts`：把规则接到 React，并管理动作计时。

游戏进度与菜单选中状态分开保存。菜单打开、选中家具和弹窗位置属于临时界面状态，不应写入存档。

## 添加互动

先在 `PET_ACTIONS` 定义动作，再在家具的 `actions` 中引用同一个动作 ID。消耗、奖励、首次互动亲密度和小记文案放在家具的 `effects` 配置中；通用引擎会检查资源并应用效果，不需要按家具 ID 增加条件分支。

添加地点时，在 `SCENES`、`SCENE_BACKGROUNDS`、`SCENE_FURNITURE` 中补齐对应数据，并为可互动家具配置动作。新增 UI 页面时，把页面组件与游戏规则分开，避免让 `MobileLayout` 同时承担内容数据、存档和数值结算。

## 存档兼容

当前写入键为 `wenbebi-mobile-game-v2`，读取时仍兼容 `wenbebi-mobile-game-v1`。新增持久字段要在 `normalizeGameState` 中提供默认值并校验类型；更改既有字段时先兼容旧格式，再迁移写入。不要在升级时删除旧键。

## 体验约束

- 不用连续登录、每日任务、签到或限时提示驱动玩家回来。
- 资源不足可以给出说明，但不能让玩家失去基础互动或被迫离开当前场景。
- 场景与角色是首要内容，界面状态不持久化，也不应遮住主要互动区域。

## 验证

- `npm run test:mobile`：检查存档归一化、旧档读取、互动消费和地点探索规则。
- `npm run build`：检查类型和网页生产构建。
