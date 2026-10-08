# RAY-545 自测记录（/posts 列表加 banner ＋ 系列名改为 pill hashtag）

## 改了什么

| # | 文件 | 内容 |
|---|---|---|
| 1 | `src/series.ts` | 新增 `displayPostTitle()`（去掉「 \| 系列名 #NN」后缀）、`seriesOfTag()`、`displayTags()`（系列标签前置）；删除只处理 RayDesign 的 `seriesPostTitle()` |
| 2 | `src/components/SeriesPill.astro` | **新增**：系列 pill 组件，`class="series-pill"`，文字 = `#` + i18n 短名，href = `/posts/<系列>/` |
| 3 | `src/styles/global.css` | 新增 `.series-pill` 规则（两页共用一份样式） |
| 4 | `src/components/pages/PostListPage.astro` | 每篇加 banner 封面（`class="list-cover"`，`listBanner ?? banner`、高 200px、object-fit: cover）；标题走 `displayPostTitle`；标签行走 `displayTags` + `<SeriesPill>` |
| 5 | `src/components/pages/ArticlePage.astro` | h1 走 `displayPostTitle`；标签行走 `displayTags` + `<SeriesPill>`（`<title>` / OG / JSON-LD 不动） |
| 6 | `src/components/pages/SeriesPage.astro` | 改用 `displayPostTitle()` |
| 7 | `src/components/pages/TagPage.astro` | 列表标题改用 `displayPostTitle()` |
| 8 | `src/search-index.ts` | 搜索下拉里的标题同样去后缀（系列名仍可搜到 —— 标签单独匹配） |
| 9 | `src/i18n/zh.json` / `en.json` | 新增 `series.<x>.pill` 短名：随便想想 / 半月记 / Ray 的设计课；JustThinking / Biweekly / RayDesign |
| 10 | `DESIGN.md` | Post Card 补封面与系列标签、Tag Pill 一节改写为系列 pill 规格、决策区加 RAY-545 条目 |

不改 frontmatter、不改 `/tags/` 页结构、不改 `<title>` / OG / JSON-LD（仍带「 \| 系列名 #NN」）。

## 两个实现口径（需求正文没写死，先按此落地）

1. **pill 显示名取 i18n 短名**：中文页「#随便想想 / #半月记 / #Ray 的设计课」，英文页「#JustThinking / #Biweekly / #RayDesign」。
   需求正文如此规定；mock ①（/posts）里的 `#JustThinking` 与 mock ② 的 `#随便想想` 互相不一致，取正文口径。
2. **系列标签前置**：biweekly 的 frontmatter 里 `biweekly` 排在第 6 枚（ai / anthropic / mint / toothpaste / website / biweekly），
   原位渲染 pill 会埋在行尾，与「系列以第一枚 hashtag 呈现」及 mock 不符 —— 故只在**展示层**把系列标签提到首位，
   其余标签保持原顺序，frontmatter 与 `/tags/<tag>/` 路由都不动。
3. **与 mock ② 的差异（需要 Ray 确认）**：mock 的文章页把 pill 单独放在 meta 行上方、标签行里仍保留 `#JustThinking`；
   本次按需求正文「标签行里第一条命中 SERIES_TAGS 的 tag 渲染为填充胶囊」实现 —— pill 在标签行内、
   原系列标签不再重复出现。若 Ray 更喜欢 mock 的位置，改一行即可。

## 实测方法

- `pnpm build`（44 页，exit 0），`python3 -m http.server` 起 `dist/` 静态服务。
- Playwright + **系统 Chrome**（`/usr/bin/google-chrome`），无头、视口 **1280×900**、`deviceScaleFactor: 2`。
- 主题：`localStorage.theme` 置 `light` / `dark`（页面 `html[data-theme]`），浅色、暗色各跑一遍。
- 读数全部来自 `getComputedStyle` / `getBoundingClientRect`，脚本见本目录 `verify.mjs`，
  原始读数见 `readings-after.json`（42 项断言，**0 失败**）。

## 一、结构断言（全部命中）

| 检查 | 结果 |
|---|---|
| `/posts` 7 篇全部有封面、高 200px、`object-fit: cover` | ✅ |
| `/posts` 标题无「 \| 系列名 #NN」 | ✅ 广州地铁志愿有感 / 你的蓝色和我的蓝色一样吗？ / 谁有权给一个概念命名？——从 Token 与「词元」之争说起 / 「静音车厢」为何总是静不下来？我推演了 6 种解法 / AI 的 4D 框架、AI 诚信声明、薄荷是牙膏味的、建站 / RayView 有博客网站啦！ / 关于 Emoji 的一切 |
| `/posts` pill 6 枚（welcome 无系列标签，故无 pill），文字 = 短名，href = 系列页，排在标签行首位 | ✅ `#随便想想`×4 → `/posts/justthinking/`；`#半月记` → `/posts/biweekly/`；`#Ray 的设计课` → `/posts/raydesign/` |
| 文章页 h1 无后缀、`<title>` 仍含后缀 | ✅ h1「广州地铁志愿有感」/ title「广州地铁志愿有感 \| 随便想想 #04 - 睿见 RayView」 |
| 英文页一致 | ✅ `/en/posts/` + `/en/posts/justthinking/justthinking-04-metro-volunteer/`：h1「Metro Volunteering」、pill `#JustThinking` → `/en/posts/justthinking/` |
| 点击 pill 进系列页 | ✅ 真实导航一次，落到 `/posts/justthinking/` |
| 标签页标题 | ✅ `/tags/JustThinking/` 4 篇标题均无后缀 |
| 全站扫描（44 个 HTML，剔除 `<title>` / meta / JSON-LD 后取可见文本） | ✅ 0 处残留「 \| 系列名」 |

## 二、pill 读数（`getComputedStyle`）

| 页面 | 主题 | 底色 | 文字色 | 对比度 | 圆角 | 字号 / 高 | 下划线 |
|---|---|---|---|---|---|---|---|
| `/posts/` | light | `rgb(27,27,27)` | `rgb(249,249,249)` | 16.4:1 | 999px | 12px / 16px | none |
| `/posts/` | dark | `rgb(226,226,226)` | `rgb(0,0,0)` | 16.2:1 | 999px | 12px / 16px | none |
| 文章页 | light | `rgb(27,27,27)` | `rgb(249,249,249)` | 16.4:1 | 999px | 14px / 18px | none |
| 文章页 | dark | `rgb(226,226,226)` | `rgb(0,0,0)` | 16.2:1 | 999px | 14px / 18px | none |

字号不写死、继承所在标签行：/posts 列表 12px → 胶囊高 **16px**（＝ mock ① 量到的 16px），
文章页 14px → **18px**（mock ② 量到 ≈18–20px）。浅色黑底白字，深色自动反相成白底黑字，无需额外主题规则。

## 三、目视对照（截图）

| 文件 | 内容 |
|---|---|
| `posts-light.png` / `posts-dark.png` | `/posts` 封面 + 标题 + pill（浅 / 深） |
| `article-light.png` / `article-dark.png` | 文章页 h1 + pill（浅 / 深） |
| `pill-zoom-light.png` / `pill-zoom-dark.png` | pill 局部放大（对照 mock 的圆角与内边距） |
| `article-biweekly-light.png` | biweekly（系列标签在 frontmatter 里排最后 → 前置后 pill 在行首） |
| `en-posts-light.png` / `en-article-light.png` | 英文列表 / 英文文章页 |
| `tag-page-light.png` | `/tags/JustThinking/` 标题去后缀回归 |

## 四、未覆盖 / 待确认

- mock ② 的 pill 位置（meta 行上方）未采用，见上文「口径 3」。
- 移动端窄屏未单独跑读数：pill 为 `inline-block` + `white-space: nowrap`，
  标签行本来就会随宽度换行，无新增溢出风险；如需逐档读数可补跑。
