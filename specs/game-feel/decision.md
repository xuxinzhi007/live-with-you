# game-feel 决定

- 级别：L2。跨衣橱规则、世界档和页面。非 Go 栈，走 change。
- 真正要解决的问题：现在点完衣服和分数，下一幕不会变，所以像一个衣橱展示。这一次要让「这一局的结果」决定下一话能不能打，并且弹层上的礼券、亲密等于写进存档的数。
- 怎样算满足：新档只能打第 1 话；上一话最好成绩达到 S、SS 或 SSS 才开放下一话。达到 S 的结算写明下一话已开放。点角色的礼券 60 秒内只发 2 点，弹层不加没发出的礼券。闯关和抽卡写入的亲密等于弹层数字。定制不再调用送花。优雅气场按文案加上加权总分的 12%。`npm test` 退出码 0。
- 现有能力：`nikki-wardrobe.ts:evaluateOutfitForStage`、`nikki-wardrobe.ts:rollPavilionGacha`、`WorldApp.tsx:handleStartStylingEval`、`useWorldGame.ts:companionAct`。已证实。无旧决定。
- 最小充分方案：章节锁由 `clearedStages` 推导，不新开进度表。亲密用 `grantBond` 写入世界档。礼券冷却记在衣橱档的可选字段 `lastCouponPatAt`，旧档没有该字段就当作可以领。
- 为什么更小的做法不够：只改文案，第 2 话仍然一开始就能打，点角色仍然无限加礼券，抽卡弹层的亲密仍然不是写入的那个数。
- 相关的债：B。只改这次碰到的结算副作用。`WorldApp.tsx` 仍不拆。密语入口、云存档、图片失败回退、生产环境 Comfy 接口，这次不做。
- 这次不做：把密语接到导航；合并两套货币；重做对手 AI；删除 `rooms.ts` / `actions.ts`。
- 风险：碰到本地存档的可选字段和结算状态。旧键不迁移、不删除。`lastCouponPatAt` 缺省时按「可以领礼券」处理。已有存档若第 1 话没有 S，第 2 话起会重新锁上。
