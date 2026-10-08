# RAY-550 自测记录（英文文章正文行高 1.2 → 1.4）

## 改了什么

`src/styles/global.css` 两条规则，其余样式文件零改动（Ray 挑定，原话「英文行高 1.4 might be cool」）：

| 选择器 | 改动前（RAY-528/530） | 改动后（本单） |
|---|---|---|
| `article.heti p:lang(en), article.heti li:lang(en)` | `line-height: 1.2` | **`1.4`** |
| `article.heti .ai-disclosure__summary:lang(en)`（RAY-544 新增的折叠区） | `line-height: 1.2` | **`1.4`** |

**全库 grep 确认英文文章上下文里只有这两处 `line-height: 1.2`**：`grep -n "lang(en)" src/styles/global.css`
只命中这两条规则（外加一处注释），构建产物 164 条 CSS 规则里 `:lang(en)` 规则也只有这两条。
段落、列表（ul/ol 的 `li`）、引用块内的 `p`、脚注 `li` 与脚注内 `p` 全部由第一条命中；
折叠区 `summary` 不是 `p`/`li`，故由第二条单独承载。

仍然用**无单位倍数**：每个字号各自按自己的 `font-size` 算出固定行高
（正文 18px → 英文 25.2px、脚注 14px → 19.6px），不被父级倍数连带缩放。
中文侧一律不动：`article.heti p/li:lang(zh)` 保持 **1.8**、summary:lang(zh) 保持 1.8、
全局 `:lang(zh) 1.8`、文章容器内联 `1.65`、`pre 1.6`、`blockquote` 自身 `1.1`、heti 标题固定 px。

构建产物 CSS 的逐规则 diff（把 `}` 拆行后 `diff`，前后各 **164** 条规则，只有这两行不同）：

```diff
- article.heti p:lang(en),article.heti li:lang(en){line-height:1.2}
+ article.heti p:lang(en),article.heti li:lang(en){line-height:1.4}
- article.heti .ai-disclosure__summary:lang(en){line-height:1.2}
+ article.heti .ai-disclosure__summary:lang(en){line-height:1.4}
```

## 这些数是怎么来的

`pnpm build` 出两份 `dist/`：**before** = 本单改动前的 `global.css`，**after** = 本分支（都是完整站点）。
两份都用 `python3 -m http.server` 起静态服务，Playwright **1.62.0** + 无头 **Google Chrome 151.0.7922.71**、
视口 1280×900，读数全部来自 `getComputedStyle`（`fontSize` / `lineHeight`），不靠肉眼。
行盒数用 `Range.getClientRects()` 按 `top` 去重计数（与 RAY-528/530 同口径）。

英文集合现在有了一篇真实译文 `/en/posts/justthinking/justthinking-04-metro-volunteer/`
（正文段 + 「AI Disclosure」折叠区），列表 / 引用 / 代码 / 脚注仍按 RAY-528/530 的做法
补一篇**临时探针文章** `src/content/posts-en/zz-lineheight-probe.md`，实测完即删、不入库
（同时清 `node_modules/.astro` 内容缓存，避免 `dist/` 继续生成探针页；正式产物 **44 页**，无探针残留）。

## 一、逐档行高表（英文文章，`html lang="en"`）

探针页 `/en/posts/zz-lineheight-probe/`，明暗两主题读数一致：

| 元素 | 字号 | 行高（前 → 后） | 比值（前 → 后） | 规则来源 | 本单 |
|---|---|---|---|---|---|
| 正文 `p` | 18px | **21.6 → 25.2** | **1.2 → 1.4** | `global.css`（本单） | ✅ 改 |
| 正文 `li`（ul / ol） | 18px | **21.6 → 25.2** | **1.2 → 1.4** | 同上 | ✅ 改 |
| 引用块内 `p` | 18px | **21.6 → 25.2** | **1.2 → 1.4** | 同上（同选择器命中） | ✅ 改 |
| 脚注 `li` | 14px | **16.8 → 19.6** | **1.2 → 1.4** | 同上（同选择器命中） | ✅ 改 |
| 脚注 `p`（`display:inline`） | 14px | **16.8 → 19.6** | **1.2 → 1.4** | 同上（同选择器命中） | ✅ 改 |
| 折叠区 `.ai-disclosure__summary` | 18px | **21.6 → 25.2** | **1.2 → 1.4** | `global.css` 第二条（本单） | ✅ 改 |
| 折叠区正文 `.ai-disclosure__body p` | 18px | **21.6 → 25.2** | **1.2 → 1.4** | 同正文 `p` 规则 | ✅ 改 |
| 正文里的行内 `code` | 16.2px（0.9em） | **19.44 → 22.68** | 1.2 → 1.4 | 继承 `p` 的无单位倍数 | 连带（相对关系保持） |
| `article.heti` 容器 | 18px | 29.7 → 29.7 | 1.65 | `ArticlePage.astro` 内联 | 保持 |
| `h1`–`h6` | 32/24/18/18/16/14px | 48 / 36 / 36 / 24 / 24 / 24 | 1.5 / 1.5 / 2.0 / 1.33 / 1.5 / 1.71 | `heti.min.css` 固定 px | 保持 |
| 代码块 `pre` / `pre code` | 14px | 22.4 → 22.4 | 1.6 | `global.css` | 保持 |
| 引用块 `blockquote` 自身 | 18px | 19.8 → 19.8 | 1.1 | `global.css` | 保持 |
| 脚注容器 `.footnotes` | 14px | 23.1 → 23.1 | 1.65 | 继承文章容器 | 保持 |
| 脚注标题 `.footnotes > h2` | 14px | 36 → 36 | 2.57 | `heti.min.css` 固定 px | 保持 |
| 脚注引用 `sup a` | 13.5px | 13.5 → 13.5 | 1.0 | `heti.min.css`（`.heti sup{line-height:1}`） | 保持 |
| 文章页标题 `.post-title` | 40px | 44 → 44 | 1.1 | `ArticlePage.astro` | 保持 |
| `body` / `header a` / `footer p` | 16 / 16 / 12px | 26.4 / 26.4 / 19.2 | 1.65 / 1.65 / 1.6 | 全局 | 保持 |

真实英文文章 `/en/posts/justthinking/justthinking-04-metro-volunteer/` 的读数：

| 元素 | 字号 | 行高（前 → 后） | 行盒数 | 盒高（前 → 后） |
|---|---|---|---|---|
| 正文 `p`（首段） | 18px | **21.6 → 25.2** | 6 → 6 | 129.56 → 151.13 |
| 折叠区 `summary` | 18px | **21.6 → 25.2** | 见注 1 | 21.59 → 25.19 |
| 折叠区正文 `p` | 18px | **21.6 → 25.2** | 9 → 9 | 194.34 → 226.69 |

**注 1（summary 仍是单行）**：`.ai-disclosure__summary` 是 `display:flex`（文字 + chevron 图标），
`Range.getClientRects()` 数的是 flex 子项而不是行，按 `top` 去重后会随行高变化在 2 / 3 之间跳（度量伪影）。
真正的判据是**盒高＝行高**：21.59 ≈ 1.2×18、25.19 ≈ 1.4×18，即「※ AI Disclosure ＋ chevron」始终一行。

## 二、逐档行高表（中文文章，`html lang="zh"`）—— 全部不变

实测页 `/posts/biweekly/biweekly-2605-a/`（列表 / 代码块 / 引用块 / 脚注）、
`/posts/justthinking/justthinking-03-blue-green/`（脚注），明暗两主题逐项相同：

| 元素 | 字号 | 行高（前 → 后） | 比值 | 规则来源 | 本单 |
|---|---|---|---|---|---|
| 正文 `p` / `li` / 引用块内 `p` | 18px | **32.4 → 32.4** | 1.8 | `global.css` | 保持 |
| 脚注 `li` / 脚注 `p` | 14px | 25.2 → 25.2 | 1.8 | 同上 | 保持 |
| 折叠区 `summary` / 折叠区正文 `p` | 18px | 32.4 → 32.4 | 1.8 | 同上 | 保持 |
| 代码块 `pre` / `pre code` | 14px | 22.4 / 25.2 | 1.6 / 1.8 | `global.css` / `:lang(zh)` | 保持 |
| `h2` / `h3` | 24 / 18px | 36 / 36 | 1.5 / 2.0 | `heti.min.css` | 保持 |
| 脚注容器 / 脚注标题 / `sup a` | 14 / 14 / 13.5px | 25.2 / 36 / 24.3 | 1.8 / 2.57 / 1.8 | — | 保持 |
| `article.heti` 容器 / `.post-title` / `body` | 18 / 40 / 16px | 29.7 / 44 / 28.8 | 1.65 / 1.1 / 1.8 | — | 保持 |

**中文侧整页零变化**：两份 `dist/` 的 46 个 HTML 页（含中文页）在归一化 CSS 文件名 hash 后**逐字节相同**；
中文页截图 before / after **逐字节相同**（`zh-body-paragraph-*.png`、`zh-footnotes-*.png` 各 9,823 B / 55,283 B，
md5 一致）。英文侧「不该动」的部分同样逐字节相同：`en-heading-before.png` 与 `en-heading-after.png`
是同一张图（3,858 B）。

## 三、before / after 读数与截图

**换行点零漂移**：英文两页里**每一个** `p` / `li` 的行盒数前后一致 ——
探针页 16 个元素、真实文章 22 个元素，共 **38 / 38 零变化**（`Range.getClientRects()` 按 `top` 去重计数）。

| 图（`docs/qa/RAY-550/`） | 说明 |
|---|---|
| `en-body-paragraph-before.png` / `-after.png` | 英文真实文章正文段（浅色；同 6 行、同换行点，行距放宽） |
| `en-body-paragraph-dark-before.png` / `-after.png` | 同上，深色主题 |
| `en-list-before.png` / `-after.png` | 英文探针无序列表（含行内 code） |
| `en-blockquote-before.png` / `-after.png` | 英文探针引用块 |
| `en-footnotes-before.png` / `-after.png`、`en-footnotes-dark-*.png` | 英文探针脚注区（编号 / 回跳箭头 / 换行均正常） |
| `en-disclosure-before.png` / `-after.png`、`en-disclosure-dark-*.png` | 「AI Disclosure」折叠区（summary 单行 + chevron，展开态正文） |
| `en-heading-before.png` / `-after.png` | 英文探针 h2（两张字节相同：标题不在本单范围） |
| `zh-body-paragraph-before.png` / `-after.png` | 中文正文段（两张字节相同） |
| `zh-footnotes-before.png` / `-after.png` | 中文脚注区（两张字节相同） |

## 四、回归检查

- **构建产物逐页比对**：46 个 HTML 页（含临时探针页）在 before / after 两份 `dist/` 里，
  把 CSS 文件名 hash 归一化后**逐字节相同**（真实差异 0 / 46）。
- **CSS 规则数**：前后各 164 条，只有上面那两条的 `line-height` 变化。
- **无溢出 / 裁切**：所有实测页 `documentElement.scrollWidth == clientWidth`（1280），明暗主题均无横向溢出。
- **JS 报错**：0（before / after 均为 0）。
- **`pnpm build`** ✅（探针版 46 pages、正式版 **44 pages**，exit 0）；
  **`.github/scripts/check-build.sh`** ✅（公众号图标 5 页、AI 声明区 6 页 = 源文件 6 篇、体积 14M）。
- **线上复核不在本单**：`https://raysview.fun/en/posts/justthinking/justthinking-04-metro-volunteer/`
  英文正文 computed `line-height` 应为 **25.2px**，中文页仍为 **32.4px**，由验收方在部署后执行。

## 五、遗留

- 临时探针文章 `src/content/posts-en/zz-lineheight-probe.md` 验证后已删除，未入库。
- `public/fonts/MiSans-VF.woff2` 会被 `pnpm build` 的 prebuild 子集脚本重写，本单跑完构建后
  `git status` 里无该文件改动（产物与仓库内版本一致），无需还原。
- 中英之外的第三处 `1.2` 不存在：`grep` 到的其余 `1.2` 都是 `margin-bottom: 1.2em`（段落下距，非行高）。
