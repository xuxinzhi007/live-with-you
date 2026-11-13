exit 0

# docs-consolidation 核对

- verify.log：`specs/docs-consolidation/verify.log`，命令 `npm run test:mobile && npm run build`，第一行 `exit 0`
- 工作树确实动过（`gate_check=ok`，见 `specs/docs-consolidation/evidence.log`）

## 一、验收条件逐条核对

### A1 索引唯一 / 无坏链 / 无零入链现行文档 → 通过

- 命令：`node tools/audit/docs-links.mjs`
- 期望输出：`broken 0`、`orphan 0`
- 实际输出：`broken 0` / `orphan 0`（exit 0）
- 对应 decision：「怎样算满足 1」

### A2 6 条口径与代码一致 → 通过

- 命令：`node tools/audit/docs-links.mjs --verify-claims`
- 期望输出：`claims ok 6/6`
- 实际输出：
  ```
  ✓ 8788 默认关闭
  ✓ MeinaMix / 角色 LoRA 不在现行线
  ✓ 底栏六项与代码一致
  ✓ sit / sleep 从不渲染
  ✓ 密语页无入口
  ✓ 裁缝铺仅开发环境
  claims ok 6/6
  ```
- 对应 decision：「怎样算满足 2」

### A3 文档搬迁不改坏仓库测试入口 → 通过

- 命令一（runner 执行的 verify）：`npm run test:mobile && npm run build`
  - 验的用例：`tests/mobile-engine.test.mjs` 全部 19 条（存档迁移链 v1→v2、v4/v6/v7→v8、坏 JSON 回退等）
  - 期望输出：`# fail 0`
  - 实际输出：`# tests 19 / # pass 19 / # fail 0`；`vite build` 成功产出
- 命令二（手工补跑，因为本次 `npm install` 装回了 vitest）：`npm test`
  - 验的用例：`tests/world/anim-clips.test.ts`、`tests/screens/WardrobeScreen.test.tsx`、`tests/screens/CodexScreen.test.tsx` + 上面 19 条
  - 期望输出：`Test Files 3 passed`、`Tests 22 passed`、`# fail 0`
  - 实际输出：与期望一致
- 命令三：`npx tsc --noEmit` → exit 0
- 对应 decision：「怎样算满足 3」

## 二、diff 是否超出 decision

在范围内：

1. 新增 `tools/audit/docs-links.mjs`（含 `--verify-claims`）
2. 新增 `docs/现行状态.md`、`docs/资产管线.md`、`docs/待办-动作帧.md`、`docs/服务端接线.md`
3. 指针化 `docs/current-state-and-next.md`、`docs/wenbao-product/交接-当前状态.md`、`docs/mobile-architecture.md`
4. 归档 `docs/wenbao-product/*`（8 份）、`docs/wenbao-asset-pipeline/*`（5 份）、`docs/superpowers/specs/`（2 份）
5. 修 `README.md`、`docs/README.md`、`docs/game-direction.md`、`docs/product-charter.md`、`docs/architecture-map.md`、`docs/archive/README.md`
6. 删 `docs/wenbao-asset-pipeline/雯宝资产管线-项目分析.zip`
7. `tools/PIPELINE-DRESS.md`、`tools/PIPELINE-LAYERS.md` → `tools/_archive-docs/`
8. 修 archive/research 的 16 处坏链（`./product-charter.md` → `../`、`spark-output` 图片降级为文字）

超出 / 与决定对不上的地方（如实列出）：

1. `tools/*.bak*` 决定写「4 个」，实际删了 **5 个**：多的是 `run-official-dress.py.bak-20261111-before-seven-group`。同一类、同一意图，数字写少了。
2. `docs/mobile-architecture.md` 决定写「并入 archive」，实际做成**原路径指针**（内容已并入 `architecture-map.md` §2.4）。原因：留在原地才能保住旧链接；挪进 archive 会让 `docs/README` 之外的引用断掉。
3. `npm install` 装回了 devDependencies（vitest / eslint / @testing-library 等 208 个包）。这不是代码改动，但改了本机环境；决定里没有写。理由：runner 的 verify 入口是 `npm test`，缺 vitest 会直接红，且「测试链恢复」是核对的前提。

没有改动：`src/` 下任何文件、`public/` 下任何资源、`.env`、`package.json`、`netlify/`、`vite.config.ts`。

## 三、未覆盖 / 留给下一次

- 12 个 V2 遗留资源（`public/assets/{idle,jump,rest,sleep,wenbebi}.{png,webp}`）未删 —— 不在本次决定内。
- 6 条代码断点未修（密语入口、sit/sleep 渲染、裁缝铺 DEV 保护、dataURL 落 localStorage、onError 回退、重复 `GameScreen` 类型）—— 决定「这次不做」，要另开一次 `change`。
- 文档只做了「合并 + 归档 + 口径修正」，没有把长文重写成短篇；`archive/` 里的原件仍是细节来源。
