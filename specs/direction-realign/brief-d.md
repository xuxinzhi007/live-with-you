# Agent D —— #3 存档断链 + 测试

独占文件：`src/mobile/world/nikki-wardrobe.ts`、`tests/mobile-engine.test.mjs`
产出：`specs/direction-realign/agent-d.md`
禁止碰：`src/mobile/WorldApp.tsx`、`skeleton-system.ts`、`paper-doll-rig.ts`、`tools/**`

## 三处缺陷（已证实，位置在 WorldApp.tsx:83-125）

**3a** 回退链 `v8 → v6 → v4`，**缺 v7**。只写过 v7 的用户存档读不到。

**3b** `equipped` 直接 spread，无槽位校验：
```ts
equipped: { ...DEFAULT_EQUIPPED_OUTFIT, ...(parsed.equipped || {}) }
```
`getWardrobeItem` 找不到 id 时返回 `WARDROBE_ITEMS[0]`，**不校验 slot**，会让主装扮槽拿到一件头饰。

**3c** `itemStars` 不过滤，`coupons` 只判 `typeof number`。`NaN` 能进存档，之后所有购买判定永远失败。

## 任务

### 1. 把 SavedNikkiState 移到 wardrobe
目前 `SavedNikkiState` 定义在 `WorldApp.tsx:73`。移到 `nikki-wardrobe.ts` 并导出。

注意：`WorldApp.tsx` 是别人的独占文件，你**不能改它**。所以你改完后 `WorldApp` 会继续用本地定义，编译仍然通过（它没有 export 冲突）。在交付文档里明确写出"C 需要把 WorldApp 的本地 interface 删掉改成 import"。

### 2. 新增纯函数 normalizeNikkiSave
```ts
export function normalizeNikkiSave(raw: unknown): SavedNikkiState
```
规则：
- `equipped`：每个 `WARDROBE_SLOTS` 槽位单独校验，id 必须存在于 `WARDROBE_ITEMS` 且 slot 匹配；否则落回 `DEFAULT_EQUIPPED_OUTFIT[slot]`
- `itemStars`：只保留存在于 `WARDROBE_ITEMS` 的 key，值 clamp 成 1..5 整数
- `coupons`：clamp 0..999999 整数
- `unlockedIds`：去重 + 过滤掉不在 `WARDROBE_ITEMS` 的 id + 并入 `DEFAULT_UNLOCKED_ITEM_IDS`
- `clearedStages` / `customImages` / `dressSkeletons`：类型守卫，非法则给空对象
- 整体 try/catch，任何异常返回全默认值

### 3. 测试
在 `tests/mobile-engine.test.mjs` 里：

a) **新增** `normalizeNikkiSave` 用例：
- 非法槽位（主装扮槽塞一个头饰 id）→ 落回默认
- 已下架的 id → 落回默认
- `coupons: NaN` / 负数 / 小数 → 修正为合法值
- `itemStars` 里的 `0` / `9` / `"3"` / `NaN` 都处理正确
- 重复 unlockedIds → 去重
- 完全垃圾输入（`null`、字符串、`{}`）→ 返回可用默认值，不抛

b) **新增** 迁移链用例：构造 v4 / v5 / v6 / v7 / v8 五种形状的原始数据，断言 `normalizeNikkiSave` 都能产出合法状态，且礼券不丢失（除非本身非法）。

c) **修改** V9 测试：`assert.equal(slices.length, 6, ...)` 改成断言返回空数组，理由写清（矩形切片已废弃，改为 slot 叠加）。Agent B 正在把 `computeHumanoidPartSlices` 改成返回 `[]`。

如果 B 的改动还没落地，你的测试会先失败——这是正常的。跑一遍记录当前状态即可，不要为了让测试变绿而去改 B 的文件。

## 硬约束
- `npm run test:mobile` 最终要全绿（若因 B 未落地导致 V9 红，写明原因，其余必须绿）。
- 不改 `src/mobile/WorldApp.tsx`。
- 少注释。

## 交付
写 `specs/direction-realign/agent-d.md`：新增了哪些函数、测试从几条变几条、当前 pass/fail 数、C 需要做的收尾改动。
