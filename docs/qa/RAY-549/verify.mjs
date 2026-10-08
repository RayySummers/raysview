/**
 * RAY-549 自测脚本：「AI 声明」折叠区（左对齐修正 ＋ 平滑开合动画）
 *
 * 用法: node verify.mjs <baseUrl> <outJson> <shotsDir>
 *   baseUrl 指向本地 dist 静态服务（如 python3 -m http.server 44488 --directory dist）
 *
 * 检查项（Chromium 走系统 Chrome，另跑一遍 Firefox 验兜底脚本）：
 *   1. 左对齐：summary 的 computed padding-left / padding-inline-start = 0，
 *      且 summary 文字、折叠区内段落、折叠区之前的正文段落左缘完全重合（中/英 × 浅/深）；
 *   2. 平滑开合：点击后逐帧采样 details 高度，必须是渐变（≥3 个中间帧）、时长 ≈ 200ms；
 *      收起后 details.open=false、::details-content 的 content-visibility=hidden；
 *   3. chevron：展开态 transform=none，收起态 rotate(180deg)；
 *   4. 键盘：聚焦 summary 后 Enter 收起 / Space 展开；
 *   5. prefers-reduced-motion：直切（无中间帧）；
 *   6. JS 关闭：原生 details 仍能开合（功能不坏）；
 *   7. 展开态几何与「中和掉新规则」时逐像素一致（不引入块高/文档高偏差）；
 *   8. 控制台无 error。
 *
 * 口径与 docs/qa/RAY-531 / RAY-545 一致：1280×900、deviceScaleFactor 2。
 */
import { chromium, firefox } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [baseUrl, outJson, shotsDir] = process.argv.slice(2);
if (!baseUrl || !outJson || !shotsDir) {
  console.error('usage: node verify.mjs <baseUrl> <outJson> <shotsDir>');
  process.exit(2);
}
fs.mkdirSync(shotsDir, { recursive: true });

const ZH = `${baseUrl}/posts/justthinking/justthinking-04-metro-volunteer/`;
const EN = `${baseUrl}/en/posts/justthinking/justthinking-04-metro-volunteer/`;
const CHROME = '/usr/bin/google-chrome';

const result = { baseUrl, browsers: {}, failures: [] };
function check(name, ok, detail) {
  result.browsers[result.current].checks.push({ name, ok, detail });
  if (!ok) result.failures.push(`${result.current}/${name}: ${JSON.stringify(detail)}`);
}

const FEATURES = () => ({
  detailsContent: CSS.supports('selector(::details-content)'),
  interpolate: CSS.supports('interpolate-size', 'allow-keywords'),
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches
});

const LAYOUT = () => {
  const box = document.querySelector('details.ai-disclosure');
  const summary = box.querySelector('summary');
  const label = box.querySelector('.ai-disclosure__label');
  const body = box.querySelector('.ai-disclosure__body');
  const firstP = body.querySelector('p');
  const art = document.querySelector('article.heti');
  const beforeP = [...art.querySelectorAll(':scope > p')]
    .filter(p => p.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING)[0] || null;
  const cs = getComputedStyle(summary);
  return {
    paddingLeft: cs.paddingLeft,
    paddingInlineStart: cs.paddingInlineStart,
    summaryLeft: +summary.getBoundingClientRect().left.toFixed(2),
    labelLeft: +label.getBoundingClientRect().left.toFixed(2),
    bodyPLeft: firstP ? +firstP.getBoundingClientRect().left.toFixed(2) : null,
    beforePLeft: beforeP ? +beforeP.getBoundingClientRect().left.toFixed(2) : null,
    fontSize: cs.fontSize,
    lineHeight: cs.lineHeight,
    open: box.open,
    detailsH: +box.getBoundingClientRect().height.toFixed(1)
  };
};

const START_SAMPLER = () => {
  const box = document.querySelector('details.ai-disclosure');
  window.__samples = [];
  window.__stop = false;
  const t0 = performance.now();
  const rec = () => {
    window.__samples.push([
      Math.round(performance.now() - t0),
      Math.round(box.getBoundingClientRect().height * 10) / 10
    ]);
    if (!window.__stop) requestAnimationFrame(rec);
  };
  requestAnimationFrame(rec);
};

const STOP_SAMPLER = () => { window.__stop = true; return window.__samples; };

const STATE = () => {
  const box = document.querySelector('details.ai-disclosure');
  const cs = getComputedStyle(box, '::details-content');
  return {
    open: box.open,
    detailsH: +box.getBoundingClientRect().height.toFixed(1),
    contentVisibility: cs.contentVisibility,
    blockSize: cs.blockSize,
    chevron: getComputedStyle(box.querySelector('.ai-disclosure__chevron')).transform
  };
};

const GEOMETRY = () => ({
  detailsH: +document.querySelector('details.ai-disclosure').getBoundingClientRect().height.toFixed(2),
  docH: document.documentElement.scrollHeight
});

const NEUTRALIZE = () => {
  const s = document.createElement('style');
  s.textContent = '.ai-disclosure::details-content{block-size:auto !important;overflow:visible !important;transition:none !important}';
  document.head.appendChild(s);
};

function curve(samples) {
  const heights = samples.map(s => s[1]);
  const start = heights[0];
  const end = heights[heights.length - 1];
  const begin = samples.find(s => Math.abs(s[1] - start) > 0.6)?.[0] ?? null;
  const settle = samples.find(s => Math.abs(s[1] - end) < 0.6)?.[0] ?? null;
  const lo = Math.min(start, end) + 1;
  const hi = Math.max(start, end) - 1;
  return {
    start,
    end,
    intermediate: heights.filter(h => h > lo && h < hi).length,
    distinct: new Set(heights).size,
    beginMs: begin,
    settleMs: settle,
    durationMs: begin === null || settle === null ? null : settle - begin,
    samples: samples.length,
    first5: samples.slice(0, 5)
  };
}

async function runBrowser(name, type) {
  result.current = name;
  result.browsers[name] = { checks: [] };
  const launchOpts = name === 'chromium' && fs.existsSync(CHROME)
    ? { executablePath: CHROME, args: ['--no-sandbox', '--font-render-hinting=none'] }
    : {};
  const browser = await type.launch(launchOpts);
  const errors = [];
  const watch = page => {
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', e => errors.push(String(e)));
  };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });

  // ---- 主场景：中文浅色 ----
  const page = await ctx.newPage();
  watch(page);
  await page.goto(ZH, { waitUntil: 'load' });
  await page.waitForTimeout(700);
  const features = await page.evaluate(FEATURES);
  result.browsers[name].features = features;
  const lay = await page.evaluate(LAYOUT);
  result.browsers[name].layoutZhLight = lay;
  check('summary padding-left 归零', lay.paddingLeft === '0px' && lay.paddingInlineStart === '0px', lay);
  const ref = lay.beforePLeft ?? lay.bodyPLeft;
  check('summary 与正文左缘平齐', Math.abs(lay.summaryLeft - ref) <= 0.5 && Math.abs(lay.labelLeft - ref) <= 0.5,
    { summaryLeft: lay.summaryLeft, labelLeft: lay.labelLeft, bodyPLeft: lay.bodyPLeft, beforePLeft: lay.beforePLeft });
  await page.locator('details.ai-disclosure').screenshot({ path: path.join(shotsDir, 'qa-zh-light-expanded.png') });

  // ---- 收起曲线 ----
  await page.evaluate(START_SAMPLER);
  await page.locator('details.ai-disclosure summary').click();
  await page.waitForTimeout(60);
  await page.locator('details.ai-disclosure').screenshot({ path: path.join(shotsDir, 'qa-zh-mid-animation.png') });
  await page.waitForTimeout(520);
  const closeCurve = curve(await page.evaluate(STOP_SAMPLER));
  const closed = await page.evaluate(STATE);
  result.browsers[name].closeCurve = closeCurve;
  result.browsers[name].stateClosed = closed;
  check('收起是渐变不是瞬跳', closeCurve.intermediate >= 3 && closeCurve.distinct >= 4, closeCurve);
  check('收起时长 ≈200ms', closeCurve.durationMs !== null && closeCurve.durationMs >= 120 && closeCurve.durationMs <= 330, closeCurve);
  check('收起后 open=false / 内容 hidden / 块高回到 summary',
    closed.open === false && closed.contentVisibility === 'hidden' && closed.detailsH < 60, closed);
  check('收起后 chevron 旋转 180°', closed.chevron === 'matrix(-1, 0, 0, -1, 0, 0)', closed.chevron);
  await page.locator('details.ai-disclosure').screenshot({ path: path.join(shotsDir, 'qa-zh-light-collapsed.png') });

  // ---- 展开曲线 ----
  await page.evaluate(START_SAMPLER);
  await page.locator('details.ai-disclosure summary').click();
  await page.waitForTimeout(580);
  const openCurve = curve(await page.evaluate(STOP_SAMPLER));
  const opened = await page.evaluate(STATE);
  result.browsers[name].openCurve = openCurve;
  result.browsers[name].stateOpen = opened;
  check('展开是渐变不是瞬跳', openCurve.intermediate >= 3 && openCurve.distinct >= 4, openCurve);
  check('展开时长 ≈200ms', openCurve.durationMs !== null && openCurve.durationMs >= 120 && openCurve.durationMs <= 330, openCurve);
  check('展开后 open=true / 内容 visible / chevron 未旋转',
    opened.open === true && opened.contentVisibility === 'visible' && opened.chevron === 'none' && opened.detailsH > 200, opened);

  // ---- 键盘 ----
  await page.locator('details.ai-disclosure summary').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const kb1 = await page.evaluate(STATE);
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  const kb2 = await page.evaluate(STATE);
  result.browsers[name].keyboard = { afterEnter: kb1.open, afterSpace: kb2.open };
  check('键盘 Enter 收起 / Space 展开', kb1.open === false && kb2.open === true, result.browsers[name].keyboard);

  // ---- 几何不变（中和新规则前后对比）----
  const geoBefore = await page.evaluate(GEOMETRY);
  await page.evaluate(NEUTRALIZE);
  await page.waitForTimeout(200);
  const geoAfter = await page.evaluate(GEOMETRY);
  result.browsers[name].geometry = { withNewCss: geoBefore, neutralized: geoAfter };
  check('展开态块高/文档高无偏差',
    Math.abs(geoBefore.detailsH - geoAfter.detailsH) <= 0.5 && Math.abs(geoBefore.docH - geoAfter.docH) <= 0.5,
    result.browsers[name].geometry);

  // ---- 深色主题 ----
  const darkCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await darkCtx.addInitScript(() => { try { localStorage.setItem('theme', 'dark'); } catch {} });
  const dark = await darkCtx.newPage();
  watch(dark);
  await dark.goto(ZH, { waitUntil: 'load' });
  await dark.waitForTimeout(500);
  const layDark = await dark.evaluate(LAYOUT);
  result.browsers[name].themeAttr = await dark.evaluate(() => document.documentElement.dataset.theme);
  result.browsers[name].layoutZhDark = layDark;
  const refDark = layDark.beforePLeft ?? layDark.bodyPLeft;
  check('深色主题下左缘同样平齐',
    layDark.paddingLeft === '0px' && Math.abs(layDark.labelLeft - refDark) <= 0.5, layDark);
  await dark.locator('details.ai-disclosure').screenshot({ path: path.join(shotsDir, 'qa-zh-dark-expanded.png') });
  await darkCtx.close();

  // ---- 英文页 ----
  const en = await ctx.newPage();
  watch(en);
  await en.goto(EN, { waitUntil: 'load' });
  await en.waitForTimeout(600);
  const layEn = await en.evaluate(LAYOUT);
  result.browsers[name].layoutEnLight = layEn;
  const refEn = layEn.beforePLeft ?? layEn.bodyPLeft;
  check('英文页左缘平齐', layEn.paddingLeft === '0px' && Math.abs(layEn.labelLeft - refEn) <= 0.5, layEn);
  await en.evaluate(START_SAMPLER);
  await en.locator('details.ai-disclosure summary').click();
  await en.waitForTimeout(580);
  const enCurve = curve(await en.evaluate(STOP_SAMPLER));
  const enClosed = await en.evaluate(STATE);
  result.browsers[name].enCloseCurve = enCurve;
  check('英文页收起是渐变', enCurve.intermediate >= 3, enCurve);
  check('英文页收起到位', enClosed.open === false && enClosed.detailsH < 60, enClosed);
  await en.locator('details.ai-disclosure summary').click();
  await en.waitForTimeout(500);
  const enOpen = await en.evaluate(STATE);
  result.browsers[name].stateEnOpen = enOpen;
  check('英文页可再展开', enOpen.open === true && enOpen.detailsH > 180, enOpen);
  await en.locator('details.ai-disclosure').screenshot({ path: path.join(shotsDir, 'qa-en-light-expanded.png') });
  await ctx.close();

  // ---- prefers-reduced-motion：直切 ----
  const rmCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const rm = await rmCtx.newPage();
  watch(rm);
  await rm.goto(ZH, { waitUntil: 'load' });
  await rm.waitForTimeout(500);
  await rm.evaluate(START_SAMPLER);
  await rm.locator('details.ai-disclosure summary').click();
  await rm.waitForTimeout(160);
  const rmCurve = curve(await rm.evaluate(STOP_SAMPLER));
  await rm.waitForTimeout(200);
  const rmState = await rm.evaluate(STATE);
  result.browsers[name].reducedCurve = rmCurve;
  check('reduced-motion 直切（无中间帧）', rmCurve.intermediate === 0, rmCurve);
  check('reduced-motion 仍能收起', rmState.open === false, rmState);
  await rmCtx.close();

  // ---- JS 关闭：原生 details 可用 ----
  const njCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
  const nj = await njCtx.newPage();
  const d = nj.locator('details.ai-disclosure');
  await nj.goto(ZH, { waitUntil: 'load' });
  await nj.waitForTimeout(300);
  const nojs = {
    initialAttr: await d.getAttribute('open'),
    initialH: (await d.boundingBox()).height
  };
  await d.locator('summary').click();
  await nj.waitForTimeout(200);
  nojs.afterClickAttr = await d.getAttribute('open');
  nojs.afterClickH = (await d.boundingBox()).height;
  nojs.bodyVisible = await nj.locator('details.ai-disclosure .ai-disclosure__body').isVisible();
  await d.locator('summary').focus();
  await nj.keyboard.press('Enter');
  await nj.waitForTimeout(200);
  nojs.afterEnterAttr = await d.getAttribute('open');
  nojs.afterEnterH = (await d.boundingBox()).height;
  result.browsers[name].noJs = nojs;
  check('无 JS：默认展开', nojs.initialAttr !== null && nojs.initialH > 200, nojs);
  check('无 JS：点击可收起', nojs.afterClickAttr === null && nojs.bodyVisible === false && nojs.afterClickH < 60, nojs);
  check('无 JS：键盘可再展开', nojs.afterEnterAttr !== null && nojs.afterEnterH > 200, nojs);
  await njCtx.close();

  result.browsers[name].consoleErrors = errors;
  check('控制台无 error', errors.length === 0, errors.slice(0, 3));
  await browser.close();
}

await runBrowser('chromium', chromium);
await runBrowser('firefox', firefox);

fs.writeFileSync(outJson, JSON.stringify(result, null, 2));
console.log(`readings -> ${outJson}`);
for (const [name, b] of Object.entries(result.browsers)) {
  console.log(`\n== ${name} ==`);
  console.log('  features:', b.features);
  console.log('  layout zh light:', b.layoutZhLight);
  console.log('  layout zh dark :', b.layoutZhDark);
  console.log('  layout en light:', b.layoutEnLight);
  console.log('  close curve:', b.closeCurve);
  console.log('  open curve :', b.openCurve);
  console.log('  closed:', b.stateClosed);
  console.log('  opened:', b.stateOpen);
  console.log('  keyboard:', b.keyboard, ' geometry:', b.geometry);
  console.log('  reduced:', b.reducedCurve);
  console.log('  no-JS:', b.noJs);
  console.log('  console errors:', b.consoleErrors);
  for (const c of b.checks) console.log(`   ${c.ok ? 'PASS' : 'FAIL'} ${c.name}`);
}
if (result.failures.length) {
  console.error(`\n${result.failures.length} 项未通过`);
  process.exit(1);
}
console.log('\n全部断言通过');
