/**
 * RAY-545 自测脚本：/posts 列表封面 ＋ 标题去后缀 ＋ 系列 pill
 *
 * 用法: node verify.mjs <baseUrl> <outJson> <shotsDir>
 *
 * 检查项：
 *   1. /posts、/en/posts：每篇有 .list-cover（高 200px、img object-fit: cover），标题不含系列后缀，
 *      系列标签是 .series-pill（文字 = i18n 短名，href 指向系列页）；
 *   2. 文章页（中/英）：h1 不含后缀、<title> 仍含后缀（回归口径），pill 在标签行里；
 *   3. 浅/深主题：pill 底色/文字色随主题反相，对比度 ≥ 4.5:1；
 *   4. 点击 pill 进系列页（真实导航一次）。
 *
 * Playwright 用系统 Chrome（与 docs/qa/RAY-531 同一套口径：1280×900、deviceScaleFactor 2）。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [baseUrl, outJson, shotsDir] = process.argv.slice(2);
if (!baseUrl || !outJson || !shotsDir) {
  console.error('usage: node verify.mjs <baseUrl> <outJson> <shotsDir>');
  process.exit(2);
}
fs.mkdirSync(shotsDir, { recursive: true });

const NAV_TIMEOUT = 15000;
const result = { baseUrl, checks: [], readings: [], failures: [] };

function check(name, ok, detail) {
  result.checks.push({ name, ok, detail });
  if (!ok) result.failures.push({ name, detail });
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});

async function newContext(theme, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t);
    } catch {}
  }, theme);
  return ctx;
}

/** 页内读取：pill / 封面 / 标题 / 标签行 */
const READ_LIST = () => {
  const txt = (el) => (el ? el.textContent.trim() : null);
  const articles = [...document.querySelectorAll('article')];
  return {
    theme: document.documentElement.getAttribute('data-theme'),
    covers: articles.map((a) => {
      const link = a.querySelector('.list-cover');
      const img = link?.querySelector('img');
      if (!link || !img) return null;
      const box = link.getBoundingClientRect();
      const cs = getComputedStyle(img);
      return {
        href: link.getAttribute('href'),
        height: Math.round(box.height),
        objectFit: cs.objectFit,
        imgWidth: Math.round(img.getBoundingClientRect().width),
        src: img.getAttribute('src'),
      };
    }),
    titles: articles.map((a) => txt(a.querySelector('.post-title'))),
    pills: articles.map((a) => {
      const pill = a.querySelector('.series-pill');
      if (!pill) return null;
      const cs = getComputedStyle(pill);
      const box = pill.getBoundingClientRect();
      return {
        text: txt(pill),
        href: pill.getAttribute('href'),
        background: cs.backgroundColor,
        color: cs.color,
        radius: cs.borderRadius,
        fontSize: cs.fontSize,
        height: Math.round(box.height),
        width: Math.round(box.width),
        textDecorationLine: cs.textDecorationLine,
        // pill 是否是标签行里的第一枚标签
        firstTag: a.querySelector('time + span')?.firstElementChild === pill,
      };
    }),
  };
};

/** 页内读取：文章页 pill + h1 + 标签行 */
const READ_ARTICLE = () => {
  const pill = document.querySelector('.series-pill');
  const h1 = document.querySelector('h1.post-title') || document.querySelector('h1');
  const cs = pill ? getComputedStyle(pill) : null;
  const box = pill?.getBoundingClientRect();
  const metaRow = document.querySelector('h1 + div');
  return {
    theme: document.documentElement.getAttribute('data-theme'),
    h1: h1?.textContent.trim(),
    title: document.title,
    pill: pill
      ? {
          text: pill.textContent.trim(),
          href: pill.getAttribute('href'),
          background: cs.backgroundColor,
          color: cs.color,
          radius: cs.borderRadius,
          fontSize: cs.fontSize,
          height: Math.round(box.height),
          textDecorationLine: cs.textDecorationLine,
          inMetaRow: !!metaRow?.contains(pill),
        }
      : null,
    metaText: metaRow?.textContent.replace(/\s+/g, ' ').trim(),
  };
};

function luminance(rgb) {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

async function visit(ctx, url, shot) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(250);
  if (shot) await page.screenshot({ path: path.join(shotsDir, shot), fullPage: false });
  return page;
}

// ---------- 1. /posts 列表（中 / 英 × 浅 / 深）----------
for (const theme of ['light', 'dark']) {
  const ctx = await newContext(theme);
  const page = await visit(ctx, `${baseUrl}/posts/`, `posts-${theme}.png`);
  const data = await page.evaluate(READ_LIST);
  result.readings.push({ page: '/posts/', theme, ...data });

  const covers = data.covers.filter(Boolean);
  check(`/posts ${theme}: 每篇都有封面`, covers.length === data.covers.length && covers.length > 0, `${covers.length}/${data.covers.length}`);
  check(`/posts ${theme}: 封面高 200px + object-fit cover`, covers.every((c) => c.height === 200 && c.objectFit === 'cover'), covers.map((c) => `${c.height}/${c.objectFit}`).join(' '));
  check(`/posts ${theme}: 标题无「| 系列名 #NN」`, data.titles.every((t) => !/\|\s*(随便想想|半月记|Ray 的设计课|JustThinking|biweekly|RayDesign)/.test(t)), JSON.stringify(data.titles));
  const pills = data.pills.filter(Boolean);
  check(`/posts ${theme}: 有系列 pill 且文字为短名`, pills.length >= 5 && pills.every((p) => /^#(随便想想|半月记|Ray 的设计课)$/.test(p.text)), JSON.stringify(pills.map((p) => p.text)));
  check(`/posts ${theme}: pill 链接指向系列页`, pills.every((p) => /^\/posts\/(justthinking|biweekly|raydesign)\/$/.test(p.href)), JSON.stringify(pills.map((p) => p.href)));
  check(`/posts ${theme}: pill 在标签行首位`, pills.every((p) => p.firstTag), JSON.stringify(pills.map((p) => p.firstTag)));
  check(`/posts ${theme}: pill 圆角 999px 且无下划线`, pills.every((p) => p.radius === '999px' && p.textDecorationLine === 'none'), JSON.stringify(pills.map((p) => `${p.radius}/${p.textDecorationLine}`)));
  const minContrast = Math.min(...pills.map((p) => contrast(p.background, p.color)));
  check(`/posts ${theme}: pill 文字对比度 ≥ 4.5`, minContrast >= 4.5, minContrast.toFixed(2));
  check(`/posts ${theme}: 主题生效`, data.theme === theme, String(data.theme));
  await ctx.close();
}

// 英文列表（浅色）
{
  const ctx = await newContext('light');
  const page = await visit(ctx, `${baseUrl}/en/posts/`, 'en-posts-light.png');
  const data = await page.evaluate(READ_LIST);
  result.readings.push({ page: '/en/posts/', theme: 'light', ...data });
  const pills = data.pills.filter(Boolean);
  check('/en/posts: 封面 + 英文 pill 短名', data.covers.filter(Boolean).length === data.covers.length && pills.length > 0 && pills.every((p) => p.text === '#JustThinking' && p.href === '/en/posts/justthinking/'), JSON.stringify(pills));
  check('/en/posts: 标题无后缀', data.titles.every((t) => !t.includes('|')), JSON.stringify(data.titles));
  await ctx.close();
}

// ---------- 2. 文章页（中 / 英 × 浅 / 深）----------
const ARTICLES = [
  { url: '/posts/justthinking/justthinking-04-metro-volunteer/', theme: 'light', shot: 'article-light.png', pill: '#随便想想', href: '/posts/justthinking/' },
  { url: '/posts/justthinking/justthinking-04-metro-volunteer/', theme: 'dark', shot: 'article-dark.png', pill: '#随便想想', href: '/posts/justthinking/' },
  { url: '/posts/biweekly/biweekly-2605-a/', theme: 'light', shot: 'article-biweekly-light.png', pill: '#半月记', href: '/posts/biweekly/' },
  { url: '/en/posts/justthinking/justthinking-04-metro-volunteer/', theme: 'light', shot: 'en-article-light.png', pill: '#JustThinking', href: '/en/posts/justthinking/' },
];
for (const item of ARTICLES) {
  const ctx = await newContext(item.theme);
  const page = await visit(ctx, `${baseUrl}${item.url}`, item.shot);
  const data = await page.evaluate(READ_ARTICLE);
  result.readings.push({ page: item.url, theme: item.theme, ...data });
  check(`文章 ${item.url} ${item.theme}: h1 无后缀`, !/\|\s*(随便想想|半月记|Ray 的设计课|JustThinking|biweekly|RayDesign)/.test(data.h1 || ''), String(data.h1));
  check(`文章 ${item.url} ${item.theme}: <title> 保留后缀`, /\|\s*(随便想想|半月记|Ray 的设计课|JustThinking|biweekly|RayDesign)/.test(data.title || ''), String(data.title));
  check(`文章 ${item.url} ${item.theme}: pill 文字/href`, data.pill?.text === item.pill && data.pill?.href === item.href, JSON.stringify(data.pill));
  check(`文章 ${item.url} ${item.theme}: pill 在标签行内`, !!data.pill?.inMetaRow, String(data.pill?.inMetaRow));
  check(`文章 ${item.url} ${item.theme}: pill 圆角/无下划线/对比度`, data.pill?.radius === '999px' && data.pill?.textDecorationLine === 'none' && contrast(data.pill.background, data.pill.color) >= 4.5, JSON.stringify(data.pill && { r: data.pill.radius, d: data.pill.textDecorationLine, c: contrast(data.pill.background, data.pill.color).toFixed(2) }));
  await ctx.close();
}

// ---------- 3. pill 局部截图（浅 / 深）----------
for (const theme of ['light', 'dark']) {
  const ctx = await newContext(theme);
  const page = await visit(ctx, `${baseUrl}/posts/justthinking/justthinking-04-metro-volunteer/`, null);
  const pill = page.locator('.series-pill').first();
  const box = await pill.boundingBox();
  await page.screenshot({
    path: path.join(shotsDir, `pill-zoom-${theme}.png`),
    clip: { x: Math.max(0, box.x - 60), y: Math.max(0, box.y - 60), width: 420, height: 150 },
  });
  await ctx.close();
}

// ---------- 4. 点击 pill → 系列页 ----------
{
  const ctx = await newContext('light');
  const page = await visit(ctx, `${baseUrl}/posts/`, null);
  await Promise.all([
    page.waitForURL('**/posts/justthinking/', { timeout: NAV_TIMEOUT }),
    page.locator('article .series-pill').first().click(),
  ]);
  check('点击 /posts 的 pill 进系列页', page.url().endsWith('/posts/justthinking/'), page.url());
  await ctx.close();
}

// ---------- 5. 标签页标题（回归）----------
{
  const ctx = await newContext('light');
  const page = await visit(ctx, `${baseUrl}/tags/JustThinking/`, 'tag-page-light.png');
  const titles = await page.$$eval('.post-title', (els) => els.map((e) => e.textContent.trim()));
  check('标签页标题无后缀', titles.length > 0 && titles.every((t) => !t.includes('|')), JSON.stringify(titles));
  await ctx.close();
}

await browser.close();
fs.writeFileSync(outJson, JSON.stringify(result, null, 2));
console.log(`checks: ${result.checks.length}, failures: ${result.failures.length}`);
for (const f of result.failures) console.log('FAIL', f.name, '→', f.detail);
