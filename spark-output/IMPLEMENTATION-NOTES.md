# 实现说明（纠正「追进度」）

先前把 `/scope` `/probe` `/signal` `/journey` 当链路打卡推进，**不合适**。  
那些 JSON/HTML 不是产品完成态。真正进度以代码为准。

## 现网锚点（2026-10-20）

| 模块 | 路径 | 现状 |
| --- | --- | --- |
| 移动主壳 | `src/layouts/MobileLayout.tsx` | 竖屏主入口；双独立角色 + 站位槽 |
| 状态/存档 | `src/mobile/engine/types.ts` + `storage.ts` | `player.playerId` + 旧档补 id |
| 引擎 | `src/mobile/engine/GameEngine.ts` | `createPlayer` 写入独立身份 |
| 创建流 | `src/mobile/CharacterCreate.tsx` | 名→外观→确认 |
| 外观 | `src/mobile/data/player-looks.ts` | 现有立绘三套 |
| 多人（Slice 1） | `src/mobile/multiplayer/*` + `data/slots.ts` | MockTransport / BroadcastChannel |

## 已落地

### 方向 A
1. 旧档无 `player` → 进创建流  
2. HUD「我」；场景「我」+ 雯宝同屏（无人联机时）  
3. 摸她挤压 juice；进场轻相遇反馈  

### 方向 B（本地先验）
1. 共处动词 6 个：`coplay-actions.ts`  
2. 「一起做」入口 + 底部面板（无横滑条）  
3. 共处短动画（greet/sit/pass/clap/look/lean）  

### Slice 1 — 双独立角色 + 竖屏舞台（Mock）
1. `PlayerProfile.playerId`；站位槽 L/R/C + 家具 `anchors`  
2. `useCoupleRoom` + Vite SSE 中继 `/.wenbebi/couple-room`（跨浏览器 / 局域网）+ BroadcastChannel 兜底  
3. 对方进场时隐藏雯宝代理，渲染独立 peer 立绘；顶栏在场点  
4. 共处动词广播；对方动作 1s 内可见 juice / 气泡  

验法：重启 `npm run dev` 后，两边点「找对方」→ 一方「创建房间」复制短码，另一方「输入短码加入」。顶栏应变「对方在场」，舞台右侧为对方立绘。  
说明：名字/零钱不同是正常的；未进房时显示雯宝代理也正常。

### 竖屏移动 S1（地点瞬切 + 锚点短位移）
1. 地点条 / 门：淡入淡出瞬切（~220ms），不走路穿越  
2. 点家具 / 共处：~0.7s 滑到家具锚点或靠拢，再播反馈；约 1.6s 后回站位  
3. `stage-motion.ts` + `useStagePresence`；窗/椅等补了脚底锚点  

## 尚未做

- Slice 2：真 WebSocket 网关 + 共处邀请条 + snapshot 重连  
- 可拖宽场景 / Pixi 视差；大世界地图传送层  
- Avatar 定妆接入 `player-looks`  
- 桌面 App 对齐 / Capacitor  

设计全文：`docs/multiplayer-portrait-scene-design.md`

## spark-output 里其它文件

`frame` / `brief` / `audit` / `avatar`：分支带来的方向与素材，可作决策参考。  
`probe`：已完成 n=1 深挖 + P1-S1 验收脚本（`spark-output/probe/wenbebi.md`）；**共玩实测回填前假设仍 pending**。  
`bench` / `signal` / `journey`：研究笔记，**不等于已实现**。  
