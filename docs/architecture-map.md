# 雯宝 · 系统架构与玩法流程

> 基于当前代码（`feature/asset-pipeline-realign`）与 42 次提交的历史分析整理。
> 入口：`src/main.tsx` → `src/mobile/WorldApp.tsx`。

---

## 一、Git 历史分析：阻塞点与频繁调整

### 1.1 提交类型分布（42 次提交）

```
feat:      24 次   ← 新功能，占 57%
refactor:   6 次   ← 重构，占 14%
docs:       4 次   ← 文档
chore:      3 次   ← 工程杂项
Merge:      2 次   ← 分支合并
test/perf:  2 次   ← 测试与性能
```

**特征：新功能远多于重构和测试。** 说明项目一直在「加功能」，但很少「还债」。

### 1.2 高频调整区域

| 区域 | 涉及提交数 | 问题 |
|---|---|---|
| **骨骼/渲染系统** | 18 次提及 | 反复调整透明度、动画、分层方案 |
| **WorldApp.tsx** | 每次大改都碰 | 2093 行单文件，改任何屏幕都要动它 |
| **产品方向** | 至少 3 次大转向 | 桌面宠物 → 可走动小世界 → 换装闯关 |
| **技术方案** | Pixi → Live2D → Spine → 自研 DOM | 渲染方案换了 4 轮 |

### 1.3 三个反复出现的阻塞模式

**模式一：渲染方案来回换（最大的时间黑洞）**

```
Pixi.js (65c1de7 引入)
  ↓ 发现太重，移动端卡
Live2D (47c2435 调研)
  ↓ 需要专门软件授权 + 逐部件绘制，做不了
Spine (docs/spine-integration.md)
  ↓ 同样需要商业工具
自研 DOM + CSS transform (当前)
  ↓ 但骨骼动画还在用 setState 驱动（04ef76d 才节流）
```

**阻塞根因**：每次换方案都把旧代码留着，新旧并存导致复杂度翻倍。`runtime.ts`（519 行）直到远端 `ee75e08` 才删。

**模式二：单文件膨胀 → 拆分 → 又膨胀**

```
WorldApp.tsx 增长曲线：
  ~400 行 (V0.2) → ~800 行 (V2 小世界) → 1574 行 (V5 换装) → 2093 行 (合并后)
                                    ↓
              本次拆分 (2a6a0ce) → 1736 行
```

**阻塞根因**：拆分时只搬 JSX，没搬状态。35 个 `useState` 还在 WorldApp 里，所以组件拆出来了但逻辑还是耦合的。

**模式三：文档与代码脱节**

```
product-charter.md   写「不借鉴抽卡」     代码做了抽卡
current-state.md     写「可走动小世界」    代码已经删了 runtime.ts
README.md            写「Pixi 舞台」      代码已经删了 Pixi
```

**阻塞根因**：每次方向调整时，代码改了但文档没同步。下次有人（或 AI）按文档干活就会踩空。

---

## 二、当前系统架构

### 2.1 分层结构

```
┌────────────────────────────────────────────────────────────┐
│  入口层   src/main.tsx → render(<WorldApp />)               │
├────────────────────────────────────────────────────────────┤
│  路由层   WorldApp.tsx (1736 行)                            │
│           9 屏条件渲染 + 35 个 useState + 全部 handler       │
│           title / lobby / world / wardrobe / rig /          │
│           stages / pavilion / codex / chat                  │
├──────────────┬──────────────┬──────────────┬───────────────┤
│  屏幕层       │  屏幕层       │  屏幕层       │  屏幕层        │
│  CodexScreen │  ChatScreen  │ StagesScreen │ WardrobeScreen │
│  (134 行)    │  (114 行)    │  (114 行)    │  (139 行)      │
│  + .css      │  + .css      │  + .css      │  + .css        │
├──────────────┴──────────────┴──────────────┴───────────────┤
│  状态层   store/useNikkiState.ts  ← 换装存档                │
│           world/useWorldGame.ts   ← 世界存档                │
├────────────────────────────────────────────────────────────┤
│  业务层   world/nikki-wardrobe.ts  (1176 行) 换装/抽卡/闯关 │
│           world/codex.ts           (840 行)  亲密/图鉴/聊天  │
│           world/skeleton-system.ts (677 行)  骨骼 FK        │
│           world/paper-doll-rig.ts  (434 行)  抠图/SVG叠加   │
│           world/actions.ts         (376 行)  物件交互        │
│           world/rooms.ts           (355 行)  房间数据        │
│           world/companion-bridge.ts(243 行)  AI 陪伴        │
│           world/state.ts           (225 行)  世界状态        │
├────────────────────────────────────────────────────────────┤
│  引擎层   engine/storage.ts   GameState 持久化              │
│           engine/types.ts     全部类型定义                   │
└────────────────────────────────────────────────────────────┘
```

### 2.2 依赖方向

```
screens/*  →  store/*  →  world/* (纯函数)  →  engine/*
   ↑                                                   
   └────────── 不允许反向依赖 ──────────────────────────┘

WorldApp.tsx 是唯一的「上帝」，所有屏幕通过 props 接收状态和回调
```

### 2.3 核心数据模型

```typescript
// 一份存档走天下
GameState {
  coins: number          // 礼券（硬通货）
  seeds: number          // 花种
  flowers: number        // 花束
  bond: number           // 亲密值
  mementos: number       // 纪念物
  journal: JournalEntry[]      // 生活小记
  bondedMoments: string[]      // 已触发羁绊
  pet: PetState                // 精力/心情
  world: WorldState {
    room: "home" | "garden" | "street"
    skin: "original" | "maid"
    plots: GardenPlot[3]       // 花圃
    cooldowns: Record<string, number>
    collection: Record<FlowerKind, number>
  }
}

// 换装存档（独立存储）
SavedNikkiState {
  equipped: Record<WardrobeSlot, string>   // 5 槽位
  unlockedIds: string[]
  itemStars: Record<string, number>        // ★1-5
  clearedStages: Record<string, string>    // 章节 → 最高评级
  coupons: number
  customImages: Record<string, string>     // ComfyUI 自定义图
  dressSkeletons: AllDressSkeletons        // 每套衣服的骨骼校准
}
```

---

## 三、玩法流程

### 3.1 主循环

```
                    ┌─────────────┐
                    │   启动 App   │
                    └──────┬──────┘
                           │
              ┌────────────▼────────────┐
              │  ?screen=xxx 深链？       │
              │  是 → 直达对应屏幕         │
              │  否 → openingScreen()     │
              │       首次 → title        │
              │       老用户 → lobby      │
              └────────────┬────────────┘
                           │
                    ┌──────▼──────┐
                    │  主大厅 Lobby │
                    │ 雯宝全身展示   │
                    │ 右侧悬浮按钮组 │
                    └──┬───┬───┬──┘
              换装/骨骼 │   │   │ 小世界/闯关/幻阁/聊天/图鉴
           ┌────────────┤   ├───────────────────────────┐
           │            │   │                           │
    ┌──────▼──────┐     │   │                    ┌──────▼──────┐
    │  高定衣橱    │     │   │                    │   小世界     │
    │  5 槽位换装  │     │   │                    │ 3 房间 18 物件│
    └──────┬──────┘     │   │                    └──────┬──────┘
           │            │   │                           │
    ┌──────▼──────┐     │   │                    ┌──────▼──────┐
    │ 试穿/装备    │     │   │                    │ 点物件交互   │
    │ 骨骼锚点微调 │     │   │                    │ rest/read/  │
    └──────┬──────┘     │   │                    │ sit/wish/   │
           │            │   │                    │ plot(种花)  │
    ┌──────▼──────┐     │   │                    └──────┬──────┘
    │ 升星 / 定制  │     │   │                           │
    │ 消耗礼券     │     │   │                    ┌──────▼──────┐
    └─────────────┘     │   │                    │ 收获花束    │
                        │   │                    │ +亲密+纪念  │
                        │   │                    └─────────────┘
              ┌─────────┘   └─────────┐
              │                        │
       ┌──────▼──────┐          ┌──────▼──────┐
       │  搭配闯关    │          │  星愿幻阁    │
       │  6 章主题 PK │          │  单抽 / 五连 │
       └──────┬──────┘          └──────┬──────┘
              │                        │
       ┌──────▼──────┐          ┌──────▼──────┐
       │ 5 维 weighted│          │ 保底 SR/SSR │
       │ 套装共鸣     │          │ 重复自动升星 │
       │ 技能加成     │          │ +亲密       │
       └──────┬──────┘          └─────────────┘
              │
       ┌──────▼──────┐
       │ C~SSS 评级   │
       │ 赢礼券+解锁  │
       └─────────────┘
```

### 3.2 经济闭环

```
        ┌─────────────────────────────────────┐
        │           礼券 (coupons)              │
        │    唯一硬通货，驱动换装/抽卡/升星       │
        └──────┬───────────────┬────────────────┘
               │ 收入           │ 支出
        ┌──────▼──────┐  ┌─────▼──────────────────┐
        │ 搭配闯关 S+  │  │ 定制未解锁单品           │
        │ 抚摸 (60s)   │  │   R:10 / SR:16 / SSR:28 │
        └─────────────┘  │ 升星 ★n → ★n+1          │
                         │   成本: n × 8            │
                         │ 星愿幻阁抽卡             │
                         └──────────────────────────┘
```

### 3.3 亲密系统（bond）

```
  行为                    亲密值
  ─────────────────────────────
  抚摸雯宝                +少量     (60s 冷却)
  小世界物件交互           +少量~中量
  种植收获                +少量
  送花 / 送点心            +中量
  抽卡获得新品            SSR+18 / SR+10 / R+6
  闯关胜利                +大量
        │
        ▼
  ┌─────────────┐
  │   等级提升   │──→ 解锁新闯关章节 / 新对话 / 新内容
  │  Lv.1 → N   │
  └─────────────┘
```

### 3.4 小世界种植闭环

```
  买种(6 零钱 2 颗) → 种下 → 浇水(成长减半) → 开花 → 收花
       │                                    │
       └──── 60s ──── 30s ──── 立即 ◄───────┘
                                          │
                                    ┌─────▼─────┐
                                    │  +1 花束   │
                                    │  +1 花种   │
                                    │  首次进收藏 │
                                    └───────────┘
```

### 3.5 AI 陪伴（双引擎回退）

```
  用户输入 / 打开聊天
        │
  ┌─────▼─────────────────────────┐
  │  probeCompanionStatus()        │
  │  局域网 Ollama 可达？           │
  └─────┬──────────────────┬──────┘
        │ 是               │ 否
  ┌─────▼─────┐      ┌─────▼─────────────┐
  │ 调 Ollama │      │ fallbackCompanion  │
  │ 生成对话   │      │ 本地高情商文案      │
  │           │      │ (100% 不阻塞)      │
  └─────┬─────┘      └─────┬─────────────┘
        │                  │
        └────────┬─────────┘
                 ▼
           显示回复 + 写入生活小记
```

### 3.6 换装评分算法

```
  evaluateOutfitForStage(stage, equipped, itemStars, castSkills)
       │
       ▼
  computeOutfitStats(equipped, itemStars)
    → 每件单品 5 维属性 × 星级倍率(1 + 0.15×(star-1))
       │
       ▼
  weighted = 按 stage.primaryAttr / secondaryAttr 加权
       │
       ▼
  + 羁绊卡被动加成 (skillAttr × skillBoost)
  + 主动技能加成 (castSkills[0..2])
  + 套装共鸣 (detectActiveSuit → bonusScore)
       │
       ▼
  totalScore → 与 stage.sssScore / ssScore / sScore 比较
       │
       ▼
  rank = C / B / A / S / SS / SSS
  passedS = rank ∈ {S, SS, SSS}
  beatRival = totalScore ≥ stage.rivalScore
```

---

## 四、模块职责与健康状况

| 模块 | 行数 | 职责 | 健康度 | 备注 |
|---|---|---|---|---|
| `WorldApp.tsx` | 1736 | 9 屏路由 + 状态 + handler | 🔴 | 仍需继续拆 pavilion/rig |
| `nikki-wardrobe.ts` | 1176 | 换装/抽卡/闯关/经济 | 🟡 | 纯函数，可留，但太大 |
| `codex.ts` | 840 | 亲密/图鉴/奇遇/花圃/聊天 | 🟡 | 职责过多，该拆 |
| `skeleton-system.ts` | 677 | 骨骼 FK + 插槽锚点 | 🟢 | 稳定 |
| `paper-doll-rig.ts` | 434 | 抠图 + SVG 叠加 | 🟢 | 稳定 |
| `actions.ts` | 376 | 物件交互 7 分支 | 🟢 | 纯函数 |
| `rooms.ts` | 355 | 3 房间 18 物件数据 | 🟢 | 数据文件 |
| `companion-bridge.ts` | 243 | AI 陪伴 + 回退 | 🟢 | 稳定 |
| `state.ts` | 225 | 世界状态纯函数 | 🟢 | 稳定 |
| `useWorldGame.ts` | 74 | 世界状态 hook | 🟢 | 精简 |
| `useNikkiState.ts` | ~60 | 换装状态 hook | 🟢 | 新增 |
| `layered-stage.ts` | 92 | 四层纸娃娃（第一期） | 🟢 | 渐进启用 |

---

## 五、已知技术债

| 债 | 严重程度 | 影响 | 计划 |
|---|---|---|---|
| WorldApp.tsx 还有 1736 行 | 高 | 改任何屏幕都要读完全文件 | 继续拆 pavilion/rig |
| pavilion/rig 未拆 | 高 | 拖拽动画状态耦合 | 需先统一动画状态 |
| `latest` 版本已锁但无 CI | 中 | 本地通过 ≠ 远端通过 | 加 GitHub Actions |
| lint 46 个问题 | 中 | 历史遗留 | 随拆分逐步清 |
| 文档可能再次脱节 | 中 | 方向调整后文档没同步 | 方向调整时必须改文档 |
| 无 E2E 测试 | 低 | 核心流程没保障 | Playwright 排期 |

---

## 六、一句话总结

> **42 次提交、3 次方向大转、4 轮渲染方案。当前架构是「单组件 + 纯函数业务层」，业务层稳定，但路由层（WorldApp）仍在还债。最大的历史教训是：换方案时没删旧代码，导致复杂度翻倍。**
