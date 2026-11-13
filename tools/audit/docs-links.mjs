#!/usr/bin/env node
/**
 * docs 体检：文档互链 + 口径与代码是否一致。
 *
 *   node tools/audit/docs-links.mjs                  # 坏链 / 零入链
 *   node tools/audit/docs-links.mjs --verify-claims  # 追加 6 条「文档口径 vs 代码」
 *
 * 退出码：0 全部通过；1 有坏链、有未被索引的现行文档、或有口径断言失败。
 *
 * 约定：
 * - `docs/archive/**` 允许零入链（历史材料，只由 archive/README 概括）。
 * - 内容里写着 `已并入` 的指针文件允许零入链（保留旧路径给外部链接）。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOCS = path.join(ROOT, 'docs');
const SEP = String.fromCharCode(92);
const norm = (p) => p.split(SEP).join('/');
const rel = (p) => norm(path.relative(ROOT, p));

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.md')) files.push(p);
  }
})(DOCS);
if (fs.existsSync(path.join(ROOT, 'README.md'))) files.push(path.join(ROOT, 'README.md'));

const linksOf = (file) => {
  const text = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const m of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#|tel:)/i.test(target)) continue;
    out.push(decodeURIComponent(target.split('#')[0]));
  }
  return { text, links: out.filter(Boolean) };
};

let broken = 0;
const inbound = new Map(files.map((f) => [norm(f), []]));

for (const file of files) {
  const { links } = linksOf(file);
  for (const target of links) {
    const abs = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(abs)) {
      broken++;
      console.log(`  ✗ ${rel(file)} -> ${target}`);
      continue;
    }
    if (abs.endsWith('.md') && inbound.has(norm(abs))) inbound.get(norm(abs)).push(rel(file));
  }
}
console.log(`broken ${broken}`);

const allowedOrphan = (file) => {
  const r = rel(file);
  if (r === 'README.md') return true;
  if (r.startsWith('docs/archive/')) return true;
  return fs.readFileSync(file, 'utf8').includes('已并入');
};
const orphans = files.filter((f) => inbound.get(norm(f)).length === 0 && !allowedOrphan(f));
console.log(`orphan ${orphans.length}`);
for (const f of orphans) console.log(`  · ${rel(f)}`);

let claimsFailed = 0;
if (process.argv.includes('--verify-claims')) {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const worldApp = read('src/mobile/WorldApp.tsx');
  const navBlock = worldApp.slice(
    worldApp.indexOf('className="nk-nav"'),
    worldApp.indexOf('</nav>'),
  );
  const navLabels = [...navBlock.matchAll(/<small>([^<]+)<\/small>/g)].map((m) => m[1].trim());
  const current = read('docs/现行状态.md');
  const direction = read('docs/game-direction.md');
  const server = read('docs/服务端接线.md');
  const readme = read('README.md');

  const checks = [
    {
      name: '8788 默认关闭',
      ok:
        read('src/mobile/world/remote-assets.ts').includes('if (!raw) return "";') &&
        !/默认[^\n]*8788/.test(readme),
    },
    {
      name: 'MeinaMix / 角色 LoRA 不在现行线',
      ok: (() => {
        const docs = ['README.md', 'docs/现行状态.md', 'docs/资产管线.md', 'docs/game-direction.md'];
        for (const d of docs) {
          for (const line of read(d).split('\n')) {
            if (!/meinamix|xiaoyan\.safetensors/i.test(line)) continue;
            if (!/禁止|不挂|不再|停止|作废|旧线|归档/.test(line)) return false;
          }
        }
        return true;
      })(),
    },
    {
      name: '底栏七项与代码一致',
      ok: (() => {
        const want = ['大厅', '小世界', '衣橱', '闯关', '幻阁', '图鉴', '密语'];
        const canon = navLabels.map((label) => {
          const hit = want.find((n) =>
            n === '图鉴' ? /原画|图鉴/.test(label) : label.includes(n),
          );
          return hit ?? label;
        });
        return (
          navLabels.length === 7 &&
          canon.join('/') === want.join('/') &&
          want.every((n) => direction.includes(n))
        );
      })(),
    },
    {
      name: 'sit / sleep 从不渲染',
      ok: !/activeSkin\.(sit|sleep)/.test(worldApp) && current.includes('从未渲染'),
    },
    {
      name: '密语有底栏入口',
      ok: (() => {
        const chatRow = current.split('\n').find((l) => l.includes('`chat`')) ?? '';
        return (
          /setScreen\(["']chat["']\)/.test(worldApp) &&
          navLabels.some((l) => l.includes('密语')) &&
          chatRow.length > 0 &&
          !chatRow.includes('无入口')
        );
      })(),
    },
    {
      name: '角色图 onError 回退已接线',
      ok:
        /applyLocalAssetFallback\(/.test(worldApp) &&
        read('src/mobile/world/remote-assets.ts').includes('export function applyLocalAssetFallback'),
    },
    {
      name: '裁缝铺仅开发环境',
      ok:
        read('vite.config.ts').includes('/api/comfy/draw') &&
        !fs.readdirSync(path.join(ROOT, 'netlify/functions')).some((f) => /comfy/i.test(f)) &&
        /import\.meta\.env\.DEV/.test(worldApp) &&
        server.includes('仅开发'),
    },
  ];

  for (const c of checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}`);
    if (!c.ok) claimsFailed++;
  }
  console.log(`claims ok ${checks.length - claimsFailed}/${checks.length}`);
}

process.exit(broken === 0 && orphans.length === 0 && claimsFailed === 0 ? 0 : 1);
