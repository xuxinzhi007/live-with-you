# 雯宝文档地图

> 一句话：**先读 [现行状态](./现行状态.md)**。那是唯一的「现在做到哪」。
> 其余文档按下面三层：现行（有约束力）、调研（不是运行时）、归档（历史，不作数）。
>
> 体检：`node tools/audit/docs-links.mjs --verify-claims`（坏链 / 零入链 / 6 条「文档 vs 代码」口径）。

## 一、现行（有约束力）

| 文件 | 干什么 |
| --- | --- |
| [现行状态.md](./现行状态.md) | 屏幕与导航、**链路闭环检查（已修 4 断，剩 4 条）**、资源与存档、出图路线、待拍板 |
| [product-charter.md](./product-charter.md) | 产品约束与质量底线 |
| [game-direction.md](./game-direction.md) | 方向摘要与核心循环 |
| [architecture-map.md](./architecture-map.md) | 分层 / 依赖方向 / 数据模型 / 模块健康度 / 玩法流程 / 技术债 |
| [handoff-implemented-ops.md](./handoff-implemented-ops.md) | 已落地的玩家操作与幻阁交互细节 |
| [资产管线.md](./资产管线.md) | 出图契约（母图 + Qwen Q4）、去底与 760 对齐、目录、暂停表 |
| [待办-动作帧.md](./待办-动作帧.md) | 点击 / 坐下 / 躺下三个槽位的结论、可用稿与换图契约 |
| [服务端接线.md](./服务端接线.md) | 陪伴 Function、`/api/comfy/draw`、资源库探活、开发与生产差异 |
| [comfy-official-qwen/execution-design.md](./comfy-official-qwen/execution-design.md) | 官方 Qwen 节点图与 API 约定（comfyui 出具） |

指针文件（保留旧路径，内容已并入上面）：`current-state-and-next.md` → 现行状态；`mobile-architecture.md` → architecture-map；`wenbao-product/交接-当前状态.md` → 现行状态。

## 二、调研与专题（不是运行时，别照它改主路径）

| 文件 | 内容 |
| --- | --- |
| [产品分析-主大厅与小世界.md](./产品分析-主大厅与小世界.md) | 这两块屏的现状取证、根因与改造清单（P0/P1/P2 + 验收） |
| [character-rig-design.md](./character-rig-design.md) | 角色底模与部件化提案 |
| [standard-character-plan.md](./standard-character-plan.md) | 五头身底模计划 |
| [spine-integration.md](./spine-integration.md) | Spine 设想 |
| [live2d-11-parts-research.md](./live2d-11-parts-research.md) | Live2D 11 件方案调研 |
| [backend-save-contract.md](./backend-save-contract.md) | 尚未接入的匿名存档接口 |
| [offline-first-save-design.md](./offline-first-save-design.md) | 云同步设计 |
| [diagrams/](./diagrams/) | 架构与玩家流程图（excalidraw + svg） |

## 三、归档（历史，不作为规则）

- [archive/README.md](./archive/README.md)：V2 可走动小屋、像素家具、桌面宠物包装调研、未被引用的旧样式
- `archive/wenbao-product-2026-11-13/`：整包 PRD / 设计 / 架构 / 角色不显示分析（已并入现行状态）
- `archive/asset-pipeline-2026-11-13/`：资产管线 PRD / 架构 / 设计说明 + caption 清单 + 项目分析 HTML
- `archive/superpowers/`：2026-11-06 分层动画设计（已被 `skeleton-system.ts` 取代）

## 四、不是文档源

- `tools/`：生图、抠图、校验脚本，以及 `PIPELINE-*.md` 管线笔记（`tools/_archive-docs/` 是停用的旧版）。
- `specs/`：data-workflow 的运行记录（decision / check / evidence / confess），随仓库提交。最近两次运行：`specs/docs-consolidation/`、`specs/nav-and-closure/`。
- `spark-output/`：历史审计与截图（已清理，文档里的相关图片链接不再有效）。
- [dev/learnings.md](./dev/learnings.md)：踩过的坑与可复用事实（verify 入口、搬目录断链、口径断言）。
