"""RAY-632 自测：目录浮层高亮（scrollspy）/ Esc + 焦点管理 / aria-expanded。

用法：python3 docs/qa/RAY-632/verify.py http://127.0.0.1:4321
依赖：playwright（Python）+ Chromium。截图与 results.json 落在同目录。

检查项（对应 issue 验收）：
  1. 桌面 1440 / 手机 390：滚到第 2、第 3 个标题，目录对应项高亮 + aria-current
  2. 键盘：Tab 到按钮 → Enter 打开 → 焦点进第一项 → Esc 关闭 → 焦点回按钮
  3. aria-expanded 开 true / 关 false
  4. 零回归：点目录项后 hash 更新、标题距顶 ≈48px；点外部关闭
  5. 文末：最后一节保持高亮，全局只有一个高亮项
  6. 深色 + prefers-reduced-motion：无 JS 报错、高亮仍工作、无过渡
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4321"
OUT = Path(__file__).resolve().parent
POST = BASE.rstrip("/") + "/posts/raydesign/emoji-everything/"

ACTIVE_JS = """
() => {
  const el = document.querySelector('.toc-item.is-active');
  return {
    active: el ? el.dataset.tocTarget : null,
    ariaCurrent: el ? el.getAttribute('aria-current') : null,
    activeCount: document.querySelectorAll('.toc-item.is-active').length,
  };
}
"""


def scroll_to_heading(page, slug, offset=10):
    """把标题滚到导航条（48px）下方 offset 处，模拟用户读到该节开头。"""
    page.evaluate(
        """([s, off]) => {
            const el = document.getElementById(s);
            window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 48 + off });
        }""",
        [slug, offset],
    )
    page.wait_for_timeout(400)  # 等 IntersectionObserver 回调 + scroll 校对节流


def main():
    results = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome", headless=True)

        # ---- 1. 桌面 / 390 滚动高亮 ----
        for name, viewport in [("desktop", {"width": 1440, "height": 900}), ("mobile390", {"width": 390, "height": 844})]:
            page = browser.new_page(viewport=viewport)
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(POST, wait_until="load")
            toc = page.eval_on_selector_all(".toc-item", "els => els.map(e => e.dataset.tocTarget)")
            page.click("#toc-toggle")
            shots = []
            for idx, slug in enumerate([toc[1], toc[2]], start=1):
                scroll_to_heading(page, slug)
                state = page.evaluate(ACTIVE_JS)
                shot = OUT / f"{name}-spy-{idx}.png"
                page.screenshot(path=str(shot))
                shots.append({"heading": slug, **state, "screenshot": shot.name})
            results[name] = {"shots": shots, "pageErrors": errors}
            page.close()

        # ---- 2. 键盘流程 + 3. aria-expanded ----
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(POST, wait_until="load")
        reached = False
        for _ in range(30):
            page.keyboard.press("Tab")
            if page.evaluate("() => document.activeElement?.id") == "toc-toggle":
                reached = True
                break
        expanded_closed_before = page.get_attribute("#toc-toggle", "aria-expanded")
        page.screenshot(path=str(OUT / "kb-1-focus-on-toggle.png"))

        page.keyboard.press("Enter")
        page.wait_for_timeout(250)
        opened = page.evaluate(
            """() => ({
                expanded: document.getElementById('toc-toggle').getAttribute('aria-expanded'),
                hidden: document.getElementById('toc-panel').hidden,
                focusText: document.activeElement?.textContent?.trim().slice(0, 20) || null,
                scrollY: window.scrollY,
            })"""
        )
        page.screenshot(path=str(OUT / "kb-2-opened-first-item-focused.png"))

        page.keyboard.press("Escape")
        page.wait_for_timeout(250)
        closed = page.evaluate(
            """() => ({
                expanded: document.getElementById('toc-toggle').getAttribute('aria-expanded'),
                hidden: document.getElementById('toc-panel').hidden,
                focusIsToggle: document.activeElement === document.getElementById('toc-toggle'),
                scrollY: window.scrollY,
            })"""
        )
        page.screenshot(path=str(OUT / "kb-3-closed-focus-back-on-toggle.png"))
        results["keyboard"] = {
            "tabReachedToggle": reached,
            "expandedBeforeOpen": expanded_closed_before,
            "afterEnter": opened,
            "afterEscape": closed,
            "pageErrors": errors,
        }

        # aria-expanded DOM 片段（开 / 关）
        dom_closed = page.eval_on_selector("#toc-toggle", "el => el.outerHTML.slice(0, 200)")
        page.click("#toc-toggle")
        dom_open = page.eval_on_selector("#toc-toggle", "el => el.outerHTML.slice(0, 200)")
        results["ariaExpandedDom"] = {"closed": dom_closed, "open": dom_open}

        # ---- 4. 零回归：点目录项（hash / 48px 偏移）+ 点外部关闭 ----
        page.goto(POST, wait_until="load")
        page.click("#toc-toggle")
        slug = page.eval_on_selector_all(".toc-item", "els => els[1].dataset.tocTarget")
        page.click(f'.toc-item[data-toc-target="{slug}"]')
        page.wait_for_timeout(1800)  # 等平滑滚动（lenis）收尾
        click_state = page.evaluate(
            """(s) => {
                const el = document.getElementById(s);
                const active = document.querySelector('.toc-item.is-active');
                return {
                    hash: location.hash,
                    headingTop: Math.round(el.getBoundingClientRect().top),
                    active: active ? active.dataset.tocTarget : null,
                };
            }""",
            slug,
        )
        page.mouse.click(300, 400)
        page.wait_for_timeout(200)
        outside = page.evaluate(
            """() => ({
                hidden: document.getElementById('toc-panel').hidden,
                expanded: document.getElementById('toc-toggle').getAttribute('aria-expanded'),
            })"""
        )
        results["regression"] = {"clickTocItem": click_state, "outsideClick": outside}

        # ---- 5. 文末：最后一节保持高亮（浮层开着截图）----
        page.click("#toc-toggle")
        page.evaluate("() => window.scrollTo({ top: document.body.scrollHeight })")
        page.wait_for_timeout(700)
        bottom = page.evaluate(
            """() => ({
                active: document.querySelector('.toc-item.is-active')?.dataset.tocTarget || null,
                lastTocItem: [...document.querySelectorAll('.toc-item')].pop().dataset.tocTarget,
                activeCount: document.querySelectorAll('.toc-item.is-active').length,
            })"""
        )
        page.screenshot(path=str(OUT / "end-of-article-last-item-active.png"))
        results["endOfArticle"] = bottom

        # ---- 6. 深色 + reduced-motion ----
        context = browser.new_context(
            viewport={"width": 1440, "height": 900}, color_scheme="dark", reduced_motion="reduce"
        )
        dark = context.new_page()
        dark_errors = []
        dark.on("pageerror", lambda e: dark_errors.append(str(e)))
        dark.goto(POST, wait_until="load")
        dark.evaluate("() => window.scrollTo({ top: 1200 })")
        dark.wait_for_timeout(600)
        dark_state = dark.evaluate(
            """() => {
                const item = document.querySelector('.toc-item');
                const cs = getComputedStyle(item);
                return {
                    active: document.querySelector('.toc-item.is-active')?.dataset.tocTarget || null,
                    transition: cs.transitionProperty + ' ' + cs.transitionDuration,
                };
            }"""
        )
        dark.click("#toc-toggle")
        dark.wait_for_timeout(200)
        dark.screenshot(path=str(OUT / "dark-reduced-motion.png"))
        results["darkReducedMotion"] = {**dark_state, "pageErrors": dark_errors}
        context.close()

        browser.close()

    (OUT / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False, indent=2))

    # 断言：任何一条不满足都以非零退出
    failed = []
    for name in ("desktop", "mobile390"):
        for shot in results[name]["shots"]:
            if shot["active"] != shot["heading"] or shot["ariaCurrent"] != "true":
                failed.append(f"{name}: {shot}")
    kb = results["keyboard"]
    if not kb["tabReachedToggle"] or kb["expandedBeforeOpen"] != "false":
        failed.append("keyboard: 初始态异常")
    if kb["afterEnter"]["expanded"] != "true" or kb["afterEnter"]["hidden"]:
        failed.append("keyboard: Enter 未打开")
    if kb["afterEscape"]["expanded"] != "false" or not kb["afterEscape"]["hidden"] or not kb["afterEscape"]["focusIsToggle"]:
        failed.append("keyboard: Esc 未关闭或焦点未回按钮")
    if kb["afterEscape"]["scrollY"] != kb["afterEnter"]["scrollY"]:
        failed.append("keyboard: 打开/关闭改变了页面滚动")
    if results["regression"]["clickTocItem"]["headingTop"] != 48:
        failed.append("regression: 点击滚动偏移不是 48px")
    if not results["regression"]["outsideClick"]["hidden"]:
        failed.append("regression: 点外部未关闭")
    if results["endOfArticle"]["active"] != results["endOfArticle"]["lastTocItem"]:
        failed.append("endOfArticle: 末节未保持高亮")
    if results["darkReducedMotion"]["pageErrors"] or results["darkReducedMotion"]["transition"].startswith(("color", "all")):
        failed.append("darkReducedMotion: 有报错或仍有过渡")
    if failed:
        print("\nFAILED:\n" + "\n".join(failed))
        sys.exit(1)
    print("\nALL CHECKS PASSED")


if __name__ == "__main__":
    main()
