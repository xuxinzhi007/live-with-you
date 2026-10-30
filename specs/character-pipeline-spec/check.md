# character-pipeline-spec 核对

## 跑了什么

```
$ python3 tools/character/verify.py
original   idle 429x720 cx=380 feet=748 frames=idle,react,sit,sleep
maid       idle 554x714 cx=379 feet=748 frames=idle,react
OK   metrics -> public/assets/characters/metrics.json
     typed  -> src/mobile/world/character-metrics.ts
exit 0

$ npm run test:mobile
tests 24 / pass 24 / fail 0
exit 0

$ npx tsc --noEmit
exit 0
```

完整输出在 `verify.log`。

## 验收条件

| # | 条件（来自 decision.md） | 结果 |
| --- | --- | --- |
| 1 | 规格有唯一来源，build 与 skins.ts 都从它读 | 达到。`tools/character/spec.json` 是唯一来源；`build-character-assets.py` 读 `SPEC[...]`，`skins.ts` 读生成的 `character-metrics.ts` |
| 2 | 生成产物必须过校验 | 达到。`verify.py` 越界退出码 1，只有通过才写 `metrics.json` 与 TS |
| 3 | 校验结果可被测试断言 | 达到。新增单测 `skin metrics come from the generated spec...`，24 项全绿 |
| 4 | 部件化有落位与判定顺序 | 达到（只定形状，见 decision「部件化」段），本次不实现 |
| 5 | 不破坏现有两套皮肤 | 达到。`original` 429×720 / `maid` 554×714，与改动前实测一致 |

## 闸门有效性验证（不只是"跑通了"）

**闸门一：verify.py 会拦**
临时把 spec 的 `original.visibleHeight` 改成 999：
```
FAIL original.idle height 720 != declared 999
1 failed   exit 1
```
恢复后 OK。

**闸门二：单测会拦"改了 spec 忘了重跑"**
临时把 `maid.visibleHeight` 改成 800、不重跑 verify：
```
✖ skin metrics come from the generated spec, not hand-typed numbers
pass 23 / fail 1
```
恢复后 24/24。

两道闸门都真的会响，不是摆设。

## diff 有没有超出 decision.md

改动的文件与 decision.md 逐条对应：

| 文件 | 对应决定 |
| --- | --- |
| `tools/character/spec.json`（新增） | 第一步：立 spec |
| `tools/character/verify.py`（新增） | 第二步：量测口径 + 校验 + 产出 |
| `public/assets/characters/metrics.json`（新增，生成物） | 第二步产物 |
| `src/mobile/world/character-metrics.ts`（新增，生成物） | 第三步：typed metrics |
| `src/mobile/world/skins.ts` | 第三步：删手写数字，改 `metricsFor()` |
| `tools/build-character-assets.py` | 第一步：常量改读 SPEC |
| `tests/mobile-engine.test.mjs` | B 债：`heroHeight = 300` → `PLAYER_STAND_H`；新增 metrics 一致性断言 |

**未触碰**（decision「这次不做」全部遵守）：未实现 `compose.py`、未画部件、未改资产、
未改头身比、未动 `standard-character-plan.md`、未动 `audit/*.mjs`、未动 `WorldView.tsx` 渲染逻辑。

`.gitignore` 的改动（忽略技能副本）不是本次产生的，是仓库既有工作区变更。

## 遗留

1. **`build-character-assets.py` 未实跑**：依赖 `numpy`，本机系统 python3 没有；
   `verify.py` 已改为纯 PIL 无 numpy 依赖。build 脚本的改动是「常量改为读 spec」，
   逻辑分支未变，`verify.py` 对现有资产的实测结果与改动前一致可作旁证。
   要在本机重跑 build，需先装 numpy。
2. **`original/sit` 帧高 715 ≈ idle 720**：属 decision 里标 C（暂缓）的债，需重画。
3. **头身比仍不统一**（1.87 vs 2.06）：这是 `standard` 新皮肤与部件化要解决的事，
   本次 spec 已能表达该值（`skins.<id>.heads`），但未强制统一。
4. **couui 输出契约未定**：`spec.json` 不依赖它；接入时只需把它的产物送进
   `verify.py` 的归一化环节，不需改 spec 结构。
