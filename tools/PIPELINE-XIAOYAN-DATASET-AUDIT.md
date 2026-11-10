# 小燕训练集体检表（只读，不改图/不重训）

> 扫描日期：2026-11-08 17:07（Asia/Shanghai）  
> 路径：`D:\lora_train\xiaoyan\10_xiaoyan`  
> 本文件只做体检；**不批量改 caption、不启动训练**。

## 1. 规模

| 项 | 数量 |
|----|------|
| 图片 | 66 |
| 同名 `.txt` caption | 20 |
| **缺 txt** | **46** |
| 空 txt | 0 |
| 孤儿 txt（无图） | 5 |

## 2. 文件名前缀分布（抽样分组）

| 前缀 | 张数 |
|------|------|
| `re01` | 19 |
| `Xiaoyan` | 11 |
| `comfyui-mcp` | 8 |
| `MeinaMix` | 7 |
| `mother` | 5 |
| `wenbebi` | 5 |
| `style` | 3 |
| `confirm` | 2 |
| `solo02` | 2 |
| `xiaoyan` | 2 |
| `lock` | 1 |
| `Wenbao` | 1 |

## 3. 可疑污染标签抽样（翅膀 / 黑裙等）

命中文件数：**20** / 66

| 文件 | 命中标签 | caption 摘录 |
|------|----------|--------------|
| `MeinaMix_00001_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `MeinaMix_00003_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `MeinaMix_i2i_00001_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `MeinaMix_i2i_00004_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `MeinaMix_pose_00002_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `MeinaMix_pose_00003_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `MeinaMix_pose_00004_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `xiaoyan_00001_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `xiaoyan_00002_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `Xiaoyan_anchor_00001_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `Xiaoyan_redraw_00001_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `Xiaoyan_train_00002_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `Xiaoyan_train_00003_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white dress, black skirt, long skirt, white footwear, standing, wings, white background shoes, standing, table |
| `Xiaoyan_train_00005_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `Xiaoyan_train_00011_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `Xiaoyan_train_00012_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `Xiaoyan_unified_00001_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `Xiaoyan_unified_00002_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `Xiaoyan_unified_00003_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |
| `Xiaoyan_unified_00005_.png` | wings, black hair, brown eyes | wenbao, 1girl, black hair, short hair, bob cut, ahoge, brown eyes, white shirt, black skirt, long skirt, white footwear, standing, wings, white background |

## 4. 外貌堆砌 / 脸写进 caption 抽样（建议清洗时删）

命中文件数：**0** / 66


## 5. 缺 txt 列表

- `comfyui-mcp_00007_.png`
- `comfyui-mcp_00008_.png`
- `comfyui-mcp_00014_.png`
- `comfyui-mcp_00015_.png`
- `comfyui-mcp_00016_.png`
- `comfyui-mcp_00018_.png`
- `comfyui-mcp_00019_.png`
- `comfyui-mcp_00020_.png`
- `confirm_solo_01_00001_.png`
- `confirm_solo_02_00001_.png`
- `lock_04_lookback_00001_.png`
- `mother_01_00001_.png`
- `mother_02_00001_.png`
- `mother_03_00001_.png`
- `mother_04_00001_.png`
- `mother_05_00001_.png`
- `re01_armsup_00001_.png`
- `re01_armsup_donor_00001_.png`
- `re01_back_00001_.png`
- `re01_bottom_00001_.png`
- `re01_bottom_00002_.png`
- `re01_bottom_00003_.png`
- `re01_crouch_00001_.png`
- `re01_crouch_00002_.png`
- `re01_crouch_donor_00001_.png`
- `re01_front_00001_.png`
- `re01_front_00002_.png`
- `re01_front_00003_.png`
- `re01_side_00001_.png`
- `re01_sit_00001_.png`
- `re01_sit_00002_.png`
- `re01_top_00001_.png`
- `re01_top_00002_.png`
- `re01_top_00003_.png`
- `re01_tq_00001_.png`
- `solo02_re_02_00001_.png`
- `solo02_re_04_00001_.png`
- `style_01_stand_00001_.png`
- `style_02_threequarter_00001_.png`
- `style_03_sit_00001_.png`
- `Wenbao_Raw_00001_.png`
- `wenbebi_v7_00004_.png`
- `wenbebi_v7_00005_.png`
- `wenbebi_v7_00006_.png`
- `wenbebi_v7_00007_.png`
- `wenbebi_v7_00008_.png`

## 6. 高频 caption 片段 TOP20（粗分词）

| 片段 | 次数 |
|------|------|
| `standing` | 21 |
| `wenbao` | 20 |
| `1girl` | 20 |
| `black hair` | 20 |
| `short hair` | 20 |
| `bob cut` | 20 |
| `ahoge` | 20 |
| `brown eyes` | 20 |
| `black skirt` | 20 |
| `long skirt` | 20 |
| `white footwear` | 20 |
| `wings` | 20 |
| `white shirt` | 19 |
| `white background` | 19 |
| `white dress` | 1 |
| `white background shoes` | 1 |
| `table` | 1 |

## 7. 建议（本轮不执行）

1. 补齐缺 txt，或删掉无 caption 的漂移图。
2. 人工扫污染命中：去掉 wings / black dress 等不应进角色集的标签。
3. 外貌词（blue hair / green eyes 等）从 caption 抽掉，交给 trigger `xiaoyan`。
4. 正式 trigger/文件名本轮继续 `xiaoyan`，不切 `wenbao`。
5. 清洗后再训；本体检**不启动** Kohya。

