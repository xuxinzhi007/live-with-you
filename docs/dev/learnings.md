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
