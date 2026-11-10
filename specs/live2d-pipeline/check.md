# live2d-pipeline 核对

## 跑了什么

```
$ npm run test:mobile
tests 9 / pass 9 / fail 0
exit 0

$ python3 tools/character/make-rig-templates.py
OK   spark-output/audit/character-rig/standard-template-390.png
OK   spark-output/audit/character-rig/face-readability-390.png
OK   spark-output/audit/character-rig/parts-template-390.png
exit 0

$ cd /tmp/l2ddemo && node verify.mjs
RESULT ok
{"ok":true,"model":{"loadMs":99,"motion":true,"expression":true,"parallelMotion":true},
 "render":{"fps":52,"nonEmptySamples":192,"sampleTotal":256}}
exit 0
```

## 验收条件

| # | 条件（来自 decision.md） | 结果 |
| --- | --- | --- |
| 1 | 有可验证链路：11 件 → 对齐 → 模型 → 渲染 | 达到。链路画在 `docs/live2d-11-parts-research.md` §4，渲染端已实测 |
| 2 | 渲染库在 Pixi v8 下能跑 | 达到。Pixi **8.22.0** + engine 1.4.0，52fps，出图见 `live2d-canvas.png` |
| 3 | 生成端有对齐基准图 | 达到。`parts-template-390.png`，11 件框 + z 序 + 枢轴 |
| 4 | 姿势一致性有机制保障 | 达到（方案层）。ControlNet 三仓库均已验证存在 |
| 5 | 明确标出不可自动化环节 | 达到。报告 §5.1「绑骨不可自动化」+ §5.2 工作量 |

## 三项任务完成情况

### B. 11 件骨架对位图

`spark-output/audit/character-rig/parts-template-390.png`

- 11 个 slot 框，按 z 序编号 01–11
- back / mid / front 三层用不同颜色区分
- 枢轴点（胯/腰/肩/颈/头顶/手）从 `spec.json` 的 `keypoints()` 算出，不手填
- 底部两列清单 + 图例

绘图过程中修了 4 次排版：标签重叠 → 引线穿身 → 编号入框 → 列宽溢出。

### C. 渲染库 demo

实测通过。关键数据：

| 项 | 值 |
| --- | --- |
| Pixi | 8.22.0 |
| engine | 1.4.0 |
| Cubism Core | 5.1.0 |
| 模型加载 | 99–167 ms（Haru 1965×4018） |
| 渲染 | 60 帧 / 1158 ms ≈ 52 fps（SwiftShader 软渲染） |
| 像素探测 | 192/256 不透明 → 确认真的画出内容 |

**踩了 4 个坑，每个都会导致静默空白**，全部记入报告 §3：
主入口要求 Cubism2、必须从 `cubism` 子入口取、插件须在 `app.init()` 前注册、
需读 `getBounds()` 触发布局。

### A. 技术方案

`docs/live2d-11-parts-research.md`（含选型表、链路图、硬约束、工作量、许可）

## diff 有没有超出 decision.md

| 文件 | 对应决定 |
| --- | --- |
| `specs/live2d-pipeline/decision.md` | A |
| `tools/character/make-rig-templates.py`（改） | B：新增 `make_parts_template()` |
| `spark-output/audit/character-rig/parts-template-390.png`（新增） | B |
| `docs/live2d-11-parts-research.md`（新增） | A + C 的结论 |
| `spark-output/audit/live2d-demo/`（新增 4 文件） | C 的证据 |

**未触碰**：`src/` 下零改动、未装 ControlNet / LayerDiffusion、
未生成真实 Live2D 模型、未动 `skeleton-system.ts` / `paper-doll-rig.ts`、
未改 `generate-comfy-assets.mjs`。全部符合 decision「这次不做」。

demo 放在 `/tmp` 和 `spark-output/audit/`，未进 `src/`，未污染运行时。

## 遗留

1. **Cubism Core 未入库**：`live2dcubismcore.min.js` 是 Live2D 专有许可文件，
   不能随仓库分发。接入时需构建期下载或使用者自备。已在报告 §5.3 标注。
2. **Haru 样本模型未入库**：体积 4.4MB + 第三方版权。
3. **demo 是临时目录**：`/tmp/l2ddemo` 会丢。归档的是脚本与产出，
   重跑需重新 `npm i` + 下载 Core/模型。若要长期保留应建正式 demo 目录。
4. **另两个 v8 库未测**：`@jannchie` 与 `@naari3` 只验证了 peer 声明，未实跑。
5. **11 件对位框是估算值**：`PART_SLOTS` 的矩形比例按 5.0 头身人体结构估的，
   真实绑骨后需按 Cubism Editor 的实测调整。
