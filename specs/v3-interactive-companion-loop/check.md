# v3-interactive-companion-loop 核对

## 跑了什么

```text
exit 0
cmd npm run test:mobile && npm run build
```

- `npm run test:mobile`：`pass 14 / fail 0`（全面覆盖 V3 瞬达交互、亲密等级成长、心愿暴击、自选种花/催熟/出售闭环、喷泉 N/R/SR 扭蛋池、18 项图鉴进度、街区二选一奇遇、离线对话与存档迁移）。
- `npm run build`：`tsc --noEmit && vite build` 零警告通过（CSS 从 114 KiB 精简至 13.65 KiB，构建耗时 391ms）。
- 完整输出见 `specs/v3-interactive-companion-loop/verify.log`。

## 验收条件核对

| # | 条件（来自 `decision.md`） | 结果 |
| --- | --- | --- |
| 1 | 物理清理全部 V0 / V1 僵尸代码与旧横版跑腿逻辑 | **达到**。已删除 `src/App.tsx`、`src/Studio.tsx`、`src/CharacterDetail.tsx`、`src/game/**`、`src/layouts/**`、`src/mobile/multiplayer/**`、`src/mobile/data/**`、`styles.css`、`vite-plugins/` 等全部历史包袱，`src/` 仅保留 16 个纯净的 V3 模块文件。 |
| 2 | 废除手动跑腿与罚站冷却，改为一键切场景 + 瞬达交互 + 自主心愿气泡 | **达到**。顶部新增 `🏠 小屋 / 🌿 庭院 / ⛲ 街区` 瞬切胶囊；点击场景物件或底部行动坞（摸摸头/喂曲奇/读画册/小憩/花圃/踢球/许愿/奇遇）直接调用 `interactInstant` 秒就位演出；头顶常驻可点击的「雯宝的心愿气泡」，点击自动完成并给双倍亲密暴击。 |
| 3 | 亲密等级体系 + 动态数值飘字 + 自选种花与委托 + 喷泉 N/R/SR 扭蛋 + 18 项全图鉴 + 面对面聊天 | **达到**。`codex.ts` 实现 `Lv.1 ~ Lv.10+` 称号与经验条、18 项 N/R/SR 图鉴（3 花卉 + 9 珍藏摆件 + 6 奇遇记忆）、喷泉保底扭蛋池、街角奇遇二选一、自选花种播种与一键催熟、花摊卖花束变现，以及内置聊天抽屉。 |

## diff 有没有超出 `decision.md`

未超出 `decision.md` 声明的大换血重构范围，且 100% 兼容 `wenbebi-mobile-game-v2` 本地存档结构。
