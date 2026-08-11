// RAY-228 搜索功能浏览器冒烟验证
// 场景：首页搜索「词元」→ 点击结果 → 应跳转到真实文章页
import { chromium } from 'playwright-core';

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });
  const page = await browser.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => failedRequests.push(req.url()));
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

  const BASE = 'http://localhost:4321';
  const results = [];
  const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ' — ' + detail : ''}`);

  // 1. 打开首页
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  check('首页可访问', page.url().endsWith('/'), page.url());

  // 2. 打开搜索框，输入「词元」
  await page.click('#search-toggle');
  await page.fill('#search-input', '词元');
  await page.waitForTimeout(600); // 等待 debounce(150ms) + 渲染
  const resultLinks = await page.$$eval('#search-results a', (as) =>
    as.map((a) => ({ text: a.textContent.trim().slice(0, 30), href: a.getAttribute('href') }))
  );
  check('搜索结果出现', resultLinks.length > 0, `${resultLinks.length} 条`);
  const wordHref = resultLinks.find((l) => l.text.includes('词元'))?.href;
  check('结果链接无 undefined', wordHref && !wordHref.includes('undefined'), wordHref || '');
  check('结果链接非协议相对 //', wordHref && !wordHref.startsWith('//'), wordHref || '');
  check('结果链接为 /posts/ 绝对路径', wordHref && wordHref.startsWith('/posts/'), wordHref || '');

  // 3. 点击「词元」结果 → 应进入文章页
  if (wordHref) {
    await page.click(`#search-results a[href="${wordHref}"]`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    const url = page.url();
    check('点击后跳转到文章页', url.includes('/posts/justthinking/justthinking-02-token-ciyuan'), url);
    check('文章标题渲染', (await page.textContent('h1')).includes('Token'), (await page.textContent('h1')).slice(0, 40));
  }

  // 4. 标签页链接
  await page.goto(BASE + '/tags/词元', { waitUntil: 'networkidle' });
  const tagHrefs = await page.$$eval('article a', (as) => as.map((a) => a.getAttribute('href')));
  check('标签页无 // 协议相对链接', tagHrefs.every((h) => h && !h.startsWith('//')), tagHrefs.join(', '));
  check('标签页无 undefined', tagHrefs.every((h) => !h.includes('undefined')), tagHrefs.join(', '));
  await page.click('article a');
  await page.waitForLoadState('domcontentloaded');
  check('标签页点击跳转文章页', page.url().includes('/posts/justthinking/'), page.url());

  // 5. 截图留档
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.click('#search-toggle');
  await page.fill('#search-input', '词元');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'search-smoke.png' });

  console.log(results.join('\n'));
  console.log('--- console errors ---');
  console.log(consoleErrors.length ? consoleErrors.join('\n') : '(none)');
  console.log('--- failed requests ---');
  console.log(failedRequests.length ? failedRequests.join('\n') : '(none)');

  await browser.close();
  const failed = results.some((r) => r.startsWith('FAIL')) || consoleErrors.length > 0;
  process.exitCode = failed ? 1 : 0;
})();
