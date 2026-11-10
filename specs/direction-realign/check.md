# direction-realign 核对

## verify.log 结果

```
VERIFY exit 0   (npm run test:mobile · 17 passed / 0 failed)
npx tsc --noEmit    exit 0
npm run build       exit 0  (built in 240ms)
```

## 验收条件

| # | 条件 | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 资产管线能出带 alpha 的图 | 达成 | `tools/postprocess-alpha.mjs` 实测 `dress-rose-waltz.png` 输出 colorType=6 (RGBA)，透明 34.5% |
| 2 | 资产体检能拦下结构性缺陷 | 达成 | `npm run audit:assets` 对现有 25 张全部判 FAIL（无 alpha + 尺寸不足），exit 1 |
| 3 | 矩形切片废弃，改 slot 叠加 | 达成 | `computeHumanoidPartSlices` 返回 `[]`；新增 `computeSlotLayers` |
| 4 | 运行时抠图只在无 alpha 时兜底 | 达成 | `paper-doll-rig.ts` 改为按全图透明像素占比判定，>3% 直接用原图 |
| 5 | #3 存档断链三处全修 | 达成 | `normalizeNikkiSave` + `loadNikkiSaveFrom`；回退链补 v5/v7 |
| 6 | 存档迁移有测试 | 达成 | 新增 8 个用例，测试 9 → 17 |
| 7 | 小世界 UI 挂载 | 达成 | `WorldScreen.tsx` + 底栏「🏡 小世界」，实测截图见下 |

## 实际画面

`http://localhost:5173/?screen=world` 原生截图：房间背景正常渲染，物件（庭院/床/书桌/绿植/收藏架）带标签，房间 tab（小屋/庭院/街区）、底部导航高亮均正确。

## diff 是否超出 decision.md

超出 2 处，都属必要：

1. **`world.css` 新增全局 `html/body/#root` 重置**。验证时发现根容器在部分环境缺包含块，子元素宽度链断裂。这不是本次功能引入的问题（原本就缺），但不补就没法确认小世界真实渲染。
2. **`WorldApp.tsx` 新增 `?screen=` 深链**。原本 8 个屏幕只能靠点击进入，无法自动化验收，也无法分享直达链接。

## 过程中被推翻的判断（重要）

| 我一开始的判断 | 实际 | 怎么发现的 |
| --- | --- | --- |
| 「小世界线资产一件都没有」 | 21 张场景 webp 齐全 | 列目录 |
| 「截图空白是小世界组件布局错了」 | headless Chrome 的 `innerWidth` 恒为 1，是测试环境 bug | 打印视口尺寸 |
| 「`.nk-world` 需要补 flex 高度」 | 补了没用，根因在视口 | 连续三次有效测量都是 0 宽 |

第 3 条浪费了最多时间：我在一个坏掉的测量工具上做了三轮 CSS 修改。教训是**先确认测量工具本身正确，再改被测对象**。

## 已知未做

- 25 张现有资产仍是 RGB 无 alpha。管线已就绪，但需要本机 ComfyUI 跑一次 `npm run gen:comfy` + `npm run postprocess:alpha` 才能真正解决。当前 `audit:assets` 会一直 FAIL，这是**正确的红灯**，不该被绕过。
- `WorldApp.tsx` 仍在每帧 `setState` 驱动骨骼动画，性能问题独立。
- 死代码（`runtime.ts` / `poses.ts` / `assets.ts` / `pixi.js` / `styles-mobile.css`）未删，因为小世界合并后 `runtime.ts` 是否复用尚未定。
