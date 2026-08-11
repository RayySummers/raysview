# -*- coding: utf-8 -*-
"""浏览器渲染 QA：验证公众号 HTML 成品样式 + 输出预览截图（Playwright）
用法: python qa-browser.py <input.html> [output.png]"""
import json
import sys
import asyncio
from playwright.async_api import async_playwright

HTML_PATH = sys.argv[1]
SHOT_PATH = sys.argv[2] if len(sys.argv) > 2 else None

JS = r"""
(() => {
  const cs = (el) => getComputedStyle(el);
  const q = (s) => document.querySelector(s);
  const h1 = q('h1');
  const sec = q('section');
  const imgs = [...document.querySelectorAll('img')].map((i) => ({
    src: i.src.split('/').pop(),
    loaded: i.complete && i.naturalWidth > 0,
    w: i.naturalWidth,
    display: cs(i).display,
    margin: cs(i).margin,
    radius: cs(i).borderRadius,
  }));
  const sup = q('sup');
  const fnHeader = [...document.querySelectorAll('div')].find((d) => d.textContent.trim() === '参考资料');
  const fnItems = [...document.querySelectorAll('p')].filter((p) => /width:32px/.test(p.innerHTML));
  const link = q('a');
  const linkSpan = q('a span');
  const captionPs = [...document.querySelectorAll('p')].filter((p) => /text-align:center/.test(p.getAttribute('style') || ''));
  const imgBeforeCaption = (() => {
    for (const p of captionPs) {
      const prev = p.previousElementSibling;
      if (prev && prev.tagName === 'IMG') return { imgMargin: cs(prev).margin, captionMargin: cs(p).margin };
    }
    return null;
  })();
  return {
    title: document.title,
    h1: { text: h1.textContent, borderLeftColor: cs(h1).borderLeftColor, fontSize: cs(h1).fontSize, textAlign: cs(h1).textAlign },
    section: { fontSize: cs(sec).fontSize, lineHeight: cs(sec).lineHeight, letterSpacing: cs(sec).letterSpacing, color: cs(sec).color, padding: cs(sec).padding, textAlign: cs(sec).textAlign },
    paragraph: { fontSize: cs(q('p')).fontSize, lineHeight: cs(q('p')).lineHeight, textAlign: cs(q('p')).textAlign },
    images: { count: imgs.length, list: imgs },
    footnotes: { supCount: document.querySelectorAll('sup').length, supColor: sup ? cs(sup).color : null, itemCount: fnItems.length, itemColor: fnItems[0] ? cs(fnItems[0]).color : null, fnItemAlign: fnItems[0] ? cs(fnItems[0]).textAlign : null },
    fnHeader: fnHeader ? { color: cs(fnHeader).color, borderBottom: cs(fnHeader).borderBottomColor + ' ' + cs(fnHeader).borderBottomWidth, textAlign: cs(fnHeader).textAlign } : null,
    listMarker: (() => { const s = q('ul li span'); return s ? { color: cs(s).color, text: s.textContent } : null; })(),
    link: link ? { color: cs(link).color, borderBottom: cs(link).borderBottomColor, innerSpanColor: linkSpan ? cs(linkSpan).color : null } : null,
    caption: captionPs.length ? { count: captionPs.length, textAlign: cs(captionPs[0]).textAlign, fontSize: cs(captionPs[0]).fontSize, color: cs(captionPs[0]).color, imgCaptionGap: imgBeforeCaption } : null,
    fnUrlSpans: [...document.querySelectorAll('p span')].filter((s) => (s.textContent || '').startsWith('http')).length,
    layout: { viewportW: window.innerWidth, docScrollW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth },
  };
})()
"""


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 414, "height": 896})
        await page.goto("file:///" + HTML_PATH.replace("\\", "/"), wait_until="networkidle", timeout=60000)
        await page.wait_for_timeout(3000)
        data = await page.evaluate(JS)
        with open(HTML_PATH + ".qa.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        print("QA_DONE")
        if SHOT_PATH:
            await page.screenshot(path=SHOT_PATH, full_page=True)
            print("SHOT_SAVED:" + SHOT_PATH)
        await browser.close()


asyncio.run(main())
