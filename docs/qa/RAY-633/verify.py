#!/usr/bin/env python3
"""RAY-633 自测：桌面（≥1200px）常驻侧栏目录，窄屏保持右下浮层。

用法：
    pnpm build
    pnpm preview --port 4321 --host 127.0.0.1
    python3 docs/qa/RAY-633/verify.py http://127.0.0.1:4321 [fixture-slug]

第二个参数是临时长目录 fixture 的 slug（可选）：传了才跑「目录自身滚动」那条。
"""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4321').rstrip('/')
FIXTURE = sys.argv[2] if len(sys.argv) > 2 else None
OUT = Path(__file__).resolve().parent

POST = '/posts/biweekly/biweekly-2605-a/'
EN_POST = '/en/posts/justthinking/justthinking-04-metro-volunteer/'
TAG = '/tags/JustThinking/'

results = []


def check(name, ok, detail=''):
    results.append({'name': name, 'ok': bool(ok), 'detail': detail})
    print(('PASS  ' if ok else 'FAIL  ') + name + (f'  [{detail}]' if detail else ''))


def info(pg):
    js = """() => {
      const q = (s) => document.querySelector(s);
      const layout = q('.post-layout');
      const toc = q('.toc-container');
      const panel = q('#toc-panel');
      const toggle = q('#toc-toggle');
      const art = q('article.heti');
      const rect = (el) => el ? el.getBoundingClientRect() : null;
      const navs = document.querySelectorAll('[role="navigation"]');
      const visiblePanels = Array.from(document.querySelectorAll('.toc-panel'))
        .filter(p => p.offsetParent !== null || getComputedStyle(p).position === 'fixed' && getComputedStyle(p).display !== 'none');
      return {
        layoutDisplay: layout ? getComputedStyle(layout).display : 'none',
        layoutW: rect(layout)?.width ?? null,
        layoutLeft: rect(layout)?.left ?? null,
        cols: layout ? getComputedStyle(layout).gridTemplateColumns : null,
        gap: layout ? getComputedStyle(layout).gap : null,
        tocPosition: toc ? getComputedStyle(toc).position : null,
        tocTop: rect(toc)?.top ?? null,
        tocBottom: rect(toc)?.bottom ?? null,
        tocLeft: rect(toc)?.left ?? null,
        tocRight: rect(toc)?.right ?? null,
        tocW: rect(toc)?.width ?? null,
        tocOverflowY: panel ? getComputedStyle(panel).overflowY : null,
        panelHidden: panel ? panel.hidden : null,
        panelDisplay: panel ? getComputedStyle(panel).display : null,
        panelScrollH: panel ? panel.scrollHeight : null,
        panelClientH: panel ? panel.clientHeight : null,
        panelScrollTop: panel ? panel.scrollTop : null,
        toggleDisplay: toggle ? getComputedStyle(toggle).display : null,
        toggleExpanded: toggle ? toggle.getAttribute('aria-expanded') : null,
        toggleControls: toggle ? toggle.getAttribute('aria-controls') : null,
        navCount: navs.length,
        navLabel: navs[0] ? navs[0].getAttribute('aria-label') : null,
        tocCount: document.querySelectorAll('.toc-container').length,
        visiblePanels: visiblePanels.length,
        active: panel?.querySelector('.toc-item.is-active')?.dataset.tocTarget ?? null,
        ariaCurrent: panel ? panel.querySelectorAll('.toc-item[aria-current="true"]').length : 0,
        ariaCurrentTarget: panel?.querySelector('.toc-item[aria-current="true"]')?.dataset.tocTarget ?? null,
        artW: rect(art)?.width ?? null,
        artLeft: rect(art)?.left ?? null,
        h1Size: q('.post-title') ? getComputedStyle(q('.post-title')).fontSize : null,
        blurUp: document.querySelectorAll('.blur-up').length,
        footnotes: document.querySelectorAll('.footnotes').length,
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        scrollY: window.scrollY,
      };
    }"""
    return pg.evaluate(js)


def scroll_to_heading(pg, idx):
    pg.evaluate(
        """(i) => {
          const links = Array.from(document.querySelectorAll('#toc-panel .toc-item'));
          const id = links[i].dataset.tocTarget;
          const el = document.getElementById(id);
          const y = el.getBoundingClientRect().top + window.scrollY - 48;
          if (window.lenis) window.lenis.scrollTo(y, { immediate: true });
          window.scrollTo(0, y);
          window.__qaHeadingId = id;
        }""",
        idx,
    )
    pg.wait_for_timeout(700)
    return pg.evaluate('window.__qaHeadingId')


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={'width': 1400, 'height': 900})

        # ---------- A. 1400px：两栏 + sticky + scrollspy ----------
        pg = ctx.new_page()
        pg.goto(BASE + POST, wait_until='load', timeout=45000)
        d = info(pg)
        check('A1 1400 两栏 grid', d['layoutDisplay'] == 'grid', d['layoutDisplay'])
        check('A2 右栏 232px（220–240）', d['cols'] == '584px 232px', d['cols'])
        check('A3 gap 用 --space-5 = 32px', d['gap'] == '32px', d['gap'])
        check('A4 目录 sticky', d['tocPosition'] == 'sticky', d['tocPosition'])
        check('A5 目录宽 232', d['tocW'] == 232, str(d['tocW']))
        check('A6 正文列宽与窄屏一致（584）', d['artW'] == 584, str(d['artW']))
        check('A7 开关按钮在侧栏形态隐藏', d['toggleDisplay'] == 'none', d['toggleDisplay'])
        check('A8 目录面板展开（无 hidden）', d['panelHidden'] is False and d['panelDisplay'] == 'block',
              f"hidden={d['panelHidden']} display={d['panelDisplay']}")
        check('A9 全页只有一个目录 nav', d['navCount'] == 1 and d['tocCount'] == 1,
              f"nav={d['navCount']} toc={d['tocCount']}")
        check('A10 nav 可读名称 = 目录', d['navLabel'] in ('目录', 'Table of contents'), str(d['navLabel']))
        check('A11 无横向溢出', d['scrollW'] <= d['innerW'], f"{d['scrollW']}<={d['innerW']}")
        check('A12 标题字号未变（40px）', d['h1Size'] == '40px', str(d['h1Size']))
        check('A13 blur-up 图片仍在', d['blurUp'] > 0, str(d['blurUp']))
        check('A14 脚注区仍在', d['footnotes'] == 1, str(d['footnotes']))
        # 侧栏常驻：点正文 / 按 Esc 都不应该把它收起来（浮层时代的关闭逻辑必须被断点屏蔽）
        pg.click('article.heti p')
        pg.wait_for_timeout(200)
        check('A22 点正文不收起侧栏', info(pg)['panelHidden'] is False, str(info(pg)['panelHidden']))
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(200)
        check('A23 Esc 不收起侧栏', info(pg)['panelHidden'] is False, str(info(pg)['panelHidden']))

        pg.evaluate('window.scrollTo(0, 0)')
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT / '1400-sidebar-top.png'))

        # 滚到第 2 节：对应项高亮
        hid2 = scroll_to_heading(pg, 1)
        d2 = info(pg)
        check('A15 第 2 节高亮', d2['active'] == hid2, f"active={d2['active']} want={hid2}")
        check('A16 aria-current 唯一且命中', d2['ariaCurrent'] == 1 and d2['ariaCurrentTarget'] == hid2,
              f"n={d2['ariaCurrent']} target={d2['ariaCurrentTarget']}")
        check('A17 sticky 顶部 = 48 + 24 = 72', abs(d2['tocTop'] - 72) < 1.5, str(d2['tocTop']))
        check('A18 侧栏不越过视口底部', d2['tocBottom'] <= 900, str(d2['tocBottom']))
        pg.screenshot(path=str(OUT / '1400-section-2-active.png'))

        # 滚到第 3 节
        hid3 = scroll_to_heading(pg, 2)
        d3 = info(pg)
        check('A19 第 3 节高亮', d3['active'] == hid3, f"active={d3['active']} want={hid3}")
        check('A20 高亮项随滚动移动', d3['active'] != d2['active'], f"{d2['active']} → {d3['active']}")
        pg.screenshot(path=str(OUT / '1400-section-3-active.png'))

        # 滚到文末：最后一节保持高亮
        pg.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)')
        pg.wait_for_timeout(800)
        d_end = info(pg)
        check('A21 文末仍保持某节高亮', d_end['active'] is not None, str(d_end['active']))
        pg.close()

        # ---------- B. 1100px：回到单栏 + 右下浮层 ----------
        ctx2 = browser.new_context(viewport={'width': 1100, 'height': 900})
        pg = ctx2.new_page()
        pg.goto(BASE + POST, wait_until='load', timeout=45000)
        b = info(pg)
        check('B1 1100 单栏（非 grid）', b['layoutDisplay'] == 'block', b['layoutDisplay'])
        check('B2 目录回到 fixed 浮层', b['tocPosition'] == 'fixed', b['tocPosition'])
        check('B3 浮层默认收起', b['panelHidden'] is True, str(b['panelHidden']))
        check('B4 开关按钮可见', b['toggleDisplay'] != 'none' and b['toggleDisplay'] != 'hidden', b['toggleDisplay'])
        check('B5 aria-expanded 初始 false', b['toggleExpanded'] == 'false', str(b['toggleExpanded']))
        check('B6 aria-controls 指向浮层', b['toggleControls'] == 'toc-panel', str(b['toggleControls']))
        check('B7 正文宽度仍是 584', b['artW'] == 584, str(b['artW']))
        check('B8 单个目录 nav', b['navCount'] == 1, str(b['navCount']))
        pg.click('#toc-toggle')
        pg.wait_for_timeout(300)
        b2 = info(pg)
        check('B9 点开浮层可见', b2['panelHidden'] is False and b2['panelDisplay'] != 'none',
              f"hidden={b2['panelHidden']} display={b2['panelDisplay']}")
        check('B10 打开后 aria-expanded true', b2['toggleExpanded'] == 'true', str(b2['toggleExpanded']))
        check('B11 浮层在视口内', 0 < b2['tocTop'] and b2['tocBottom'] <= 900,
              f"top={b2['tocTop']:.0f} bottom={b2['tocBottom']:.0f}")
        pg.screenshot(path=str(OUT / '1100-overlay-open.png'))
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(200)
        b3 = info(pg)
        check('B12 Esc 关闭且回焦按钮', b3['panelHidden'] is True and b3['toggleExpanded'] == 'false',
              f"hidden={b3['panelHidden']} expanded={b3['toggleExpanded']}")
        check('B13 Esc 后焦点回到开关',
              pg.evaluate("document.activeElement?.id") == 'toc-toggle',
              pg.evaluate("document.activeElement?.id"))
        pg.close()
        ctx2.close()

        # ---------- C. 390px：浮层可用 ----------
        ctx3 = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
        pg = ctx3.new_page()
        pg.goto(BASE + POST, wait_until='load', timeout=45000)
        c = info(pg)
        check('C1 390 单栏', c['layoutDisplay'] == 'block', c['layoutDisplay'])
        check('C2 390 浮层 fixed', c['tocPosition'] == 'fixed', c['tocPosition'])
        check('C3 390 无横向溢出', c['scrollW'] <= c['innerW'], f"{c['scrollW']}<={c['innerW']}")
        pg.click('#toc-toggle')
        pg.wait_for_timeout(300)
        c2 = info(pg)
        check('C4 390 浮层可打开', c2['panelHidden'] is False, str(c2['panelHidden']))
        check('C5 浮层不超出视口',
              c2['tocLeft'] >= 0 and c2['tocRight'] <= 390 and c2['tocTop'] >= 0 and c2['tocBottom'] <= 844,
              f"box=({c2['tocLeft']:.0f},{c2['tocTop']:.0f})-({c2['tocRight']:.0f},{c2['tocBottom']:.0f})")
        check('C6 单一目录 nav', c2['navCount'] == 1, str(c2['navCount']))
        pg.screenshot(path=str(OUT / '390-overlay-open.png'))
        pg.keyboard.press('Escape')
        pg.close()
        ctx3.close()

        # ---------- D. 断点切换：不出现两个目录、正文不跳 ----------
        ctx4 = browser.new_context(viewport={'width': 1440, 'height': 900})
        pg = ctx4.new_page()
        pg.goto(BASE + POST, wait_until='load', timeout=45000)
        hid = scroll_to_heading(pg, 2)
        pg.wait_for_timeout(300)
        before = info(pg)
        before['headingTop'] = pg.evaluate(
            """(id) => document.getElementById(id).getBoundingClientRect().top""", hid)
        pg.screenshot(path=str(OUT / 'breakpoint-1440-before.png'))

        for w, label in ((1199, 'breakpoint-1199-after.png'), (1200, 'breakpoint-1200-after.png')):
            pg.set_viewport_size({'width': w, 'height': 900})
            pg.wait_for_timeout(400)
            cur = info(pg)
            cur['headingTop'] = pg.evaluate(
                """(id) => document.getElementById(id).getBoundingClientRect().top""", hid)
            check(f'D{w} 只有一个目录 nav / 一个目录容器',
                  cur['navCount'] == 1 and cur['tocCount'] == 1,
                  f"nav={cur['navCount']} toc={cur['tocCount']}")
            check(f'D{w} 可见目录面板只有 1 个', cur['visiblePanels'] <= 1, str(cur['visiblePanels']))
            check(f'D{w} 滚动位置不丢', cur['scrollY'] == before['scrollY'],
                  f"{before['scrollY']} → {cur['scrollY']}")
            check(f'D{w} 章节不上下跳（≤1px）',
                  abs(cur['headingTop'] - before['headingTop']) <= 1.0,
                  f"{before['headingTop']:.2f} → {cur['headingTop']:.2f}")
            check(f'D{w} 正文列宽不变', cur['artW'] == 584, str(cur['artW']))
            check(f'D{w} 当前节仍高亮', cur['active'] == hid, f"active={cur['active']} want={hid}")
            if w == 1200:
                check('D1200 回到 sticky 侧栏', cur['tocPosition'] == 'sticky', cur['tocPosition'])
            else:
                check('D1199 回到 fixed 浮层', cur['tocPosition'] == 'fixed', cur['tocPosition'])
            pg.screenshot(path=str(OUT / label))

        # 反向切换：宽 → 窄，浮层必须回到「默认收起」，不能留着桌面用的展开态
        pg.set_viewport_size({'width': 1100, 'height': 900})
        pg.wait_for_timeout(400)
        back = info(pg)
        check('D1100→ 反向切回浮层默认收起',
              back['tocPosition'] == 'fixed' and back['panelHidden'] is True,
              f"pos={back['tocPosition']} hidden={back['panelHidden']}")
        check('D1100→ 反向切换后仍只有一个 nav', back['navCount'] == 1, str(back['navCount']))
        pg.screenshot(path=str(OUT / 'breakpoint-1100-after-resize-back.png'))
        pg.close()
        ctx4.close()

        # ---------- E. /en 英文页 & 标签页：无目录时保持单栏 ----------
        ctx5 = browser.new_context(viewport={'width': 1400, 'height': 900})
        pg = ctx5.new_page()
        pg.goto(BASE + EN_POST, wait_until='load', timeout=45000)
        e = info(pg)
        check('E1 /en 页正常渲染', pg.locator('article.heti').count() == 1, str(pg.locator('article.heti').count()))
        check('E2 /en 无目录时保持单栏', e['layoutDisplay'] == 'block', e['layoutDisplay'])
        check('E3 /en 正文宽度不被右栏挤窄', e['artW'] == 584, str(e['artW']))
        check('E4 /en 没有空目录 nav', e['navCount'] == 0, str(e['navCount']))
        check('E5 /en 无横向溢出', e['scrollW'] <= e['innerW'], f"{e['scrollW']}<={e['innerW']}")
        pg.screenshot(path=str(OUT / 'en-1400-single-column.png'))

        pg.goto(BASE + TAG, wait_until='load', timeout=45000)
        t = pg.evaluate("""() => ({
          ok: !!document.querySelector('main'),
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
          h1: document.querySelector('h1')?.textContent?.trim().slice(0, 40),
          toc: document.querySelectorAll('.toc-container').length,
        })""")
        check('E6 标签页正常', t['ok'] and bool(t['h1']), str(t['h1']))
        check('E7 标签页无溢出 / 无目录', t['scrollW'] <= t['innerW'] and t['toc'] == 0,
              f"scrollW={t['scrollW']} toc={t['toc']}")
        pg.screenshot(path=str(OUT / 'tags-1400.png'))
        pg.set_viewport_size({'width': 390, 'height': 844})
        pg.wait_for_timeout(300)
        check('E8 标签页 390 无溢出',
              pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'),
              str(pg.evaluate('document.documentElement.scrollWidth')))
        pg.close()

        # ---------- F. 目录自身滚动（可选：临时长目录 fixture） ----------
        if FIXTURE:
            ctx6 = browser.new_context(viewport={'width': 1400, 'height': 560})
            pg = ctx6.new_page()
            pg.goto(f'{BASE}/posts/qa/{FIXTURE}/', wait_until='load', timeout=45000)
            pg.evaluate('window.scrollTo(0, 300)')
            pg.wait_for_timeout(400)
            f0 = info(pg)
            check('F1 fixture 侧栏出现', f0['tocPosition'] == 'sticky', f0['tocPosition'])
            check('F2 目录内容高于视口 → 自身可滚',
                  f0['panelScrollH'] > f0['panelClientH'] + 40,
                  f"{f0['panelScrollH']} > {f0['panelClientH']}")
            check('F3 面板 overflow-y auto', f0['tocOverflowY'] in ('auto', 'scroll'), f0['tocOverflowY'])
            scrolled = pg.evaluate("""() => {
              const p = document.getElementById('toc-panel');
              const y0 = window.scrollY;
              p.scrollTop = 160;
              return {panelScrollTop: p.scrollTop, y0, y1: window.scrollY};
            }""")
            pg.wait_for_timeout(300)
            y_after = pg.evaluate('window.scrollY')
            check('F4 滚目录不带动正文', scrolled['panelScrollTop'] > 0 and y_after == scrolled['y0'],
                  f"panelTop={scrolled['panelScrollTop']} pageY={scrolled['y0']}→{y_after}")
            pg.evaluate('document.getElementById("toc-panel").scrollTop = 0')
            pg.screenshot(path=str(OUT / 'fixture-long-toc-sidebar.png'))

            # 高亮到靠后的章节时，侧栏要自己把该项带进可视区（否则 18 条目录里第 15 条永远看不见）
            hid_last = scroll_to_heading(pg, 16)
            pg.wait_for_timeout(500)
            f5 = pg.evaluate("""(id) => {
              const panel = document.getElementById('toc-panel');
              const link = panel.querySelector(`[data-toc-target="${id}"]`);
              const pb = panel.getBoundingClientRect();
              const lb = link.getBoundingClientRect();
              return {
                active: panel.querySelector('.toc-item.is-active')?.dataset.tocTarget,
                inside: lb.top >= pb.top - 1 && lb.bottom <= pb.bottom + 1,
                scrollTop: panel.scrollTop,
                h: panel.clientHeight, sh: panel.scrollHeight,
              };
            }""", hid_last)
            check('F5 长目录里高亮项被滚进可视区',
                  f5['active'] == hid_last and f5['inside'] and f5['scrollTop'] > 0,
                  f"active={f5['active']} inside={f5['inside']} scrollTop={f5['scrollTop']:.0f}")
            pg.screenshot(path=str(OUT / 'fixture-long-toc-active-late.png'))
            ctx6.close()

        browser.close()

    failed = [r for r in results if not r['ok']]
    (OUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print()
    print(f"{len(results) - len(failed)}/{len(results)} passed")
    if failed:
        print('FAILED:', ', '.join(r['name'] for r in failed))
        sys.exit(1)
    print('ALL ASSERTIONS PASSED')


if __name__ == '__main__':
    main()
