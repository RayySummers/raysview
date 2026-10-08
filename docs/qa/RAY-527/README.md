# RAY-527 自测记录（全站 hover 加粗降档：320 → 620）

## 改了什么

5 处 `:hover` 的加粗目标由 `font-weight: 700` 收到 **620**（＝静止 320 ＋ 300 档，约 SemiBold 观感）：

| # | 文件 | 规则 |
|---|---|---|
| 1 | `src/components/pages/HomePage.astro` | `.nav-link:hover`（首页 3 个系列链接） |
| 2 | `src/components/pages/PostListPage.astro` | `.nav-link:hover`（`/posts/`、`/en/posts/` 系列链接） |
| 3 | `src/components/pages/PostListPage.astro` | `.post-title:hover`（RAY-525 加入） |
| 4 | `src/components/pages/TagPage.astro` | `.post-title:hover`（RAY-525 加入） |
| 5 | `src/components/pages/SeriesPage.astro` | `.post-title:hover`（RAY-525 加入） |

过渡参数一律未动：`.nav-link` 仍是 `font-weight 100ms ease-out`；`.post-title` 仍是
`text-decoration-color var(--transition-fast)` ＋ `font-weight 100ms ease-out`。
静止态（320）、下划线、`::after` 划线动画、`fit-content` 收窄等全部逐字未改。

Ray 2026-10-08 反馈：「靠上去变成 Black 这么粗不太好；Light 加粗是 SemiBold 就够了」。

## 为什么是 620，不需要取整到 630

实测两支字体的可变轴（`fvar`）：

| 字体 | wght 轴 | 覆盖 620？ |
|---|---|---|
| MiSans VF（中文汉字） | 150 – 700（default 330） | ✅ 轴内，连续可变 |
| Roboto Flex Variable（拉丁 / 数字） | 100 – 1000（`@fontsource-variable/roboto-flex/opsz.css`） | ✅ 轴内，连续可变 |
| Zhudou Sans VF（标点兜底） | 250 – 900 | ✅ |
| Source Han Sans SC VF（全角标点兜底） | 250 – 900 | ✅ |

MiSans 的命名实例是 Semibold **520** / Bold **630** —— 那是实例名，不是轴的离散档位，
620 落在 520 与 630 之间照常插值渲染，**无需夹取到相邻实例**。
（对照：MiSans 的 wght 上限确实是 700，700 以上的值会被夹住，所以此前 hover 700 已是轴顶。）

## 这些数是怎么来的

`pnpm build` 出两份 `dist/`：**before** = `main` @ `190927d8` 原样（git worktree），
**after** = 本分支。两份各用 `python3 -m http.server` 起静态服务，
Playwright ＋ 无头 Chromium、视口 1280×900、`deviceScaleFactor: 2`。
读数全部来自 `getComputedStyle` / `getBoundingClientRect` / `Range.getClientRects()`，不靠肉眼。

- 过渡采样：hover 前在页面内挂一个 `requestAnimationFrame` 逐帧记录 `computed font-weight`，
  再 `mouse.move` 到元素中心，采样窗口 260ms（≈17–18 帧）。
- 靠后的列表项先 `scrollIntoView({block:'center'})` 再测，否则鼠标落点会在视口外、`:hover` 根本不触发（假阴性）。

## 一、逐处实测（17 个 hover 目标，全部命中）

「文字宽」＝ `Range.getClientRects()` 的最右边界；「卡片高」＝ 最近的 `<article>` 高度。

| # | 页面 | 元素 | 文本（截断） | 改前 hover | 改后 hover | 行数 | 文字宽 | 盒高 | 卡片高 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `/` | `a.nav-link` #0 | 文章 Posts… | 700 | **620** | 1→1 | 456→462 | 43.19→43.19 | —→— |
| 2 | `/` | `a.nav-link` #1 | 视频 Videos… | 700 | **620** | 1→1 | 469→476 | 43.19→43.19 | —→— |
| 3 | `/` | `a.nav-link` #2 | 关于 About… | 700 | **620** | 1→1 | 461→467 | 43.19→43.19 | —→— |
| 4 | `/posts/` | `a.nav-link` #0 | 随便想想 / JustThinking… | 700 | **620** | 2→2 | 516→519 | 28.8→28.8 | —→— |
| 5 | `/posts/` | `a.nav-link` #1 | 半月记 / Biweekly… | 700 | **620** | 2→2 | 470→475 | 28.8→28.8 | —→— |
| 6 | `/posts/` | `a.nav-link` #2 | Ray 的设计课 / RayDesign… | 700 | **620** | 2→2 | 530→534 | 28.8→28.8 | —→— |
| 7 | `/posts/` | `h3.post-title` #0 | 你的蓝色和我的蓝色一样吗？ \| 随便想想 #… | 700 | **620** | 1→1 | 666→667 | 28.8→28.8 | 54.39→54.39 |
| 8 | `/posts/` | `h3.post-title` #1 | 谁有权给一个概念命名？——从 Token 与… | 700 | **620** | 1→1 | 876→879 | 28.8→28.8 | 54.39→54.39 |
| 9 | `/posts/` | `h3.post-title` #2 | 「静音车厢」为何总是静不下来？我推演了 6 … | 700 | **620** | 1→1 | 827→828 | 28.8→28.8 | 54.39→54.39 |
| 10 | `/posts/` | `h3.post-title` #3 | AI 的 4D 框架、AI 诚信声明、薄荷是牙膏味的… | 700 | **620** | 1→1 | 848→856 | 28.8→28.8 | 54.39→54.39 |
| 11 | `/posts/` | `h3.post-title` #4 | RayView 有博客网站啦！… | 700 | **620** | 1→1 | 524→527 | 28.8→28.8 | 54.39→54.39 |
| 12 | `/posts/` | `h3.post-title` #5 | 关于 Emoji 的一切 \| RayDesign #… | 700 | **620** | 1→1 | 588→592 | 28.8→28.8 | 54.39→54.39 |
| 13 | `/tags/website/` | `h3.post-title` #0 | AI 的 4D 框架、AI 诚信声明、薄荷是牙膏味的… | 700 | **620** | 1→1 | 848→856 | 28.8→28.8 | 54.39→54.39 |
| 14 | `/tags/website/` | `h3.post-title` #1 | RayView 有博客网站啦！… | 700 | **620** | 1→1 | 524→527 | 28.8→28.8 | 54.39→54.39 |
| 15 | `/posts/justthinking/` | `h2.post-title` #0 | 你的蓝色和我的蓝色一样吗？ \| 随便想想 #… | 700 | **620** | 1→1 | 666→667 | 28.8→28.8 | 262.39→262.39 |
| 16 | `/posts/justthinking/` | `h2.post-title` #1 | 谁有权给一个概念命名？——从 Token 与… | 700 | **620** | 1→1 | 876→879 | 28.8→28.8 | 262.39→262.39 |
| 17 | `/posts/justthinking/` | `h2.post-title` #2 | 「静音车厢」为何总是静不下来？我推演了 6 … | 700 | **620** | 1→1 | 827→828 | 28.8→28.8 | 262.39→262.39 |

- **computed 字重**：改后 17/17 = 静止 `320` → hover `620`（改前 17/17 = `320` → `700`）。
- **过渡参数**：`.nav-link` 读回 `font-weight / 0.1s / ease-out`；`.post-title` 读回
  `text-decoration-color, font-weight / 0.15s, 0.1s / ease-out, ease-out` —— 与改前逐字相同。
- **下划线**：`.post-title` 静止 `rgba(0, 0, 0, 0)` → hover `rgb(27, 27, 27)`，RAY-525 的行为未受影响。

## 二、过渡采样（确认是插值，不是瞬跳）

同一支 `.nav-link`（首页第 1 项）hover 后逐帧 `computed font-weight`：

| 版本 | 采样（ms:值） |
|---|---|
| 改前（→700） | `0.5:320` `15.8:320` `31.7:419.25` `48.5:505.5` `65.3:580.25` `81.9:640.5` `98.4:683` `114.9:700` → 稳定 700 |
| 改后（→620） | `0.5:320` `7.9:320` `24.2:398.5` `40.9:466.5` `57.7:525.25` `74.5:573` `91.2:606.5` `107.8:619.75` `124.6:620` → 稳定 620 |

17 个目标在 hover 后 30–80ms 窗口内的采样值都落在 **398–573**（改前 419–683），
末值 17/17 = `620` —— 曲线平滑、档位收窄，过渡手感未劣化。

## 三、回流检查（无抖动）

17 个目标 hover 前后：

- **行数**：全部不变（`/posts/` 与 `/posts/justthinking/` 的多行标题 1→1，系列链接 2→2）。
- **元素盒高**：全部不变（`.nav-link` 43.19 / 28.8，`.post-title` 28.8）。
- **卡片高与卡片 y 坐标**：全部不变（54.39 / 262.39，坐标逐条相同）。
- **页面滚动位置与文档高**：全部不变（`scrollY`、`scrollHeight` 前后一致）。

唯一的横向变化是拉丁字形加粗带来的字宽增加（+1 ~ +8px），与 RAY-525 记录的同源行为一致；
中文全角字形定宽不参与，故无换行点漂移。视觉对照见 `post-title-320-620-700.png`。

## 四、回归检查（**没**改哪些）

`grep -rn "font-weight: 700" src` 复查后，剩余的 700 全部是静态档，一处未动：

| 位置 | 说明 |
|---|---|
| `src/styles/global.css:345` | `article.heti h1` 正文一级标题（静态） |
| `src/components/pages/ArticlePage.astro:116` | 文章页 `<h1>` 页标题（静态） |
| `src/components/pages/SeriesPage.astro:32` | 系列页 `<h1>` 页标题（静态） |
| `src/components/pages/NotFoundPage.astro:16` | 404 大字（静态） |
| `src/components/Header.astro:52` | 顶栏时钟（静态） |
| `src/components/LanguageSwitcher.astro:167` | 语言菜单 current 档（英文标签 700 ↔ 中文 600，RAY-465 校准，静态） |
| `src/styles/global.css:84` | `@font-face` 的 Geist Sans 700 字面声明（非规则） |

另外**未动**的 hover：`article.heti .footnotes a:hover`（脚注链接走 GRAD 轴 ＋ 380，专为防网址换行校准，
属另一套机制）、全局 `a:hover`、正文 / 标签链接。

- `/en/posts/`（英文集合）与中文共用 `PostListPage.astro`，构建产物里 `.post-title*` 规则一字不差
  （英文集合目前为空，同 RAY-525 的状态）。
- 全站构建产物扫描：`font-weight:620` 出现在 26 个 HTML 页面（含 `/en/` 系列 5 页），
  不存在残留的 hover `font-weight:700`。

## 五、构建

`pnpm build` → **37 page(s) built，exit 0**。

⚠️ 已知坑（同 RAY-525）：`prebuild` 会重写 `public/fonts/MiSans-VF.woff2`
（子集脚本按仓库实际用字重压，本轮注释新增的汉字会进入子集），**已 `git checkout` 还原、未入库**。
