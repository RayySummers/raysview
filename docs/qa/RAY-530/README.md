# RAY-530 自测记录（中文正文行高 1.6 → 1.8）

## 改了什么

`src/styles/global.css` 一条规则，其余样式文件零改动：

| 选择器 | 改动前（RAY-528） | 改动后（本单） |
|---|---|---|
| `article.heti p:lang(zh), article.heti li:lang(zh)` | `line-height: 1.6` | **`1.8`** |
| `article.heti p:lang(en), article.heti li:lang(en)` | `1.2` | `1.2`（**不动**） |

仍然用**无单位倍数**：每个字号各自按自己的 `font-size` 算出固定行高（正文 18px → 中文 32.4px / 英文 21.6px），
不被父级倍数连带缩放。范围只到文章正文 `p`/`li`（`blockquote` 内的 `p` 同样命中）；
全局 `:lang(zh) 1.8`、文章容器内联 `1.65`、`pre` 1.6、`blockquote` 1.1 与 heti 的标题固定 px 全部不动。

构建产物 CSS 的逐规则 diff（把 `}` 拆行后 `diff`，前后各 **151** 条规则，只有这一行不同）：

```diff
- article.heti p:lang(zh),article.heti li:lang(zh){line-height:1.6}
+ article.heti p:lang(zh),article.heti li:lang(zh){line-height:1.8}
```

## 这些数是怎么来的

`pnpm build` 出两份 `dist/`：**before** = 本单改动前的 `global.css`，**after** = 本分支。
两份都用 `python3 -m http.server` 起静态服务，Playwright 1.63.0 + 无头 **Google Chrome 151.0.7922.71**、
视口 1280×900，读数全部来自 `getComputedStyle`（`fontSize` / `lineHeight`），不靠肉眼。
行数用 `Range.getClientRects()` 去重计数。

> 环境说明：本机 Playwright 自带的 Chromium 版本与缓存不匹配（缺 `chromium_headless_shell-1243`），
> 故显式指定 `executablePath: /usr/bin/google-chrome` 用系统 Chrome 跑，其余口径与 RAY-528 一致。

英文集合当前仍为空，按 RAY-528 的做法加了一篇**临时探针文章** `src/content/posts-en/zz-lineheight-probe.md`
（正文段 / h2–h6 / 列表 / 引用 / 代码块 / 行内代码 / 脚注各一），实测完即删、不入库。

## 一、逐档行高表（中文文章，`html lang="zh"`）

实测页：`/posts/justthinking/justthinking-03-blue-green/`、`/posts/biweekly/biweekly-2605-a/`（含列表 / 代码块 / 引用块 / 脚注）。

| 元素 | 字号 | 行高（前 → 后） | 比值（前 → 后） | 规则来源 | 本单 |
|---|---|---|---|---|---|
| 正文 `p` | 18px | **28.8 → 32.4** | **1.6 → 1.8** | `global.css`（本单） | ✅ 改 |
| 正文 `li` | 18px | **28.8 → 32.4** | **1.6 → 1.8** | 同上 | ✅ 改 |
| 引用块内 `p` | 18px | **28.8 → 32.4** | **1.6 → 1.8** | 同上（同选择器命中） | ✅ 改 |
| 脚注 `li` | 14px | **22.4 → 25.2** | **1.6 → 1.8** | 同上（同选择器命中） | ✅ 改 |
| 脚注 `p`（`display:inline`） | 14px | **22.4 → 25.2** | **1.6 → 1.8** | 同上（同选择器命中） | ✅ 改 |
| `article.heti` 容器 | 18px | 29.7 → 29.7 | 1.65 | `ArticlePage.astro` 内联 | 保持 |
| `h1` | 32px | 48 → 48 | 1.5 | `heti.min.css` 固定 px | 保持 |
| `h2` | 24px | 36 → 36 | 1.5 | `heti.min.css` 固定 px | 保持 |
| `h3` | 18px | 36 → 36 | 2.0 | `heti.min.css` 固定 px | 保持 |
| `h4` / `h5` / `h6` | 18 / 16 / 14px | 24 → 24 | 1.33 / 1.5 / 1.71 | `heti.min.css` 固定 px | 保持 |
| 代码块 `pre` | 14px | 22.4 → 22.4 | 1.6 | `global.css` | 保持 |
| 代码块内 `code` | 14px | 25.2 → 25.2 | 1.8 | `:lang(zh)` 直接命中 | 保持 |
| 正文里的行内 `code` | 16.2px（0.9em） | 29.16 → 29.16 | 1.8 | `:lang(zh)` 直接命中 | 保持 |
| 引用块 `blockquote` 自身 | 18px | 19.8 → 19.8 | 1.1 | `global.css` | 保持 |
| 脚注容器 `.footnotes` | 14px | 25.2 → 25.2 | 1.8 | `:lang(zh)` | 保持 |
| 脚注标题 `.footnotes > h2` | 14px | 36 → 36 | 2.57 | `heti.min.css` 固定 px | 保持 |
| 脚注引用 `sup a` | 13.5px | 24.3 → 24.3 | 1.8 | `:lang(zh)` | 保持 |
| 文章页标题 `.post-title` | 40px | 44 → 44 | 1.1 | `ArticlePage.astro` | 保持 |

**注 1（盒高不等于行高）**：`blockquote` 自身、`.footnotes` 容器、`article.heti` 容器的**盒高**在本单变大，
是因为**子元素变高**、容器跟着长，它们自己的 computed `line-height` 前后完全一致（19.8 / 25.2 / 29.7）。
同理 `.footnotes li` / `.footnotes li p` 在 `/posts/biweekly/biweekly-2605-a/` 上盒高不动（75.56 / 66.38 前后相同）——
那条脚注里塞了 17px 的 `ms-icon` 回跳图标（`vertical-align:-4px`），且内层 `p` 是 `display:inline`，
行盒高度被内联内容顶住，不随 `li` 的倍数走。**本单口径认 computed `line-height`**（值为 22.4 → 25.2 已正确变化），
不认内联盒的 `getBoundingClientRect()`；在标题/代码/引用这些块级元素上两者一致，上表照旧给行高。

## 二、逐档行高表（英文文章，`html lang="en"`，临时探针）

| 元素 | 字号 | 行高（前 → 后） | 比值 | 规则来源 | 本单 |
|---|---|---|---|---|---|
| 正文 `p` | 18px | **21.6 → 21.6** | 1.2 | `global.css` | **保持不动** |
| 正文 `li` | 18px | **21.6 → 21.6** | 1.2 | 同上 | 保持 |
| 引用块内 `p` | 18px | 21.6 → 21.6 | 1.2 | 同上 | 保持 |
| 脚注 `li` / 脚注 `p` | 14px | 16.8 → 16.8 | 1.2 | 同上 | 保持 |
| 正文里的行内 `code` | 16.2px | 19.44 → 19.44 | 1.2 | 继承 `p` 的倍数 | 保持 |
| `article.heti` 容器 | 18px | 29.7 → 29.7 | 1.65 | `ArticlePage.astro` 内联 | 保持 |
| `h1`–`h6` | 32/24/18/18/16/14px | 48 / 36 / 36 / 24 / 24 / 24 | 1.5 / 1.5 / 2.0 / 1.33 / 1.5 / 1.71 | `heti.min.css` 固定 px | 保持 |
| 代码块 `pre` / `pre code` | 14px | 22.4 → 22.4 | 1.6 | `global.css` | 保持 |
| 引用块 `blockquote` 自身 | 18px | 19.8 → 19.8 | 1.1 | `global.css` | 保持 |
| 脚注容器 `.footnotes` | 14px | 23.1 → 23.1 | 1.65 | 继承容器 | 保持 |
| 脚注标题 `.footnotes > h2` | 14px | 36 → 36 | 2.57 | `heti.min.css` 固定 px | 保持 |
| 脚注引用 `sup a` | 13.5px | 13.5 → 13.5 | 1.0 | `heti.min.css`（`.heti sup{line-height:1}`） | 保持 |

**英文侧整页零变化**：探针页 before / after 两份 `dist` 的 HTML 逐字节相同，
`en-probe-paragraph-before.png` 与 `en-probe-paragraph-after.png` 也是**同一张图**（字节一致，64,786 B）。

## 三、before / after 读数与截图

| 页面 | 元素 | 前 | 后 | 行数 | 盒高 |
|---|---|---|---|---|---|
| `/posts/justthinking/justthinking-03-blue-green/` | 正文 `p` | 18px / 28.8px | 18px / **32.4px** | 3 → 3 | 86.39 → 97.17 |
| `/posts/biweekly/biweekly-2605-a/` | 正文 `p` | 18px / 28.8px | 18px / **32.4px** | 1 → 1 | 28.80 → 32.39 |
| `/posts/biweekly/biweekly-2605-a/` | 正文 `li` | 18px / 28.8px | 18px / **32.4px** | 1 → 1 | 89.98 → 97.17 |
| `/posts/biweekly/biweekly-2605-a/` | 引用块内 `p` | 18px / 28.8px | 18px / **32.4px** | 1 → 1 | 28.80 → 32.39 |
| `/posts/justthinking/justthinking-03-blue-green/` | 脚注 `li` | 14px / 22.4px | 14px / **25.2px** | 1 → 1 | 47.58 → 50.38 |
| `/posts/biweekly/biweekly-2605-a/` | 脚注 `li` | 14px / 22.4px | 14px / **25.2px** | 2 → 2 | 75.56 → 75.56（见注 1） |
| `/en/posts/zz-lineheight-probe/`（探针） | 正文 `p` | 18px / 21.6px | 18px / **21.6px** | 5 → 5 | 107.97 → 107.97 |
| `/en/posts/zz-lineheight-probe/`（探针） | 正文 `li` | 18px / 21.6px | 18px / **21.6px** | 1 → 1 | 21.59 → 21.59 |

**换行点零漂移**：上表每一行的「行盒数」前后完全一致（`Range.getClientRects()` 按 top 去重计数），
整站 37 页里被改到的段落都没有因为放宽行距而重排。

| 图 | 说明 |
|---|---|
| `zh-body-paragraph-before.png` / `zh-body-paragraph-after.png` | 中文正文段（`justthinking-03-blue-green`，同 3 行、同换行点，行距放宽） |
| `zh-list-blockquote-before.png` / `zh-list-blockquote-after.png` | 中文列表 + 代码块 + 引用块（`biweekly-2605-a`；代码块逐像素不变） |
| `en-probe-paragraph-before.png` / `en-probe-paragraph-after.png` | 英文探针正文段（两张图字节相同，21.6px 未动） |

## 四、回归检查

- **非文章区域行高不动**（实测 computed，前后逐项相同）：
  顶栏导航链接 16px → 28.8（1.8）、header logo 16px → 28.8、`body` / `html` 16px → 28.8、
  页脚 12px → 21.6、首页 `/` 全页零变化、文章页标题 `.post-title` 40px → 44（1.1）。
- **构建产物逐页比对**：37 个 HTML 页在 before / after 两份 `dist/` 里，
  把 CSS 文件名 hash 归一化后**逐字节相同**（真实差异 0 / 37；未归一化时 37/37 不同，差异只在 hash）。
- **CSS 规则数**：前后各 151 条，只有 `article.heti p:lang(zh)` 那一条的 `line-height` 变化。
- **无溢出 / 裁切**：所有实测页 `documentElement.scrollWidth == clientWidth`（1280）。
- **JS 报错**：0（before / after 均为 0）。
- `pnpm build` ✅（探针版 39 pages、正式版 **37 pages**，exit 0）。

## 五、遗留

- 临时探针文章 `src/content/posts-en/zz-lineheight-probe.md` 验证后已删除，未入库
  （同时清了 `node_modules/.astro` 内容缓存，避免 `dist/` 继续生成探针页）。
- `public/fonts/MiSans-VF.woff2` 会被 `pnpm build` 的 prebuild 子集脚本重写，提交前已 `git checkout` 还原。
- 线上复核不在本单：`https://raysview.fun/posts/justthinking/justthinking-03-blue-green/` 中文段落
  computed `line-height` 应为 **32.4px**，由验收方在部署后执行。
