/**
 * RAY-557 自测脚本（附带项）：主题按钮三态循环行为不变
 *
 * 用法:
 *   NODE_PATH=$(npm root -g) node toggle-verify.mjs <baseUrl> [outJson]
 *   baseUrl 指向本地 dist 静态服务
 *
 * 初始 localStorage.theme = 'light'，系统偏好固定为 dark，然后连点三次主题按钮。
 * 期望（与修复前逐字一致的三态语义）：
 *   light → dark（存 dark，月亮图标）→ system（存 system，跟随系统 = dark，系统图标）→ light（太阳图标）
 * 每次都「点完立刻读」，因此同时验证了点击即时生效（不需要等下一条同步周期）。
 * 顺带覆盖 `data-page="about"` 的关于页 —— 蛋黄色皮肤不在本单范围内，行为不能变。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [baseUrl, outJson] = process.argv.slice(2);
if (!baseUrl) {
  console.error('usage: node toggle-verify.mjs <baseUrl> [outJson]');
  process.exit(2);
}

const CHROME = '/usr/bin/google-chrome';
const isExternal = (url) => !url.startsWith(baseUrl) && !url.startsWith('data:');

const PAGES = [
  { name: 'zh-home', path: '/' },
  { name: 'en-home', path: '/en/' },
  { name: 'zh-about', path: '/about/' },
];

const EXPECTED = [
  { theme: 'dark', stored: 'dark', sun: 'none', moon: 'block', system: 'none' },
  { theme: 'dark', stored: 'system', sun: 'none', moon: 'none', system: 'block' },
  { theme: 'light', stored: 'light', sun: 'block', moon: 'none', system: 'none' },
];

const launchOpts = { headless: true };
if (fs.existsSync(CHROME)) launchOpts.executablePath = CHROME;
const browser = await chromium.launch(launchOpts);

const results = [];
for (const p of PAGES) {
  const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 900, height: 600 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('theme', 'light'); } catch (e) {} });
  await ctx.route('**/*', (r) => (isExternal(r.request().url()) ? r.abort() : r.continue()));
  const page = await ctx.newPage();
  await page.goto(baseUrl + p.path, { waitUntil: 'load', timeout: 30000 });

  const snap = () => page.evaluate(() => ({
    theme: document.documentElement.dataset.theme ?? null,
    stored: localStorage.getItem('theme'),
    sun: getComputedStyle(document.getElementById('sun-icon')).display,
    moon: getComputedStyle(document.getElementById('moon-icon')).display,
    system: getComputedStyle(document.getElementById('system-icon')).display,
  }));

  const initial = await snap();
  const clicks = [];
  for (let i = 0; i < 3; i++) {
    await page.click('#theme-toggle');
    clicks.push(await snap()); // 点完立刻读 = 即时生效
  }
  await ctx.close();

  const initialOk = initial.theme === 'light' && initial.stored === 'light' && initial.sun === 'block';
  const clicksOk = clicks.every((s, i) =>
    s.theme === EXPECTED[i].theme && s.stored === EXPECTED[i].stored &&
    s.sun === EXPECTED[i].sun && s.moon === EXPECTED[i].moon && s.system === EXPECTED[i].system);

  results.push({ page: p.name, initialOk, clicksOk, initial, clicks, pass: initialOk && clicksOk });
}

await browser.close();

const summary = {
  chrome: fs.existsSync(CHROME) ? CHROME : 'playwright-bundled-chromium',
  generatedAt: new Date().toISOString(),
  total: results.length,
  passed: results.filter((r) => r.pass).length,
  results,
};
if (outJson) fs.writeFileSync(outJson, JSON.stringify(summary, null, 2) + '\n');

for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.page.padEnd(9)} init=${r.initial.theme}/${r.initial.stored}/sun=${r.initial.sun}`);
  r.clicks.forEach((s, i) => console.log(
    `      click#${i + 1} → theme=${s.theme} stored=${s.stored} icons(sun/moon/system)=${s.sun}/${s.moon}/${s.system}`));
}
console.log(`\n三态循环: ${summary.passed}/${summary.total} PASS`);
process.exit(summary.passed === summary.total ? 0 : 1);
