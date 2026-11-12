# v6-wenbao-lora-cutout-and-paperdoll 核对

## 跑了什么

```text
exit 0
cmd npm run test:mobile && npm run build
```

- `npm run gen:comfy`：连接本机 `http://127.0.0.1:8188` 挂载 `meinamix_v12Final.safetensors` + `xiaoyan.safetensors`（模型强度 `0.80`、CLIP 强度 `0.80`）重新生成了 3 套**同角色 Q 版雯宝**全身纯白底礼服（`dress-apricot-tea.png`、`dress-rose-waltz.png`、`dress-starlight-dream.png`）。
- `npm run test:mobile`：`pass 8 / fail 0`（含 V6 Paper-Doll 骨骼锚点坐标与手动微调范围断言）。
- `npm run build`：`tsc --noEmit && vite build` 通过，exit 0。
- 完整输出见 `specs/v6-wenbao-lora-cutout-and-paperdoll/verify.log`。

## 验收条件核对

| # | 条件（来自 `decision.md`） | 结果 |
| --- | --- | --- |
| 1 | 不改动原有工作流，新建按「雯宝」命名的 ComfyUI 换装抠图工作流 | **达到**。已在 `D:\xuxinzhi\ComfyUI_windows_portable_nvidia\ComfyUI_windows_portable\ComfyUI\user\default\workflows\MeinaMix_雯宝LoRA_换装抠图.json` 新建工作流（挂载 `xiaoyan.safetensors` 强度 `0.80/0.80` + `ImageColorToMask -> InvertMask -> JoinImageWithAlpha` 自动透明抠图节点），原有 `MeinaMix_小燕LoRA.json` 保持未改。 |
| 2 | 用训练好的 LoRA (`xiaoyan.safetensors` · `0.80`) 重新生成同角色 Q 版雯宝礼服 + 自动四边连通洪水抠图（消除方形白框） | **达到**。3 套新礼服已全部用 LoRA 重生为同一个大头 Q 版短发雯宝；新增 `src/mobile/world/paper-doll-rig.ts:loadCutoutImage` 执行四边连通域 BFS 洪水抠图 + 1px 消白边 + 自动裁切透明边距，舞台中央彻底消除了方形背景白框。 |
| 3 | 头饰/手持物/香氛透明抠图并直接穿戴在雯宝头顶与手部骨骼锚点上，支持手动微调位置与大小 | **达到**。舞台中央采用 `.nk-paperdoll-rig` 四层骨骼挂载（`Layer 10` 香氛光环、`Layer 20` 透明主躯干、`Layer 30` 头顶头饰、`Layer 40` 手部手持物），跟随呼吸动画同步起伏；点击舞台右下角「🔧 调饰品位置」或直接点身上的饰品即可用滑块实时调整 `水平 X / 垂直 Y / 大小 / 角度` 并持久化保存。 |

## diff 有没有超出 `decision.md`

未超出 `decision.md` 声明范围。
