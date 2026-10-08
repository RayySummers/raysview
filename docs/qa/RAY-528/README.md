# RAY-528 自测记录（文章正文行高：中文 1.6 / 英文 1.2）

## 改了什么

`src/styles/global.css` 两条规则，其余文件零改动：

| 选择器 | 改动前 | 改动后 |
|---|---|---|
| `article.heti p:lang(zh), article.heti li:lang(zh)` | `line-height: 1.9` | **`1.6`** |
| `article.heti p:lang(en), article.heti li:lang(en)` | （不存在，英文正文继承文章容器 1.65） | **`1.2`** |

两条都用**无单位倍数**：每个字号各自按自己的 `font-size` 算出固定行高（正文 18px → 中文 28.8px / 英文 21.6px），
不被父级倍数连带缩放。范围只到文章正文 `p`/`li`（`blockquote` 内的 `p` 同样命中）；
全局 `:lang(zh) 1.8`、文章容器内联 `1.65`、`pre 1.6`、`blockquote 1.1` 与 heti 的标题固定 px 全部不动。

构建产物 CSS 的完整 diff（`diff` 逐规则比对，只有这两条）：

```diff
- article.heti p:lang(zh),article.heti li:lang(zh){line-height:1.9}
+ article.heti p:lang(zh),article.heti li:lang(zh){line-height:1.6}
+ article.heti p:lang(en),article.heti li:lang(en){line-height:1.2}
```

## 这些数是怎么来的

`pnpm build` 出两份 `dist/`：**before** = `main`（190927d8）原样，**after** = 本分支。
两份都用 `python3 -m http.server` 起静态服务，Playwright + 无头 Chrome、视口 1280×900，
读数全部来自 `getComputedStyle`（`fontSize` / `lineHeight`）与 `Range.getClientRects()`（行盒数），不靠肉眼。
英文集合当前为空，按 RAY-525 的做法加了一篇**临时探针文章** `src/content/posts-en/zz-lineheight-probe.md`
（正文段 / h2–h6 / 列表 / 引用 / 代码块 / 行内代码 / 脚注各一），实测完即删、不入库。

## 一、逐档行高表（中文文章，`html lang="zh"`）

实测页：`/posts/justthinking/justthinking-03-blue-green/`、`/posts/biweekly/biweekly-2605-a/`（含代码块 / 引用块 / 脚注）。

| 元素 | 字号 | 行高（前 → 后） | 比值（前 → 后） | 规则来源 | 本单 |
|---|---|---|---|---|---|
| 正文 `p` | 18px | **34.2 → 28.8** | **1.9 → 1.6** | `global.css`（本单） | ✅ 改 |
| 正文 `li` | 18px | **34.2 → 28.8** | **1.9 → 1.6** | 同上 | ✅ 改 |
| 引用块内 `p` | 18px | **34.2 → 28.8** | **1.9 → 1.6** | 同上（同选择器命中） | ✅ 改 |
| 脚注 `li` | 14px | **26.6 → 22.4** | **1.9 → 1.6** | 同上（同选择器命中） | ✅ 改 |
| 脚注 `p`（`display:inline`） | 14px | **26.6 → 22.4** | **1.9 → 1.6** | 同上（同选择器命中） | ✅ 改 |
| `article.heti` 容器 | 18px | 29.7 → 29.7 | 1.65 | `ArticlePage.astro` 内联 | 保持 |
| `h1` | 32px | 48 → 48 | 1.5 | `heti.min.css` 固定 px | 保持 |
| `h2` | 24px | 36 → 36 | 1.5 | `heti.min.css` 固定 px | 保持 |
| `h3` | 18px | 36 → 36 | 2.0 | `heti.min.css` 固定 px | 保持 |
| `h4` / `h5` / `h6` | 18 / 16 / 14px | 24 → 24 | 1.33 / 1.5 / 1.71 | `heti.min.css` 固定 px | 保持 |
| 代码块 `pre` | 14px | 22.4 → 22.4 | 1.6 | `global.css` | 保持 |
| 代码块内 `code` | 14px | 25.2 → 25.2 | 1.8 | `:lang(zh)` 直接命中 | 保持（见注 1） |
| 正文里的行内 `code` | 16.2px（0.9em） | 29.16 → 29.16 | 1.8 | `:lang(zh)` 直接命中 | 保持（见注 1） |
| 引用块 `blockquote` 自身 | 18px | 19.8 → 19.8 | 1.1 | `global.css` | 保持 |
| 脚注容器 `.footnotes` | 14px | 25.2 → 25.2 | 1.8 | `:lang(zh)` | 保持 |
| 脚注标题 `.footnotes > h2` | 14px | 36 → 36 | 2.57 | `heti.min.css` 固定 px | 保持 |
| 脚注引用 `sup a` | 13.5px | 24.3 → 24.3 | 1.8 | `:lang(zh)` | 保持 |
| 图注 `figcaption` | — | — | — | 模板不产出（见注 2） | n/a |

**注 1（有意保持现状）**：行内 `code`（0.9em = 16.2px）与代码块内 `code` 都被 `:lang(zh) 1.8` **直接命中**，
拿到 29.16px / 25.2px，而不是从 `p`/`pre` 继承倍数。改前正文行高 34.2px 比它们高，所以看不出差别；
改后正文降到 28.8px，**含行内 code 的那一行会比普通行高 0.36px**（29.16 − 28.8，实测段落总高 86.75px = 3×28.8 + 0.35）。
0.36px 不可见，且本单只动正文 `p`/`li`，故不动它 —— 如后续要收，需另开一单给 `article.heti code` 补行高。

**注 2（模板现状）**：本仓库 markdown 只输出裸 `<img>`（无 `rehype-raw`、无 figure 插件），
构建产物 39 页里 `<figure>` / `<figcaption>` 出现 **0 次**；`heti.min.css` 里那条
`.heti figcaption { font-size: 14px }`（未设行高）目前没有实例，属于「规则在、元素不在」。

## 二、逐档行高表（英文文章，`html lang="en"`，临时探针）

| 元素 | 字号 | 行高（前 → 后） | 比值（前 → 后） | 规则来源 | 本单 |
|---|---|---|---|---|---|
| 正文 `p` | 18px | **29.7 → 21.6** | **1.65 → 1.2** | `global.css`（本单） | ✅ 改 |
| 正文 `li` | 18px | **29.7 → 21.6** | **1.65 → 1.2** | 同上 | ✅ 改 |
| 引用块内 `p` | 18px | **19.8 → 21.6** | **1.1 → 1.2** | 同上 | ⚠️ 附带（见注 3） |
| 脚注 `li` | 14px | **23.1 → 16.8** | **1.65 → 1.2** | 同上 | ✅ 改 |
| 脚注 `p` | 14px | **23.1 → 16.8** | **1.65 → 1.2** | 同上 | ✅ 改 |
| 正文里的行内 `code` | 16.2px | 26.73 → **19.44** | 1.65 → **1.2** | 继承 `p` 的倍数（英文无 `:lang(zh)` 直接命中） | ✅ 跟随 |
| `article.heti` 容器 | 18px | 29.7 → 29.7 | 1.65 | `ArticlePage.astro` 内联 | 保持 |
| `h1`–`h6` | 32/24/18/18/16/14px | 48 / 36 / 36 / 24 / 24 / 24 | 1.5 / 1.5 / 2.0 / 1.33 / 1.5 / 1.71 | `heti.min.css` 固定 px | 保持 |
| 代码块 `pre` / `pre code` | 14px | 22.4 → 22.4 | 1.6 | `global.css` | 保持 |
| 引用块 `blockquote` 自身 | 18px | 19.8 → 19.8 | 1.1 | `global.css` | 保持 |
| 脚注容器 `.footnotes` | 14px | 23.1 → 23.1 | 1.65 | 继承容器 | 保持 |
| 脚注标题 `.footnotes > h2` | 14px | 36 → 36 | 2.57 | `heti.min.css` 固定 px | 保持 |
| 脚注引用 `sup a` | 13.5px | 13.5 → 13.5 | 1.0 | `heti.min.css`（`.heti sup{line-height:1}`） | 保持 |

**注 3（附带变化）**：英文引用块内的 `p` 从 1.1 变成 1.2 —— 它此前没有任何直接规则，
只是继承 `blockquote` 的 1.1；新的 `article.heti p:lang(en)` 按「正文 `p` 一律 1.2」把它接管了。
这与中文侧一致（中文引用块内 `p` 一直是 1.9 / 现在 1.6，而 `blockquote` 自身恒为 1.1），
所以是对称行为而非意外；若 Ray 希望引用块内的英文段落保持 1.1，说一声即可改。

## 三、before / after 读数与截图

| 页面 | 元素 | 前 | 后 | 行数 | 段落盒高 |
|---|---|---|---|---|---|
| `/posts/justthinking/justthinking-03-blue-green/` | 正文 `p` | 18px / 34.2px | 18px / **28.8px** | 3 → 3 | 102.56 → 86.39 |
| `/posts/biweekly/biweekly-2605-a/` | 正文 `p` | 18px / 34.2px | 18px / **28.8px** | 1 → 1 | 34.19 → 28.80 |
| `/posts/biweekly/biweekly-2605-a/` | 引用块内 `p` | 18px / 34.2px | 18px / **28.8px** | 1 → 1 | 34.19 → 28.80 |
| `/posts/biweekly/biweekly-2605-a/` | 脚注 `li` | 14px / 26.6px | 14px / **22.4px** | 7 → 7 | 79.78 → 75.56 |
| `/en/posts/zz-lineheight-probe/`（探针） | 正文 `p` | 18px / 29.7px | 18px / **21.6px** | 8 → 8 | 178.13 → 129.56 |
| `/en/posts/zz-lineheight-probe/`（探针） | 正文 `li` | 18px / 29.7px | 18px / **21.6px** | 2 → 2 | 59.38 → 43.19 |
| `/en/posts/zz-lineheight-probe/`（探针） | 脚注 `li` | 14px / 23.1px | 14px / **16.8px** | 2 → 2 | 23.09 → 17.00 |

**换行点零漂移**：上表每一行的「行盒数」前后完全一致（`Range.getClientRects()` 计数），
截图逐字比对也是同一批字落在同一行 —— 收紧行距没有引起任何重排。

| 图 | 说明 |
|---|---|
| `zh-article-before.png` / `zh-article-after.png` | 中文正文段（同一段、同 3 行，行距收紧） |
| `en-article-before.png` / `en-article-after.png` | 英文探针正文段（同 6 行，1.65 → 1.2） |
| `zh-codeblock-before.png` / `zh-codeblock-after.png` | 代码块对照（computed 22.4 / 25.2 与盒高 125.56 前后完全一致） |

## 四、回归检查

- **非文章区域行高不动**（实测 computed，前后逐项相同）：
  顶栏导航链接 中文 16px→28.8（1.8）/ 英文 16px→26.4（1.65）；文章页标题 `.post-title` 40px→44（1.1）；
  `body` / `html` 中文 1.8、英文 1.65；首页 `/` 无任何变化。
- **构建产物逐页比对**：39 个 HTML 页在 before / after 两份 `dist/` 里**逐字节相同**
  （唯一差异是 CSS 文件名 hash），CSS 只多出/改动了上面那两条规则。
- **无溢出 / 裁切**：所有实测页 `documentElement.scrollWidth == clientWidth`（1280），
  逐个被测元素 `scrollWidth <= clientWidth + 1`；`pre` 仍是 `pre-wrap`，长代码行照旧折行不溢出。
- **JS 报错**：0。
- `pnpm build` ✅（39 pages，含探针；删掉探针后 38 pages 同样通过）。

## 五、遗留

- 临时探针文章 `src/content/posts-en/zz-lineheight-probe.md` 验证后已删除，未入库。
- `public/fonts/MiSans-VF.woff2` 会被 `pnpm build` 的 prebuild 子集脚本重写，提交前已 `git checkout` 还原。
