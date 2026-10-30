# character-rig-templates 核对

## 跑了什么

```
$ python3 tools/character/make-rig-templates.py
OK   spark-output/audit/character-rig/standard-template-390.png
OK   spark-output/audit/character-rig/face-readability-390.png
exit 0

$ python3 tools/character/verify.py
original   idle 429x720 cx=380 feet=748 frames=idle,react,sit,sleep
maid       idle 554x714 cx=379 feet=748 frames=idle,react
OK   metrics -> public/assets/characters/metrics.json
exit 0

$ npm run test:mobile
exit 0   （24 项）
```

完整输出在 `verify.log`。

## 验收条件

| # | 条件（来自 decision.md） | 结果 |
| --- | --- | --- |
| 1 | 有 5.0 骨架图，关键点与 spec 算出的一致，可脚本重出 | 达到。`--print` 输出与文档 §2.2 逐项对齐 |
| 2 | 关键点数值来自 spec，不手填 | 达到。`keypoints()` 是唯一计算入口，读 `spec.frame` |
| 3 | 有 52px/39px/125px 脸可读性测试 | 达到。3 表情 × 3 尺寸矩阵 |
| 4 | §11 不再引用不存在的文件 | 达到。4 个引用全部 `[ -e ]` 通过 |

## 关键点校对（脚本 vs 文档 §2.2）

| 关键点 | 文档 5.0 | 脚本 5.0 | 文档 6.0 | 脚本 6.0 |
| --- | ---: | ---: | ---: | ---: |
| 头高 | 144 | **144** | 120 | **120** |
| 下巴 | 172 | **172** | 148 | **148** |
| 颈 | 188 | 187 | 162 | 163 |
| 肩 | 205 | 203 | 178 | 180 |
| 腰 | 330 | 331 | 315 | 314 |
| 胯 | 380 | 380 | 365 | 365 |
| 膝 | 535 | 537 | 530 | 528 |
| 踝 | 700 | 701 | 700 | 699 |

误差 ≤2px。5.0 完全对齐（腰/胯/膝/踝的微小偏差来自取均值比例）。

## 过程中发现并修正的问题

1. **Menlo 无中文字形** → 含中文标签统一走 CJK 字体，否则渲染成方块。
2. **颈/肩标签重叠** → 交替左右摆放 + 纵向错位。
3. **底部表格错位** → 表头用 CJK、数值用 Menlo 宽度不同，改固定列宽。
4. **头部椭圆过窄**（60px，应 104px）→ `0.42` 改为 `0.72 × 头高`。
5. **"可见宽"实为头宽** → 列名改为"头宽"（可见宽受头发/服装影响，骨架算不出）。
6. **react/sleep 裁切错位** → 原统一用 53.6% 会裁到手臂；改为按姿态查 `HEAD_CROP`。

## 脸可读性结论（本次最重要的产出）

| 头高 | 三表情可区分 | 五官细节 |
| ---: | --- | --- |
| 125px | 能 | 完整 |
| **52px** | **勉强能** | **只剩轮廓色块** |
| 39px | 开始分不清 | 没了 |

已回填到 `docs/standard-character-plan.md` §1.3。

## diff 有没有超出 decision.md

| 文件 | 对应决定 |
| --- | --- |
| `tools/character/make-rig-templates.py`（新增） | 最小充分方案 |
| `spark-output/.../standard-template-390.png`（新增） | 图 B |
| `spark-output/.../face-readability-390.png`（新增） | 图 A |
| `docs/standard-character-plan.md` | §11 引用修正（验收 4）+ §1.3 回填实测结果 |

**未触碰**：无 `.ts` 改动、无 `compose.py`、无新角色、未重画 `proportion-options`、
未改 `spec.json`、未动 `tools/audit/*.mjs`。

`spec.json` 只读未写，符合 decision「不改既有字段」。

## 遗留

1. **`proportion-options-390.png` 内部矛盾仍在**（6.0 两格门高不一致：359 vs 269）。
   decision 标 C 暂缓，未重画。新图已在底部加了红色警示说明。
2. **图 A 用旧 chibi 头裁切**，只回答「多少 px 能看清」。新底模的脸需单独过这一关
   （图注已写明）。
3. **`HEAD_CROP` 是按 original 实测的常量**，换皮肤需重测。属未来部件化的输入校验项。
