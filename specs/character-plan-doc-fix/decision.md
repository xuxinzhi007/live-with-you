# character-plan-doc-fix 决定

- 级别：L1

- 真正要解决的问题：`docs/standard-character-plan.md` 已经写成可施工的详细规格，但它的两处证据不可靠：(1) §11 引用的 `standard-template-390.png` 不存在；(2) §2.2 关键点表与 §5 场景表只对「5.0 头身 + 随 S3 重标定」这一个分支成立，而 §9 的 4 个待决选项会反向推翻这些数字。读者按错的分支施工，会拿到错的关键点和错的家具定标。

- 怎样算满足：
  1. §11 不再引用不存在的文件，且列出的路径全部能在磁盘上找到。
  2. §2.2 与 §5 的适用范围有显式标注，读者在第一屏就能知道这些数字依赖哪个分支。
  3. 文档不丢原有论证内容，不新增未经验证的数字。
  4. 改动后 `npm run test:mobile` 仍全绿（本次不碰代码，预期不变）。

- 现有能力：
  - `docs/standard-character-plan.md:332-339`（§11 参考图）——已证实，含悬空引用。
  - `docs/standard-character-plan.md:88-103`（§2.2 关键点表）——已证实，5.0 分支专有数字。
  - `docs/standard-character-plan.md:201-247`（§5 场景重标定）——已证实，5.0 + S3 分支专有数字。
  - `docs/standard-character-plan.md:310-317`（§9 待决选项）——已证实，包含会推翻上述数字的选项。
  - 磁盘实测：`spark-output/audit/character-rig/` 只有 `base-template-390.png`、`part-slots-390.png`、`pose-families.png`、`pose-guide-390.png`、`proportion-options-390.png`，无 `standard-template-390.png`。
  - 无出处的词：无（本次只用文档自身与磁盘事实）。

- 旧决定：无。没有排查卡片（`cards_dir` 未配置）。实现是否仍符合：无旧决定。

- 最小充分方案：只改 `docs/standard-character-plan.md` 一个文件。
  1. §11 删掉 `standard-template-390.png` 那一条；保留 `proportion-options-390.png` 与目录引用，并在目录引用里注明「清单以磁盘为准」。
  2. §2.2 标题追加适用条件，并在表前加一句：数字按 5.0 头身算；选 4.5 / 6.0 时须按 `顶 = 748 - 720`、`下巴 = 顶 + 720 / heads` 重算，不得直接套表。
  3. §5 标题追加适用条件，表前加一句：本节只在「5.0 + 家具随 S3 重标定」分支成立；§9 选「先只换角色、家具不动」时整节作废。

- 为什么更小的做法不够：只删悬空引用不解决第 (2) 点——公式表和家具表仍会被当成通用值照着施工。只加标注不删悬空引用，读者会继续找一张不存在的图。

- 相关的债：B 局部偿还。只修本次会误导施工的两处，不重构文档结构，不补文件。

- 这次不做：
  - 不生成 `standard-template-390.png`（需要画图，另一个动作）。
  - 不把 §2.2/§5 改写成公式驱动（那会动到文档主活，超出 L1）。
  - 不修 `tests/mobile-engine.test.mjs:359` 的 `heroHeight = 300` 硬编码（属 B 动作）。
  - 不修 `tools/audit/pose-audit.mjs:347` 的 `idleBreathingFramesDiffer: true`。
  - 不碰 `tools/audit/` 的 4 份重复 CDP 客户端。
  - 不改 `docs/character-rig-design.md`。
  - 不动任何 `.ts` / `.test.mjs` 代码。

- 风险：不碰契约、持久化、权限、状态、回滚。纯文档改动。

决定已定，直接进入按决定改文件。
