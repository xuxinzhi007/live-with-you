# 移动版结构与扩展约定（V2）

手机是唯一主线。玩家扮演雯宝本人，在一个横向可走动的世界里操作。
旧的观察向移动端（`MobileLayout` + `SceneStage` + `pixi-stage`）只保留在 `?legacy`，
不再作为新功能入口；桌面 `App` 保留在 `?desktop`。

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `src/mobile/WorldApp.tsx` | 页面组合、HUD、抽屉、提示；不保存游戏规则 |
| `src/mobile/world/WorldView.tsx` | Pixi 应用、贴图加载、层级与排序、指针输入、相机应用 |
| `src/mobile/world/runtime.ts` | 玩家移动、碰撞、走近、接球、镜头；纯 TS，不依赖 React/Pixi |
| `src/mobile/world/rooms.ts` | 房间、物件、阻挡盒、走近点、门与出生点 |
| `src/mobile/world/state.ts` | 花圃、生长阶段、冷却、收集的纯函数与默认值 |
| `src/mobile/world/actions.ts` | 动作结算（休息/阅读/种花/买种/许愿/接球）与文案 |
| `src/mobile/world/useWorldGame.ts` | 存档读写、把动作结果接进 React |
| `src/mobile/world/skins.ts` | 角色皮肤表：姿势帧路径、头像、可见高宽与基线 |
| `src/mobile/world/poses.ts` | 动作 → 姿态映射（纯函数，可单测） |
| `src/mobile/engine/storage.ts` | 存档键、旧档兼容、`normalizeGameState` |
| `src/mobile/engine/types.ts` | `GameState` / `WorldState` 类型 |

规则（运行时、房间数据、动作结算）不得 import React 或 Pixi；渲染层不得写存档。

## 角色皮肤

- 皮肤 id：`original`（默认，原来的白色雯宝）、`maid`（蓝白女仆「小鲸鱼」）。
- 帧规格统一：`760×760` 画布、脚底 `y=748`、水平居中 `x=380`。
- 每套必备：`idle` / `breathe-1..4` / `walk-1..4` / `react` / `avatar`。
- 可选：`sit`（坐下）、`sleep`（躺下）。缺少时渲染层按 `sleep → sit → react → idle` 回落，不会出现空白帧。
- 同一皮肤的所有姿势共用 idle 推导出的缩放；躺下的图自然更矮，不会被拉成站立高度。
- 动作映射：床 = `sleep`；书桌 / 长椅 = `sit`；花圃 = `sit`（短播）；门 = 不播姿态直接切房间；冷却中的点击 = 不播姿态。
- `prefers-reduced-motion` 下：不切走路帧、不播呼吸、镜头直接吸附。
- `world.skin` 持久化；`normalizeWorldState` 对缺失或非法值回落到 `original`。
- 渲染层 `setSkin()` 只替换角色帧与锚点，不重建房间、不重置相机。
- 点角色的判定宽度按当前皮肤的 `visibleWidth` 计算，避免换皮后点不中。

### 添加皮肤

> 想从「一套皮肤 = 一套整帧」升级到「底模 + 部件 + 任意组合」，
> 先读 [角色底模与部件化方案](./character-rig-design.md)。那里定义了画布/关键点/槽位/容差，
> 并说明了为什么不能直接拿一张画好的整图去切件。

1. 在 `types.ts` 的 `CharacterSkinId` 增加 id。
2. 在 `state.ts` 的 `CHARACTER_SKIN_IDS` 增加 id。
3. 在 `skins.ts` 的 `CHARACTER_SKINS` 增加条目（帧路径 + `visibleHeight` / `visibleWidth`）。
4. 用 `tools/build-character-assets.py` 生成 `public/assets/characters/<id>/`，或在同规格下放入素材。新增姿势时同步 `PlayerPose` 与 `poses.ts`。
5. 补测试：新皮肤帧齐全、基线与默认皮肤一致。

## 坐标与尺度

- 世界高固定 `1000`，横向按房间宽度加宽（`worldW` 960–1180）。
- 渲染时 `scale = 场景像素高 / 1000`，相机只做横向移动。
- 角色站立高 `300`；关键物件高度按角色身高的 0.6–1.5 倍定标。
- 可行走带 `y ≈ 760–884`；地平线 `y = 640`。
- 装饰物（地毯、绿植）不得有横穿可行走带的碰撞盒，也不得成为点击目标。

## 添加房间

1. 在 `src/mobile/engine/types.ts` 的 `WorldRoomId` 增加 id。
2. 在 `rooms.ts` 的 `ROOMS` 增加 `worldW`、`walk`、`defaultSpawn`、`props`。
3. 在 `assets.ts` 的 `ROOM_BACKGROUND` 与 `PROP_ASSETS` 补素材。
4. 在 `state.ts` 的 `ROOM_IDS` 增加 id；旧场景映射按需补 `sceneToRoom`。
5. 用 `tools/build-scene-assets.py` 生成背景与物件（或在同尺寸下替换）。
6. 补测试：可行走带不被堵死、门的 `spawn` 在目标房间内。

## 添加物件

1. 在 `rooms.ts` 定义 `kind`、`x/y/w/h`、`footprint`、`action` 或 `doorTo`。
2. 在 `actions.ts` 的 `applyPropAction` 增加对应 `action` 分支（纯函数，返回 `ActionOutcome`）。
3. 在 `WorldApp.tsx` 的 `ctaLabel` 增加按钮文案。
4. 需要新 `PropKind` 时，同时补 `assets.ts` 的 `PROP_ASSETS` 与素材脚本。
5. 不要按物件 id 写一次性条件分支；优先把差异放进数据。

## 存档兼容

- 写入键仍为 `wenbebi-mobile-game-v2`，读取兼容 `wenbebi-mobile-game-v1`。
- V2 世界状态放在 `gameState.world`，由 `normalizeWorldState` 校验：
  - 缺失 → 按 `currentScene` 推导房间；
  - 坏值 → 回默认值；
  - 未来时间戳（花圃、冷却）→ 夹回当前时间，避免永久锁死。
- 新增字段只在 `normalizeGameState` / `normalizeWorldState` 里补默认值，不删除旧键。
- 收花会返还 1 颗种子，保证“种 → 收 → 再种”不会因为零钱断掉。

## 体验约束

- 不用连续登录、每日任务、签到、红点或限时提示驱动玩家回来。
- 短冷却只作用于同一物件，必须显示剩余秒数，且不能阻止玩家去别处玩。
- 场景与角色优先；常驻 HUD 不超过屏高 15%（不含安全区），抽屉不超过 40dvh。
- 触控目标 ≥ 44px；尊重 `prefers-reduced-motion`。

## 验证

```bash
npx tsc --noEmit
npm run build
node --experimental-strip-types --test tests/mobile-engine.test.mjs
```

`npm run test:mobile` 需要 Node ≥ 22.6（已在 `package.json` 的 `engines` 中声明）。
