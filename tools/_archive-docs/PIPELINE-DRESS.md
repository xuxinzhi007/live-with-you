# 雯宝礼服交付管线（透明 + 760 对齐）

## 结论（本机现状）

- ComfyUI **没有**本地 RMBG / BiRefNet / rembg / LayerDiffuse 节点。
- `BriaRemoveImageBackground` 是云端节点，需要 Comfy Org 鉴权，不作为默认依赖。
- 工作流 `MeinaMix_雯宝LoRA_换装抠图.json` 仍用 `ImageColorToMask(白)` 出 **草稿 RGBA**，并加了 GrowMask + FeatherMask 减轻硬边；**白裙子仍可能被咬**，不当正式衣柜源。
- **正式 dress** = Comfy 出 RGB 原图 → `tools/deliver-dress-frame.py`（四边洪水抠图 + `spec.json` 760 对齐）→ `tools/out/wenbao-assets/dress/`。

## 一键交付 760 透明礼服

```bash
cd C:\Users\ZhuanZ1\Desktop\wenbebi

# 用已有 RGB 原图（例如 public/assets/nikki/dress-*.png 或 Comfy Wenbao_Raw）
python tools/deliver-dress-frame.py public/assets/nikki/dress-apricot-tea.png --name dress-apricot-tea.png --check-spec

# 可选：尝试上传小主机（不可达则跳过，不阻塞本地）
python tools/deliver-dress-frame.py path\to\raw.png --name dress-xxx.png --upload
```

Python 可用便携包：

```bash
D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\python_embeded\python.exe tools/deliver-dress-frame.py ...
```

输出：`tools/out/wenbao-assets/dress/<name>.png`（RGBA 760×760，脚底≈748，中心 x≈380）。

## V7 生成脚本（分类暂存，默认不整库重刷）

```bash
# 只生成并交付指定 kind（推荐）
set WENBAO_KIND=dress
set WENBAO_ONLY=dress-apricot-tea.png
set WENBAO_DELIVER_DRESS=1
node tools/generate-comfy-assets.mjs

# 正式姿势锁：挂 ControlNet（需本机有 openpose 模型与骨架图）
set COMFY_CONTROLNET=openpose
set COMFY_CONTROLNET_IMAGE=xiaoyan_pose_stand_clean.png
set WENBAO_KIND=dress
set WENBAO_DELIVER_DRESS=1
node tools/generate-comfy-assets.mjs
```

- 主输出：`tools/out/wenbao-assets/{dress,part,card,raw}/`
- `public/assets/nikki` 仅当 `WENBAO_ALSO_NIKKI=1` 时额外拷贝（兼容旧路径，不再是主目标）。
- 无 ControlNet 的文生图标为 **unofficial**；正式 dress 应设 `COMFY_CONTROLNET=openpose` + 姿势参考。

## 提示词约定

角色出图正向：`xiaoyan` + 姿势/服装/场景；**不要**再写短黑发 / bob / 棕眼等长相。

## 残留风险

- 洪水抠图：白袜/白鞋若与白背景在脚底连通，仍可能被吃掉边缘；白衣服建议浅灰底生成，或出图后人工修 alpha。
- 颜色键草稿：白裙/白蕾丝高概率破洞，只做预览。
- 小主机上传 API 若未开放 PUT，`--upload` 会软失败，文件仍留在本地 staging。

## 官方多阶段工作流（已合并）

正式礼服图请打开 ComfyUI 工作流 **MeinaMix_雯宝LoRA_换装抠图**（已升级为：LoRA + IPAdapter 锁脸 + OpenPose/ControlNet 锁姿 + 草稿抠图）。
合并与弃用说明见 	ools/PIPELINE-OFFICIAL.md。
