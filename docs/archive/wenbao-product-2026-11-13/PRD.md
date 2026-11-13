# 雯宝 / live-with-you 产品需求文档

- 版本：2026-11-13（Asia/Shanghai）
- 本机工程：`C:\Users\ZhuanZ1\Desktop\wenbebi`
- 仓库：[xuxinzhi007/live-with-you](https://github.com/xuxinzhi007/live-with-you)
- 活动分支：`featurle/xinzhi_feat`
- 读者：项目主人，以及 Live With You、comfyui、小燕资产管线
- 说明：本文是现行快照。正式出图已切到 Qwen-Image-Edit-2509 Q4；勿再把已归档的 MeinaMix 官方线当作现行方案。

> 本文是整包产品 PRD，由 Live With You 出具。Comfy 正式出图的流程与接口说明由 comfyui 另行出具；训练集、caption、过审衍生与训练门禁由小燕资产管线另行出具。冲突时：出图以 comfyui 文档为准，管线以小燕文档为准，产品目标与客户端以本文为准。

## 1. 产品定义

《雯宝》是以角色「雯宝」为核心的竖屏换装搭配与 AI 陪伴产品。打开之后，要先看到她；再用官方出图线稳定做出同一张脸和默认衣服，在舞台上换装、闯关、收集和聊天。

当前是个人使用，没有商业化计划。质量标准是：特征正常、角色正确、画面干净、没有报错。

北极星体验（沿用产品宪章，当前被打破的一条要优先修）：**打开数秒内看到雯宝与当前装扮。**

## 2. 本阶段目标

### P0：先让产品能看见、出图不走回头路

1. **角色可见。** 局域网资源库（`192.168.124.77:8788`）不可用时，客户端必须回退到仓库里已有的 `public/assets` 本地图，不能让舞台空白。这是 2026-11-13 已核实的现行缺陷。
2. **正式出图锁定 Qwen 官方线。** 工作流：`Qwen_Image_Edit_2509_Q4_官方出图.json`；母图锁 `Wenbao_redraw_00001_.png`（白 T、白短裤、白鞋正站，短黑发齐刘海、棕眼、浅笑）。用户已过目左 3/4 对照，出图本身按「没有问题」接受。
3. **开发时的实时生图不要回到旧线。** 客户端「星愿幻阁」的 `/api/comfy/draw` 仍硬编码 MeinaMix + `xiaoyan.safetensors`。对齐时走母图加提示词，不挂 `wenbao_v1`（该 LoRA 不能用在 Qwen 上）。改代码前需主人点头，并向 comfyui 要官方 API。

### P1：对齐之后再做

- 过审的 10 张衍生图仍留在 `derived_qwen_20261112_accepted`，择机再写入 `10_xiaoyan`；**这轮不开训。**
- 客户端 `/api/comfy/draw` 接到 Qwen 官方线（参数与正式 JSON 一致）。
- 四层透明件过门之前，`PHASE1_LAYERED_OUTFIT_IDS` 保持空数组，分层舞台不启用。

### P2：明确授权后再做

- 恢复四层生成、拆层、上传，写入正式库（入库契约仍是 760 透明帧，脚底约 y=748）。
- 启用客户端分层舞台。
- 新 LoRA 若再训练，对照过关后再谈挂接；正式 Qwen 线不以角色 LoRA 为出图前提。

## 3. 角色与视觉约束

| 项 | 锁定内容 |
| --- | --- |
| 官方名 | wenbao（当前磁盘上仍保留 `xiaoyan.safetensors`，不删） |
| 默认衣服 | 白 T 加白短裤，以主图为准（与此前图 2 衣服锁定一致） |
| 五官 | 短黑发、齐刘海、棕眼、浅笑；待机图只作五官参考，不锁 Q 版比例 |
| 触发词（训练） | `wenbao` 打头；五官进触发词，caption 只写该图的衣服和姿势 |
| 画布 | 分层与骨骼目标规格 760×760，脚底约 y=748，水平中心 x=380 |
| 抠图默认 | 官方后处理仍是 isnet-anime（未改）；运行时洪水填充只是客户端对不透明图的权宜 |

## 4. 功能需求

### FR-1 舞台角色可见（P0，现行缺陷）

- 默认装扮 `dress-snow-white` 使用皮肤帧 `assets/characters/original/idle.webp` 及呼吸帧；这些文件在本机 `public/assets/characters/original/` 里是齐全的。
- `resolveAsset()` 现在一律指向 `http://192.168.124.77:8788/files/...`。文档写过「库不可用则回退本地」，但**加载失败时没有 onerror 回退**。2026-11-13 01:53（Asia/Shanghai）从本机 ZhuanZ 访问 `:8788` 连接超时（curl 28），角色图请求会失败，舞台空白。
- 验收：关掉或访问不到 8788 时，封面和大厅在数秒内仍显示本地雯宝立绘；8788 恢复后可继续优先走远端。

### FR-2 官方出图（已达成主体）

- 只跑 `Qwen_Image_Edit_2509_Q4_官方出图.json`（Q4 GGUF + 文本编码器 + VAE + Lightning 8 步 LoRA，适配 8GB）。
- 已归档的 MeinaMix 官方线（`_archive_20261113_meinamix`）默认不再打开、不再排队。
- `wenbao_v1` 与旧 LoRA 文件保留在磁盘，不作为正式出图，也不挂到 Qwen。
- 衍生只从主图出，对照主图人工筛选；漂了的脸不加进集。501 / 701 不进训练集。

### FR-3 换装舞台与衣橱（已有，保持）

- 五槽：主装、头饰、手持、光环、心境卡。React DOM + CSS，无 Pixi。
- 非分层路径：皮肤呼吸帧，或 Comfy 整身图经 `loadCutoutImage` 抠透明后做切片骨骼。
- 分层路径：body → dress → head → arms-front。第一期候选 `dress-snow-white` 的四张仍是整身、未过门，开关保持关闭。

### FR-4 星愿幻阁实时生图（待对齐，需授权）

- 现状：`vite.config.ts` 里 `/api/comfy/draw` 自拼 MeinaMix 文生图，LoRA 为 `xiaoyan.safetensors` 0.8/0.8，触发词仍是 `xiaoyan`，并堆了 chibi 与五官，和现行官方线、caption 规则都不一致。
- 目标：同一接口改为调用 Qwen 官方工作流（母图 + 用户提示词）。不改正式 JSON 的生产参数。四层和入库仍先不动。

### FR-5 训练与资产管线（暂停训练）

- 训练集：`D:\lora_train\xiaoyan\10_xiaoyan`（6 张 + caption；`mother_05` 在 `held_out\aside`）。
- 10 张 Qwen 过审图：`derived_qwen_20261112_accepted`，先不写入 `10_xiaoyan`。
- 用户删除的 25 张不找回。这轮不开训、不重训。8GB 上只用 Kohya LoRA，不用 DreamBooth。

## 5. 非功能需求

- 本机显存 8GB；Qwen 走 Q4，不假设 fp8（约 16GB）能跑。
- 客户端离线可展示角色（本地资产是正式回退，不是临时备份）。
- 代码改动打 `featurle/xinzhi_feat`，不要打 main；不要回退已合入 main 的 PR #2，也不把这次 main 同步进 feat，除非主人明确要求。
- 未经明确要求不改仓库、不开 PR、不恢复四层、不写正式资源库。

## 6. 明确本阶段不做

- 不开训、不把过审 10 张写入训练集
- 不找回已删的 25 张，不把 `held_out` 搬回
- 不把 `wenbao_v1` 挂到 Qwen
- 不启用客户端分层，不恢复四层生成 / 拆层 / 上传
- 不做自定义训练 exe；星辉 / moe-social 继续搁置
- 不把 Live2D / Spine / Blender 当作当前运行时（仅可作远期选项）

## 7. 分工

| 角色 | 负责 | 本阶段任务 |
| --- | --- | --- |
| Live With You | 仓库与客户端（分层舞台接线） | 角色可见回退；等授权后对齐 `/api/comfy/draw`；维护与现行流程一致的文档 |
| comfyui | ComfyUI 出图与工作流 | 看守 Qwen 官方线；对齐代理时提供官方 API；不动已归档 MeinaMix 正式模板 |
| 小燕资产管线 | 训练集、caption、一致性 | 看守 6 张 + 10 张过审目录；对照主图筛衍生图；这轮不开训 |
| 主人 | 最终视觉验收与授权 | 出图已过目；改客户端、开训、恢复四层需点头 |

## 8. 验收标准

1. 本机访问不到 `:8788` 时，封面和大厅仍能显示雯宝，而不是空白。
2. 正式出图只走 Qwen 官方工作流，母图仍是 `Wenbao_redraw_00001_.png`。
3. 实时工坊在授权对齐之前，不把它当成正式出图入口宣传；对齐后抽测与官方线一致。
4. 四层开关仍为关；仓库无未授权提交。
