# 已实现操作交接

日期：2026-11-10。依据是当前运行时代码，不是旧的小屋 / Pixi 文档。

入口仍是 `src/main.tsx` → `src/mobile/WorldApp.tsx`。玩法数字在 `src/mobile/world/nikki-wardrobe.ts`。本地预览：`npm run dev`，地址 `http://127.0.0.1:5173/`。

## 玩家现在能做的

| 在哪 | 操作 | 结果 |
| --- | --- | --- |
| 封面 | 点画面或开始 | 进入大厅，并记住「已经进过」 |
| 再次打开或刷新 | 无 | 已进过的直接到大厅。从大厅回到封面不会清掉这个标记 |
| 大厅 | 点角色 | 加亲密。礼券每 60 秒最多 +2，冷却中只加亲密 |
| 衣橱 | 换装 | 礼服先用已经抠好的图，避免先闪一张白底 |
| 闯关 | 开始对决 | 第 1 话一直开。后面的话要上一话最好成绩达到 S / SS / SSS |
| 闯关结算 | 无额外按钮 | 弹层上的亲密数等于写入存档的数：C/B/A 为 6，S/SS 为 12，SSS 为 24 |
| 幻阁 | 左右切分类并许愿 | 见下一节 |
| 幻阁 | 裁缝铺 | 默认收起。展开后才是给当前单品重绘卡面的输入框 |
| 图鉴 | 浏览 | 底部导航可进。密语页有实现，底部导航没有入口 |

## 星愿幻阁

分类定义在 `WISH_POOLS`。抽卡函数是 `rollPavilionGacha(count, unlockedIds, currentStars, rng, pool)`，第 5 个参数默认 `"all"`，旧调用行为不变。

| 分类 | 槽位 | 件数 | 卡面说明 |
| --- | --- | --- | --- |
| 全部 | 五个槽 | 27 | 衣服、配饰、羁绊各取一张代表 |
| 衣服 | `dress` | 5 | 只出连衣裙 |
| 配饰 | `hairAcc`、`handheld`、`aura` | 17 | 发饰、手持、光环 |
| 羁绊 | `memoryCard` | 5 | 只出羁绊卡 |

代表图由 `showcaseForWishPool` 按稀有度挑。衣服池把次高的一件放主视觉，避免和「全部」用同一张主图。

许愿价格：1 次 5 礼券，5 连 20 礼券。五连若前四张没有 SR/SSR，第 5 张在**当前分类**里保底。重复单品升星，最高 5 星。抽出的亲密用 `grantBond` 写入，只加亲密。

揭晓分两段：`charge` 约 900ms，然后 `reveal`。一次只开一张，点大卡或「下一张」才继续，最后一张按钮变成「收下」。背景按当前这张的稀有度变：R 粉、SR 紫、SSR 金，SSR 卡更大。遮罩是实底，大厅不会透出来。

分类条是一排可滑动的卡，不是一排小标签。

- 左右圆按钮贴在幻阁两侧空白处，不压在卡面上。到头的那一侧按钮禁用。
- 拖动跟手。松开后按速度再滑一小段，停在最近的一张。滚轮、方向键、底部圆点、点卡片，都滑到对应的一张。
- 拖动和滑动过程中，靠近画面中心的卡会变大变亮，离开就缩小。放大不需要等松开。
- 当前居中的分类才是这次许愿的池子。

## 规则改动落在哪

| 行为 | 符号 | 文件 |
| --- | --- | --- |
| 封面只在第一次出现 | `openingScreen`，键 `wenbebi-entered-lobby` | `nikki-wardrobe.ts`、`WorldApp.tsx` |
| 章节锁 | `isStageUnlocked` | `nikki-wardrobe.ts` |
| 结算亲密 | `stageBondForRank`、`grantBond` | `nikki-wardrobe.ts`、`useWorldGame.ts` |
| 摸头礼券冷却 | `couponsFromPat`，`COUPON_PAT_COOLDOWN_MS = 60_000`，存档字段 `lastCouponPatAt` | `nikki-wardrobe.ts` |
| 护盾技能 | 加权属性之和的 12% 再加 420，和技能文案一致 | `evaluateOutfitForStage` |
| 定制衣服 | 不再调用 `giftFlower` | `WorldApp.tsx` 的定制流程 |
| 换装不闪白底 | 预抠全部 Comfy 礼服；展示只用抠好的图 | `WorldApp.tsx`、`paper-doll-rig.ts` 的 `loadCutoutImage` |

衣橱存档键是 `wenbebi-nikki-wardrobe-v8`，读取时兼容 v6 / v4。世界亲密档仍是 `wenbebi-mobile-game-v2`。两套货币还在：礼券在衣橱档，魅力/金币在世界档。

## 验证

```bash
npx tsc --noEmit
npm test
```

`npm test` 即 `npm run test:mobile`。引擎测试覆盖了护盾加成、章节锁、结算亲密、摸头冷却、封面分流，以及衣服池五连只出 `dress`。幻阁的拖动和放大是页面行为，这组测试不覆盖。

## 这次没有做

- 密语没有导航入口。
- 没有把礼券和世界货币合成一种。
- 没有拆 `WorldApp.tsx`。
- 没有改闯关分数线。默认开局装扮仍可能在第 1 话打出 SSS，章节锁会马上打开第 2 话。
- 图片加载失败没有自动换本地图。Comfy 绘制接口只在开发服务里。
