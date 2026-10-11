/**
 * RAY-557 自测脚本：跨页导航首帧主题（修复 FOUC / 闪白）
 *
 * 用法:
 *   NODE_PATH=$(npm root -g) node verify.mjs <baseUrl> <outJson> <shotsDir> [label] [cpuThrottle]
 *   baseUrl 指向本地 dist 静态服务（如 python3 -m http.server 44557 --directory dist）
 *
 * 口径与 docs/qa/RAY-549 / RAY-552 一致：Chromium（系统 Chrome）走 CDP，
 * 视图 900×600、DPR 1（这里要的是首帧底色，不需要高分屏）。
 *
 * 两项检查（都针对「跨页导航」，即 MPA 全量加载）：
 *   ① 最早可读时刻：在 readystatechange → 'interactive' 的第一个事件里读
 *      document.documentElement.dataset.theme。规范顺序是「置 readyState=interactive、
 *      触发 readystatechange」→「执行 defer / module 脚本」，所以这一刻的取值就是
 *      「浏览器已解析完文档、还没跑任何延迟脚本」时的主题。修复前（主题初始化在
 *      Astro 打包出的延迟 module 里）此刻必然是 null；修复后（head 里的经典内联脚本）
 *      此刻已是最终值。
 *   ② 首帧采样：CDP Page.startScreencast 逐帧收集合成帧，sharp 解码后取顶部 48px 条带
 *      的平均亮度，与期望主题的底色比对。为了能看出「白闪」，导航从**与目标页同底色**的
 *      闩页发起（模拟「上一页已经是深色、跳到新页面」），并加 CPU 节流 —— 真实网络下
 *      CDN 样式/字体的往返延迟就是这个效果：解析过程跨过至少一个合成帧，
 *      延迟脚本还没跑，首帧已经画出来了。
 *
 * 6 种组合 × 中/英两页：stored(light|dark|system) × 系统偏好(dark|light)。
 * 判定：① 的取值必须等于期望主题；② 导航后不得出现与期望相反底色的帧。
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [baseUrl, outJson, shotsDir, label = 'run', throttle = '20'] = process.argv.slice(2);
if (!baseUrl || !outJson || !shotsDir) {
  console.error('usage: node verify.mjs <baseUrl> <outJson> <shotsDir> [label] [cpuThrottle]');
  process.exit(2);
}
const CPU = Number(throttle) || 1;
fs.mkdirSync(shotsDir, { recursive: true });

const CHROME = '/usr/bin/google-chrome';
const PAGES = [
  { name: 'zh-home', path: '/' },
  { name: 'en-home', path: '/en/' },
];
const COMBOS = [
  { id: 'dark-light', stored: 'dark', sys: 'light', expect: 'dark' },
  { id: 'dark-dark', stored: 'dark', sys: 'dark', expect: 'dark' },
  { id: 'light-light', stored: 'light', sys: 'light', expect: 'light' },
  { id: 'light-dark', stored: 'light', sys: 'dark', expect: 'light' },
  { id: 'system-dark', stored: 'system', sys: 'dark', expect: 'dark' },
  { id: 'system-light', stored: 'system', sys: 'light', expect: 'light' },
];

const isExternal = (url) => !url.startsWith(baseUrl) && !url.startsWith('data:') && !url.startsWith('about:');

/** 解码一帧 JPEG，返回顶部 48px 条带（页面底色区）的平均亮度 */
async function topLum(buf) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: hTotal, channels: ch } = info;
  const h = Math.min(48, hTotal);
  let sum = 0, n = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 8) {
      const i = (y * w + x) * ch;
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      n++;
    }
  }
  return sum / n;
}

const launchOpts = { headless: true, args: ['--force-color-profile=srgb'] };
if (fs.existsSync(CHROME)) launchOpts.executablePath = CHROME;
const browser = await chromium.launch(launchOpts);

const results = [];
for (const combo of COMBOS) {
  for (const target of PAGES) {
    const ctx = await browser.newContext({
      colorScheme: combo.sys,
      viewport: { width: 900, height: 600 },
      deviceScaleFactor: 1,
    });
    await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch (e) {} }, combo.stored);
    await ctx.route('**/*', (route) => (isExternal(route.request().url()) ? route.abort() : route.continue()));

    // ---------- ① 解析完成、延迟脚本尚未执行的那一刻 ----------
    const pageA = await ctx.newPage();
    await pageA.addInitScript(() => {
      window.__earliest = null;
      document.addEventListener('readystatechange', () => {
        if (window.__earliest) return;
        window.__earliest = {
          state: document.readyState,
          theme: document.documentElement?.dataset?.theme ?? null,
        };
      }, true);
    });
    await pageA.goto(baseUrl + target.path, { waitUntil: 'load', timeout: 30000 });
    const earliest = await pageA.evaluate(() => window.__earliest);
    await pageA.close();

    // ---------- ② 首帧采样 ----------
    const page = await ctx.newPage();
    const latch = combo.expect === 'dark' ? '#000000' : '#f9f9f9';
    await page.goto('data:text/html,' + encodeURIComponent(
      `<html style="background:${latch}"><body style="margin:0;background:${latch}"></body></html>`));
    const cdp = await ctx.newCDPSession(page);
    const frames = [];
    cdp.on('Page.screencastFrame', async (f) => {
      frames.push(Buffer.from(f.data, 'base64'));
      try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) {}
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, everyNthFrame: 1, maxWidth: 900, maxHeight: 600 });
    if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await page.waitForTimeout(500); // 闩页自己先稳定下来
    frames.length = 0;              // 丢掉闩页的帧，只看导航之后的
    await page.goto(baseUrl + target.path, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(600);
    if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
    await cdp.send('Page.stopScreencast').catch(() => {});
    await page.close();
    await ctx.close();

    const lums = [];
    for (const f of frames) lums.push(await topLum(f));
    const expectDark = combo.expect === 'dark';
    const wrong = lums.map((v, i) => ({ i, v })).filter((x) => (expectDark ? x.v > 120 : x.v < 120));

    const base = `${label}__${target.name}__${combo.id}`;
    if (frames.length) await sharp(frames[0]).png().toFile(path.join(shotsDir, `${base}__first.png`));
    if (wrong.length) await sharp(frames[wrong[0].i]).png().toFile(path.join(shotsDir, `${base}__wrong.png`));

    results.push({
      page: target.name,
      combo: combo.id,
      stored: combo.stored,
      systemScheme: combo.sys,
      expected: combo.expect,
      earliestState: earliest?.state ?? null,
      earliestTheme: earliest?.theme ?? null,
      earliestThemeOk: earliest?.theme === combo.expect,
      frames: lums.length,
      frameTopLum: lums.map((v) => Math.round(v)),
      firstFrameTopLum: lums.length ? Math.round(lums[0]) : null,
      finalFrameTopLum: lums.length ? Math.round(lums[lums.length - 1]) : null,
      wrongFrameCount: wrong.length,
      wrongFrameIndexes: wrong.map((x) => x.i),
      noWrongFrame: wrong.length === 0,
      pass: earliest?.theme === combo.expect && wrong.length === 0,
    });
  }
}

await browser.close();

const summary = {
  label,
  baseUrl,
  chrome: fs.existsSync(CHROME) ? CHROME : 'playwright-bundled-chromium',
  cpuThrottle: CPU,
  viewport: '900x600 @1',
  generatedAt: new Date().toISOString(),
  total: results.length,
  passed: results.filter((r) => r.pass).length,
  earliestThemeAllCorrect: results.every((r) => r.earliestThemeOk),
  noWrongFrame: results.every((r) => r.noWrongFrame),
  results,
};
fs.writeFileSync(outJson, JSON.stringify(summary, null, 2) + '\n');

for (const r of results) {
  console.log(
    `${r.pass ? 'PASS' : 'FAIL'}  ${r.page.padEnd(8)} ${r.combo.padEnd(13)}`,
    `expected=${r.expected.padEnd(5)} earliest@${String(r.earliestState).padEnd(11)} theme=${String(r.earliestTheme).padEnd(5)}`,
    `frames=${String(r.frames).padEnd(3)} first=${String(r.firstFrameTopLum).padEnd(3)} final=${String(r.finalFrameTopLum).padEnd(3)}`,
    `wrongFrames=[${r.frameTopLum.filter((v) => (r.expected === 'dark' ? v > 120 : v < 120)).join(',')}]`
  );
}
console.log(`\n${label}: ${summary.passed}/${summary.total} PASS（earliest 主题全对=${summary.earliestThemeAllCorrect}，无反向底色帧=${summary.noWrongFrame}）`);
process.exit(summary.passed === summary.total ? 0 : 1);
