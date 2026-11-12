# game-feel 核对

verify.log：本机 Python 启动器不可用，`workflow_next.py done` 没有跑成。下面是同一条测试命令的直接结果。

```
npm test
exit 0
tests 11
pass 11
fail 0
```

`npx tsc --noEmit` 退出码 0。

验收：

- 新开的页面里，第 2 话到终章显示「未开」，开始按钮是「上一话达到 S 后开放」且 disabled。已在 http://127.0.0.1:5173/ 点过。
- 第 1 话打出 SSS 后，弹层写「+8 礼券 · +24 亲密」和「下一话已开放」。礼券从 40 变为 48，亲密等级从 Lv.1 变为 Lv.2，第 2 话去掉「未开」，第 3 话仍未开。
- 定制不再调用送花。抽卡亲密走 `grantBond(rollPavilionGacha 的 bondGained)`。优雅气场测试断言为加权总分的 12% 加 420。
- diff 停在 decision 写的范围：规则函数、结算副作用、章节按钮、衣橱档可选时间戳、`npm test` 入口。没有拆 `WorldApp`，没有接密语。

还没变成一局取舍：默认雪茶套装第 1 话预估就是 SSS，所以第一道门会在第一场直接打开。分数线这次没有改。
