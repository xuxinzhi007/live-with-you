# 雯宝四层纸娃娃管线（第一期）

## 产物

| 文件 | 含义 |
|------|------|
| `tools/out/wenbao-assets/base/original-body.png` | 身体底模（去头；当前版本保留手臂以保证接缝） |
| `tools/out/wenbao-assets/base/original-head.png` | 头与刘海（顶带遮罩） |
| `tools/out/wenbao-assets/base/original-arms-front.png` | 前景手臂侧条 |
| `tools/out/wenbao-assets/dress/dress-snow-white.png` | 初雪白茶连衣裙层（去头） |

全部 760×760 RGBA。全身层脚底≈748、中心 x≈380（`tools/character/spec.json`）。

## 怎么共用同一姿势

1. 身体母图与裙子母图都走官方礼服思路：
   - `meinamix_v12Final` + `xiaoyan.safetensors`（默认 ~0.72）
   - IPAdapter PLUS FACE（默认 `xiaoyan_face_i2i04.png`，可改 `COMFY_FACE_REF`）
   - OpenPose ControlNet，直接吃骨架图 `xiaoyan_pose_stand_skel.png`（强度默认 0.85）
   - **同一 seed** 优先
2. 浅灰底生成 + 收紧洪水抠图（`near_white=252`），减轻白衣/浅肤被吃。
3. 各自对齐到 760 后，用几何顶带去头；手臂侧条另存。

脚本：`tools/build-wenbao-four-layers.py`  
辅助交付：`tools/out/debug/_deliver_qa10.py`（简化拆层）  
抠图/上传：`tools/wenbao_matting.py`（`POST /api/upload`）

## 一键

```bash
cd C:\Users\ZhuanZ1\Desktop\wenbebi
D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\python_embeded\python.exe tools/build-wenbao-four-layers.py --seed 20261106389
```

## 已知限制（第一期）

- 身体母图与裙子母图即使同 seed + 同骨架，轮廓仍会漂；叠层预览可能出现双重肢体/接缝错位。
- 几何拆层不是语义分割；头带可能切到锁骨，手臂侧条不完美。
- 白裙子仍怕洪水；务必浅灰底。
- 不要用 `MeinaMix_补全全身`，不要把 `Wenbao_Cutout` 当正式透明。

## 校验

- `dress` / `composite`：脚底与中心按 `deliver-dress-frame.py --check-spec` 同口径。
- `body`：脚底 + 画布；中心允许 ±8（去头后 bbox 会漂）。
- `head` / `arms`：760 + 非空。