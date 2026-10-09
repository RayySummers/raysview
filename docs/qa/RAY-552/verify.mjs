/**
 * RAY-552 自测脚本：字体栈重排（Zhudou Sans → Roboto Flex Variable → MiSans）
 *
 * 用法: node verify.mjs <baseUrl> <outJson> <shotsDir>
 *   baseUrl 指向本地 dist 静态服务（如 python3 -m http.server 44552 --directory dist）
 *
 * 两套栈在同一次运行里对照（同一份 dist，只在「before」上下文里用 page.route 把
 * 构建产物 CSS 的 --font-sans 改回旧顺序）—— 除字体栈外，HTML/CSS/字体文件逐字节相同，
 * 所以任何差异都只能归因于栈序本身。
 *
 * 检查项（Chromium，走系统 Chrome）：
 *   1. 标点挤压：真实正文里的 ：“ / ，「 对宽 + 合成探针的 。》 》《 ，实测值 / 1em 的比值；
 *      并对照 before 的读数（新旧两套栈各测一遍）。
 *   2. 运行时字体（CDP CSS.getPlatformFontsForNode）：汉字 / 数字 / 西文 / 全角标点 /
 *      引号 / 书名号 / 半角标点 各自由哪个字体渲染；两套栈对照。
 *   3. 回退安定性：Zhudou 认领但无字形的 〃 〇 ～ 在两套栈下最终渲染字体一致。
 *   4. 视觉扫页：首页 / 列表 / CN 文章 / EN 文章 / 关于页 × 浅深两色，
 *      逐页 before↔after 像素 diff（除 《》 类字形外不应有变化）。
 *   5. 控制台无 error。
 *
 * 口径与 docs/qa/RAY-531 / RAY-545 / RAY-549 一致：1280×900、deviceScaleFactor 2。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [baseUrl, outJson, shotsDir] = process.argv.slice(2);
if (!baseUrl || !outJson || !shotsDir) {
  console.error('usage: node verify.mjs <baseUrl> <outJson> <shotsDir>');
  process.exit(2);
}
fs.mkdirSync(shotsDir, { recursive: true });

const CHROME = '/usr/bin/google-chrome';

// 构建产物里的声明（build 不做属性值压缩，保留引号与空格）
const NEW_DECL = '--font-sans: "Zhudou Sans", "Roboto Flex Variable", "MiSans"';
const OLD_DECL = '--font-sans: "MiSans", "Zhudou Sans", "Roboto Flex Variable"';

const ZH_ARTICLE = `${baseUrl}/posts/justthinking/justthinking-04-metro-volunteer/`;
const ZH_ARTICLE_2 = `${baseUrl}/posts/justthinking/justthinking-02-token-ciyuan/`;
const EN_ARTICLE = `${baseUrl}/en/posts/justthinking/justthinking-04-metro-volunteer/`;

const PAGES = [
  { key: 'home', url: `${baseUrl}/` },
  { key: 'list', url: `${baseUrl}/posts/` },
  { key: 'article-zh', url: ZH_ARTICLE },
  { key: 'article-en', url: EN_ARTICLE },
  { key: 'about', url: `${baseUrl}/about/` }
];

const result = {
  baseUrl,
  generatedAt: new Date().toISOString(),
  states: { after: {}, before: {} },
  failures: []
};

function check(scope, name, ok, detail) {
  const bucket = scope.split('/')[0];
  const entry = { scope, name, ok, detail };
  (result.checks ||= []).push(entry);
  if (!ok) result.failures.push(`${scope} :: ${name}: ${JSON.stringify(detail)}`);
  void bucket;
}

/* ---------- 页面工厂：after = 原样；before = 把 --font-sans 改回旧顺序 ---------- */
async function makePage(browser, state, { dark = false, dsf = 2 } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: dsf,
    colorScheme: dark ? 'dark' : 'light',
    reducedMotion: 'reduce' // 关掉进场动画/平滑滚动，让 before↔after diff 只剩字体差异
  });
  const page = await context.newPage();
  // 顶栏时钟每秒把冒号在 ":" 与 " " 之间闪一次（Header.astro 的 updateClock）——
  // 两次截图差几秒就会凭空多出十几个差异像素。把 Date 的时分秒钉死，diff 里只剩字体差异。
  await context.addInitScript(() => {
    Date.prototype.getHours = function () { return 0; };
    Date.prototype.getMinutes = function () { return 0; };
    Date.prototype.getSeconds = function () { return 0; };
  });
  const consoleErrors = [];
  page.on('console', m => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', e => consoleErrors.push(`pageerror: ${e.message}`));

  if (state === 'before') {
    // 只拦本站构建产物 CSS：CDN 的 heti.min.css 等外部样式不能碰（也不能改写）
    await page.route(`${baseUrl}/**/*.css`, async route => {
      const response = await route.fetch();
      let body = await response.text();
      if (!body.includes(NEW_DECL)) {
        throw new Error('before 上下文：CSS 里找不到新的 --font-sans 声明，无法改回旧顺序');
      }
      body = body.replace(NEW_DECL, OLD_DECL);
      const headers = { ...response.headers() };
      delete headers['content-length'];
      delete headers['content-encoding'];
      await route.fulfill({ status: 200, headers, body });
    });
  }

  return { context, page, consoleErrors };
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => document.fonts.ready);
  // 触发懒加载后再回到顶部，保证整页都渲染过
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 30));
    }
    window.scrollTo(0, 0);
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

/* ---------- 1. 标点挤压：量真实文本里的字符对宽度 ---------- */
const PAIR_READING = ({ anchor, needle, refChar }) => {
  const root = document.querySelector('article.heti');
  if (!root) return { error: 'article.heti not found' };
  const findIn = ch => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const i = walker.currentNode.nodeValue.indexOf(ch);
      if (i >= 0) return { node: walker.currentNode, idx: i };
    }
    return null;
  };
  const hit = findIn(needle);
  if (!hit) return { error: `text "${needle}" not found`, anchor };
  const { node, idx } = hit;
  const rects = n => {
    const r = document.createRange();
    r.setStart(node, idx);
    r.setEnd(node, idx + n);
    return [...r.getClientRects()];
  };
  const pairRects = rects(needle.length);
  // 1em 参照：正文里任意一个汉字（单独查，不要求和 needle 同文本节点）
  const emHit = findIn(refChar);
  let em = null;
  if (emHit) {
    const r = document.createRange();
    r.setStart(emHit.node, emHit.idx);
    r.setEnd(emHit.node, emHit.idx + 1);
    const rectsEm = [...r.getClientRects()];
    if (rectsEm.length === 1) em = rectsEm[0].width;
  }
  const cs = getComputedStyle(node.parentElement);
  const pairW = pairRects.length === 1 ? pairRects[0].width : null;
  return {
    anchor,
    needle,
    pairWidth: pairW === null ? null : +pairW.toFixed(3),
    rects: pairRects.length,
    em: em === null ? null : +em.toFixed(3),
    ratio: pairW !== null && em ? +(pairW / em).toFixed(3) : null,
    fontSize: cs.fontSize,
    fontFamily: cs.fontFamily.slice(0, 60)
  };
};

/* 合成探针：内容里没有 。》 》《 这类组合时，用与正文同栈同字号的 span 量。
   styleFrom 可选：取某个元素的 computed style 作为探针样式（如 620 标题）。 */
const PROBE_READING = ({ pairs, refChar, styleFrom }) => {
  const host = document.querySelector('article.heti') || document.body;
  const styleSrc = styleFrom ? (document.querySelector(styleFrom) || host) : host;
  const cs = getComputedStyle(styleSrc);
  const box = document.createElement('div');
  box.id = 'ray552-probe-box';
  box.style.cssText = `font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};` +
    `letter-spacing:${cs.letterSpacing};font-feature-settings:${cs.fontFeatureSettings};` +
    'position:absolute;left:-99999px;top:0;white-space:nowrap;';
  host.appendChild(box); // 必须先入文档，否则 range 量到的全是 0
  const width = text => {
    const span = document.createElement('span');
    span.textContent = text;
    box.appendChild(span);
    const r = document.createRange();
    r.selectNodeContents(span);
    const rects = [...r.getClientRects()];
    return rects.length === 1 ? +rects[0].width.toFixed(3) : null;
  };
  const em = width(refChar);
  const res = {
    styleFrom: styleFrom || 'article.heti',
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    em,
    pairs: {}
  };
  for (const p of pairs) {
    const w = width(p);
    res.pairs[p] = { width: w, ratio: w !== null && em ? +(w / em).toFixed(3) : null };
  }
  return res;
};

/* ---------- 2. 运行时字体：CDP 平台字体查询 ---------- */
const PROBES = [
  { id: 'han', text: '乘', note: '汉字' },
  { id: 'han2', text: '这', note: '汉字(第二样本)' },
  { id: 'digit', text: '2', note: '数字' },
  { id: 'latin', text: 'R', note: '西文' },
  { id: 'fw-colon', text: '：', note: '全角冒号' },
  { id: 'fw-semi', text: '；', note: '全角分号' },
  { id: 'quote-open', text: '“', note: '左双引号' },
  { id: 'bookmark', text: '《', note: '书名号' },
  { id: 'ideographic-period', text: '。', note: '句号' },
  { id: 'corner-bracket', text: '「', note: '直角引号' },
  { id: 'hw-comma', text: ',', note: '半角逗号' },
  { id: 'hw-period', text: '.', note: '半角句点' },
  { id: 'no-glyph-3003', text: '〃', note: '煮豆认领但疑似无字形（U+3003）' },
  { id: 'no-glyph-3007', text: '〇', note: '煮豆认领但疑似无字形（U+3007）' },
  { id: 'no-glyph-ff5e', text: '～', note: '煮豆认领但疑似无字形（U+FF5E）' }
];

const injectProbes = probes => {
  const host = document.querySelector('article.heti') || document.body;
  const box = document.createElement('div');
  box.id = 'ray552-font-probes';
  box.style.cssText = 'position:absolute;left:-99999px;top:0;white-space:nowrap;';
  for (const p of probes) {
    const s = document.createElement('span');
    s.dataset.probe = p.id;
    s.textContent = p.text;
    box.appendChild(s);
  }
  host.appendChild(box);
};

async function platformFonts(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const out = {};
  for (const p of PROBES) {
    const { nodeId } = await cdp.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: `[data-probe="${p.id}"]`
    });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    out[p.id] = {
      text: p.text,
      note: p.note,
      renderedBy: fonts.map(f => ({ family: f.familyName, glyphs: f.glyphCount, custom: f.isCustomFont }))
    };
  }
  await cdp.detach();
  return out;
}

/* ---------- 4. 像素 diff ---------- */
async function writeDiffImage(aPath, bPath, outPath) {
  const a = await sharp(aPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(bPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = a.info;
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) return;
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < a.data.length; i += channels) {
    const d = Math.max(
      Math.abs(a.data[i] - b.data[i]),
      Math.abs(a.data[i + 1] - b.data[i + 1]),
      Math.abs(a.data[i + 2] - b.data[i + 2])
    );
    const o = (i / channels) * 4;
    if (d > 8) {
      out[o] = 255; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 255;
    } else {
      out[o] = 245; out[o + 1] = 245; out[o + 2] = 245; out[o + 3] = 255;
    }
  }
  await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(outPath);
}

async function pixelDiff(aPath, bPath) {
  const a = sharp(aPath).ensureAlpha();
  const b = sharp(bPath).ensureAlpha();
  const [am, bm] = await Promise.all([a.metadata(), b.metadata()]);
  if (am.width !== bm.width || am.height !== bm.height) {
    return { sizeMismatch: true, a: `${am.width}x${am.height}`, b: `${bm.width}x${bm.height}` };
  }
  const [ar, br] = await Promise.all([
    a.raw().toBuffer(),
    b.raw().toBuffer()
  ]);
  let diff = 0;
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  const TH = 8; // 单通道差 > 8 才算不同，滤掉抗锯齿噪声
  for (let i = 0; i < ar.length; i += 4) {
    const d = Math.max(
      Math.abs(ar[i] - br[i]),
      Math.abs(ar[i + 1] - br[i + 1]),
      Math.abs(ar[i + 2] - br[i + 2])
    );
    if (d > TH) {
      diff++;
      const px = (i / 4) % am.width;
      const py = Math.floor(i / 4 / am.width);
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }
  const total = am.width * am.height;
  return {
    width: am.width,
    height: am.height,
    diffPixels: diff,
    diffRatio: +(diff / total).toFixed(6),
    bbox: diff ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null
  };
}

/* ---------- 主流程 ---------- */
const browser = await chromium.launch({
  executablePath: CHROME,
  // 本机 Chrome 不走环境变量代理，CDN 字体（Geist / Source Han Sans / JetBrains Mono）会 TLS 失败 ——
  // 显式给浏览器挂上同一个代理，本地静态服务走 bypass。这样字体加载与线上一致。
  proxy: {
    server: process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:7890',
    bypass: '127.0.0.1,localhost,::1'
  },
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
});

try {
  /* ===== A. 逐状态读数（after / before）===== */
  for (const state of ['after', 'before']) {
    const { context, page, consoleErrors } = await makePage(browser, state, { dark: false, dsf: 2 });
    const st = result.states[state];

    await page.goto(ZH_ARTICLE, { waitUntil: 'load' });
    await settle(page);

    st.fontSansComputed = await page.evaluate(() => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--font-sans');
      return v.trim().replace(/\s+/g, ' ');
    });

    st.pairsReal = await page.evaluate(PAIR_READING, { anchor: 'JT#04', needle: '：“', refChar: '问' });

    await page.goto(ZH_ARTICLE_2, { waitUntil: 'load' });
    await settle(page);
    st.pairsReal2 = await page.evaluate(PAIR_READING, { anchor: 'JT#02', needle: '，「', refChar: '的' });

    await page.goto(ZH_ARTICLE, { waitUntil: 'load' });
    await settle(page);
    st.probePairs = await page.evaluate(PROBE_READING, {
      pairs: ['。》', '》《', '：“', '，「', '。。'],
      refChar: '问'
    });
    // 620 标题里的表现（issue 要求「正文与 620 标题」都看）
    st.probePairsTitle = await page.evaluate(PROBE_READING, {
      pairs: ['《》', '：“', '。》'],
      refChar: '乘',
      styleFrom: 'h1.post-title'
    });

    await page.evaluate(injectProbes, PROBES);
    await page.waitForTimeout(120);
    st.platformFonts = await platformFonts(page);

    st.consoleErrors = consoleErrors;
    // 纯传输层抖动（代理换出口时的 ERR_NETWORK_CHANGED 之类）不算页面问题；
    // 「字体到底有没有加载成功」由下面 fontsLoaded 单独断言，比看 console 更直接。
    const realErrors = consoleErrors.filter(
      m => !/Failed to load resource: net::ERR_(NETWORK_CHANGED|INTERNET_DISCONNECTED|CONNECTION_(RESET|CLOSED|REFUSED|TIMED_OUT|ABORTED))/.test(m)
    );
    st.consoleErrorsReal = realErrors;
    check(state, 'console 无 error（已滤掉纯传输层抖动）', realErrors.length === 0,
      { real: realErrors, raw: consoleErrors });

    // 字体文件是否真的加载（CDN 断了会让所有读数失去意义）
    st.fontsLoaded = await page.evaluate(() =>
      [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.weight}`)
    );
    const needFamilies = ['Zhudou Sans', 'MiSans', 'Roboto Flex Variable', 'Geist Sans', 'Source Han Sans SC'];
    const missing = needFamilies.filter(f => !st.fontsLoaded.some(l => l.startsWith(f + ' ')));
    check(state, '五个必需字体族全部加载完成', missing.length === 0, { missing, loaded: st.fontsLoaded });

    await context.close();
  }

  /* ===== B. 断言：新栈 = 标点归煮豆 + 挤压生效；旧栈 = 对照 ===== */
  const A = result.states.after;
  const B = result.states.before;

  check('after', '--font-sans 顺序 = Zhudou → Roboto → MiSans',
    /^"Zhudou Sans", "Roboto Flex Variable", "MiSans"/.test(A.fontSansComputed),
    A.fontSansComputed);
  check('before', '--font-sans 顺序 = MiSans → Zhudou → Roboto（对照）',
    /^"MiSans", "Zhudou Sans", "Roboto Flex Variable"/.test(B.fontSansComputed),
    B.fontSansComputed);

  // 挤压：真实正文 + 合成探针 + 620 标题
  const squeezeCases = [
    ['：“ (JT#04 真实正文)', A.pairsReal.ratio, B.pairsReal.ratio, 1.5],
    ['，「 (JT#02 真实正文)', A.pairsReal2.ratio, B.pairsReal2.ratio, 1.5],
    ['。》 (正文合成探针)', A.probePairs.pairs['。》'].ratio, B.probePairs.pairs['。》'].ratio, 1.5],
    ['》《 (正文合成探针)', A.probePairs.pairs['》《'].ratio, B.probePairs.pairs['》《'].ratio, 1.0],
    ['：“ (正文合成探针)', A.probePairs.pairs['：“'].ratio, B.probePairs.pairs['：“'].ratio, 1.5],
    ['：“ (620 标题探针)', A.probePairsTitle.pairs['：“'].ratio, B.probePairsTitle.pairs['：“'].ratio, 1.5]
  ];
  for (const [label, afterRatio, beforeRatio, expect] of squeezeCases) {
    check('after', `挤压 ${label} ≈ ${expect}em`, afterRatio !== null && Math.abs(afterRatio - expect) <= 0.06,
      { ratio: afterRatio, expect, before: beforeRatio });
  }

  // 旧栈下这三项必须「不压」（复现报障）—— 证明 before 上下文确实跑在旧栈上
  for (const [label, beforeRatio, expect] of [
    ['：“ (JT#04 真实正文)', B.pairsReal.ratio, 2.0],
    ['。》 (正文合成探针)', B.probePairs.pairs['。》'].ratio, 2.0]
  ]) {
    check('before', `旧栈对照 ${label} = ${expect}em（挤压失效）`,
      beforeRatio !== null && Math.abs(beforeRatio - expect) <= 0.06,
      { ratio: beforeRatio, expect });
  }

  // 运行时字体四类抽查（CDP 报的是字体内部名：煮豆黑體 = Zhudou Sans）
  const fam = (st, id) => st.platformFonts[id].renderedBy.map(f => f.family).join('+');
  const fontCases = [
    ['汉字 → MiSans', 'han', /MiSans/],
    ['汉字(第二样本) → MiSans', 'han2', /MiSans/],
    ['数字 → Roboto Flex Variable', 'digit', /Roboto Flex/],
    ['西文 → Roboto Flex Variable', 'latin', /Roboto Flex/],
    ['全角冒号 → Zhudou Sans', 'fw-colon', /Zhudou|煮豆/],
    ['全角分号 → Zhudou Sans', 'fw-semi', /Zhudou|煮豆/],
    ['左双引号 → Zhudou Sans', 'quote-open', /Zhudou|煮豆/],
    ['书名号 → Zhudou Sans', 'bookmark', /Zhudou|煮豆/],
    ['句号 → Zhudou Sans', 'ideographic-period', /Zhudou|煮豆/],
    ['直角引号 → Zhudou Sans', 'corner-bracket', /Zhudou|煮豆/],
    ['半角逗号 → Roboto Flex Variable', 'hw-comma', /Roboto Flex/],
    ['半角句点 → Roboto Flex Variable', 'hw-period', /Roboto Flex/]
  ];
  for (const [label, id, re] of fontCases) {
    check('after', `运行时字体 ${label}`, re.test(fam(A, id)), { after: fam(A, id), before: fam(B, id) });
  }

  // 回退安定性：煮豆认领但无字形的字符，两套栈最终字体必须一致
  for (const id of ['no-glyph-3003', 'no-glyph-3007', 'no-glyph-ff5e']) {
    check('after', `回退安定性 ${A.platformFonts[id].text} 两套栈一致`,
      fam(A, id) === fam(B, id), { after: fam(A, id), before: fam(B, id) });
  }

  // 旧栈下 ：；《》 应仍由 MiSans 渲染（这正是报障根因）
  for (const id of ['fw-colon', 'fw-semi', 'bookmark']) {
    check('before', `旧栈根因复现：${B.platformFonts[id].text} 由 MiSans 认领（挤压失效）`,
      /MiSans/.test(fam(B, id)) && !/Zhudou|煮豆/.test(fam(B, id)),
      fam(B, id));
  }

  /* ===== C. 视觉扫页 + before↔after 像素 diff ===== */
  // 几何读数：栈序只该换字形，不该动布局。header/main/footer 的位置与宽度必须逐像素一致。
  const GEOM = () => {
    const pick = sel => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: +r.x.toFixed(1), w: +r.width.toFixed(1) };
    };
    return {
      scrollHeight: document.documentElement.scrollHeight,
      header: pick('header'),
      main: pick('main'),
      footer: pick('footer'),
      article: pick('article.heti')
    };
  };

  const sweep = [];
  for (const p of PAGES) {
    for (const theme of ['light', 'dark']) {
      const shots = {};
      const geom = {};
      for (const state of ['after', 'before']) {
        const { context, page } = await makePage(browser, state, { dark: theme === 'dark', dsf: 1 });
        await page.goto(p.url, { waitUntil: 'load' });
        await settle(page);
        geom[state] = await page.evaluate(GEOM);
        const file = path.join(shotsDir, `${p.key}-${theme}-${state}.png`);
        await page.screenshot({ path: file, fullPage: true });
        shots[state] = file;
        await context.close();
      }
      const diff = await pixelDiff(shots.before, shots.after);
      const diffFile = path.join(shotsDir, `DIFF-${p.key}-${theme}.png`);
      if (!diff.sizeMismatch && diff.diffPixels > 0) await writeDiffImage(shots.before, shots.after, diffFile);
      sweep.push({ page: p.key, theme, ...diff, diffFile: diff.diffPixels ? diffFile : null, geom, files: shots });

      // 尺寸不一致 = 页面高度变了；几何不一致 = 布局被字体栈带跑了
      check('sweep', `页面尺寸未变 ${p.key} · ${theme}`, !diff.sizeMismatch,
        { before: geom.before.scrollHeight, after: geom.after.scrollHeight, sizeMismatch: !!diff.sizeMismatch });
      const sameBox = k => JSON.stringify(geom.after[k]) === JSON.stringify(geom.before[k]);
      check('sweep', `布局几何未变 ${p.key} · ${theme}（header/main/footer）`,
        sameBox('header') && sameBox('main') && sameBox('footer'),
        { header: [geom.before.header, geom.after.header], main: [geom.before.main, geom.after.main], footer: [geom.before.footer, geom.after.footer] });
      // 差异上限只作「没炸」的兜底；逐字差异的合理性看 DIFF-*.png
      check('sweep', `视觉 diff ${p.key} · ${theme} 在合理范围`,
        !diff.sizeMismatch && diff.diffRatio < 0.03,
        { diffRatio: diff.diffRatio, diffPixels: diff.diffPixels, bbox: diff.bbox });
    }
  }
  result.sweep = sweep;

  /* ===== D. 文章正文特写（DPR 2，浅深各一张）===== */
  for (const theme of ['light', 'dark']) {
    for (const state of ['after', 'before']) {
      const { context, page } = await makePage(browser, state, { dark: theme === 'dark', dsf: 2 });
      await page.goto(ZH_ARTICLE, { waitUntil: 'load' });
      await settle(page);
      const para = page.locator('article.heti p', { hasText: '还有乘客问' }).first();
      await para.screenshot({
        path: path.join(shotsDir, `article-paragraph-${theme}-${state}.png`)
      });
      await context.close();
    }
  }
} catch (err) {
  result.failures.push(`脚本异常: ${err.message}`);
  result.fatal = err.stack;
} finally {
  await browser.close();
}

fs.writeFileSync(outJson, JSON.stringify(result, null, 2));
console.log(`checks: ${(result.checks || []).length}, failures: ${result.failures.length}`);
for (const f of result.failures) console.log(`  FAIL ${f}`);
process.exit(result.failures.length ? 1 : 0);
