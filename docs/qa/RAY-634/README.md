# RAY-634 自测记录：阅读进度条 + 移动端当前章节名

## 改了什么

| # | 文件 | 改动 |
|---|---|---|
| 1 | `src/components/ReadingProgress.astro`（新增） | 两条装饰层：顶栏下沿的 3px 进度条 + `<768px` 时浮在目录按钮左侧的当前章节名胶囊。全部逻辑（滚动合帧、章节判定、减少动效分支）都在这一个组件里 |
| 2 | `src/components/pages/ArticlePage.astro` | import 并在 `<Base>` 内首行渲染 `<ReadingProgress headings={headings} />`（中文 `/posts/*` 与英文 `/en/posts/*` 共用这份模板，两版同时生效） |

没有新增依赖（`package.json` 未动）、没有新增颜色 token、没有改 `TableOfContents.astro`
（目录浮层的开关 / 焦点 / 高亮归 RAY-632，两单互不读写对方的 DOM 与 class）。

## 两个实现选择

**进度条用 `transform: scaleX()`**
改 `width` 会触发布局，滚动时每帧重排整棵子树；`scaleX` 只改合成层的变换矩阵，
滚动帧里不产生重排。滚动事件用 `requestAnimationFrame` 合帧：一帧最多写一次样式，
不会漏掉最后一次位置，也不会在松手时回弹。`transition: transform 120ms linear`
只用来抹平帧间小台阶；`prefers-reduced-motion: reduce` 下这条过渡整条去掉，位置直跳。

**章节判定不依赖滚动事件回调里的 DOM 读取**
`getBoundingClientRect()` 只在「布局真的变了」时量一次（`ResizeObserver` on `body`、
`resize`、`load`、`fonts.ready`、`pageshow`），存成每个标题的绝对纵坐标；滚动帧里只做
`tops[i] <= scrollY + 顶栏高 + 8` 的减法比较。顶栏高度从 `--header-height` 读，不写死 48。

判定线取顶栏下沿再加 8px：标题刚滚到顶栏下方就算进入该节，读者不会在标题还压在
模糊带里的时候就看到章节名变了。

**层级：默认 h2，全篇没有 h2 时回退 h3。**
站内 `justthinking-01` 这类文章通篇用 `###` 分节、一个 `h2` 都没有；只跟 h2 的话这类
长文一条章节名都不会出现。脚注区的 `h2#footnote-label` 是附录，已从章节列表里排除。

## 验收结果

构建：`pnpm build`（Astro 6.3.5，44 页，0 错误，无新增依赖）。
浏览器：Playwright / Chromium，桌面 1440×900 @1x，移动 390×844 @2x。
复跑：

```bash
pnpm build
pnpm preview --port 4321 --host 127.0.0.1
python3 docs/qa/RAY-634/verify.py http://127.0.0.1:4321
```

`ALL ASSERTIONS PASSED`（51 项），读数在 `results.json`。逐条对应验收项：

| 验收项 | 读数 | 结论 |
|---|---|---|
| 桌面 25 / 50 / 90% 宽度对应 | `scaleX` = 0.2500 / 0.5000 / 0.9000，与 `scrollY / maxScroll` 误差 < 0.01 | ✅ 截图 `1440-25/50/90.png` |
| 进度条位置 / 粗细 | `bar.top=48` = `header.bottom`；`height=3px`；左右贴边 0 / 1440 | ✅ |
| 颜色只用现有 token | 浅色 `rgb(0,0,0)` = `--color-accent`；暗色 `rgb(255,255,255)` | ✅ |
| 移动端 390 章节名随滚动切换 | 连续三张：`I. 委派（Delegation）` → `III. 鉴别（Discernment）` → `IV. 尽责（Diligence）`，与标题文字逐字一致 | ✅ `390-a/b/c.png` |
| 章节名单行截断 | 三张高度均 32px，`white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis` | ✅ |
| 不遮挡正文首行 / 不与目录按钮重叠 | 胶囊 `right=302`，目录按钮 `left=310`；底边对齐 812 | ✅ |
| 不与「回到顶部」重叠 | 文末操作栏进入视口时胶囊 `opacity=0`；`label.right=302`，`scroll-top` 按钮 `left=68` | ✅ `390-end.png` |
| 与目录浮层同时打开 | 浮层 `bottom=752`，章节名 `top=780`；浮层 `top=352`，进度条 `bottom=51`，均不重叠 | ✅ `390-toc-open.png` |
| 装饰层不抢点击 | 两者 `pointer-events: none`；`elementFromPoint` 在进度条处命中 `article.heti`、在胶囊处命中正文 `p` | ✅ |
| `prefers-reduced-motion: reduce` | 两者 `transition: none 0s`；进度仍更新（`scaleX=0.8`）、章节仍切换（3 段不同文字）、无报错 | ✅ `390-reduced-motion.png` |
| 长文（>10 h2） | 12 个 h2 的临时 fixture：25 / 50 / 90% 三张 + 三段不同章节名 | ✅ `fixture-*.png` |
| 短文（4 h2 真文章） | `biweekly-2605-a`：进度跟随、章节名可用、无报错 | ✅ `1440-short.png` |
| h3-only 真文章 | `justthinking-01`：`data-reading-level=3`，章节名「可能三：建立信用机制」 | ✅ `390-h3only.png` |
| 暗色主题 | 进度条 `rgb(255,255,255)`，胶囊底色跟随 token | ✅ `390-dark.png` |
| `pnpm build` | 44 页，0 错误 | ✅ 无新增依赖 |

控制台：失败断言里过滤掉的只有 jsdelivr 拉不到 `heti` 引起的
`ERR_NETWORK_CHANGED` / `Heti is not defined`（外部 CDN，与本次改动无关，原样记在
`results.json` 的 raw 字段里）。本组件没有产生任何 JS 报错。

## 截图

| 文件 | 内容 |
|---|---|
| `1440-25.png` / `1440-50.png` / `1440-90.png` | 真文章 `biweekly-2605-a` 桌面三档进度 |
| `390-a.png` / `390-b.png` / `390-c.png` | 真文章 390px 连续三屏，章节名切换 |
| `390-toc-open.png` | 目录浮层打开时进度条与章节名仍可见、不重叠、不抢点击 |
| `390-end.png` | 文末：章节名让位给「回到顶部」 |
| `390-reduced-motion.png` | 减少动效偏好下仍正常显示 |
| `390-dark.png` | 暗色主题 |
| `1440-short.png` | 短文（4 h2）桌面 |
| `390-h3only.png` | 只有 h3 的文章（回退到 h3 跟踪） |
| `fixture-1440-*.png` / `fixture-390-*.png` | 12 个 h2 的临时 fixture 长文（见下） |

## 长文 fixture 怎么复现

仓库里的真文章最多 4 个 h2，所以 >10 h2 的用例用一个临时 fixture 测：

```bash
cp docs/qa/RAY-634/fixture-qa-ray634-long.md src/content/posts/qa-ray634-long.md
pnpm build && pnpm preview --port 4321 --host 127.0.0.1
python3 docs/qa/RAY-634/verify.py http://127.0.0.1:4321   # 落在 /posts/qa-ray634-long/
rm src/content/posts/qa-ray634-long.md && pnpm build
```

fixture 不提交进 `src/content`（它会出现在文章列表与 sitemap 里）。没有装 fixture 时
`verify.py` 会打印一行 NOTE 并退回最长的真文章，脚本仍能跑完整套断言。

## 已知边界

- 只在 Chromium 验过；Firefox / Safari 未跑（`color-mix`、`min()`、`backdrop-filter`
  都是现行基线特性，但没有实测）。
- 章节名与进度条是纯视觉 HUD：`aria-hidden="true"`，不做 live region，
  避免读屏在每次滚动时重复播报；正文里的同名标题本来就可读。
- 进度按整篇文档算（含封面与页脚），不是「文章正文内的比例」。
