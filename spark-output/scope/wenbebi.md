# Scope — 读需求（贴现网）

- **生成时间**：2026-10-20T23:10:00+0800  
- **依据**：Brief/Frame 方向 + **实际代码**（MobileLayout / GameEngine）  
- **原则**：写可验收的设计字段，不把 HTML 当完成态  

## 产品定位

在现有竖屏 Mobile 壳上做「我 + 雯宝同屏共处」：角色创建 → juice → 共处动词；实时后置。  
主战场：`MobileLayout`；桌面 `App.tsx` 本期不强制对齐。

## 目标

**业务**：对象愿意说「一起玩」；前端可验收，不堵在联机。  
**产品**：≥5 共处事；反馈可感知；390px 单手可完成。

## 功能清单（对照代码）

| 功能 | 优先级 | 代码 | 状态 |
| --- | --- | --- | --- |
| 玩家角色创建 | P0 | `CharacterCreate.tsx` / `player` 存档 | 已落地 |
| 双角色同屏 | P0 | `MobileLayout` presence | 已落地 |
| 共处动词 6 个 | P0 | `coplay-actions.ts` + `applyCoplay` | 已落地 |
| 互动 juice | P0 | `mobile-layout.css` | 已落地（基础） |
| journal 留痕 | P1 | `game-rules.applyCoplay` | 已落地 |
| 真第二玩家/实时 | P2 | — | 未做 |
| Avatar 定妆接入 | P2 | `player-looks.ts` | 未做 |

## 约束

- 改 Mobile，不先重写桌面  
- 兼容无 `player` 旧档  
- 不新增大地点  
- 无签到/红点  

## 不做什么

实时联机、桌面强制共处、大美术、Capacitor、今日片段北极星。

## Gaps

1. 对方仍是雯宝代理，不是独立玩家角色  
2. 桌面与 Mobile 分叉  
3. Avatar 定妆未接入 looks  

## 验收（读需求落地标准）

1. 清档或无 player → 3 步创建  
2. 进小屋见「我」+ 雯宝  
3. 「一起做」6 键均可点，有气泡 + 手账一条  
4. 摸她有挤压反馈  
