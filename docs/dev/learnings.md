# 开发记录（data-workflow learnings）

只写踩过的坑和可复用的事实。格式：日期 · 工作流 · feature · 事实 · 证据（谁消费 / 怎么消费 / AI 能不能到）。

## 2026-11-13 · change · docs-consolidation

1. **`npm test` 打不开就谈不上 verify。**
   `package.json` 的 `test` 是 `test:unit && test:mobile`，但 `node_modules` 只装了运行时依赖，`vitest` / `eslint` / `@testing-library/*` 不在。
   证据：`ls node_modules/.bin` 只有 `tsc` / `vite` / `rolldown`；`npm run test:unit` 报 `'vitest' 不是内部或外部命令`。
   消费方：data-workflow runner（`declared_verify` 读 `scripts.test`）+ 人。**新会话第一步先 `npm install`。**

2. **搬 `docs/` 目录会连带打断文档内的相对链接。**
   `docs/archive/*.md` 本来就写着 `(./product-charter.md)`（同目录假设），一旦归档到子目录，正确路径变成 `../`。
   证据：搬完后 `node tools/audit/docs-links.mjs` 报 18 处 broken，修完才 `broken 0`。
   消费方：`tools/audit/docs-links.mjs`（本项目自建）+ 任何点链接的人。

3. **「文档和代码对不上」可以做成断言，不靠人眼。**
   `tools/audit/docs-links.mjs --verify-claims` 直接读 `src/mobile/WorldApp.tsx`、`vite.config.ts`、`netlify/functions/`、`remote-assets.ts`，再比文档正文。
   证据：初版断言写错过两次（`<small>` 抓到了大厅按钮、`[^]]` 正则），修完 `claims ok 6/6`。
   消费方：CI / 会话收尾；代码一改，口径断言就翻红，逼文档同步。

## 2026-11-13 · change · nav-and-closure

1. **封面是早返回，底栏只在 `screen !== "title"` 时存在。**
   证据：`WorldApp.tsx` 的 `if (screen === "title") return (...)`；渲染测试里先查 `navigation` 会 fail，必须先点「点击进入小屋」。
   消费方：任何想测底栏/大厅的测试。

2. **jsdom 没有 `scrollIntoView`，`ChatScreen` 一挂载就抛。**
   证据：`ChatScreen.tsx:34` 的 `messagesEndRef.current?.scrollIntoView(...)`；未打桩时 `WorldApp` 渲染用例直接红。
   修法：`tests/setup.ts` 里补空实现。消费方：`tests/screens/WorldApp.nav.test.tsx` 及后续整页渲染测试。

3. **「只在开发环境」的能力可以用构建产物证伪。**
   `{import.meta.env.DEV && ...}` 包住的文案，`npm run build` 后 `grep -c 裁缝铺 dist/assets/*.js` = 0。
   消费方：`--verify-claims` 的第 7 条断言、以及任何「dev-only」功能的验收。

## 2026-11-14 · change · lobby-world-p0p1

1. **官方 Qwen 编辑线「去人物」会出白图。** 源图固定是角色母图（白底立绘），提示词让它删人就只剩白底。
   修法：`/api/comfy/draw` 加可选 `source`（ComfyUI input 文件名，带路径校验），配 `tools/draw-scene.mjs`（先 POST /upload/image 再 draw）。用原场景图当源图重绘画风，构图不漂，道具坐标不用改。
   消费方：dev 中间件 + `tools/draw-scene.mjs`。

2. **`world.css` 是 CRLF，跨行字符串 replace 会静默失败。** `String.replace` 不匹配不报错，脚本还打印 ok。
   证据：第一版 CSS 脚本的 `.nk-paperdoll-rig` 块替换没生效，`grep animation: nk-hero-breathe` 仍在。
   修法：跨行锚点用 `\r?\n` 正则 + 每处替换包 `must(n===1)` 断言。

3. **`rooms.ts` 的世界坐标和三张背景图是配套设计的。** 背景 1470×1500≈0.98 = home 980/1000，garden/street 同理。
   舞台用 `aspect-ratio: worldW/1000` 就能整图显示，`cover` 裁切是之前固定高度造成的。道具 `bottom=(1000-y)/1000`、`z=y/10` 即可还原空间关系。
   消费方：`WorldScreen.tsx`；以后换背景图只要保持宽高比，坐标无需重调。
