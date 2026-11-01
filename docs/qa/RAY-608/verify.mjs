/**
 * RAY-608 自测脚本：3G 节流下图片 blur-up 懒加载的实测。
 *
 * 用法（与 docs/qa/RAY-557 / RAY-549 一致）：
 *   node verify.mjs <baseUrl> <outJson> <shotsDir> [label] [preset]
 *
 *   例：node verify.mjs http://127.0.0.1:46081 readings-before.json shots before fast3g
 *   需要 playwright：仓库不把它写进依赖（与 docs/qa 其它脚本一致），本机 `npm i -g playwright`
 *   或 `npm link playwright` 后即可运行。
 *
 * 口径：
 *   - Chromium（系统 Chrome），视口 390×844（移动端）、DPR 1、缓存关闭；
 *   - 网络走 CDP `Network.emulateNetworkConditions`，默认 Chrome DevTools 的「Fast 3G」
 *     预设（1.6 Mbps / 150 ms RTT），可用 preset 切 slow3g（500 kbps / 400 ms）；
 *   - 图片拦截时顺带抓一次原图（每个 URL 只抓一次），抓不到就退回 1×1 占位图并在结果里记一笔；
 *   - **所有图片请求统一延迟 2s 再返回**：本地静态服务的图没有真实网络延迟，若不干预，
 *     首绘时封面图早就下完，「图片晚到」这一帧根本采不到。固定延迟把两边放进同一个
 *     「图片比首绘晚到」的场景（正是慢网下的真实观感），也顺带绕开图床的真实速度差异。
 *   - 取样时刻以 First Contentful Paint 为基准：FCP 才是用户第一次看见页面的时刻
 *     （3G 下 DOMContentLoaded 要等外链样式表回来，往往两秒开外）。另外从导航起点每
 *     250ms 采一条时间线，看标题什么时候被晚到的图片顶下去。
 *
 * 每页记录：CLS（排除 hadRecentInput，与 Lighthouse 同口径）、h1 顶边位移、视口内图片到位数、
 * blur-up 容器数、剩余占位层数、图片请求字节数（懒加载到底省了多少带宽）。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [baseUrl, outJson, shotsDir, label = 'run', preset = 'fast3g'] = process.argv.slice(2);
if (!baseUrl || !outJson || !shotsDir) {
  console.error('usage: node verify.mjs <baseUrl> <outJson> <shotsDir> [label] [preset]');
  process.exit(2);
}

const PRESETS = {
  fast3g: { latency: 150, downloadThroughput: (1600 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  slow3g: { latency: 400, downloadThroughput: (500 * 1024) / 8, uploadThroughput: (500 * 1024) / 8 }
};
const NET = PRESETS[preset];
if (!NET) throw new Error(`未知 preset：${preset}`);

const PAGES = [
  { key: 'article', url: '/posts/justthinking/justthinking-02-token-ciyuan/' },
  { key: 'list', url: '/posts/' }
];
const IMAGE_HOLD_MS = 2000;
const SHOT_AT_MS = [150, 1200]; // 相对 First Contentful Paint
const TIMELINE_INTERVAL_MS = 250;
const SETTLE_TIMEOUT_MS = 25_000;
// 拦截所有位图请求（站内封面 + 图床），统一做「延迟到达」
const IMAGE_PATTERN = /\.(?:png|jpe?g|webp|avif|gif)(?:[?#]|$)/i;

// 1×1 透明 PNG：图床抓不到时的兜底，保证脚本能跑完
const FALLBACK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

fs.mkdirSync(shotsDir, { recursive: true });
fs.mkdirSync(path.dirname(path.resolve(outJson)), { recursive: true });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** 用 CDP 直接抓帧：Playwright 的 page.screenshot 会先等 document.fonts.ready，
 *  3G 节流下字体要好几秒 —— 取样时刻就全乱了。 */
async function capture(client, file) {
  const { data } = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
}

const CHROME = '/usr/bin/google-chrome';
const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true
});

const imageCache = new Map(); // url -> { body, contentType, fetched }

/** 所有图片：抓一次原图 → 固定延迟 → 直接应答（绕过带宽节流，到达时间可控） */
async function fulfillHeldImage(route) {
  const url = route.request().url();
  if (!imageCache.has(url)) {
    try {
      const res = await route.fetch({ timeout: 30_000 });
      imageCache.set(url, {
        body: await res.body(),
        contentType: res.headers()['content-type'] ?? 'image/png',
        fetched: true
      });
    } catch (err) {
      imageCache.set(url, { body: FALLBACK_PNG, contentType: 'image/png', fetched: false });
      console.error(`  ! 图片抓取失败，用 1×1 兜底：${url}（${String(err.message).split('\n')[0]}）`);
    }
  }
  const cached = imageCache.get(url);
  await sleep(IMAGE_HOLD_MS);
  try {
    await route.fulfill({ body: cached.body, contentType: cached.contentType });
  } catch {
    /* 页面已切走，请求被取消 */
  }
}

/** 页面内采样：用 evaluate 执行，必须自包含 */
const SAMPLE = () => {
  const rect = el => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), height: Math.round(r.height) };
  };
  // 只统计正文区的图（header 的 logo 与灯箱里的图不算）
  const imgs = [...document.querySelectorAll('main img')];
  const boxes = [...document.querySelectorAll('main .blur-up')];
  const h1 = document.querySelector('h1');
  const first = imgs[0];
  const inView = img => {
    const r = img.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  };
  return {
    t: Math.round(performance.now()),
    cls: Number((window.__cls ?? 0).toFixed(5)),
    shiftCount: (window.__shifts ?? []).length,
    lcp: window.__lcp ?? null,
    imgCount: imgs.length,
    imgLoaded: imgs.filter(img => img.complete && img.naturalWidth > 0).length,
    imgInView: imgs.filter(inView).length,
    imgInViewLoaded: imgs.filter(img => inView(img) && img.complete && img.naturalWidth > 0).length,
    boxCount: boxes.length,
    boxLoaded: boxes.filter(box => box.classList.contains('is-loaded')).length,
    placeholderCount: document.querySelectorAll('main .blur-up__ph').length,
    h1Top: h1 ? rect(h1).top : null,
    docHeight: Math.round(document.documentElement.scrollHeight),
    firstImg: first
      ? {
          ...rect(first),
          natural: `${first.naturalWidth}×${first.naturalHeight}`,
          loading: first.getAttribute('loading'),
          decoding: first.getAttribute('decoding'),
          opacity: getComputedStyle(first).opacity
        }
      : null
  };
};

/**
 * 运行时检查：同一篇文章页再开两个上下文。
 *   1. `prefers-reduced-motion: reduce`：图片加载完后占位层必须立刻消失、且没有过渡；
 *   2. 去掉 <html class="has-js">（等价于脚本没跑）：高清图必须照常可见，
 *      即「没有 JS 也不会白图」。
 */
async function checkRuntime(browser, url, NET) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: NET.latency,
    downloadThroughput: NET.downloadThroughput,
    uploadThroughput: NET.uploadThroughput,
    connectionType: 'cellular3g'
  });
  await page.route(IMAGE_PATTERN, fulfillHeldImage);
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 }).catch(() => {});
  await page.waitForFunction(
    () => {
      const img = document.querySelector('main .blur-up__img');
      return img && img.complete;
    },
    undefined,
    { timeout: 25_000, polling: 200 }
  ).catch(() => {});
  await sleep(500);

  const reduced = await page.evaluate(() => {
    const box = document.querySelector('main .blur-up');
    const img = box?.querySelector('.blur-up__img');
    const style = img ? getComputedStyle(img) : null;
    return {
      preferReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      // 已加载那一张的占位层是否已被收掉（未加载的懒图仍留着占位，属预期）
      firstBoxHasPlaceholder: !!box?.querySelector('.blur-up__ph'),
      placeholderCount: document.querySelectorAll('main .blur-up__ph').length,
      boxLoaded: box?.classList.contains('is-loaded') ?? null,
      imgOpacity: style?.opacity ?? null,
      imgTransition: style?.transitionDuration ?? null
    };
  });

  // 模拟「脚本没跑」：把 has-js 摘掉，高清图应立刻可见（CSS 默认 opacity:1）
  const noJs = await page.evaluate(() => {
    document.documentElement.classList.remove('has-js');
    const img = document.querySelector('main .blur-up__img');
    return { imgOpacity: img ? getComputedStyle(img).opacity : null };
  });

  await context.close();
  return { reduced, noJs };
}

const results = [];
for (const spec of PAGES) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: NET.latency,
    downloadThroughput: NET.downloadThroughput,
    uploadThroughput: NET.uploadThroughput,
    connectionType: 'cellular3g'
  });

  // 图片请求字节数：懒加载到底省了多少带宽，用 CDP 自己数
  const imageRequestIds = new Set();
  const imageUrls = [];
  let imageBytes = 0;
  let imageRequests = 0;
  client.on('Network.responseReceived', event => {
    // data: URL（内联的模糊占位）不是网络请求，不算进来
    if (event.type === 'Image' && !event.response.url.startsWith('data:')) {
      imageRequestIds.add(event.requestId);
      imageRequests++;
      imageUrls.push(event.response.url);
    }
  });
  client.on('Network.loadingFinished', event => {
    if (imageRequestIds.has(event.requestId)) imageBytes += event.encodedDataLength;
  });

  await page.addInitScript(() => {
    window.__cls = 0;
    window.__shifts = [];
    window.__lcp = null;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__cls += entry.value;
        window.__shifts.push({ value: Number(entry.value.toFixed(5)), t: Math.round(entry.startTime) });
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(list => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) window.__lcp = { t: Math.round(last.startTime), size: Math.round(last.size) };
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  await page.route(IMAGE_PATTERN, fulfillHeldImage);

  const samples = [];
  const shots = [];
  const timeline = [];

  await page.goto(new URL(spec.url, baseUrl).href, { waitUntil: 'commit', timeout: 60_000 });

  // 时间线：从导航起点每 250ms 记一条，直到稳定（看标题何时被图片顶下去）
  let timelineDone = false;
  const timelineLoop = (async () => {
    while (!timelineDone) {
      timeline.push(await page.evaluate(SAMPLE).catch(() => null));
      await sleep(TIMELINE_INTERVAL_MS);
    }
  })();

  // 等首帧内容绘制
  const painted = await page
    .waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0, undefined, {
      timeout: 30_000,
      polling: 100
    })
    .then(() => true)
    .catch(() => false);
  const fcpAt = Date.now();

  for (const offset of SHOT_AT_MS) {
    const wait = offset - (Date.now() - fcpAt);
    if (wait > 0) await sleep(wait);
    samples.push(await page.evaluate(SAMPLE));
    const file = path.join(shotsDir, `${label}-${spec.key}-${offset}ms.png`);
    await capture(client, file);
    shots.push(path.basename(file));
  }

  // 先等 load 事件（改造前所有图片都是 eager，load 会把它们都算进去；改造后只有
  // 首屏与懒加载阈值内的图会被请求）—— 这样两边的「图片请求字节数」才是同一个口径
  await page.waitForLoadState('load', { timeout: 25_000 }).catch(() => {});

  // 视口内的图到齐就算稳定（视口外的懒加载图不会发请求，complete 一直是 false）
  const settled = await page
    .waitForFunction(
      () => {
        const imgs = [...document.querySelectorAll('main img')].filter(img => {
          const r = img.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight;
        });
        return imgs.every(img => img.complete);
      },
      undefined,
      { timeout: SETTLE_TIMEOUT_MS, polling: 200 }
    )
    .then(() => true)
    .catch(() => false);

  await sleep(700);
  timelineDone = true;
  await timelineLoop;
  const final = await page.evaluate(SAMPLE);
  const finalShot = path.join(shotsDir, `${label}-${spec.key}-final.png`);
  await capture(client, finalShot);
  shots.push(path.basename(finalShot));

  // 运行时检查（只做一次，用文章页）：减少动态偏好 & 无 JS 兜底
  let runtime = null;
  if (spec.key === 'article') {
    runtime = await checkRuntime(browser, page.url(), NET);
  }

  results.push({
    key: spec.key,
    runtime,
    url: new URL(spec.url, baseUrl).href,
    settled,
    painted,
    timeline,
    imageRequests,
    imageUrls: imageUrls.map(url => url.replace(/^https?:\/\/[^/]+/, '')),
    imageBytes,
    samples,
    final,
    h1TopDelta:
      samples[0]?.h1Top != null && final.h1Top != null ? final.h1Top - samples[0].h1Top : null,
    shots
  });
  await context.close();
}

await browser.close();

const report = {
  label,
  baseUrl,
  preset,
  network: { latencyMs: NET.latency, downloadKbps: Math.round((NET.downloadThroughput * 8) / 1024) },
  viewport: { width: 390, height: 844, dpr: 1 },
  imageHoldMs: IMAGE_HOLD_MS,
  capturedAt: new Date().toISOString(),
  pages: results
};
fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

for (const item of results) {
  console.log(
    `${label} ${item.key.padEnd(8)} CLS=${item.final.cls.toFixed(4)}  h1 Δtop=${item.h1TopDelta}px  ` +
      `图 ${item.final.imgLoaded}/${item.final.imgCount}（视口内 ${item.final.imgInViewLoaded}/${item.final.imgInView}）  ` +
      `blur-up ${item.final.boxLoaded}/${item.final.boxCount}  占位剩余 ${item.final.placeholderCount}  ` +
      `图片请求 ${item.imageRequests} 个 / ${(item.imageBytes / 1024).toFixed(0)} KB`
  );
}
console.log(`→ ${outJson}`);
