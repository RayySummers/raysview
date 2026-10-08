# RAY-529 自测记录（文章页 / 系列页大标题字重 700 → 520）

## 改了什么

两处「页面大标题」的字重由 `700` 收到 **520**（＝站内 RAY-408 映射表的 SemiBold 对位档）：

| # | 文件 | 位置 | 元素 | 改前 → 改后 |
|---|---|---|---|---|
| 1 | `src/components/pages/ArticlePage.astro` | L116（内联 `style`） | `<h1 class="post-title">` 文章页标题 · 40px | `700` → **`520`** |
| 2 | `src/components/pages/SeriesPage.astro` | L32（内联 `style`） | 系列页 `<h1>` · 32px | `700` → **`520`** |

另在 `ArticlePage.astro` 的 `<style>` 块给 `.post-title` 补了一行说明性注释（只说明字重写在元素
内联 `style` 上，避免以后两处声明打架）。**没有**新增/删除任何 CSS 声明。

字号、行高（1.1）、字距（`--tracking-tight`）、`opsz`、`font-family`、`margin` 一律未动。
中英共用同一模板：英文系列页 `/en/posts/{justthinking,raydesign,biweekly}/` 同步生效。

Ray 2026-10-08：「文章标题可不可以也不要那么粗？改为 SemiBold 那附近也比较合适。」

## 为什么是 520（而不是 520–620 之间另取一点）

- **字号已经承担了层级**：页标题 40px，正文 h2 只有 24px（1.67× 字号、约 2.8× 字面面积），
  再叠 `line-height: 1.1` + `-0.02em` 字距，即使同为 520 也不会和 h2 混为一谈。
- **同视觉角色统一**：系列页 H1（32px）与文章页 H1 都是「页面大标题」，一并对齐到 520；
  RAY-408 已经把正文 h1–h6、About、ToC 都放在 520，页标题落回同一档后站内只剩「620 hover /
  520 SemiBold / 630 Bold 对位 / 700 Heavy」这套已有刻度，不引入新档位。
- **不取 620**：620 是 RAY-527 为 hover 定的「加粗档」。页标题是静止态，用 hover 档会让
  「静止＝520、交互＝620」的语义失效；且 40px 下 620 与 700 的观感差被大字号放大得不够明显，
  达不到 Ray 要的「不那么粗」。

## 一、逐页实测（computed style，全部命中）

改前 = `main` @ `a510e609` 原样构建；改后 = 本分支构建。两份各用 `python3 -m http.server`
起静态服务，Playwright ＋ 无头 Chromium，视口 **1280×900**、`deviceScaleFactor: 2`。
读数全部来自 `getComputedStyle` / `getBoundingClientRect` / `Range.getClientRects()`。

### 文章页标题（`h1.post-title`，6 页全中）

| 页面 | 标题（截断） | font-weight | 字号 | 行数 | 文字宽 | 盒高 |
|---|---|---|---|---|---|---|
| `/posts/welcome/` | RayView 有博客网站啦！ | 700 → **520** | 40px | 1→1 | 433.16 → 419.41 | 44 → 44 |
| `/posts/raydesign/emoji-everything/` | 关于 Emoji 的一切 \| RayDesign #1 | 700 → **520** | 40px | 1→1 | 583.00 → 553.39 | 44 → 44 |
| `/posts/biweekly/biweekly-2605-a/` | AI 的 4D 框架、AI 诚信声明… | 700 → **520** | 40px | 3→3 | 583.63 → 570.86 | 132 → 132 |
| `/posts/justthinking/justthinking-01-quiet-carriage/` | 「静音车厢」为何总是静不下来？… | 700 → **520** | 40px | 3→3 | 577.70 → 572.09 | 132 → 132 |
| `/posts/justthinking/justthinking-02-token-ciyuan/` | 谁有权给一个概念命名？… | 700 → **520** | 40px | 3→3 | 573.89 → 561.94 | 132 → 132 |
| `/posts/justthinking/justthinking-03-blue-green/` | 你的蓝色和我的蓝色一样吗？… | 700 → **520** | 40px | 2→2 | 578.03 → 575.38 | 88 → 88 |

### 系列页标题（首个 `h1`，3 中文 + 3 英文全中）

| 页面 | 标题 | font-weight | 字号 | 行数 | 文字宽 | 盒高 |
|---|---|---|---|---|---|---|
| `/posts/justthinking/` | 随便想想 / JustThinking | 700 → **520** | 32px | 1→1 | 331.58 → 315.78 | 35.19 → 35.19 |
| `/posts/raydesign/` | Ray 的设计课 / RayDesign | 700 → **520** | 32px | 1→1 | 356.63 → 339.88 | 35.19 → 35.19 |
| `/posts/biweekly/` | 半月记 / Biweekly | 700 → **520** | 32px | 1→1 | 243.66 → 231.25 | 35.19 → 35.19 |
| `/en/posts/justthinking/` | JustThinking | 700 → **520** | 32px | 1→1 | 182.66 → 168.78 | 35.19 → 35.19 |
| `/en/posts/raydesign/` | RayDesign | 700 → **520** | 32px | 1→1 | 148.77 → 138.38 | 35.19 → 35.19 |
| `/en/posts/biweekly/` | Biweekly | 700 → **520** | 32px | 1→1 | 126.09 → 115.61 | 35.19 → 35.19 |

### 回流（1280 宽，无位移）

6 个文章页 + 6 个系列页：**行数、盒高、文档高、滚动宽全部不变**，`scrollWidth == clientWidth == 1280`
（无横向溢出）。唯一的横向变化是拉丁字形变细带来的字宽收窄（−4 ~ −30px），中文全角字形定宽不参与。

## 二、窄屏复查（390×844 / 768×1024）

8 个页面 × 2 个视口逐页比对行数 / 盒高 / 文档高 / 横向溢出：

- **768 与 1280 宽：16/16 逐项相同**，零位移。
- **390 宽：8 页里 7 页逐项相同**；`/posts/justthinking/justthinking-02-token-ciyuan/`
  标题 **5 行 → 4 行**（盒高 220 → 176，文档高 11646 → 11602，−44px）。

断行变化逐字复核（390px，h1 内容宽 342px）：

| | 改前（700） | 改后（520） |
|---|---|---|
| L1 | 谁有权给一个概念 | 谁有权给一个概念 |
| L2 | 命名？——从 *(236px)* | 命名？——从 Token *(340px)* |
| L3 | Token 与「词元」 | 与「词元」之争说 |
| L4 | 之争说起 \| 随便想 | 起 \| 随便想想 #02 |
| L5 | 想 #02 | — |

原因：拉丁串 `Token` 在 520 下变窄，第 2 行腾出了位置。这是**少一行**的良性重排，无裁切、
无横向溢出；中文断行规则本身未变。属于本改动的已知副作用，记录在此备查。

## 三、目视校准（40px 页标题 ↔ 24px h2，同为 520）

见 `title-weight-before-after.png`（同一页面、同一视口、同一裁切宽度，左＝改前 / 右＝改后）：

- **40px 标题 vs 24px h2（都 520）**：字号差 1.67×、字面面积差约 2.8×，加上页标题独占一行
  （行高 1.1、`-0.02em`）与下方 14px 灰色 meta 行的衬托，两者语境完全不同 —— 观感上仍是
  「页标题 ≫ 小节标题」，同档位不会造成层级含混。**不需要在 520–620 之间另取点。**
- **40px 标题 vs 700 的旧值**：520 下页标题明显「松」了一档，正是 Ray 要的「不那么粗」，
  同时靠字号仍压得住正文 h2。
- **系列页 H1（32px）**：与文章页标题同步降到 520，两处「页面大标题」观感一致。

## 四、⚠️ 正文内嵌 h1：**没改**，但需要决策

`src/styles/global.css:345` 的 `article.heti h1` 仍是 **700**（32px）。它不是页面标题，而是
**正文里的一级小节标题**（markdown 里的 `#`），当前有 2 篇文章实际用到：

| 文章 | 内嵌 h1 数量 | 改前 / 改后 |
|---|---|---|
| `/posts/raydesign/emoji-everything/` | 7 | 32px / **700 → 700**（未动） |
| `/posts/biweekly/biweekly-2605-a/` | 5 | 32px / **700 → 700**（未动） |

改完后出现一处**字重倒挂**：页标题 40px@520 比正文小节标题 32px@700 更轻。
`article-hierarchy-{before,after}.png` 是同屏对照，可以直接看出改后小节标题比文章标题更粗。

**为什么没动**：本单 Out of Scope 写明「正文/其它元素字重」，且 Deliverables 只列了
`ArticlePage.astro` / `SeriesPage.astro` / `DESIGN.md`，改 `global.css` 属于扩单。
按「先标记、后动手」处理，把选择权交回 Ray / Oscar：

```diff
 /* src/styles/global.css:345 */
 article.heti h1 {
   font-size: var(--text-2xl);
-  font-weight: 700;
+  font-weight: 520;
   font-variation-settings: "opsz" 32;
 }
```

若采纳，正文 h1–h6 会全部落在 520、纯靠字号分档（32 / 24 / 18 …），与 RAY-408 的
「h2–h6 同档、只差字号」逻辑一致；代价是正文内 h1 失去唯一的重档信号。
**建议单独开一单**（涉及两篇已发布文章的正文观感，值得单独验收）。

## 五、回归检查（**没**改哪些）

`grep -rn "font-weight: *700" src` 复查后，剩余 700 全部是静态档，一处未动：

| 位置 | 说明 |
|---|---|
| `src/styles/global.css:345` | `article.heti h1` 正文内嵌一级标题（见第四节，待决策） |
| `src/components/pages/NotFoundPage.astro:16` | 404 大字 120px（静态） |
| `src/components/Header.astro:52` | 顶栏时钟（静态） |
| `src/components/LanguageSwitcher.astro:167` | 语言菜单 current 档（英文标签 700 ↔ 中文 600，RAY-465 校准，静态） |
| `src/styles/global.css:84` | `@font-face` 的 Geist Sans 700 字面声明（非规则） |

构建产物级交叉验证：

- HTML 里 `font-weight: 700` 出现次数 **50 → 38**，差值 12 处恰好等于
  「6 个文章页 + 6 个系列页」各少 1 处；**没有任何第三个页面发生变化**。
- 改后仍带内联 700 的只有两处：404 的 `<h1 style="font-size: 120px">` 与顶栏时钟 `<span>`，
  正是本单要求不动的静态档。
- CSS 产物 `assets/Base.BJOknivg.css` **改前改后 md5 完全相同**
  （`a454de59f5bec332599f6ab7823df547`）—— 本次只改了两条元素内联 `style`，零 CSS 规则变动。
  该 CSS 里仅存的 700 是 `article.heti h1`、`.lang-menu__item--current[lang=en]` 与 `@font-face`。
- 构建产物里 `class="post-title" ... font-weight: 520` 命中 **6 页**、
  `var(--text-2xl); font-weight: 520` 命中 **6 页**（3 中文 + 3 英文系列页），残留 700 命中 **0 页**。
- RAY-527 的 hover 档（`.post-title:hover` / `.nav-link:hover` → 620）与 RAY-525 的下划线行为
  都在各自的 scoped `<style>` 里，本次未触碰；文章页 `.post-title` 的 scoped 规则仍只声明
  `--post-title-size`。

## 六、构建

`pnpm build` → **37 page(s) built，exit 0**。

⚠️ 已知坑（同 RAY-525 / RAY-527）：`prebuild` 会重写 `public/fonts/MiSans-VF.woff2`
（子集脚本按仓库实际用字重压，本轮注释新增的汉字会进入子集），**已 `git checkout` 还原、未入库**。

## 七、复现方式

```bash
# before：main @a510e609 原样构建到独立目录；after：本分支
pnpm install && pnpm build
python3 -m http.server 8801 --bind 127.0.0.1   # before/dist
python3 -m http.server 8802 --bind 127.0.0.1   # after/dist
BEFORE_URL=http://127.0.0.1:8801 AFTER_URL=http://127.0.0.1:8802 node measure.mjs
```
