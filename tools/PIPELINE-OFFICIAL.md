# 雯宝 / 林小燕 · 官方出图管线（合并说明）

## 三条官方路径（不要再平行维护十几条短图）

| 路径 | 工作流 / 命令 | 用途 |
|------|----------------|------|
| **Official dress** | `MeinaMix_雯宝LoRA_换装抠图.json` + `tools/deliver-dress-frame.py` | 全身透明立绘 760×760 RGBA |
| **Official card** | V7 `generate-comfy-assets.mjs` 的 `kind=card`（512×640 CG） | 图鉴/评比，**不当衣服层** |
| **Experimental** | `MeinaMix_小燕LoRA.json` | 纯提示词试姿势/服装，**无锁姿 = unofficial** |

## Official dress 阶段（必须连在一起，不是事后补丁）

1. MeinaMix + `xiaoyan` LoRA  
2. IPAdapter PLUS FACE 锁脸（`待机状态.png`）  
3. OpenPose → ControlNet（`xiaoyan_pose_stand_clean.png`，先看骨架预览）  
4. 采样 → `Wenbao_Raw`  
5. 草稿颜色键抠图 → `Wenbao_Cutout`（白衣可能破洞，仅预览）  
6. **正式交付**：`python tools/deliver-dress-frame.py <Raw> --name dress-xxx.png --check-spec`  
   → `tools/out/wenbao-assets/dress/`（洪水抠图 + `spec.json` 对齐）

## 可合并 / 建议弃用（保留文件但不要当正式源）

| 工作流 | 建议 |
|--------|------|
| `MeinaMix_同角色换姿势.json` | 与姿势训练集_v2 重复 → **并入/让位** 姿势训练集_v2（训练采图）与官方换装抠图（礼服） |
| `MeinaMix_小燕_成长后站姿_solo02.json` | 单姿势特化 → 用官方 dress 换姿势参考即可 |
| `MeinaMix_训练集出图.json` / `_mcpfix` | 训练辅助 → 保留给采数据，不当衣柜 |
| `MeinaMix_文生图.json` / `图生图` / `补全全身` / `全身统一` | 早期短图 → **experimental only**；`补全全身` 已于 2026-11-08 移入 `_archive_20261108`（半身扩图，禁止雯宝四层） |
| `MeinaMix_小燕LoRA.json` | **保留为 unofficial 试提示词**（在 `_archive_20261106`） |
| `MeinaMix_小燕_姿势训练集_v2.json` | **保留（live）**：已挂 `xiaoyan` LoRA 0.8 + 锁脸+锁姿采训练图；礼服正式帧改走「换装抠图」官方版 |

未删除任何工作流文件。调整版 2026-11-08：v2 补 LoRA；混淆 live 文件移入 `_archive_20261108`。细节见 `PIPELINE-XIAOYAN-MANAGEMENT.md`。

## 残留抽奖风险

- 姿势参考裁腿 / 骨架抽空 → 仍会漂；必须先看骨架预览  
- IPAdapter 过强会压服装细节；过弱脸会漂  
- 草稿颜色键仍怕白衣；正式务必走 `deliver-dress-frame` 洪水抠图  
- 无 ControlNet 的脚本默认路径仍是 unofficial  
- 本机无 RMBG/BiRefNet；语义抠图待装节点后可再替换草稿段
