# 雯宝文档地图

现行产品是竖屏换装衣橱。入口：`src/main.tsx` → `src/mobile/WorldApp.tsx`。

要改玩法或界面，先读下面三份，再改代码。其余文档不是现行规则。

## 现行

| 文件 | 干什么 |
| --- | --- |
| [product-charter.md](./product-charter.md) | 产品约束 |
| [game-direction.md](./game-direction.md) | 方向摘要 |
| [current-state-and-next.md](./current-state-and-next.md) | 代码现在做到哪、下一步 |
| [handoff-implemented-ops.md](./handoff-implemented-ops.md) | 已经落地的玩家操作和幻阁交接 |
| [mobile-architecture.md](./mobile-architecture.md) | 模块各管什么 |
| [architecture-map.md](./architecture-map.md) | 系统架构图 + 玩法流程图（换装/闯关/抽卡/小世界/AI陪伴/经济闭环） |

## 调研，不是运行时

这些文件还在 `docs/` 里，开头已标明不是当前入口。不要按它们改主路径。

| 文件 | 内容 |
| --- | --- |
| [character-rig-design.md](./character-rig-design.md) | 底模与部件提案 |
| [standard-character-plan.md](./standard-character-plan.md) | 五头身底模计划，未按该文改运行时 |
| [spine-integration.md](./spine-integration.md) | Spine 设想 |
| [live2d-11-parts-research.md](./live2d-11-parts-research.md) | Live2D 调研 |
| [backend-save-contract.md](./backend-save-contract.md) | 尚未接入的匿名存档接口 |
| [offline-first-save-design.md](./offline-first-save-design.md) | 云同步设计 |

## 已归档

[archive/](./archive/README.md) 里是旧方向：可走动小屋、像素家具、桌面宠物打包调研、无人引用的 `styles-mobile.css`。

## 不是文档源

- `tools/`：生图、抠图、校验脚本，以及 `PIPELINE-*.md` 管线笔记。
- `spark-output/`：历史审计和截图。
- `specs/`：本机工作记录，已在 `.gitignore`。
