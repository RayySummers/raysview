/**
 * RAY-609 自测脚本：中文正文断行（text-wrap: pretty / balance ＋ word-break: auto-phrase）
 *
 * 用法: node docs/qa/RAY-609/verify.mjs <baseUrl> <shotsDir> <outJson>
 *   baseUrl 指向本地 dist 静态服务（如 python3 -m http.server 44488 --directory dist）
 *
 * 做四件事：
 *   1. 三档宽度（1440 / 768 / 390）截同一篇长文页面（页头 + 正文前 1600px），存进 shotsDir；
 *      选 justthinking-04：正文无站外图片，截图不会被图床拖慢/拖挂；
 *   2. 同一页面在「新规则生效 / 用 !important 中和掉新规则」两种状态下逐段量行数与末行字数，
 *      给出孤字段数、末行填充率 —— 断行效果有数字支撑；
 *   3. 用 biweekly-26.05-a（有 h1/h2 长标题）在 390 宽度量多行标题的行数与末行填充率；
 *   4. 控制实验：同一引擎下用英文段落/标题验证 pretty、balance 本身是生效的
 *      （中文目前量不出差别，要能区分「规则没生效」和「引擎不支持 CJK 优化」）。
 *
 * 量法：把元素文本按字符拆 Range，按 rect.top 归组得到视觉行；
 * 末行字数 = 最后一行里的字符数（含标点）。只统计 ≥2 行的正文段落；
 * AI 声明折叠区、脚注、blockquote 不计入正文。
 */
import { chromium, firefox } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [baseUrl, shotsDir, outJson] = process.argv.slice(2);
if (!baseUrl || !shotsDir || !outJson) {
  console.error('usage: node verify.mjs <baseUrl> <shotsDir> <outJson>');
  process.exit(2);
}
fs.mkdirSync(shotsDir, { recursive: true });

const CHROME = '/usr/bin/google-chrome';
const ZH_SHOT = '/posts/justthinking/justthinking-04-metro-volunteer/'; // 无站外图，49 段
const ZH_HEAD = '/posts/biweekly/biweekly-2605-a/'; // 最长的一篇，含 h1/h2 长标题
const WIDTHS = [
  { name: '1440', width: 1440, height: 1600, dpr: 1 },
  { name: '768', width: 768, height: 1600, dpr: 1 },
  { name: '390', width: 390, height: 1600, dpr: 2 },
];

// 中和新规则：只覆盖 RAY-609 新增的三条声明，其余样式不动
const OFF_CSS = `
  article.heti p { text-wrap: wrap !important; }
  article.heti h1, article.heti h2, article.heti h3 { text-wrap: wrap !important; }
  @supports (word-break: auto-phrase) {
    article.heti p:lang(zh), article.heti li:lang(zh) { word-break: normal !important; }
  }
`;

const MEASURE = (wantHeadings) => {
  const art = document.querySelector('article.heti');
  if (!art) return null;

  const isBody = el =>
    !el.closest('.ai-disclosure') && !el.closest('.footnotes') && !el.closest('blockquote');

  const lineBoxes = el => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const lines = [];
    let node;
    while ((node = walker.nextNode())) {
      for (let i = 0; i < node.length; i++) {
        if (/\s/.test(node.textContent[i])) continue;
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + 1);
        const rect = r.getClientRects()[0];
        if (!rect || rect.width === 0) continue;
        const top = Math.round(rect.top * 2) / 2;
        const last = lines[lines.length - 1];
        if (last && Math.abs(last.top - top) < 1) {
          last.chars++;
          last.left = Math.min(last.left, rect.left);
          last.right = Math.max(last.right, rect.right);
        } else {
          lines.push({ top, chars: 1, left: rect.left, right: rect.right });
        }
      }
    }
    return lines;
  };

  const paras = [...art.querySelectorAll('p')].filter(isBody);
  const artRect = art.getBoundingClientRect();

  const paraStats = paras
    .map((p, i) => {
      const lines = lineBoxes(p);
      if (lines.length < 2) return null;
      const last = lines[lines.length - 1];
      return {
        i,
        text: p.textContent.trim().slice(0, 20),
        lines: lines.length,
        lastChars: last.chars,
        lastFill: +((last.right - last.left) / p.clientWidth).toFixed(3),
      };
    })
    .filter(Boolean);

  const headStats = wantHeadings
    ? [...art.querySelectorAll('h1, h2, h3')]
        .map(h => {
          const lines = lineBoxes(h);
          if (lines.length < 2) return null;
          const last = lines[lines.length - 1];
          return {
            tag: h.tagName.toLowerCase(),
            text: h.textContent.trim().slice(0, 24),
            lines: lines.length,
            lastChars: last.chars,
            lastFill: +((last.right - last.left) / h.clientWidth).toFixed(3),
            width: +h.getBoundingClientRect().width.toFixed(1),
          };
        })
        .filter(Boolean)
    : [];

  const firstP = paras[0];
  const firstHead = art.querySelector('h1, h2, h3');
  return {
    articleHeight: +artRect.height.toFixed(1),
    articleWidth: +artRect.width.toFixed(1),
    paragraphs: paraStats.length,
    orphan1: paraStats.filter(s => s.lastChars === 1).length,
    orphan2: paraStats.filter(s => s.lastChars <= 2).length,
    orphan3: paraStats.filter(s => s.lastChars <= 3).length,
    meanFill: paraStats.length
      ? +(paraStats.reduce((a, s) => a + s.lastFill, 0) / paraStats.length).toFixed(3)
      : null,
    multiLineHeadings: headStats,
    font: firstP ? `${getComputedStyle(firstP).fontSize} / ${getComputedStyle(firstP).fontFamily.split(',')[0]}` : null,
    computed: {
      pWrap: firstP ? getComputedStyle(firstP).textWrap : null,
      pWordBreak: firstP ? getComputedStyle(firstP).wordBreak : null,
      pLineBreak: firstP ? getComputedStyle(firstP).lineBreak : null,
      hWrap: firstHead ? getComputedStyle(firstHead).textWrap : null,
    },
  };
};

// 控制实验：同一引擎下 pretty / balance 是否真的会改变断行。
// 中文正文目前量不出差别，靠这组对照区分「规则没生效」和「引擎不支持 CJK 优化」。
const CONTROLS = () => {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:300px;font:18px/1.6 system-ui;';
  document.body.append(host);

  const lines = el => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const out = [];
    let n;
    while ((n = w.nextNode())) {
      for (let i = 0; i < n.length; i++) {
        if (/\s/.test(n.textContent[i])) continue;
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + 1);
        const rect = r.getClientRects()[0];
        if (!rect) continue;
        const top = Math.round(rect.top);
        const last = out[out.length - 1];
        if (last && Math.abs(last.top - top) < 1) {
          last.chars++;
          last.right = Math.max(last.right, rect.right);
          last.left = Math.min(last.left, rect.left);
        } else out.push({ top, chars: 1, left: rect.left, right: rect.right });
      }
    }
    return out;
  };

  const measure = (el, prop, value, text) => {
    el.textContent = text;
    el.style[prop] = value;
    const ls = lines(el);
    return {
      value,
      lineChars: ls.map(l => l.chars),
      fills: ls.map(l => +((l.right - l.left) / el.clientWidth).toFixed(2)),
    };
  };

  // 段落对照：pretty 只在「末行只剩一个词」时才回退调整断点。
  // 逐个前缀长度试一遍，挑出 normal 末行字数很少的样本，再看 pretty 是否把它修好。
  const para = document.createElement('p');
  para.style.margin = '0 0 24px';
  host.append(para);
  const words =
    'A good interface survives translation because its layout does not depend on any single language and its copy leaves room for the words that will arrive later on'.split(
      ' ',
    );
  const paragraphSamples = [];
  for (let take = words.length; take >= 8; take -= 1) {
    const text = words.slice(0, take).join(' ');
    paragraphSamples.push({
      words: take,
      normal: measure(para, 'textWrap', 'wrap', text),
      pretty: measure(para, 'textWrap', 'pretty', text),
    });
  }
  const narrowLastLine = paragraphSamples.filter(s => s.normal.lineChars.at(-1) <= 12);
  const changed = narrowLastLine.filter(
    s => s.normal.lineChars.join() !== s.pretty.lineChars.join(),
  ).length;
  const paragraph = { samples: paragraphSamples.length, narrowLastLine, changed };

  const headings = [
    ['en', 'Build Interfaces That Survive Translation And Still Read Well Everywhere'],
    ['zh', '薄荷是牙膏味的：一个关于颜色与语义的长期困惑'],
  ].map(([lang, text]) => {
    const h = document.createElement('h2');
    h.lang = lang;
    h.style.cssText = 'font:520 24px/1.3 system-ui;margin:0 0 8px';
    host.append(h);
    return {
      lang,
      text,
      normal: measure(h, 'textWrap', 'wrap', text),
      balance: measure(h, 'textWrap', 'balance', text),
    };
  });

  host.remove();
  return { paragraph, headings };
};

const result = { baseUrl, chrome: CHROME, widths: {}, headings390: null, controls: null, failures: [], imageWarnings: [] };

const t0 = Date.now();
const log = (...a) => console.error(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const vp of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      locale: 'zh-CN',
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/Failed to load resource|ERR_NETWORK_CHANGED|net::ERR/.test(t)) result.imageWarnings.push(`${vp.name}: ${t}`);
      else errors.push(t);
    });

    await page.goto(`${baseUrl}${ZH_SHOT}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);

    log(vp.name, 'loaded');
    const on = await page.evaluate(MEASURE, false);
    log(vp.name, 'measured on');

    // 视口高度就是 1600：直接截视口，不做 fullPage（长文 fullPage 会截整页再裁，慢且吃内存）
    const shotPath = path.join(shotsDir, `zh-${vp.name}.png`);
    await page.screenshot({ path: shotPath });
    log(vp.name, 'shot');

    await page.addStyleTag({ content: OFF_CSS });
    await page.waitForTimeout(300);
    const off = await page.evaluate(MEASURE, false);
    log(vp.name, 'measured off');

    result.widths[vp.name] = {
      viewport: vp,
      on,
      off,
      shot: { path: shotPath, bytes: fs.statSync(shotPath).size },
      consoleErrors: errors,
    };

    if (on.orphan2 > off.orphan2) result.failures.push(`${vp.name}: 孤字段变多（${off.orphan2} → ${on.orphan2}）`);
    if (on.meanFill + 0.01 < off.meanFill) result.failures.push(`${vp.name}: 末行填充率下降（${off.meanFill} → ${on.meanFill}）`);
    if (on.computed.pWrap !== 'pretty') result.failures.push(`${vp.name}: 正文段落 computed text-wrap 不是 pretty（${on.computed.pWrap}）`);
    if (errors.length) result.failures.push(`${vp.name}: 控制台有非资源类 error：${errors[0]}`);
    await ctx.close();
  }

  // 390 宽的长标题（biweekly）：balance 前后的行数 / 末行填充率
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 1600 }, deviceScaleFactor: 2, locale: 'zh-CN' });
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}${ZH_HEAD}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    log('headings', 'loaded');
    const on = await page.evaluate(MEASURE, true);
    log('headings measured on');
    await page.addStyleTag({ content: OFF_CSS });
    await page.waitForTimeout(300);
    const off = await page.evaluate(MEASURE, true);
    log('headings measured off');
    result.headings390 = { on: on.multiLineHeadings, off: off.multiLineHeadings, computed: on.computed };
    if (on.computed.hWrap !== 'balance') result.failures.push(`标题 computed text-wrap 不是 balance（${on.computed.hWrap}）`);
    await ctx.close();
  }

  // 特性检测 + 控制实验
  {
    const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 }, locale: 'zh-CN' });
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}${ZH_SHOT}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    result.featureSupport = await page.evaluate(() => ({
      lineBreakAutoPhrase: CSS.supports('line-break', 'auto-phrase'),
      wordBreakAutoPhrase: CSS.supports('word-break', 'auto-phrase'),
      textWrapPretty: CSS.supports('text-wrap', 'pretty'),
      textWrapBalance: CSS.supports('text-wrap', 'balance'),
    }));
    log('support done');
    result.controls = await page.evaluate(CONTROLS);
    log('controls done');
    await ctx.close();
  }
} finally {
  await browser.close();
}

// Firefox：不支持 pretty / auto-phrase，验证「不支持时保持原样」
if (process.env.RAY609_FF === '1') try {
  let ff;
  ff = await firefox.launch({ headless: true });
  const fp = await ff.newPage({ viewport: { width: 768, height: 1024 } });
  await fp.goto(`${baseUrl}${ZH_SHOT}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await fp.waitForSelector('article.heti p', { timeout: 15000 });
  result.firefox = await fp.evaluate(() => {
    const p = document.querySelector('article.heti p');
    const h = document.querySelector('article.heti h3');
    return {
      version: navigator.userAgent.match(/Firefox\/[\d.]+/)?.[0],
      lineBreakAutoPhrase: CSS.supports('line-break', 'auto-phrase'),
      wordBreakAutoPhrase: CSS.supports('word-break', 'auto-phrase'),
      textWrapPretty: CSS.supports('text-wrap', 'pretty'),
      pWrap: getComputedStyle(p).textWrap,
      pWordBreak: getComputedStyle(p).wordBreak,
      hWrap: h ? getComputedStyle(h).textWrap : null,
      articleHeight: +document.querySelector('article.heti').getBoundingClientRect().height.toFixed(1),
    };
  });
} catch (e) {
  result.firefox = { error: e.message.slice(0, 200) };
} finally {
  if (typeof ff !== 'undefined') await ff.close().catch(() => {});
}

fs.writeFileSync(outJson, JSON.stringify(result, null, 2));

const brief = {
  failures: result.failures,
  featureSupport: result.featureSupport,
  controls: result.controls,
  firefox: result.firefox,
  imageWarnings: result.imageWarnings.length,
  widths: Object.fromEntries(
    Object.entries(result.widths).map(([w, v]) => [w, {
      artWidth: v.on.articleWidth,
      artHeight: { on: v.on.articleHeight, off: v.off.articleHeight },
      paragraphs: v.on.paragraphs,
      orphan1: { on: v.on.orphan1, off: v.off.orphan1 },
      orphan2: { on: v.on.orphan2, off: v.off.orphan2 },
      orphan3: { on: v.on.orphan2, off: v.off.orphan2 },
      meanFill: { on: v.on.meanFill, off: v.off.meanFill },
      computed: v.on.computed,
      shotKB: Math.round(v.shot.bytes / 1024),
      consoleErrors: v.consoleErrors,
    }])
  ),
  headings390: result.headings390,
};
console.log(JSON.stringify(brief, null, 2));
process.exit(result.failures.length ? 1 : 0);
