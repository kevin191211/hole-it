// 發佈到 GitHub Pages：版本號自動 +1、寫入發佈時間、更新快取參數，commit 後推上 GitHub（Pages 約一分鐘後更新）
// 用法：node deploy.mjs "這次改了什麼"
//       node deploy.mjs "這次改了什麼" --netlify   同時發到舊的 Netlify 網址（舊網址會自動帶存檔跳到新網址）
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';

const NETLIFY_SITE_ID = '6cec1053-d11c-469d-aa27-80c593355b6b';
const cwd = new URL('.', import.meta.url);
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', cwd });
const file = new URL('./index.html', import.meta.url);
let html = readFileSync(file, 'utf8');

const args = process.argv.slice(2);
const netlify = args.includes('--netlify');
const note = args.filter((a) => a !== '--netlify').join(' ');

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

const msg = `發版 v${ver}${note ? ' ' + note : ''}`;
console.log(`發佈 v${ver}（${build}）…`);
run('git', ['add', 'index.html']);
run('git', ['commit', '-q', '-m', msg]);
run('git', ['push', '-q', 'origin', 'HEAD']);
console.log('已推上 GitHub，約一分鐘後生效：https://kevin191211.github.io/hole-it/');
if (netlify) {
  // netlify 在 Windows 是 .cmd，要經過 shell 執行；訊息加引號才不會被空白切開
  execSync(`netlify deploy --prod --no-build --dir . --site ${NETLIFY_SITE_ID} --message ${JSON.stringify(msg)}`, { stdio: 'inherit', cwd });
}
console.log(`完成：v${ver}`);
