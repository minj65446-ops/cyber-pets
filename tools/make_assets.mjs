/* 生成 Toy 发布页要的封面（1200×900，4:3）与图标（512×512）。
 * 依赖：puppeteer-core + 本机 Chrome。只在开发机跑一次，产物已提交到 assets/，
 * 正常打包（tools/build_toy.py）不需要浏览器。
 *
 *   node tools/make_assets.mjs
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
const PAGE = 'file:///' + path.join(ROOT, 'cyber-pets', 'index.html').replace(/\\/g, '/');
const OUT = path.join(ROOT, 'assets');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

fs.mkdirSync(OUT, { recursive: true });

const b = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'],
});

/* ---- 封面：直接截首页 1200×900 ---- */
const p = await b.newPage();
await p.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
await p.goto(PAGE, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 1200));
await p.screenshot({ path: path.join(OUT, 'cover.png') });

/* ---- 图标：512×512 的程序化头像，不是封面缩图 ---- */
const dataUrl = await p.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const pet = PETS.find(x => x.id === 'yujie') || PETS[0];
  drawPet(c.getContext('2d'), pet, 512, 82, 0);
  return c.toDataURL('image/png');
});
fs.writeFileSync(path.join(OUT, 'icon.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));

await p.close();
await b.close();

for (const f of ['cover.png', 'icon.png']) {
  const s = fs.statSync(path.join(OUT, f));
  console.log(f, (s.size / 1024).toFixed(1) + ' KB');
}
