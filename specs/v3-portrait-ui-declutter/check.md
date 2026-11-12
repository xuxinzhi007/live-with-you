# v3-portrait-ui-declutter 核对

## 跑了什么

```text
exit 0
cmd npm run test:mobile && npm run build
```

- `npm run test:mobile`：`pass 14 / fail 0`。
- `npm run build`：`tsc --noEmit && vite build` 通过，exit 0。
- 完整输出见 `specs/v3-portrait-ui-declutter/verify.log`。

## 验收条件核对

| # | 条件（来自 `decision.md`） | 结果 |
| --- | --- | --- |
| 1 | 顶栏缩减为单行（高度 ≤ 54px），移除顶部第 2、3 排横幅 | **达到**。`.world-top` 合并为单行：左侧紧凑身份胶囊（头像 + `Lv.X` + 时段 + 细经验条），右侧合并的「零钱 · 花种」双联胶囊（`.world-res-capsule`）。 |
| 2 | 移除压在雯宝身上的巨型四宫格卡片，中间 75% 屏幕完全留给房间与角色 | **达到**。已删除 `.world-action-dock` 大号四宫格卡片，雯宝从头到脚完整露出，窗户与背景不再被横幅遮挡。 |
| 3 | 心愿改为贴近角色头顶的小巧对话气泡 + 底部单排轻巧悬浮条 | **达到**。新增带小尖角的 `.world-speech-wish` 轻巧说话气泡；底部仅保留单排 `.world-float-bar`（左：`小屋 / 庭院 / 街区` 分段胶囊；右：`摸头 / 喂食` 轻按钮）。 |
| 4 | 彻底消除 Android 模拟器 `▯` 乱码豆腐块 | **达到**。将 `🪙`、`🤍` 等在模拟器缺字的 Emoji 全部替换为内联 SVG（`CoinIcon`、`SeedIcon`、`HeartIcon`）。 |

## diff 有没有超出 `decision.md`

仅修改 `src/mobile/WorldApp.tsx`、`src/mobile/world.css` 与 `src/mobile/world/codex.ts`（`🤍` 替换为 `♥`），未超出 `decision.md` 声明范围。
