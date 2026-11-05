"""RAY-627 自测：skip link 默认不可见 / Tab 聚焦后完整出现 / 回车跳 #main / reduced-motion 无动画。

用法：python3 docs/qa/RAY-627/verify.py http://127.0.0.1:4321
依赖：playwright（Python）+ Chromium。截图落在同目录。
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4321"
OUT = Path(__file__).resolve().parent
URL = BASE.rstrip("/") + "/"

METRICS_JS = """
() => {
  const el = document.querySelector('.skip-link');
  const header = document.querySelector('header.site-header');
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const h = header.getBoundingClientRect();
  const hits = [];
  for (const x of [8, 20, 40, 80, 160]) {
    for (const y of [4, 16, 28, 44, 60, 76, 96]) {
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit))) hits.push([x, y, hit.className]);
    }
  }
  return {
    rect: {x: r.x, y: r.y, w: r.width, h: r.height, top: r.top, bottom: r.bottom},
    header: {top: h.top, bottom: h.bottom, height: h.height},
    clipPath: cs.clipPath,
    position: cs.position,
    overflow: cs.overflow,
    transitionDuration: cs.transitionDuration,
    animationName: cs.animationName,
    active: document.activeElement && (document.activeElement.className || document.activeElement.id),
    hits,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewport: {w: innerWidth, h: innerHeight},
  };
}
"""

OLD_STYLE_JS = """
() => {
  const el = document.querySelector('.skip-link');
  el.style.position = 'fixed';
  el.style.top = '72px';
  el.style.left = 'var(--space-3)';
  el.style.width = 'auto';
  el.style.height = 'auto';
  el.style.margin = '0';
  el.style.padding = 'var(--space-2) var(--space-3)';
  el.style.border = '1px solid var(--color-border)';
  el.style.overflow = 'visible';
  el.style.clipPath = 'none';
  el.style.transform = 'translateY(-200%)';
  const r = el.getBoundingClientRect();
  const h = document.querySelector('header.site-header').getBoundingClientRect();
  const exposedTop = Math.max(r.top, 0);
  const exposedBottom = Math.min(r.bottom, h.bottom);
  return {rect: {top: r.top, bottom: r.bottom, height: r.height},
          headerBottom: h.bottom,
          exposedPx: Math.max(0, exposedBottom - exposedTop)};
}
"""

results = {}


def open_page(page):
    page.goto(URL, wait_until="commit", timeout=20000)
    page.wait_for_selector(".skip-link", state="attached", timeout=15000)


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")

    # ---- 手机 390×844：默认态 + Tab 聚焦态 + 回车 ----
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page = ctx.new_page()
    open_page(page)
    page.wait_for_timeout(1200)
    page.mouse.move(380, 800)
    default = page.evaluate(METRICS_JS)
    page.screenshot(path=str(OUT / "390-default.png"))
    results["390_default"] = default

    page.keyboard.press("Tab")
    page.wait_for_timeout(250)
    focused = page.evaluate(METRICS_JS)
    page.screenshot(path=str(OUT / "390-focus.png"))
    results["390_focus"] = focused

    page.keyboard.press("Enter")
    page.wait_for_timeout(700)
    results["390_enter"] = page.evaluate(
        "() => ({hash: location.hash, activeId: document.activeElement && document.activeElement.id,"
        " activeTag: document.activeElement && document.activeElement.tagName,"
        " mainTop: document.getElementById('main').getBoundingClientRect().top})"
    )

    # 鼠标点击同样要跳 #main
    open_page(page)
    page.wait_for_timeout(800)
    page.keyboard.press("Tab")
    page.wait_for_timeout(200)
    page.click(".skip-link")
    page.wait_for_timeout(700)
    results["390_click"] = page.evaluate(
        "() => ({hash: location.hash, activeId: document.activeElement && document.activeElement.id,"
        " mainTop: document.getElementById('main').getBoundingClientRect().top})"
    )

    # 旧样式（PR #94）在同一页面的实际露出量，用于 README 的根因数字
    open_page(page)
    page.wait_for_timeout(500)
    results["old_style_exposed"] = page.evaluate(OLD_STYLE_JS)
    ctx.close()

    # ---- reduced-motion ----
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844}, reduced_motion="reduce", device_scale_factor=2
    )
    page = ctx.new_page()
    open_page(page)
    page.wait_for_timeout(600)
    page.keyboard.press("Tab")
    page.wait_for_timeout(100)
    results["reduced_motion"] = page.evaluate(METRICS_JS)
    ctx.close()

    # ---- 桌面 1440×900 默认态 ----
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    page = ctx.new_page()
    open_page(page)
    page.wait_for_timeout(1000)
    page.mouse.move(1400, 850)
    results["1440_default"] = page.evaluate(METRICS_JS)
    page.screenshot(path=str(OUT / "1440-default.png"))
    ctx.close()

    browser.close()

print(json.dumps(results, ensure_ascii=False, indent=2))

d = results["390_default"]
f = results["390_focus"]
e = results["390_enter"]
c = results["390_click"]
rm = results["reduced_motion"]
desk = results["1440_default"]
assert not d["hits"], f"默认态 skip link 仍可命中：{d['hits']}"
assert d["clipPath"] == "inset(50%)", d["clipPath"]
assert d["transitionDuration"] == "0s", d["transitionDuration"]
assert not desk["hits"], f"桌面默认态仍可命中：{desk['hits']}"
assert f["active"] and "skip-link" in f["active"], f
assert f["rect"]["w"] > 40 and f["rect"]["h"] > 20, f
assert f["rect"]["top"] >= f["header"]["bottom"], f
assert f["rect"]["top"] >= 0 and f["rect"]["bottom"] <= f["viewport"]["h"], f
assert f["rect"]["x"] >= 0 and f["rect"]["x"] + f["rect"]["w"] <= f["viewport"]["w"], f
assert e["hash"] == "#main" and e["activeId"] == "main", e
assert c["hash"] == "#main" and c["activeId"] == "main", c
assert rm["transitionDuration"] == "0s" and rm["animationName"] == "none", rm
assert rm["active"] and "skip-link" in rm["active"], rm
print("\nALL ASSERTIONS PASSED")
