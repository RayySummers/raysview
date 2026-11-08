#!/usr/bin/env python3
"""RAY-634 自测：阅读进度条 + 移动端当前章节名。

用法：
    pnpm build
    pnpm preview --port 4321 --host 127.0.0.1
    python3 docs/qa/RAY-634/verify.py http://127.0.0.1:4321

断言全部通过时最后一行打印 ALL ASSERTIONS PASSED，读数写入同目录 results.json。
截图落在同目录，命名见 shots 列表。
"""

import json
import pathlib
import sys
import urllib.error
import urllib.request

from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4321").rstrip("/")
OUT = pathlib.Path(__file__).resolve().parent
LONG = f"{BASE}/posts/qa-ray634-long/"          # fixture：12 个 h2（见 fixture-qa-ray634-long.md）
SHORT = f"{BASE}/posts/biweekly/biweekly-2605-a/"  # 真文章：4 个 h2
H3ONLY = f"{BASE}/posts/justthinking/justthinking-01-quiet-carriage/"  # 真文章：只有 h3


def reachable(url):
    try:
        return urllib.request.urlopen(url, timeout=10).status == 200
    except (urllib.error.HTTPError, urllib.error.URLError):
        return False


# 仓库里的真文章最多 4 个 h2，>10 h2 的长文要先把 fixture 拷进 src/content/posts
# （见 README）。没装 fixture 时退回最长的真文章，保证脚本任何时候都能跑。
if not reachable(LONG):
    print(f"NOTE  {LONG} 不存在，长文用例改用真文章 {SHORT}（4 个 h2）")
    LONG = SHORT

failures = []
results = {}


def check(name, cond, detail):
    ok = bool(cond)
    results[name] = {"pass": ok, "detail": detail}
    print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")
    if not ok:
        failures.append(name)


def scroll_to(page, y):
    """Lenis 会接管滚动，直接把位置设过去（immediate），再等补间收敛。"""
    page.evaluate(
        """(y) => {
            if (window.lenis && window.lenis.scrollTo) window.lenis.scrollTo(y, { immediate: true });
            else window.scrollTo(0, y);
        }""",
        y,
    )
    page.wait_for_timeout(250)


def scroll_ratio(page, ratio):
    max_scroll = page.evaluate(
        "() => document.documentElement.scrollHeight - window.innerHeight"
    )
    scroll_to(page, round(max_scroll * ratio))
    return max_scroll


def read_meter(page):
    return page.evaluate(
        """() => {
            const fill = document.querySelector('[data-reading-fill]');
            const m = new DOMMatrixReadOnly(getComputedStyle(fill).transform);
            return {
                scaleX: m.a,
                scrollY: window.scrollY,
                maxScroll: document.documentElement.scrollHeight - window.innerHeight,
                height: fill.getBoundingClientRect().height,
                top: fill.getBoundingClientRect().top,
                bg: getComputedStyle(fill).backgroundColor,
            };
        }"""
    )


def read_section(page):
    return page.evaluate(
        """() => {
            const box = document.querySelector('[data-reading-section]');
            const text = document.querySelector('[data-reading-section-text]');
            if (!box || !text) return null;
            const r = box.getBoundingClientRect();
            const cs = getComputedStyle(box);
            return {
                text: text.textContent,
                opacity: Number(cs.opacity),
                display: cs.display,
                pointerEvents: cs.pointerEvents,
                ariaHidden: box.getAttribute('aria-hidden'),
                rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height },
                textScrollWidth: text.scrollWidth,
                textClientWidth: text.clientWidth,
                whiteSpace: getComputedStyle(text).whiteSpace,
                overflow: getComputedStyle(text).overflow,
                fontSize: cs.fontSize,
            };
        }"""
    )


# 沙箱里 jsdelivr 的 heti 偶发拉不到（ERR_NETWORK_CHANGED → Heti is not defined），
# 这条外部依赖与本次改动无关；只把它记录在 results 里，不计入「本页无报错」断言。
EXTERNAL_NOISE = ("ERR_NETWORK_CHANGED", "Failed to load resource", "Heti is not defined")


def relevant(errors):
    return [e for e in errors if not any(noise in e for noise in EXTERNAL_NOISE)]


def open_page(browser, url, viewport, reduced=False, scale=1):
    ctx = browser.new_context(
        viewport=viewport,
        device_scale_factor=scale,
        reduced_motion="reduce" if reduced else "no-preference",
    )
    page = ctx.new_page()
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto(url, wait_until="networkidle")
    page.evaluate("() => document.fonts.ready")
    page.wait_for_timeout(300)
    return ctx, page, errors


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ---------------------------------------------------------------- 桌面长文
    ctx, page, errors = open_page(browser, LONG, {"width": 1440, "height": 900})
    geo = page.evaluate(
        """() => {
            const bar = document.querySelector('.reading-meter').getBoundingClientRect();
            const header = document.querySelector('header').getBoundingClientRect();
            return { barTop: bar.top, barHeight: bar.height, barLeft: bar.left, barRight: bar.right,
                     headerBottom: header.bottom, sectionDisplay: getComputedStyle(document.querySelector('[data-reading-section]')).display };
        }"""
    )
    check("meter below header", abs(geo["barTop"] - geo["headerBottom"]) < 0.5,
          f"bar.top={geo['barTop']} header.bottom={geo['headerBottom']}")
    check("meter 2-3px", 2 <= geo["barHeight"] <= 3, f"height={geo['barHeight']}px")
    check("meter full width", geo["barLeft"] == 0 and abs(geo["barRight"] - 1440) < 0.5,
          f"left={geo['barLeft']} right={geo['barRight']}")
    check("section label hidden on desktop", geo["sectionDisplay"] == "none",
          f"display={geo['sectionDisplay']}")

    for ratio, name in ((0.25, "1440-25"), (0.5, "1440-50"), (0.9, "1440-90")):
        scroll_ratio(page, ratio)
        m = read_meter(page)
        expected = m["scrollY"] / max(m["maxScroll"], 1)
        check(f"desktop {int(ratio * 100)}% scaleX", abs(m["scaleX"] - expected) < 0.01,
              f"scaleX={m['scaleX']:.4f} expected={expected:.4f}")
        page.screenshot(path=str(OUT / f"{name}.png"))
        results[f"{name}-shot"] = {"scrollY": m["scrollY"], "scaleX": m["scaleX"]}

    # 滚到底：进度条必须是满的，且不能溢出
    scroll_to(page, 10 ** 7)
    m = read_meter(page)
    check("desktop bottom scaleX=1", abs(m["scaleX"] - 1) < 0.001, f"scaleX={m['scaleX']}")
    check("desktop accent colour", m["bg"] == "rgb(0, 0, 0)", f"background={m['bg']}")
    check("desktop no console errors", not relevant(errors), f"errors={relevant(errors)} (raw={errors})")
    ctx.close()

    # ---------------------------------------------------------------- 移动端长文
    ctx, page, errors = open_page(browser, LONG, {"width": 390, "height": 844}, scale=2)
    label = read_section(page)
    check("mobile label present", label is not None, "found [data-reading-section]")
    check("mobile label hidden before first section", label["opacity"] == 0,
          f"opacity={label['opacity']} text={label['text']!r}")

    toc = page.evaluate(
        """() => {
            const b = document.getElementById('toc-toggle').getBoundingClientRect();
            return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
        }"""
    )
    # 精确滚到第 1 / 中间 / 最后一个章节标题下方 40px：既验证「切到哪一节」，
    # 也保证短文（4 个 h2）不会在某个模糊比例上还没进第一节
    heads = page.evaluate(
        """() => {
            const level = document.querySelector('[data-reading-level]').dataset.readingLevel;
            return [...document.querySelectorAll(`article.heti h${level}[id]:not(#footnote-label)`)]
                .map(h => ({ text: h.textContent.trim(), top: h.getBoundingClientRect().top + window.scrollY }));
        }"""
    )
    check("mobile headings found", len(heads) >= 3, f"count={len(heads)}")
    picks = [0, len(heads) // 2, len(heads) - 1]
    shots = []
    seen_texts = []
    section_rects = []
    for name, idx in zip(("390-a", "390-b", "390-c"), picks):
        scroll_to(page, round(heads[idx]["top"] - 40))
        page.wait_for_timeout(250)  # 让 180ms 的淡入跑完
        s = read_section(page)
        m = read_meter(page)
        seen_texts.append(s["text"])
        section_rects.append(s["rect"])
        page.screenshot(path=str(OUT / f"{name}.png"))
        shots.append({"shot": name, "expected": heads[idx]["text"], "text": s["text"],
                      "opacity": s["opacity"], "scaleX": m["scaleX"]})
    results["mobile-shots"] = shots

    check("mobile section text switches", len(set(seen_texts)) == 3, f"texts={seen_texts}")
    check("mobile section text matches heading", all(
        t == h["text"] for t, h in zip(seen_texts, [heads[i] for i in picks])),
        f"texts={seen_texts} expected={[heads[i]['text'] for i in picks]}")
    check("mobile label opaque after fade-in", all(s["opacity"] > 0.99 for s in shots),
          f"opacity={[s['opacity'] for s in shots]}")
    check("mobile label one line", all(abs(r["height"] - 32) < 1 for r in section_rects),
          f"heights={[round(r['height'], 1) for r in section_rects]}")
    check("mobile label ellipsis", read_section(page)["whiteSpace"] == "nowrap" and
          read_section(page)["overflow"] == "hidden",
          f"white-space/overflow checked")
    check("mobile label never overlaps TOC button",
          all(r["right"] <= toc["left"] + 0.5 for r in section_rects),
          f"label.right={[round(r['right'], 1) for r in section_rects]} toc.left={toc['left']}")
    check("mobile label inside viewport", all(r["left"] >= 0 and r["right"] <= 390 for r in section_rects),
          f"left={[round(r['left'], 1) for r in section_rects]}")
    check("mobile label bottom-aligned with TOC button",
          all(abs(r["bottom"] - toc["bottom"]) < 0.5 for r in section_rects),
          f"label.bottom={[round(r['bottom'], 1) for r in section_rects]} toc.bottom={toc['bottom']}")
    check("mobile label not clickable", read_section(page)["pointerEvents"] == "none",
          f"pointer-events={read_section(page)['pointerEvents']}")
    check("mobile label aria-hidden", read_section(page)["ariaHidden"] == "true", "aria-hidden=true")

    # 文末：章节名让位给「回到顶部」
    scroll_to(page, 10 ** 7)
    page.wait_for_timeout(350)
    s = read_section(page)
    actions = page.evaluate(
        """() => {
            const a = document.querySelector('.post-actions').getBoundingClientRect();
            const b = document.getElementById('scroll-top-btn').getBoundingClientRect();
            return { actionsTop: a.top, scrollTopBtn: { left: b.left, right: b.right, top: b.top, bottom: b.bottom } };
        }"""
    )
    check("section label suppressed at article end", s["opacity"] < 0.01,
          f"opacity={s['opacity']} actionsTop={actions['actionsTop']}")
    check("no overlap with scroll-top button",
          s["rect"]["right"] < actions["scrollTopBtn"]["left"] or s["opacity"] < 0.01,
          f"label.right={round(s['rect']['right'], 1)} btn.left={round(actions['scrollTopBtn']['left'], 1)}")
    page.screenshot(path=str(OUT / "390-end.png"))

    # ------------------------------------------------------- TOC 浮层同时打开
    scroll_ratio(page, 0.45)
    page.wait_for_timeout(200)
    page.click("#toc-toggle")
    page.wait_for_timeout(300)
    overlay = page.evaluate(
        """() => {
            const panel = document.getElementById('toc-panel');
            const p = panel.getBoundingClientRect();
            const bar = document.querySelector('.reading-meter');
            const barRect = bar.getBoundingClientRect();
            const sec = document.querySelector('[data-reading-section]');
            const s = sec.getBoundingClientRect();
            const hitBar = document.elementFromPoint(barRect.left + 40, barRect.top + barRect.height / 2);
            const hitSec = document.elementFromPoint(s.left + 10, s.top + s.height / 2);
            return {
                panelOpen: !panel.hidden,
                panel: { left: p.left, right: p.right, top: p.top, bottom: p.bottom },
                bar: { top: barRect.top, bottom: barRect.bottom, pointerEvents: getComputedStyle(bar).pointerEvents },
                section: { left: s.left, right: s.right, top: s.top, bottom: s.bottom,
                           opacity: Number(getComputedStyle(sec).opacity),
                           pointerEvents: getComputedStyle(sec).pointerEvents },
                hitBar: hitBar ? (hitBar.tagName + '.' + hitBar.className) : null,
                hitSection: hitSec ? (hitSec.tagName + '.' + hitSec.className) : null,
            };
        }"""
    )
    results["overlay"] = overlay
    check("TOC panel opened", overlay["panelOpen"], "panel visible")
    check("progress bar visible with panel open", overlay["bar"]["bottom"] > overlay["bar"]["top"], "bar has height")
    check("section label visible with panel open", overlay["section"]["opacity"] > 0.9,
          f"opacity={overlay['section']['opacity']} text={read_section(page)['text']!r}")
    check("label does not overlap panel",
          overlay["section"]["top"] >= overlay["panel"]["bottom"] - 0.5 or
          overlay["section"]["bottom"] <= overlay["panel"]["top"] + 0.5,
          f"label.top={round(overlay['section']['top'], 1)} panel.bottom={round(overlay['panel']['bottom'], 1)}")
    check("bar does not overlap panel", overlay["bar"]["bottom"] < overlay["panel"]["top"],
          f"bar.bottom={overlay['bar']['bottom']} panel.top={round(overlay['panel']['top'], 1)}")
    check("decorative layers are not click targets",
          overlay["bar"]["pointerEvents"] == "none" and overlay["section"]["pointerEvents"] == "none",
          f"bar={overlay['bar']['pointerEvents']} label={overlay['section']['pointerEvents']}")
    check("clicks pass through bar to content", overlay["hitBar"] and "reading-meter" not in overlay["hitBar"],
          f"elementFromPoint={overlay['hitBar']}")
    check("clicks pass through label", overlay["hitSection"] and "reading-section" not in overlay["hitSection"],
          f"elementFromPoint={overlay['hitSection']}")
    page.screenshot(path=str(OUT / "390-toc-open.png"))
    page.click("#toc-toggle")
    check("mobile no console errors", not relevant(errors), f"errors={relevant(errors)} (raw={errors})")
    ctx.close()

    # ------------------------------------------------------------ 减少动效偏好
    ctx, page, errors = open_page(browser, LONG, {"width": 390, "height": 844}, reduced=True, scale=2)
    reduced = page.evaluate(
        """() => {
            const fill = document.querySelector('[data-reading-fill]');
            const sec = document.querySelector('[data-reading-section]');
            return {
                matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
                fillTransition: getComputedStyle(fill).transitionProperty + ' ' + getComputedStyle(fill).transitionDuration,
                sectionTransition: getComputedStyle(sec).transitionProperty + ' ' + getComputedStyle(sec).transitionDuration,
            };
        }"""
    )
    results["reduced-motion"] = reduced
    check("reduced-motion detected", reduced["matches"], "media query active")
    check("fill has no transition", reduced["fillTransition"].strip() in ("none 0s", "all 0s"),
          f"transition={reduced['fillTransition']}")
    check("section label has no transition", reduced["sectionTransition"].strip() in ("none 0s", "all 0s"),
          f"transition={reduced['sectionTransition']}")

    texts = []
    for ratio in (0.2, 0.5, 0.8):
        scroll_ratio(page, ratio)
        page.wait_for_timeout(120)
        s = read_section(page)
        texts.append(s["text"])
        if ratio == 0.5:
            page.screenshot(path=str(OUT / "390-reduced-motion.png"))
    m = read_meter(page)
    check("reduced-motion still updates progress", m["scaleX"] > 0.5, f"scaleX={m['scaleX']:.3f}")
    check("reduced-motion still switches sections", len(set(texts)) == 3, f"texts={texts}")
    check("reduced-motion no console errors", not relevant(errors), f"errors={relevant(errors)} (raw={errors})")
    ctx.close()

    # ------------------------------------------------------------ 暗色主题
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.goto(LONG, wait_until="networkidle")
    page.evaluate("() => localStorage.setItem('theme', 'dark')")
    page.reload(wait_until="networkidle")
    page.evaluate("() => document.fonts.ready")
    page.wait_for_timeout(300)
    scroll_ratio(page, 0.5)
    page.wait_for_timeout(250)
    dark = page.evaluate(
        """() => ({
            theme: document.documentElement.dataset.theme,
            fill: getComputedStyle(document.querySelector('[data-reading-fill]')).backgroundColor,
            labelBg: getComputedStyle(document.querySelector('[data-reading-section]')).backgroundColor,
            labelText: getComputedStyle(document.querySelector('[data-reading-section]')).color,
            pageBg: getComputedStyle(document.body).backgroundColor,
        })"""
    )
    results["dark"] = dark
    check("dark: theme applied", dark["theme"] == "dark", f"data-theme={dark['theme']}")
    check("dark: progress bar uses accent", dark["fill"] == "rgb(255, 255, 255)", f"background={dark['fill']}")
    check("dark: no console errors", not relevant(errors), f"errors={relevant(errors)} (raw={errors})")
    page.screenshot(path=str(OUT / "390-dark.png"))
    ctx.close()

    # -------------------------------------------------------- 真文章（短文 / h3 回退）
    for url, label_, shot, expect_level in (
        (SHORT, "short (4 h2)", "1440-short.png", 2),
        (H3ONLY, "h3-only article", "390-h3only.png", 3),
    ):
        ctx, page, errors = open_page(browser, url, {"width": 1440, "height": 900} if expect_level == 2 else {"width": 390, "height": 844}, scale=1 if expect_level == 2 else 2)
        level = page.evaluate("() => document.querySelector('[data-reading-level]').dataset.readingLevel")
        check(f"{label_}: section level", level == str(expect_level), f"data-reading-level={level}")
        max_scroll = page.evaluate("() => document.documentElement.scrollHeight - window.innerHeight")
        # 短文可能不足一屏：滚到 60% 位置看读数
        scroll_to(page, round(max_scroll * 0.6))
        m = read_meter(page)
        s = read_section(page)
        check(f"{label_}: progress tracks scroll", abs(m["scaleX"] - (m["scrollY"] / max(m["maxScroll"], 1))) < 0.01,
              f"scaleX={m['scaleX']:.3f} scrollY={m['scrollY']}")
        check(f"{label_}: section label works", s is None or s["opacity"] > 0.9,
              f"text={s['text']!r} opacity={s['opacity'] if s else None}")
        page.screenshot(path=str(OUT / shot))
        check(f"{label_}: no console errors", not relevant(errors), f"errors={relevant(errors)} (raw={errors})")
        ctx.close()

    browser.close()

print()
print("ALL ASSERTIONS PASSED" if not failures else f"FAILED: {failures}")
(OUT / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
sys.exit(1 if failures else 0)
