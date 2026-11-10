# 小燕 / 雯宝 · 网上调研对照（稳定模板 + 训练过程）

> 调研日期：2026-11-08  
> 目的：对照当前 ComfyUI 模板怎么调更稳，以及训练过程该怎么管。  
> 初稿只做调研与建议；**调整版 2026-11-08** 已按「中期」落地一部分（见下「落地状态」），细节以 `PIPELINE-XIAOYAN-MANAGEMENT.md` 为准。

参考来源（公开文章/仓库，2024–2026 常见实践）：
- DEV: LoRA + ControlNet + IPAdapter 一致性管线
- mikeabakumoff / sdxl-character-lora-guide（数据集与过拟合）
- goragen / kohya 数据集指南
- honeychat tutorial（角色 LoRA + 换装参考）
- RunComfy / Flick / note.com 等角色一致性写法

---

## 1. 网上共识：稳定靠「分工」，不靠堆工作流

| 职责 | 交给谁 | 不要交给谁 |
|------|--------|------------|
| 是谁（身份） | 角色 LoRA；必要时轻量脸参考 | 不要主要靠长提示词堆长相 |
| 什么姿势 | OpenPose / DWPose → ControlNet | 不要只靠 prompt 改姿势 |
| 穿什么 / 场景 | 提示词；可选单独衣服参考 | 不要让姿势参考图顺便带衣服/背景 |

推荐推理链（与你 B 线高度一致）：

```
Checkpoint → Character LoRA → IPAdapter(脸/canon) → OpenPose预处理 → ControlNet → KSampler
```

采样常见稳区：`dpmpp_2m` + `karras`，约 25–30 步，CFG 约 6–7。  
CFG 过高容易和 LoRA 打架。

---

## 2. 模板参数：网上推荐区间 vs 你现在

| 项 | 网上常见稳区 | 你现在（出图线） | 评价 |
|----|--------------|------------------|------|
| LoRA 强度 | 0.7–0.8 | 0.8 / 0.8 | 合适 |
| IPAdapter 脸 | Face 类约 0.7–0.85；跨场景 style 常更低到 0.5–0.6 | PLUS FACE 0.8，全程 0–1 | 站姿锁脸够用；复杂场景可试略降或提前结束 |
| ControlNet OpenPose | strength 0.7–0.85 | 0.85 | 合适 |
| CN end | 不少人用 0.8–0.9「末段松手」；也有人用 1.0 | **1.0** | 姿势极稳，但衣服/细节可能被压；**一次只改 end 做对照**，别和姿势板一起改 |
| 预处理 | 必须 openpose_full / Preprocessor | 照片 → OpenposePreprocessor | **必须保留**；直喂手绘骨架是你之前漂服装的主因之一 |
| 画布 | 与训练分辨率同族更稳 | 训练 512；出图 512×640 / 采图 512×768 | 合理 |

**模板调整原则（更稳）**

1. 活列表只留两条：姿势采图、角色出图。实验进 `_archive`。 → **调整版已收口 live**  
2. 两条都挂同一正式 LoRA（正式文件仍是 `xiaoyan.safetensors`）。→ **v2 已补挂 0.8/0.8**  
3. 一次只改一类变量：姿势 **或** 衣服 **或** seed。  
4. 姿势输入永远：清晰全身图 → 预处理器 → CN；禁止手绘骨架直喂。  
5. 需要更自然服装时，单独做「仅 end 0.85 vs 1.0」最小对照，不要同时改 prompt/负向/姿势板。

---

## 3. 训练过程：网上标准流程

### 3.1 数据集

- 数量：约 **15–30 张精选** 往往优于「很多但不干净」  
- 变化：角度、表情、景别、光照、服装、全身/半身  
- 恒定：同一人、发型年龄一致；模糊/畸变/别人的脸坚决删  
- 全身图要有，否则全身比例容易漂

### 3.2 Caption

核心句：**只标注你想以后用提示词改的东西；脸不要写进每一张 caption。**

- 写：姿势、表情、衣服、构图、背景、光  
- 不写（或极少写）：脸型、发色、瞳色、体型（交给 trigger）  
- 每张 caption 要有差异，不要全员同一句  
- 自动 WD14 只是草稿，必须人工扫一遍

Trigger：短、稀有；出图时第一个词用它。  
（README 里规划过 `wenbao` 重训；**调整版明确：正式 trigger/文件名本轮继续 `xiaoyan`，不切 `wenbao`**。改名要两边一起切。）

### 3.3 Kohya 训练

常见可复用设定（SD1.5 角色、8GB 级）：

- 分辨率 512；batch 1；可选 gradient checkpointing  
- network dim 16–32，alpha 约为 dim 一半  
- lr 约 `1e-4`，cosine；clip skip 2（动漫）  
- **按 epoch 存 checkpoint**，不要只留最后一个  
- 用「训练集里没出现过的衣服/姿势/场景」同 seed 对比，挑「像本人但仍能换装」的那一档——常常不是最后一档

### 3.4 训练 → 出图闭环

1. 用姿势线（锁脸+锁姿）批量采干净全身/多角度图  
2. 人工筛选进 `10_xiaoyan`（或正式数据集）  
3. WD14 + 人工改 caption  
4. Kohya 训，存多 checkpoint  
5. 固定出图模板测：无 LoRA / 有 LoRA / 换装 / 新姿势  
6. 选定正式文件名，写进管理文档，旧检查点只归档

---

## 4. 对照你本机现状

### 已对齐得好的

- 出图线已是 **LoRA + IPAdapter 脸 + OpenPose 预处理 + CN**  
- 采样器/步数/CFG 落在稳区  
- 训练目录 `D:\lora_train\xiaoyan\10_xiaoyan`（repeats=10）结构正确  
- 训练配置：meinamix、512、dim16/alpha8、lr 1e-4、cosine、clip skip 2、按 epoch 存  
- 已有 `xiaoyan-000001`…`000009` + 正式 `xiaoyan.safetensors`

### 主要管理问题（调整版后）

1. ~~姿势 v2 未挂 LoRA~~ → **已补挂**；请用 UI 出一张对照确认观感（本调研轮未强制出图）。  
2. ~~live 与实验混用~~ → **已再收口到 `_archive_20261108`**；仍勿从归档开主线。  
3. **训练集混杂（仍在）**：见 `PIPELINE-XIAOYAN-DATASET-AUDIT.md`（66 图 / 缺 txt 46 / 污染命中约 20）。本轮**只体检不改图**。  
4. **命名双轨（策略已钉死本轮）**：正式继续 `xiaoyan`；部分旧 caption 仍写 `wenbao` + 黑发褐眼翅膀污染——清洗时一并处理。  
5. **改姿势时破坏模板纪律**（直喂手绘骨架、同时改 prompt/end）→ 操作风险仍在，文档纪律不变。

---

## 5. 建议的稳定模板调整

### 短期（零改文件也能执行）

- 日常只开两条：v2 = 采姿势；换装抠图 = 出角色/衣服  
- 换姿势：只换姿势参考图，过预处理器，看骨架预览  
- 换衣服：只改正向衣服词，姿势板不动  
- 不稳时：优先回退到「GOOD 白裙那次」的姿势链（照片→预处理→CN end1.0），不要堆 negative

### 中期 · 落地状态（调整版 2026-11-08）

1. 给 v2 补挂 `xiaoyan.safetensors` 0.8，缩短蓝发绿眼长描述 → **已做**  
2. 统一正式 trigger / 文件名 → **本轮选定继续 `xiaoyan`（不切 wenbao）**  
3. 清洗 `10_xiaoyan` → **未做**（仅有体检表）  
4. 用同一测试卡评选 checkpoint → **未做**  
5. 出图线 CN `end` 1.0 vs 0.85 对照 → **未做**

### 不要优先做的

- 再平行新建第三条「万能大图」工作流  
- 用补全全身做出图母版（该文件已归档到 `_archive_20261108`）  
- 把 Cutout / 白底色键当正式透明  
- 四层纸娃娃未过画面门就继续抽 seed

---

## 6. 和已有文档关系

- 日常两套线（调整版）：`tools/PIPELINE-XIAOYAN-MANAGEMENT.md`  
- 本文件：网上调研 + 与本机差距 + 调整优先级 / 落地状态  
- 训练集体检：`tools/PIPELINE-XIAOYAN-DATASET-AUDIT.md`  
- 官方路径总表：`tools/PIPELINE-OFFICIAL.md`  
- 四层纸娃娃：`tools/PIPELINE-LAYERS.md`（另线，未恢复生成前勿混进本模板）
