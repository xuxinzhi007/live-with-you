# character-plan-doc-fix 核对

## 跑了什么

```
$ npm run test:mobile
exit 0
tests 23 / pass 23 / fail 0
```

完整输出在 `verify.log`。`verify` 原先未配置（`done` 停在 RED），已在本仓库
`.cursor/skills/data-workflow/config.yaml` 写上 `npm run test:mobile`——这是
`package.json` 里已有的入口，未新增命令。

## 验收条件

| # | 条件（来自 decision.md） | 结果 |
| --- | --- | --- |
| 1 | §11 不再引用不存在的文件，列出的路径全部能找到 | 达到。`standard-template` 残留计数 0；文档内 `spark-output/...` 引用逐个 `[ -e ]` 核验，2/2 存在 |
| 2 | §2.2 与 §5 有显式适用范围标注 | 达到。两节标题下各加一条 `适用条件` 引用块，写明依赖 5.0 头身 / S3 分支及重算公式 |
| 3 | 不丢原有论证内容，不新增未验证数字 | 达到。只增 2 处引用块、删 1 条失效路径；未改动任何表格数值 |
| 4 | `npm run test:mobile` 仍全绿 | 达到。exit 0，23/23 |

## diff 有没有超出 decision.md

没有。`git status` 显示本次只改 `docs/standard-character-plan.md`：

- §2.2 标题下 +2 行适用条件（含重算公式）
- §5 标题下 +2 行适用条件
- §11 删 2 行悬空引用、给目录引用补「清单以磁盘为准」

decision.md「这次不做」里列的六项均未触碰：未生成图、未改写成公式驱动、
未动 `tests/mobile-engine.test.mjs:359`、未动 `pose-audit.mjs:347`、
未动 `tools/audit/` 重复客户端、未动 `docs/character-rig-design.md`、未动任何代码。

## 遗留（本次刻意不做，属另一个动作）

1. `docs/standard-character-plan.md` 仍缺 `standard-template-390.png`——§1.2 的方案对比与
   §9 的比例决策都依赖它才能拍板。需画图。
2. `tests/mobile-engine.test.mjs:359` 的 `heroHeight = 300` 硬编码，会在 S3 场景重标定后
   让「关键家具按角色缩放」这条断言静默失效（仍绿但校验错基准）。
3. `tools/audit/pose-audit.mjs:347` 的 `idleBreathingFramesDiffer: true` 仍是硬编码。
