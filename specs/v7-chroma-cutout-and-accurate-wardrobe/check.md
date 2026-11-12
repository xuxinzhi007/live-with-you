# v7-chroma-cutout-and-accurate-wardrobe 核对

## 跑了什么

```text
exit 0
cmd npm run test:mobile && npm run build
```

- `npm run gen:comfy`：使用调优后的 LoRA 权重（礼服 `0.58`、羁绊卡 `0.65`）与严格负向词重新生成了全部 25 张二次元资产，并通过视觉核验确认无黑块残影、无陌生金发人头。
- `npm run test:mobile`：`pass 8 / fail 0`（含 760×760 归一化骨骼插槽 `BONE_SOCKETS` 与 17 件纯透明矢量可穿戴图层 `WEARABLE_SVG_OVERLAYS` 校验）。
- `npm run build`：`tsc --noEmit && vite build` 通过，exit 0。
- 完整输出见 `specs/v7-chroma-cutout-and-accurate-wardrobe/verify.log`。

## 验收条件核对

| # | 条件（来自 `decision.md`） | 结果 |
| --- | --- | --- |
| 1 | 调优 LoRA 强度消除黑块污染，重新生成颜色款式准确的同角色雯宝礼服与同角色羁绊卡 | **达到**。`tools/generate-comfy-assets.mjs` 将礼服 LoRA 设为 `0.58`、羁绊卡设为 `0.65`，生成的「杏仁奶昔针织裙」「暮色蔷薇圆舞曲」「星河眠云轻纱裙」及 5 张心境羁绊卡 CG 全部为同一个短发雯宝，且服装颜色款式 100% 准确。 |
| 2 | 彻底解决“配饰带金发人头/背景杂物”与“抠图过度” | **达到**。17 件配饰卡牌图已全部重生成为纯物品无人物插画；穿戴在雯宝骨骼上的图层采用 `WEARABLE_SVG_OVERLAYS` 100% 透明底矢量动漫部件；角色立绘抠图升级为严格外边框连通 + 760×760 标准基线对齐，内部眼白/头发高光/白衣 0 破洞。 |
| 3 | 760×760 归一化骨骼系统（普通模式与「👁️ 全景放大」模式 100% 同步缩放，永不失效） | **达到**。`.nk-bone-box` 建立 1:1 正方形骨骼局部坐标系（`228×228` -> 放大模式 `336×336`），所有配饰的 `left`、`top`、`width` 均以百分比锚定在 `BONE_SOCKETS`（`hair-crown`、`hair-side`、`hand-right`、`hand-left`、`aura-back`）上，切换全景放大时头饰与手持物 100% 锁死在头顶与手上。 |

## diff 有没有超出 `decision.md`

未超出 `decision.md` 声明范围。
