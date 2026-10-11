// 發佈到 Netlify：版本號自動 +1、寫入發佈時間、更新快取參數，然後部署
// 用法：node deploy.mjs "這次改了什麼"
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SITE_ID = '6cec1053-d11c-469d-aa27-80c593355b6b';
const file = new URL('./index.html', import.meta.url);
let html = readFileSync(file, 'utf8');

const cur = (html.match(/data-version="(\d+)\.(\d+)"/) || [, '1', '0']).slice(1).map(Number);
const ver = `${cur[0]}.${cur[1] + 1}`;
const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const build = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

html = html
  .replace(/data-version="[^"]*"/, `data-version="${ver}"`)
  .replace(/data-build="[^"]*"/, `data-build="${build}"`)
  .replace(/\?v=[\w.]+"/g, `?v=${ver}"`);
writeFileSync(file, html);

const msg = `v${ver} ${process.argv[2] || ''}`.trim();
console.log(`發佈 v${ver}（${build}）…`);
execFileSync('netlify', ['deploy', '--prod', '--dir', '.', '--site', SITE_ID, '--message', msg], {
  stdio: 'inherit', shell: true, cwd: new URL('.', import.meta.url),
});
console.log(`完成：v${ver}`);
