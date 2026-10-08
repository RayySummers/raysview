/**
 * RAY-547 自测脚本：JT#04 中英对照词表逐行显示 ＋ 中文篇公众号入口
 *
 * 用法: node verify.mjs <baseUrl> <outJson> <shotsDir>
 *
 * 检查项：
 *   1. 词表逐行：从源 Markdown 数出词表 15 行，逐条在浏览器里量它的行盒
 *      —— 每条必须落在自己的一行上（top 严格递增、左边缘对齐），
 *      而不是整块被并成一行。长词条（英文 banknotes 那条 73 字符）在窄容器里
 *      折行是正常文本流，所以断言的是「每条各起一行」，不是「行盒数 = 15」；
 *   2. 词表段落里没有 <li>（无 bullet，观感与公众号版一致）；
 *   3. 词表段落的文字与源文件逐行一致（没有丢字/串行）；
 *   4. 中文页底部有 .wechat-link，href 指向 Ray 给的公众号链接，图标真的加载出来；
 *      英文页没有公众号入口；
 *   5. 窄屏（390×844）下仍然逐行、且没有横向溢出。
 *
 * Playwright 用系统 Chrome（与 docs/qa/RAY-531 / RAY-545 同一套口径：1280×900、deviceScaleFactor 2）。
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
const SHOT_TIMEOUT = 45000; // 截图要等字体，站点外链 fallback 字体偶尔很慢
const WECHAT_URL = 'https://mp.weixin.qq.com/s/sR7e_i-bN1YDzjVFOMN9wQ';
const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');

/** 与 .github/scripts/check-build.sh 同一口径：从「首行」起、到第一个空行为止 */
function wordlistEntries(srcFile, first) {
  const lines = fs.readFileSync(path.join(REPO_ROOT, srcFile), 'utf8').split('\n');
  const start = lines.findIndex((l) => l.startsWith(first));
  if (start < 0) throw new Error(`源文件里找不到词表首行「${first}」：${srcFile}`);
  const out = [];
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim() === '') break;
    out.push(lines[i].replace(/\s+$/, ''));
  }
  return out;
}

const PAGES = [
  {
    label: 'zh',
    url: '/posts/justthinking/justthinking-04-metro-volunteer/',
    src: 'src/content/posts/justthinking/justthinking-04-metro-volunteer.md',
    first: '乘车码——ride code',
    expectWechat: true
  },
  {
    label: 'en',
    url: '/en/posts/justthinking/justthinking-04-metro-volunteer/',
    src: 'src/content/posts-en/justthinking/justthinking-04-metro-volunteer.md',
    first: 'ride code——乘车码',
    expectWechat: false
  }
];
for (const spec of PAGES) spec.entries = wordlistEntries(spec.src, spec.first);

const result = { baseUrl, checks: [], readings: [], failures: [] };
function check(name, ok, detail) {
  result.checks.push({ name, ok, detail });
  if (!ok) result.failures.push(`${name}: ${detail}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** 逐条量行盒：返回每条词的 top/left，以及段落总行盒数 */
const measure = ([first, entries]) => {
  const p = [...document.querySelectorAll('article.heti p')].find((el) =>
    el.textContent.trim().startsWith(first)
  );
  if (!p) return null;
  const nodes = [];
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) nodes.push(walker.currentNode);

  const rows = entries.map((entry) => {
    for (const n of nodes) {
      const i = n.data.indexOf(entry);
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + entry.length);
      const rect = r.getBoundingClientRect();
      return { entry, top: +rect.top.toFixed(1), left: +rect.left.toFixed(1), right: +rect.right.toFixed(1) };
    }
    return { entry, top: null, left: null, right: null };
  });

  const range = document.createRange();
  range.selectNodeContents(p);
  const boxes = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 0);
  const tops = [];
  for (const b of boxes) {
    if (!tops.some((t) => Math.abs(t - b.top) <= 2)) tops.push(b.top);
  }
  tops.sort((a, b) => a - b);

  return {
    paragraphsWithBr: [...document.querySelectorAll('article.heti p')].filter((el) => el.querySelector('br')).length,
    brCount: p.querySelectorAll('br').length,
    liCount: p.querySelectorAll('li').length,
    lineBoxes: tops.length,
    rows,
    text: p.textContent,
    docScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  };
};

/**
 * 等字体就绪，但自带上限：站点的 fallback 字体（Source Han Sans SC）走外链，
 * 网络慢的时候 document.fonts.ready 会一直挂着，Playwright 截图会跟着卡死。
 * 这里最多等 ms 毫秒，超时就用当前字形继续（排版断言不受影响）。
 */
async function waitFonts(page, ms = 30000) {
  const ok = await page.evaluate(
    (limit) => Promise.race([document.fonts.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), limit))]),
    ms
  );
  if (!ok) console.log(`  · 字体 ${ms}ms 内没全部就绪（外链 fallback 字体），用当前字形继续`);
}

/** 执行一段滚动代码并等滚动停稳（站内用 Lenis 平滑滚动，量坐标前必须等它停） */
async function settleScroll(page, scrollSource) {
  await page.evaluate(async (src) => {
    // eslint-disable-next-line no-new-func
    new Function(src)();
    await new Promise((resolve) => {
      let last = -1;
      let stable = 0;
      const tick = () => {
        const y = window.scrollY;
        if (Math.abs(y - last) < 0.5) {
          if (++stable >= 4) return resolve();
        } else {
          stable = 0;
        }
        last = y;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      setTimeout(resolve, 3000); // 兜底：滚动没停也往下走
    });
  }, scrollSource);
}

/** 滚到词表段落，返回裁到视口内的截图区域（Playwright 的 clip 是视口坐标） */
async function clipAroundWordlist(page, first, { padTop, padBottom }) {
  await settleScroll(
    page,
    `[...document.querySelectorAll('article.heti p')]
       .find((el) => el.textContent.trim().startsWith(${JSON.stringify(first)}))
       .scrollIntoView({ block: 'center' })`
  );
  const box = await page.evaluate((first) => {
    const p = [...document.querySelectorAll('article.heti p')].find((el) => el.textContent.trim().startsWith(first));
    const r = p.getBoundingClientRect();
    return { top: r.top, height: r.height, innerHeight: window.innerHeight, innerWidth: window.innerWidth };
  }, first);
  const y = Math.max(0, Math.min(box.top - padTop, box.innerHeight - 1));
  return {
    x: 0,
    y,
    width: box.innerWidth,
    height: Math.max(1, Math.min(box.innerHeight - y, box.height + padTop + padBottom))
  };
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const spec of PAGES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    page.setDefaultTimeout(NAV_TIMEOUT);
    await page.goto(baseUrl + spec.url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
    await waitFonts(page);

    const m = await page.evaluate(measure, [spec.first, spec.entries]);
    check(`${spec.label} 词表段落存在`, !!m, m ? '' : `找不到以「${spec.first}」开头的 <p>`);
    if (!m) {
      await page.close();
      continue;
    }

    const missing = m.rows.filter((r) => r.top === null).map((r) => r.entry);
    check(`${spec.label} 15 条词都在页面上`, missing.length === 0, missing.length ? `找不到：${missing.join(' / ')}` : '');
    const tops = m.rows.map((r) => r.top);
    const increasing = tops.every((t, i) => i === 0 || (t !== null && tops[i - 1] !== null && t > tops[i - 1]));
    check(`${spec.label} 每条词各起一行（top 严格递增）`, increasing, `tops=${tops.join(', ')}`);
    const lefts = m.rows.map((r) => r.left);
    const leftSpread = +(Math.max(...lefts) - Math.min(...lefts)).toFixed(2);
    check(`${spec.label} 词条左边缘对齐`, leftSpread <= 0.5, `最大差 ${leftSpread}px`);
    check(`${spec.label} 词表无 bullet`, m.liCount === 0, `<li> ${m.liCount} 个`);
    check(
      `${spec.label} 硬换行数 = 词条数 - 1`,
      m.brCount === spec.entries.length - 1,
      `<br> ${m.brCount} 个，词条 ${spec.entries.length} 条`
    );
    check(`${spec.label} 页面里只有词表段落带 <br>`, m.paragraphsWithBr === 1, `带 <br> 的段落 ${m.paragraphsWithBr} 个`);
    const norm = (s) => s.replace(/[\s\u00a0]+/g, ' ').trim();
    check(
      `${spec.label} 词表文字与源文件逐行一致`,
      norm(m.text) === norm(spec.entries.join(' ')),
      norm(m.text) === norm(spec.entries.join(' ')) ? '' : `页面：${norm(m.text).slice(0, 80)}…`
    );

    // —— 公众号入口：lazy 图改成 eager 强制加载，不依赖滚动位置 ——
    const wechat = await page.evaluate(async () => {
      const a = document.querySelector('.wechat-link');
      if (!a) return { present: false };
      const img = a.querySelector('img');
      if (img) {
        img.loading = 'eager';
        if (!img.complete) {
          await new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
            setTimeout(resolve, 5000);
          });
        }
      }
      const r = a.getBoundingClientRect();
      return {
        present: true,
        href: a.href,
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
        imgSrc: img ? img.getAttribute('src') : null,
        imgLoaded: img ? img.complete && img.naturalWidth > 0 : false,
        width: +r.width.toFixed(1),
        height: +r.height.toFixed(1)
      };
    });
    check(
      `${spec.label} 公众号入口${spec.expectWechat ? '存在' : '不存在'}`,
      wechat.present === spec.expectWechat,
      JSON.stringify(wechat)
    );
    if (spec.expectWechat && wechat.present) {
      check(`${spec.label} 公众号链接指向 Ray 给的地址`, wechat.href === WECHAT_URL, wechat.href);
      check(`${spec.label} 公众号图标加载成功`, wechat.imgLoaded, `src=${wechat.imgSrc}`);
      check(
        `${spec.label} 新窗口打开且带 noopener`,
        wechat.target === '_blank' && /noopener/.test(wechat.rel || ''),
        `target=${wechat.target} rel=${wechat.rel}`
      );
    }

    // —— 截图：词表区域（浅色） ——
    await page.screenshot({
      path: path.join(shotsDir, `wordlist-${spec.label}-light.png`),
      timeout: SHOT_TIMEOUT,
      clip: await clipAroundWordlist(page, spec.first, { padTop: 60, padBottom: 60 })
    });
    if (wechat.present) {
      await settleScroll(page, "document.querySelector('.wechat-link').scrollIntoView({ block: 'center' })");
      const box = await (await page.$('.wechat-link')).boundingBox();
      const pad = 30;
      const x = Math.max(0, box.x - pad);
      const y = Math.max(0, box.y - pad);
      await page.screenshot({
        path: path.join(shotsDir, 'wechat-entry-zh-light.png'),
        timeout: SHOT_TIMEOUT,
        clip: { x, y, width: Math.min(1280 - x, box.width + pad * 2), height: box.height + pad * 2 }
      });
    }

    // —— 窄屏：仍然逐行、无横向溢出 ——
    const narrow = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    narrow.setDefaultTimeout(NAV_TIMEOUT);
    await narrow.goto(baseUrl + spec.url, { waitUntil: 'load', timeout: NAV_TIMEOUT });
    await waitFonts(narrow);
    const nm = await narrow.evaluate(measure, [spec.first, spec.entries]);
    const ntops = nm.rows.map((r) => r.top);
    check(
      `${spec.label} 窄屏 390px 每条词各起一行`,
      ntops.every((t, i) => i === 0 || (t !== null && ntops[i - 1] !== null && t > ntops[i - 1])),
      `tops=${ntops.join(', ')}`
    );
    check(
      `${spec.label} 窄屏 390px 无横向溢出`,
      nm.docScrollWidth <= nm.viewportWidth,
      `scrollWidth=${nm.docScrollWidth} viewport=${nm.viewportWidth}`
    );
    await narrow.screenshot({
      path: path.join(shotsDir, `wordlist-${spec.label}-narrow.png`),
      timeout: SHOT_TIMEOUT,
      clip: await clipAroundWordlist(narrow, spec.first, { padTop: 30, padBottom: 30 })
    });

    result.readings.push({ ...spec, entries: undefined, measured: m, narrow: { lineBoxes: nm.lineBoxes, rows: nm.rows, docScrollWidth: nm.docScrollWidth }, wechat });
    await page.close();
    await narrow.close();
  }
} finally {
  await browser.close();
}

result.passed = result.failures.length === 0;
fs.writeFileSync(outJson, JSON.stringify(result, null, 2));
console.log(`\n${result.passed ? 'ALL PASS' : `FAILURES: ${result.failures.length}`} — 结果写入 ${outJson}`);
process.exit(result.passed ? 0 : 1);
