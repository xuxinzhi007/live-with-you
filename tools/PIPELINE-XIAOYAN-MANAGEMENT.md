# 小燕 / 雯宝 · 出图与训练管理说明（调整版）

> 只写管理规则，不新建第三条万能工作流 JSON。  
> 整理日期：2026-11-08（Asia/Shanghai）→ **调整版落地**  
> 角色 LoRA 正式名 / trigger：**继续 `xiaoyan`**（本轮不切 `wenbao`）  
> 正式文件：`xiaoyan.safetensors`

---

## 调整版 2026-11-08 · 变更记录

1. **A 线 v2 已挂角色 LoRA**：`xiaoyan.safetensors`，强度 `0.8 / 0.8`（与 B 线一致）。  
2. **正向外貌堆砌已缩短**：身份交给 LoRA + IPAdapter；正向保留 trigger `xiaoyan` + 姿势相关词。  
3. **姿势链未改**：`OpenposePreprocessor` → ControlNet `strength=0.85`、`end=1.0`；禁止手绘骨架直喂 CN、禁止跳过预处理器。  
4. **改前备份**：  
   - `...\workflows\_archive_20261108\MeinaMix_小燕_姿势训练集_v2_pre_lora_20261108.json`  
   - 同内容副本：`...\workflows\_archive_20261106\MeinaMix_小燕_姿势训练集_v2_pre_lora_20261108.json`  
5. **live 收口**：实验/半正式移入 `_archive_20261108`（不删除）。live 现只留两条正式线 + `.index.json`。  
6. **训练集**：只写体检表 `tools/PIPELINE-XIAOYAN-DATASET-AUDIT.md`，未改 caption、未重训。  
7. **未做**：未新建第三条工作流；未恢复雯宝四层生成/拆层/上传；未动 body/head/arms；未写 dress-snow-white；本轮未排队出图。

---

## 1. 先记住：只保留两套官方线

| 线 | 现用工作流 | 干什么 | 不干什么 |
|----|------------|--------|----------|
| **A. 姿势 / 采图** | `MeinaMix_小燕_姿势训练集_v2.json` | 换姿势、采训练素材、**LoRA+锁脸+锁姿** | 不当正式礼服 / 纸娃娃交付 |
| **B. 角色出图 / 换装** | `MeinaMix_雯宝LoRA_换装抠图.json` | 出角色图、换衣服、出母图 Raw | 不拿草稿 Cutout 当正式透明层 |

归档目录：

| 目录 | 内容 |
|------|------|
| `_archive_20261106\` | 早期收口（同角色换姿势、solo02、训练集出图、文生/图生图等） |
| `_archive_20261108\` | 本轮调整版收口（见下） |

### 1.1 live 现状（2026-11-08）

**仍在 live（正式）**

- `MeinaMix_小燕_姿势训练集_v2.json`
- `MeinaMix_雯宝LoRA_换装抠图.json`
- `.index.json`

**本轮移入 `_archive_20261108`（未删除）**

| 文件 | 说明 |
|------|------|
| `MeinaMix_补全全身.json`（+ 若干 `.bak.*`） | **半身扩图实验**；禁止用于雯宝四层；脚本无硬编码依赖，已可安全归档 |
| `RealisticVision_文生图.json` | 非小燕正式线，易与 MeinaMix 正式线混淆 |
| `SeeThrough_Live2D_8GB.json` | Live2D/透视实验，非两套官方线 |
| `MeinaMix_小燕_姿势训练集_v2_pre_lora_20261108.json` | v2 挂 LoRA **前**备份 |

日常不要从归档里当主线开。

---

## 2. 和网上常见做法怎么对齐

成熟角色管线一般拆成三块，一次只动一块：

1. **身份** → 角色 LoRA（必要时再加轻量脸部参考）  
2. **姿势** → OpenPose / 骨架单独进 ControlNet  
3. **衣服 / 场景** → 提示词（或单独衣服参考）

推荐链（A/B 现已一致）：

```
Checkpoint → Character LoRA → IPAdapter(脸) → OpenPose预处理 → ControlNet → KSampler
```

训练侧常见纪律：

- 素材约 20–30 张精选优于大量混杂  
- Caption **只写会变的**（姿势、衣服、背景），**不写脸**；长相交给 trigger `xiaoyan`  
- 保存多个 checkpoint，用「训练集外服装 + 新姿势」挑不过拟合的那一档  
- 出图时固定身份，只换姿势板或只换衣服词，不要一次改三项

---

## 3. A 线 · 姿势 / 采图（v2）

**文件**  
`...\ComfyUI\user\default\workflows\MeinaMix_小燕_姿势训练集_v2.json`

**固定槽位（与 live 节点一致，不要随便改）**

| 槽位 | 当前值 |
|------|--------|
| 底模 | `meinamix_v12Final.safetensors` |
| 角色 LoRA | **`xiaoyan.safetensors`，`0.8 / 0.8`**（调整版已挂） |
| CLIP skip | `-2` |
| 锁脸 | `待机状态.png` + IPAdapter PLUS FACE，权重 `0.8` |
| 锁姿 | `xiaoyan_pose_stand_clean.png` → **OpenposePreprocessor** → ControlNet `0.85`，`end=1.0` |
| 画布 | `512×768` |
| 采样 | 28 步，cfg 7，`dpmpp_2m` / `karras`，denoise 1.0 |
| 正向原则 | `xiaoyan` + 姿势/构图词；**不堆**蓝发绿眼长描述 |
| 输出前缀 | `MeinaMix_xiaoyan_pose_train` + 骨架预览 `MeinaMix_xiaoyan_pose_skel` |

**即拿即用时只改**

- 姿势参考图（全身、有腿、清晰）  
- 正向里的姿势词（站/坐/举手等）  
- seed（需要复现时再锁）

**不要改**

- 跳过 `OpenposePreprocessor`  
- 把手绘骨架直接喂给 ControlNet  
- 把这条当成礼服交付线  

**已知缺口（当前事实）**

- ~~v2 未挂 LoRA~~ → **已消除（调整版）**  
- 训练集 caption 污染 / 缺 txt → 见 `PIPELINE-XIAOYAN-DATASET-AUDIT.md`（清洗与重训另下令）  
- 命名双轨：部分 caption 仍写 `wenbao`，正式推理文件/trigger 本轮仍固定 `xiaoyan`

---

## 4. B 线 · 角色出图 / 换装

**文件**  
`...\ComfyUI\user\default\workflows\MeinaMix_雯宝LoRA_换装抠图.json`

**固定槽位**

| 槽位 | 当前值 |
|------|--------|
| 底模 | `meinamix_v12Final.safetensors` |
| 角色 LoRA | `xiaoyan.safetensors`，`0.8 / 0.8` |
| CLIP skip | `-2` |
| 锁脸 | `待机状态.png` + IPAdapter PLUS FACE，`0.8` |
| 锁姿 | `xiaoyan_pose_stand_clean.png` → OpenposePreprocessor → ControlNet `0.85`，`end=1.0` |
| 画布 | `512×640`（正式再对齐 760） |
| 采样 | 26 步，cfg 6.8，`dpmpp_2m` / `karras`，denoise 1.0 |
| 输出 | `Wenbao_Raw`（主看这个）；`Wenbao_Cutout` **仅草稿**；骨架预览 `Wenbao_Dress_PoseSkel` |

**即拿即用时只改**

- 正向里的衣服 / 场景词  
- 需要时换姿势参考图（仍必须走预处理器）  
- seed  

**正式透明交付（脚本，不在工作流里硬抠白底）**

```bash
cd C:\Users\ZhuanZ1\Desktop\wenbebi
python tools\deliver-dress-frame.py <Wenbao_Raw路径> --name dress-xxx.png --check-spec
```

产物目录：`tools\out\wenbao-assets\dress\`（或项目约定的 clothes 目录）。  
**禁止**把 node17 `Wenbao_Cutout` 或纯白背景色键当最终 alpha。

---

## 5. 角色 LoRA 文件管理

路径：`ComfyUI\models\loras\`

| 文件 | 用途 |
|------|------|
| `xiaoyan.safetensors` | **正式推理用** |
| `xiaoyan-000001` … `000009` | 同轮训练检查点，对比用，日常别混着挂 |
| `xiaoyan_*.json` | 训练配置备份，不是推理 LoRA |

触发词 / 提示：A/B 正向都用 **`xiaoyan`**；外貌细节交给 LoRA + 锁脸。  
**本轮明确：正式 trigger / 文件名继续 `xiaoyan`，不切 `wenbao`。**（README 若仍写重训输出 `wenbao.safetensors`，视为规划项，未生效前勿混挂。）

---

## 6. 日常操作清单（稳定优先）

1. 先看骨架预览是否完整（头、躯干、腿、手）。  
2. A 线换姿势；B 线换衣服；**一次只改一类变量**。  
3. ControlNet 保持「照片/清晰姿势图 → 预处理器 → CN」，`strength≈0.85`，`end=1.0`。  
4. 出图先看 Raw 是否人物完整、衣服对、底干净；过门再谈抠图 / 拆层 / 上传。  
5. 新实验另存名字进 `_archive` 或 `debug/`，**不要再平行新增第三条“半正式”工作流**。  
6. 四层纸娃娃（body/head/arms/dress）另见 `PIPELINE-LAYERS.md`；未过画面门不写 `dress-snow-white`、不上传、不动已锁定三层。

---

## 7. 调整版检查清单

- [ ] ComfyUI 打开 **live** `MeinaMix_小燕_姿势训练集_v2`，确认有 `LoraLoader` → `xiaoyan.safetensors` 0.8/0.8  
- [ ] 确认仍有 OpenposePreprocessor，且未把手绘骨架直连 ControlNet  
- [ ] 正向含 `xiaoyan`，无大段蓝发绿眼外貌堆砌  
- [ ] live 目录只有 A/B 两条正式 JSON（外加 `.index.json`）  
- [ ] 需要对照时：用户在 UI 用 v2 出一张站姿图 vs 挂 LoRA 前观感（本任务未授权代理排队出图）  
- [ ] 训练集问题只看 `PIPELINE-XIAOYAN-DATASET-AUDIT.md`，清洗/重训另开任务  

---

## 8. 和现有文档的关系

| 文档 | 作用 |
|------|------|
| `tools/PIPELINE-OFFICIAL.md` | 官方三条路径总表（dress / card / experimental） |
| `tools/PIPELINE-LAYERS.md` | 四层纸娃娃第一期说明 |
| `tools/PIPELINE-XIAOYAN-RESEARCH.md` | 调研对照与优先级（中期项本轮已落地一部分） |
| `tools/PIPELINE-XIAOYAN-DATASET-AUDIT.md` | 训练集只读体检表 |
| **本文件** | **xiaoyan 角色：姿势线 vs 出图线的日常管理（调整版）** |

冲突时：以「live 工作流里实际节点」为准，再回写文档。

---

## 9. 明确先不做（仍需下令）

- 不新建第三条「万能」姿势/出图 JSON  
- 不删除归档文件  
- 不恢复雯宝四层重做生成 / 拆层 / 上传  
- 不批量改 caption、不自动开训  
- 不把正式名切到 `wenbao`（除非两边文件与文档一起切）  

可选下一刀（未做）：B 线 CN `end` 1.0 vs 0.85 单变量对照；训练集清洗后再评 checkpoint。
