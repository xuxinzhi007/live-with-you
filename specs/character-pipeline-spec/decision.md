# character-pipeline-spec 决定

- 级别：L3（定架构；不碰契约、持久化、权限、状态、回滚，但要做规格单一来源 + 产物契约）

- 真正要解决的问题：角色资源没有单一事实来源。画布约定（760×760 / 脚底 748 / 中心 380）
  写在 `tools/build-character-assets.py` 的常量里，可见尺寸（`visibleHeight` / `visibleWidth`）
  又手写进 `src/mobile/world/skins.ts`，两处各存一份、靠人工量图同步。下一批角色要用
  couui 生成工作流（原始整图，需抠图 + 归一化 + 对位），沿用现状会变成「每套皮肤一组手填数字」，
  `docs/character-rig-design.md:88` 已经预判「再加第三套就会失控」。

- 怎样算满足：
  1. 规格有唯一来源（`spec` 文件），`build` 脚本与 `skins.ts` 都从它读，不再手填。
  2. 生成产物必须过校验（实测 vs 规格），不通过的产物不能被写进资产目录。
  3. 校验结果可被测试断言，`npm run test:mobile` 能发现「实测与记载不一致」。
  4. 部件化（槽位 + 合成）有明确落位与判定顺序，本次只定形状，不实现合成。
  5. 改动不破坏现有两套皮肤：`original` / `maid` 的输出与现在一致。

## 现有边界（各管什么）

| 边界 | 现在管什么 | 证据 |
| --- | --- | --- |
| `tools/build-character-assets.py` | 抠图、trim、共用缩放、对位、呼吸/走路/头像生成 | 已证实。常量 `FRAME=760` `FRAME_HEIGHT=720` `BASELINE_Y=748` `CENTER_X=380` |
| `src/mobile/world/skins.ts` | 每个皮肤的资源路径 + `metrics`（手写） | 已证实。`visibleHeight: 720/714`、`visibleWidth: 429/554` |
| `src/mobile/world/WorldView.tsx` | 唯一消费方：`base = PLAYER_STAND_H / metrics.visibleHeight` | 已证实，5 处（149/246/353/538/541） |
| `tests/mobile-engine.test.mjs:359` | `heroHeight = 300` 硬编码校验家具比例 | 已证实 |
| `docs/standard-character-plan.md` §3 | 槽位与 z 序定义（11 个 slot） | 已证实 |
| `docs/standard-character-plan.md` §4.4 | 校验指标与容差表 | 已证实 |

- 无出处的词：**couui 生成工作流的输出契约**（尺寸范围、是否有 alpha、是否单角色、
  是否保证正面平视）。用户已确认产物形态属「原始整图需归一化」，但具体像素约定待确认，
  本次设计不依赖它，只把「归一化」做成流水线的一步。

- 旧决定：无卡片（`cards_dir` 未配置）。实现是否仍符合：无旧决定。

## 实测校正（推翻上一轮口述）

上一轮我说「maid 脚底 751、可见宽高与记载不符」——**该结论错误**。用 `alpha > 8` 阈值
重新量测，与 `skins.ts` 记载完全一致：

| 皮肤/姿态 | w | h | 中心 x | 脚底 y |
| --- | ---: | ---: | ---: | ---: |
| original/idle | 429 | 720 | 380 | 748 |
| original/sit | 429 | 715 | 380 | 748 |
| original/sleep | 429 | 443 | 380 | 748 |
| maid/idle | 554 | 714 | 380 | 748 |
| maid/react | 526 | 704 | 380 | 748 |

之前的偏差来自用 `Image.getbbox()` 读全通道（webp 半透明边缘被计入）。**这条本身是证据**：
「怎么量」目前没有统一口径，`getbbox()` 与 `alpha>8` 会给出不同答案。这正是要定 spec 的原因。

## 真正的不统一（已证实）

1. **头身比不统一**：`original` 1.87 头身、`maid` 2.06 头身（`character-rig-design.md:77,255`）。
   两者站立高都被归一化到 300 世界单位，所以屏上一样高，但比例不同 —— 换皮肤时角色"变形"。
2. **`visibleHeight` 是归一化除数**：`300/720` vs `300/714`，值域仅差 0.8%。
   它只能修图内留白，**不能表达「角色在场景里该有多大」**。这个语义没有第二个开关。
3. **`sit` 帧高 715 ≈ `idle` 720**：脚本注释称「共用缩放，躺下自然更矮」，
   但 sit 几乎和站立等高，说明该帧不是同一缩放基准画的。姿态家族的比例关系不可靠。
4. **规格两处存**：脚本常量与 `skins.ts` 手写值，无自动校验。

## 最小充分方案（本次只落这三件）

**第一步：立 spec 为唯一来源。**
新增 `tools/character/spec.json`，字段沿用 `standard-character-plan.md` §2.1/§2.2/§4.4：

```
canvas / baselineY / centerX / feetY
heads           目标头身比（该皮肤一个数）
tolerance       visibleHeight / feet / center / heads / headHeight
poses           stand / sit / lie 的可见高区间
```

`build-character-assets.py` 读它，不再用模块常量。

**第二步：新增 `tools/character/verify.py`，量测口径固定。**
- 唯一量测函数：alpha 阈值 `>8` 取 bbox（禁用裸 `getbbox()`）。
- 输出 `<out>/metrics.json`：每皮肤每姿态的实测 `w/h/cx/feet`。
- 逐项对照 spec 容差，越界打印 `FAIL <skin>.<pose> <指标> 实测/期望`，退出码非 0。

**第三步：`skins.ts` 的 `metrics` 改为读生成物。**
- `metrics.json` 由 build 产出，`skins.ts` 导入它（或由脚本生成 `skins.metrics.ts`），
  删除手写的 `visibleHeight` / `visibleWidth`。
- 消费方 `WorldView.tsx` 与 `tests/...:359` 统一改读 `PLAYER_STAND_H` 常量，消除第二处硬编码。

**部件化（本次只定形状，不实现）**
- 落位：`assets/characters/<skin>/parts/<pose>/<slot>.webp`，slot 与 z 序取
  `standard-character-plan.md` §3 的 11 个。
- 合成不引入运行时开销：build 期合成成整帧，`pickFrame()` 维持现状。
- 判定顺序：先 `verify.py` 过单件，再 `compose.py` 出整帧，再对整帧跑一次 `verify.py`。
  单件不过不进合成；整帧不过不进 `assets/`。

## 为什么更小的做法不够

- 只改 `skins.ts` 手填新数字：仍是两处存、仍靠人工量，接生成工作流后问题原样复现。
- 只加 spec 不接 build：spec 会成为第三处「文档」，比现状更糟。
- 直接上部件合成：单件都还没有统一规格，合成只会把偏差叠起来。

## 相关的债

- **A 现在偿还**：量测口径不统一（`getbbox` vs `alpha>8`）——它直接决定校验对不对，必须现在定。
- **B 局部偿还**：`tests/...:359` 的 `heroHeight` 硬编码，本次顺手改成读常量。
- **C 暂缓**：`original/sit` 帧的缩放基准问题。要重画，不在本次。
- **D 不能带过**：无。

## 这次不做

- 不实现 `compose.py`、不画部件、不生成任何新角色图。
- 不改 `original` / `maid` 的现有资产（输出必须与现在一致）。
- 不改头身比（`original` 1.87 / `maid` 2.06 保持；标准化是 `standard` 新皮肤的事）。
- 不动 `docs/standard-character-plan.md`（上一轮 `character-plan-doc-fix` 已收口）。
- 不修 `tools/audit/pose-audit.mjs:347`、不动 4 份重复 CDP 客户端。
- 不动 `WorldView.tsx` 的渲染逻辑（只改 metrics 取数来源）。
- 不接 couui 工作流。

## 风险

- 不碰契约、持久化、权限、状态、回滚。风险面是构建产物：`metrics.json` 若被误提交为空，
  `skins.ts` 会拿到 undefined 导致缩放 NaN。缓解：`skins.ts` 保留常量兜底 + 测试断言
  「metrics 数值 > 0 且与资产实测一致」。
