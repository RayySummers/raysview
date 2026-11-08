# RAY-633 自测记录：桌面常驻侧栏目录（≥1200px）

## 改了什么

| # | 文件 | 改动 |
|---|---|---|
| 1 | `src/components/pages/ArticlePage.astro` | 正文外层包一层 `.post-layout`（有目录时加 `.post-layout--has-toc`）；≥1200px 时它变成「正文列 + 目录列」的 grid，用对称负外边距从 `main` 的 680px 盒里撑出来。返回键移进正文列，宽屏时与正文左缘对齐 |
| 2 | `src/components/TableOfContents.astro` | 加一段 `@media (min-width: 1200px)`：`.toc-container` 从 `fixed` 换 `sticky`，收起开关/关闭按钮，面板常驻展开、内容超高时自身滚动；脚本加 `matchMedia` 同步 `hidden` / `aria-expanded`，并屏蔽浮层时代的 Esc / 点外部关闭 |
| 3 | `src/styles/global.css` | 未改（目录的 h3 缩进等全局规则保持原样） |

没有新增依赖（`package.json` / `pnpm-lock.yaml` 未动），没有复制第二份目录 DOM。

## 三个实现选择

**正文列宽刻意保持 584px，不是 640px。**
Base 的 `<main>` 上限 680px、左右内边距各 48px，所以改动前正文实际是 584px。
两栏里正文列继续用 584px，跨 1200 断点时正文、封面、标题宽度一个像素都不变，
只有右侧多出目录栏 —— 断点切换不会因为重新折行而整页上下跳（实测标题视口位置
47.70 → 47.70px，`scrollY` 6589 → 6589）。

**用负外边距把 grid 撑出来，不改 `main` 的宽度。**
`<main>` 的 `max-width` 写在行内 style 上，改它要么和行内样式打架、要么上 `!important`，
还会波及同页其它元素。这里让 `.post-layout--has-toc` 自身 `width: 848px`
（584 + gap 32 + 232），`margin-inline: calc((100% - 848px) / 2)` 即左右各 −132px，
几何上仍以页面中线为中心，`main` 与其它页面完全不动。

**同一套 DOM，两种形态；JS 只同步可访问性状态。**
桌面形态完全由 CSS 断点决定，脚本没跑起来时侧栏照样显示。脚本只做三件事：
宽屏把面板的 `hidden` 去掉（让辅助技术读到这个 `nav`）、窄屏加回去；
宽屏屏蔽 Esc / 点外部关闭（否则滚一下侧栏就没了）；断点变化后按当前滚动位置补算高亮。
目录只有一个 `<nav>`，不存在两份 DOM 同时可读。

## 验收结果

构建：`pnpm build`（Astro 6.3.5，44 页，0 错误，无新增依赖）。
浏览器：Playwright / Chromium，桌面 1400×900、1100×900，移动 390×844 @2x。
复跑：

```bash
pnpm build
pnpm preview --port 4321 --host 127.0.0.1
python3 docs/qa/RAY-633/verify.py http://127.0.0.1:4321
# 目录自身滚动那条需要临时 fixture：
cp docs/qa/RAY-633/fixture-long-toc.md src/content/posts/qa/ray633-long-toc.md
pnpm build
python3 docs/qa/RAY-633/verify.py http://127.0.0.1:4321 ray633-long-toc
rm -rf src/content/posts/qa
```

正文页面 **66/66 通过**（`results.json`）；含 fixture 的完整跑 **71/71 通过**
（`results-fixture.json`）。逐条对应验收项：

| 验收项 | 读数 | 结论 |
|---|---|---|
| 1400 宽：右侧目录常驻 | `grid-template-columns: 584px 232px`，`gap: 32px`，目录 `position: sticky`、宽 232px | ✅ `1400-sidebar-top.png` |
| 1400：滚到第 2 节高亮 | `active = i-委派delegation`，与第 2 个标题 id 一致；`aria-current="true"` 仅 1 个 | ✅ `1400-section-2-active.png` |
| 1400：滚到第 3 节高亮 | `active = ii-描述description`（随滚动从第 2 节切过来） | ✅ `1400-section-3-active.png` |
| 侧栏贴导航下方 | 滚动后目录 `top = 72 = 48（导航）+ 24（--space-4）` | ✅ |
| 1100 宽：回到单栏 + 右下浮层 | `display: block`、目录 `position: fixed`、浮层默认 `hidden`；点开可见（820–868 在视口内），`aria-expanded` false→true | ✅ `1100-overlay-open.png` |
| 浮层功能不回归 | Esc 关闭且焦点回 `#toc-toggle`；`aria-controls="toc-panel"` | ✅ |
| 390：浮层可用 | 可打开、盒子 `(310,764)-(358,812)` 完全在 390×844 内、无横向溢出 | ✅ `390-overlay-open.png` |
| 侧栏超高时自身滚动，不带动正文 | 18 条目录 fixture（视口 560）：`scrollHeight 539 > clientHeight 440`，`overflow-y: auto`；`panel.scrollTop 0→99` 时 `window.scrollY` 300→300 | ✅ `fixture-long-toc-sidebar.png` |
| 长目录里高亮项自动进可视区 | 滚到第 17 节：`active = 第-17-节…`，该项在面板可视区内，`panel.scrollTop = 79` | ✅ `fixture-long-toc-active-late.png` |
| 断点切换不出现两个目录 | 1199 / 1200 两侧：`nav = 1`、`.toc-container = 1`、可见面板 ≤ 1 | ✅ |
| 断点切换不跳动 | 1199 ↔ 1200：`scrollY 6589 → 6589`，第 2 节标题视口位置 `47.70 → 47.70px`，正文列宽 `584 → 584` | ✅ `breakpoint-1440-before.png` / `breakpoint-1199-after.png` / `breakpoint-1200-after.png` |
| 反向切换（宽→窄） | 回到 `fixed` 且浮层默认收起（`hidden=true`） | ✅ `breakpoint-1100-after-resize-back.png` |
| 桌面形态下点正文 / Esc 不收起目录 | `hidden` 始终 false | ✅ |
| `/en` 英文页 | 英文译文没有任何 h1–h3、不渲染目录：保持单栏、正文仍 584px、无空目录 `nav`、无溢出 | ✅ `en-1400-single-column.png` |
| 标签页 | `/tags/JustThinking/` 1400 与 390 均正常、无目录、无溢出 | ✅ `tags-1400.png` |
| 标题 / 脚注 / blur-up 不回归 | 标题 40px、`.blur-up` 5 处、`.footnotes` 1 处 | ✅ |
| 无障碍 | 全页仅 1 个 `role="navigation"`（名称「目录」），`aria-current` 唯一且落在当前节 | ✅ |
| `pnpm build` / 新增依赖 | 通过；`package.json`、`pnpm-lock.yaml` 无 diff | ✅ |

## 未覆盖 / 已知取舍

- 侧栏滚动条在 Chromium 的 overlay 模式下只在滚动时可见；没有另加渐变遮罩做「还有更多」提示。
- 目录自身滚动只验证了鼠标/程序化滚动（`scrollTop`），没有单独录触控板惯性滚动的视频。
- `prefers-reduced-motion` 与 RAY-632 一致：目录项没有过渡，侧栏形态本身不含动画。
