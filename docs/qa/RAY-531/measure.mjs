/**
 * RAY-531 页面大标题字重 520 → 620：逐页读数 / 窄屏回流 / hover 复原 实测脚本
 *
 * 用法: node measure.mjs <baseUrl> <outJson> <shotsDir> <label>
 *   label: 'before' | 'after'（仅用于文件命名）
 *
 * Playwright 用系统 Chrome（本机自带 Chromium 与缓存版本不匹配）。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [baseUrl, outJson, shotsDir, label] = process.argv.slice(2);
if (!baseUrl || !outJson || !shotsDir || !label) {
  console.error('usage: node measure.mjs <baseUrl> <outJson> <shotsDir> <label>');
  process.exit(2);
}
fs.mkdirSync(shotsDir, { recursive: true });

const ARTICLE_PAGES = [
  '/posts/welcome/',
  '/posts/raydesign/emoji-everything/',
  '/posts/biweekly/biweekly-2605-a/',
  '/posts/justthinking/justthinking-01-quiet-carriage/',
  '/posts/justthinking/justthinking-02-token-ciyuan/',
  '/posts/justthinking/justthinking-03-blue-green/',
];
const SERIES_PAGES = [
  '/posts/justthinking/',
  '/posts/raydesign/',
  '/posts/biweekly/',
  '/en/posts/justthinking/',
  '/en/posts/raydesign/',
  '/en/posts/biweekly/',
];
const THEMES = ['light', 'dark'];

const result = {
  label,
  baseUrl,
  viewport: '1280x900@2x',
  generatedAt: new Date().toISOString(),
  titleReadings: [],
  hover: {},
  narrow: [],
  overflow: [],
  consoleErrors: [],
};

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});

async function newContext(viewport, theme) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference',
  });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t);
    } catch {}
  }, theme);
  return ctx;
}

const READ_H1 = () => {
  const articleH1 = document.querySelector('h1.post-title');
  const el = articleH1 || document.querySelector('main h1') || document.querySelector('h1');
  if (!el) return null;
  const cs = getComputedStyle(el);
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
  const box = el.getBoundingClientRect();
  const de = document.documentElement;
  const overflowing = [...document.querySelectorAll('body *')]
    .filter((n) => {
      const r = n.getBoundingClientRect();
      return r.width > 0 && (r.right > de.clientWidth + 0.5 || r.left < -0.5);
    })
    .slice(0, 5)
    .map((n) => `${n.tagName.toLowerCase()}.${(n.className || '').toString().split(' ')[0]}`);
  return {
    selector: articleH1 ? 'h1.post-title' : 'main h1',
    text: (el.textContent || '').trim().slice(0, 40),
    fontWeight: cs.fontWeight,
    fontSize: cs.fontSize,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    fontFamily: cs.fontFamily.split(',')[0],
    optSizing: cs.fontOpticalSizing,
    lines: rects.length,
    textWidth: Math.max(...rects.map((r) => r.width)),
    boxWidth: box.width,
    boxHeight: box.height,
    docScrollWidth: de.scrollWidth,
    docClientWidth: de.clientWidth,
    horizontalOverflow: de.scrollWidth > de.clientWidth,
    overflowing,
  };
};

async function goto(ctx, url) {
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  page.on('console', (m) => {
    if (m.type() === 'error') result.consoleErrors.push(`${url} :: ${m.text()}`);
  });
  page.on('pageerror', (e) => result.consoleErrors.push(`${url} :: pageerror ${e.message}`));
  await page.goto(baseUrl + url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  return page;
}

/* ---------- 1. 逐页读数：文章页 + 系列页 × 明暗 ---------- */
try {
for (const theme of THEMES) {
  const ctx = await newContext({ width: 1280, height: 900 }, theme);
  for (const [kind, pages] of [
    ['article', ARTICLE_PAGES],
    ['series', SERIES_PAGES],
  ]) {
    for (const url of pages) {
      const page = await goto(ctx, url);
      const data = await page.evaluate(READ_H1);
      result.titleReadings.push({ kind, url, theme, ...data });
      if (!data.horizontalOverflow && data.overflowing.length) {
        result.overflow.push({ url, theme, offenders: data.overflowing });
      }
      // 截图（仅浅色、每类第一页，供 QA 对照图使用）
      if (theme === 'light') {
        const shots = {
          article: ['/posts/welcome/', '/posts/biweekly/biweekly-2605-a/'],
          series: ['/posts/justthinking/', '/en/posts/raydesign/'],
        };
        if (shots[kind].includes(url)) {
          const slug = url.replace(/\//g, '_').replace(/^_|_$/g, '');
          await page.locator('h1').first().screenshot({
            path: path.join(shotsDir, `${label}-${slug}.png`),
          });
        }
      }
      await page.close();
    }
  }
  await ctx.close();
}

/* ---------- 2. hover 复原对照（真实鼠标事件） ---------- */
{
  const ctx = await newContext({ width: 1280, height: 900 }, 'light');
  // 2a. 系列页列表里的文章标题链接：320 → hover 620 → 移开 320
  const page = await goto(ctx, '/posts/justthinking/');
  const link = page.locator('a.post-title-link').first();
  const restWeight = await link.evaluate((el) => getComputedStyle(el.querySelector('.post-title')).fontWeight);
  const box = await link.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  const hoverWeight = await link.evaluate((el) => getComputedStyle(el.querySelector('.post-title')).fontWeight);
  const hoverDeco = await link.evaluate(
    (el) => getComputedStyle(el.querySelector('.post-title')).textDecorationColor
  );
  await page.mouse.move(1270, 880);
  await page.waitForTimeout(400);
  const afterWeight = await link.evaluate((el) => getComputedStyle(el.querySelector('.post-title')).fontWeight);
  const afterDeco = await link.evaluate(
    (el) => getComputedStyle(el.querySelector('.post-title')).textDecorationColor
  );
  // 2b. 页面大标题（H1）在鼠标经过时保持 620
  const h1Box = await page.locator('main h1').first().boundingBox();
  await page.mouse.move(h1Box.x + 10, h1Box.y + h1Box.height / 2);
  await page.waitForTimeout(300);
  const h1WhileHovered = await page.evaluate(
    () => getComputedStyle(document.querySelector('main h1')).fontWeight
  );
  result.hover.seriesPage = { restWeight, hoverWeight, afterWeight, hoverDeco, afterDeco, h1WhileHovered };
  await page.close();

  // 2c. 首页三个 tab（.nav-link）：静止 320 → hover 620 → 移开 320
  const page2 = await goto(ctx, '/');
  const nav = page2.locator('.nav-link').first();
  const navBox = await nav.boundingBox();
  const navRest = await nav.evaluate((el) => getComputedStyle(el).fontWeight);
  await page2.mouse.move(navBox.x + navBox.width / 2, navBox.y + navBox.height / 2);
  await page2.waitForTimeout(400);
  const navHover = await nav.evaluate((el) => getComputedStyle(el).fontWeight);
  await page2.mouse.move(1270, 880);
  await page2.waitForTimeout(400);
  const navAfter = await nav.evaluate((el) => getComputedStyle(el).fontWeight);
  const homeH1 = await page2.evaluate(() => {
    const el = document.querySelector('main h1');
    return el ? getComputedStyle(el).fontWeight : null;
  });
  result.hover.articleNavLink = { navRest, navHover, navAfter, homeH1 };
  await page2.close();

  // 2d. 文章页大标题在静止时不参与 hover（页标题不是链接）
  const page3 = await goto(ctx, '/posts/welcome/');
  const t3 = page3.locator('h1.post-title');
  const t3box = await t3.boundingBox();
  const t3rest = await t3.evaluate((el) => getComputedStyle(el).fontWeight);
  await page3.mouse.move(t3box.x + t3box.width / 2, t3box.y + t3box.height / 2);
  await page3.waitForTimeout(300);
  const t3hover = await t3.evaluate((el) => getComputedStyle(el).fontWeight);
  result.hover.articlePageTitle = { rest: t3rest, whileHovered: t3hover };
  await page3.close();
  await ctx.close();
}

/* ---------- 3. 窄屏（≤480px）回流 ---------- */
for (const width of [480, 375]) {
  for (const theme of THEMES) {
    const ctx = await newContext({ width, height: 900 }, theme);
    for (const [kind, url] of [
      ['article', '/posts/biweekly/biweekly-2605-a/'],
      ['article', '/posts/justthinking/justthinking-01-quiet-carriage/'],
      ['series', '/posts/justthinking/'],
      ['series', '/en/posts/biweekly/'],
    ]) {
      const page = await goto(ctx, url);
      const data = await page.evaluate(READ_H1);
      result.narrow.push({ kind, url, theme, viewport: `${width}x900`, ...data });
      await page.close();
    }
    await ctx.close();
  }
}

} catch (e) {
  result.error = String((e && e.stack) || e);
} finally {
  await browser.close();
  fs.writeFileSync(outJson, JSON.stringify(result, null, 2));
  console.log(
    `[${label}] pages=${result.titleReadings.length} narrow=${result.narrow.length} consoleErrors=${result.consoleErrors.length} error=${result.error ? 'YES' : 'no'} written -> ${outJson}`
  );
}
