# RAY-531 自测记录（页面大标题字重 520 → 620）

## 改了什么

两处「页面大标题」的字重由 RAY-529 落地的 `520` 提到 **`620`**（＝ RAY-527 定义的全站 hover 加粗档）：

| # | 文件 | 位置 | 元素 | 改前 → 改后 |
|---|---|---|---|---|
| 1 | `src/components/pages/ArticlePage.astro` | L116（内联 `style`） | `<h1 class="post-title">` 文章页标题 · 40px | `520` → **`620`** |
| 2 | `src/components/pages/SeriesPage.astro` | L32（内联 `style`） | 系列页 `<h1>` · 32px | `520` → **`620`** |
| 3 | `src/components/pages/ArticlePage.astro` | L176–178（`<style>` 内说明性注释） | `.post-title` 注释 | 补一行 RAY-531，避免注释里留着旧值 `520` 与代码打架 |
| 4 | `DESIGN.md` | 现行规格区 + 决策区 | Type Scale 表 / 标题说明 / 末尾新条目 | 见下 |

字号（40px / `--text-2xl` 32px）、行高 1.1、字距 `--tracking-tight`、`opsz`、
`font-family`、间距、颜色**一律未动**；hover 规则本身、正文内嵌 `article.heti h1`
以及其它任何样式都不在本次范围。

中英共用同一模板：英文系列页 `/en/posts/{justthinking,raydesign,biweekly}/` 同步生效。

## 为什么是 620

Ray 目视校准后点名指定（原话）：「**链接 hover 时的加粗效果就是我想要文章标题多粗**」
→ 取 620（RAY-527 标准：静止 320 + 300 档），站内既有刻度，不引入新档位。

RAY-529 曾把这两处从 700 收到 520，并在 DESIGN.md 里写明「未取 620 —— 那是为 hover 定义的档位，
静止态沿用会让『静止 520 / 交互 620』的语义失效」。本次 Ray 点名要该档，故 620 的语义由
「hover 专属」变为「**hover 与页面大标题共用**」；RAY-529 的历史条目按原样保留，未修改。

## 实测方法

- **改前**＝`main` @ `d62a41e4`（origin/main，含 RAY-530）原样构建；**改后**＝本分支构建。
  两次构建均 `pnpm build` 通过（37 页，exit 0），各自用 `python3 -m http.server` 起静态服务。
- Playwright + **系统 Chrome**（`/usr/bin/google-chrome`；本机自带 Chromium 与缓存版本不匹配）
  无头模式，视口 **1280×900**、`deviceScaleFactor: 2`。
- 主题：`localStorage.theme` 置 `light` / `dark`（页面 `html[data-theme]`），浅色、暗色各跑一遍。
- 读数全部来自 `getComputedStyle` / `getBoundingClientRect` / `Range.getClientRects()`；
  行数取 range 的行盒数量。
- hover 用**真实鼠标事件**（`page.mouse.move`）打到元素中心，等待 400ms（过渡 100ms）后读数，再移开复读。
- 每页读数与 hover 结果原样存于本目录 `readings-before.json` / `readings-after.json`，
  脚本见 `measure.mjs`。

## 一、逐页读数（浅色，全部命中）

### 文章页（`h1.post-title`，40px）

| 页面 | 标题 | font-weight | 字号 | 行数 | 文字宽 (px) | 盒高 (px) |
|---|---|---|---|---|---|---|
| `/posts/welcome/` | RayView 有博客网站啦！ | 520 → **620** | 40px | 1 → 1 | 419.41 → 427.08 | 44.00 → 44.00 |
| `/posts/raydesign/emoji-everything/` | 关于 Emoji 的一切 \| RayDesign #1 | 520 → **620** | 40px | 1 → 1 | 553.39 → 569.91 | 44.00 → 44.00 |
| `/posts/biweekly/biweekly-2605-a/` | AI 的 4D 框架、AI 诚信声明、薄荷是牙膏味的、建站 \| 半月记 2026.05.A | 520 → **620** | 40px | 3 → 3 | 570.86 → 578.00 | 132.00 → 132.00 |
| `/posts/justthinking/justthinking-01-quiet-carriage/` | 「静音车厢」为何总是静不下来？\| 随便想想 #1 | 520 → **620** | 40px | 3 → 3 | 572.09 → 575.22 | 132.00 → 132.00 |
| `/posts/justthinking/justthinking-02-token-ciyuan/` | 谁有权给一个概念命名？\| 随便想想 #2 | 520 → **620** | 40px | 3 → 3 | 561.94 → 568.61 | 132.00 → 132.00 |
| `/posts/justthinking/justthinking-03-blue-green/` | 你的蓝色和我的蓝色一样吗？\| 随便想想 #3 | 520 → **620** | 40px | 2 → 2 | 575.38 → 576.86 | 88.00 → 88.00 |

### 系列页（首个 `<h1>`，32px；中英共用模板）

| 页面 | 标题 | font-weight | 字号 | 行数 | 文字宽 (px) | 盒高 (px) |
|---|---|---|---|---|---|---|
| `/posts/justthinking/` | 随便想想 / JustThinking | 520 → **620** | 32px | 1 → 1 | 315.78 → 324.58 | 35.19 → 35.19 |
| `/posts/raydesign/` | Ray 的设计课 / RayDesign | 520 → **620** | 32px | 1 → 1 | 339.88 → 349.22 | 35.19 → 35.19 |
| `/posts/biweekly/` | 半月记 / Biweekly | 520 → **620** | 32px | 1 → 1 | 231.25 → 238.17 | 35.19 → 35.19 |
| `/en/posts/justthinking/` | JustThinking | 520 → **620** | 32px | 1 → 1 | 168.78 → 176.52 | 35.19 → 35.19 |
| `/en/posts/raydesign/` | RayDesign | 520 → **620** | 32px | 1 → 1 | 138.38 → 144.17 | 35.19 → 35.19 |
| `/en/posts/biweekly/` | Biweekly | 520 → **620** | 32px | 1 → 1 | 115.61 → 121.47 | 35.19 → 35.19 |

改后 12 页 font-weight 全部 = **620**（改前全部 = 520）。文字宽随字重变粗而增大 1.7%–6.7%
（中文页标题走 MiSans VF，620 在 150–700 轴内，无需取整夹取）。

## 二、暗色（`html[data-theme=dark]`）读数

| 页面 | 类别 | font-weight | 行数 | 文字宽 (px) | 盒高 (px) |
|---|---|---|---|---|---|
| `/posts/welcome/` | 文章页 | 520 → **620** | 1 → 1 | 419.41 → 427.08 | 44.00 → 44.00 |
| `/posts/raydesign/emoji-everything/` | 文章页 | 520 → **620** | 1 → 1 | 553.39 → 569.91 | 44.00 → 44.00 |
| `/posts/biweekly/biweekly-2605-a/` | 文章页 | 520 → **620** | 3 → 3 | 570.86 → 578.00 | 132.00 → 132.00 |
| `/posts/justthinking/justthinking-01-quiet-carriage/` | 文章页 | 520 → **620** | 3 → 3 | 572.09 → 575.22 | 132.00 → 132.00 |
| `/posts/justthinking/justthinking-02-token-ciyuan/` | 文章页 | 520 → **620** | 3 → 3 | 561.94 → 568.61 | 132.00 → 132.00 |
| `/posts/justthinking/justthinking-03-blue-green/` | 文章页 | 520 → **620** | 2 → 2 | 575.38 → 576.86 | 88.00 → 88.00 |
| `/posts/justthinking/` | 系列页 | 520 → **620** | 1 → 1 | 315.78 → 324.58 | 35.19 → 35.19 |
| `/posts/raydesign/` | 系列页 | 520 → **620** | 1 → 1 | 339.88 → 349.22 | 35.19 → 35.19 |
| `/posts/biweekly/` | 系列页 | 520 → **620** | 1 → 1 | 231.25 → 238.17 | 35.19 → 35.19 |
| `/en/posts/justthinking/` | 系列页 | 520 → **620** | 1 → 1 | 168.78 → 176.52 | 35.19 → 35.19 |
| `/en/posts/raydesign/` | 系列页 | 520 → **620** | 1 → 1 | 138.38 → 144.17 | 35.19 → 35.19 |
| `/en/posts/biweekly/` | 系列页 | 520 → **620** | 1 → 1 | 115.61 → 121.47 | 35.19 → 35.19 |

暗色读数与浅色逐项一致（字重、行数、文字宽、盒高），无主题相关差异。

## 三、窄屏（≤480px）回流检查

| 视口 | 主题 | 页面 | font-weight | 行数 | 文字宽 (px) | 盒高 (px) | 横向溢出 |
|---|---|---|---|---|---|---|---|
| 480x900 | 浅色 | `/posts/biweekly/biweekly-2605-a/` | 520 → **620** | 3 → 3 | 431.20 → 431.20 | 132.00 → 132.00 | False → False |
| 480x900 | 浅色 | `/posts/justthinking/justthinking-01-quiet-carriage/` | 520 → **620** | 3 → 3 | 431.20 → 431.20 | 132.00 → 132.00 | False → False |
| 480x900 | 浅色 | `/posts/justthinking/` | 520 → **620** | 1 → 1 | 315.78 → 324.58 | 35.19 → 35.19 | False → False |
| 480x900 | 浅色 | `/en/posts/biweekly/` | 520 → **620** | 1 → 1 | 115.61 → 121.47 | 35.19 → 35.19 | False → False |
| 480x900 | 暗色 | `/posts/biweekly/biweekly-2605-a/` | 520 → **620** | 3 → 3 | 431.20 → 431.20 | 132.00 → 132.00 | False → False |
| 480x900 | 暗色 | `/posts/justthinking/justthinking-01-quiet-carriage/` | 520 → **620** | 3 → 3 | 431.20 → 431.20 | 132.00 → 132.00 | False → False |
| 480x900 | 暗色 | `/posts/justthinking/` | 520 → **620** | 1 → 1 | 315.78 → 324.58 | 35.19 → 35.19 | False → False |
| 480x900 | 暗色 | `/en/posts/biweekly/` | 520 → **620** | 1 → 1 | 115.61 → 121.47 | 35.19 → 35.19 | False → False |
| 375x900 | 浅色 | `/posts/biweekly/biweekly-2605-a/` | 520 → **620** | 4 → 4 | 313.61 → 313.61 | 176.00 → 176.00 | False → False |
| 375x900 | 浅色 | `/posts/justthinking/justthinking-01-quiet-carriage/` | 520 → **620** | 4 → 4 | 313.61 → 313.61 | 176.00 → 176.00 | False → False |
| 375x900 | 浅色 | `/posts/justthinking/` | 520 → **620** | 1 → 1 | 315.78 → 324.58 | 35.19 → 35.19 | False → False |
| 375x900 | 浅色 | `/en/posts/biweekly/` | 520 → **620** | 1 → 1 | 115.61 → 121.47 | 35.19 → 35.19 | False → False |
| 375x900 | 暗色 | `/posts/biweekly/biweekly-2605-a/` | 520 → **620** | 4 → 4 | 313.61 → 313.61 | 176.00 → 176.00 | False → False |
| 375x900 | 暗色 | `/posts/justthinking/justthinking-01-quiet-carriage/` | 520 → **620** | 4 → 4 | 313.61 → 313.61 | 176.00 → 176.00 | False → False |
| 375x900 | 暗色 | `/posts/justthinking/` | 520 → **620** | 1 → 1 | 315.78 → 324.58 | 35.19 → 35.19 | False → False |
| 375x900 | 暗色 | `/en/posts/biweekly/` | 520 → **620** | 1 → 1 | 115.61 → 121.47 | 35.19 → 35.19 | False → False |

窄屏下文章页标题行数**零变化**（480px 三行、375px 四行），文字宽在窄屏被容器宽度吃满后
改前改后完全相同；`documentElement.scrollWidth == clientWidth`，横向溢出 false。
另外做了全页扫描：除标题自身外无任何元素越出视口右边界。

## 四、hover 复原对照（真实鼠标事件，浅色）

| 目标 | 静止 | hover | 移开 | 结论 |
|---|---|---|---|---|
| 系列页列表里的文章标题 `.post-title`（`/posts/justthinking/`） | 320 | **620** | 320 | 与改前逐项一致，未回归 |
| 同上，hover 时下划线色 | `rgba(0,0,0,0)` | `rgb(27,27,27)` | `rgba(0,0,0,0)` | 下划线出现/收起未变 |
| 首页三个 tab `.nav-link` | 320 | **620** | 320 | 与改前一致 |
| 文章页大标题 `h1.post-title`（鼠标压上去） | — | 改前 520 / 改后 **620** | — | 页标题不是链接，hover 不改变其字重 |
| 系列页大标题 `main h1`（鼠标压上去） | — | 改前 520 / 改后 **620** | — | 同上 |

即：hover 加粗档 620 本身**未做任何改动**；页面大标题只是补用了同一档位，
hover 的 320 → 620 → 320 往返行为逐项与改前一致。

## 五、未变项自检

- **构建产物逐字节核对**：改前/改后两份 `dist/` 的全部 37 页 HTML，
  归一化资源 hash 后做序列比对，**全站只有 12 处字符差异**，即 6 个文章页 + 6 个系列页
  的 `font-weight: 5` → `6`，没有第二处被动到。
- 计算值中 `line-height`（44px / 35.2px）、`letter-spacing`（-0.8px / -0.64px）、
  `font-family`（MiSans）、`font-optical-sizing`（auto）改前改后完全一致。
- 两次实测浏览器 console **0 error**（改前那轮的一次 `ERR_NETWORK_CHANGED` 是外链 CDN
  资源加载的偶发网络错误，重跑后消失，与本改动无关）。
- `pnpm build`：改前/改后各跑一次，均 **37 页、exit 0**。

## 六、对照图

- `article-title-520-620.png` — 文章页 `/posts/biweekly/biweekly-2605-a/`（3 行长标题）上下对照
- `series-title-520-620.png` — 系列页 `/posts/justthinking/` 与英文页 `/en/posts/raydesign/` 上下对照

（截图为元素级裁剪，浅色主题，`deviceScaleFactor: 2`。）

## 七、复现

```bash
# 改前：git worktree / stash 到 d62a41e4 后 pnpm build，dist 拷到 dist-before
# 改后：本分支 pnpm build
python3 -m http.server 8321 --bind 127.0.0.1   # 在 dist-before 下
python3 -m http.server 8322 --bind 127.0.0.1   # 在 dist-after 下
node measure.mjs http://127.0.0.1:8321 readings-before.json ./shots before
node measure.mjs http://127.0.0.1:8322 readings-after.json ./shots after
```

`measure.mjs` 依赖 `playwright`（本机装在 `~/node_modules`，脚本目录需能解析到它），
并固定用系统 Chrome：`chromium.launch({ executablePath: '/usr/bin/google-chrome' })`。

## 交付说明

- 除上述 3 个源文件外，`pnpm build` 的 `prebuild`（`scripts/subset-misans.mjs`）会重新生成
  `public/fonts/MiSans-VF.woff2`；该产物**已还原，未纳入本 PR diff**（保持与 `main` 一致）。
- 部署后线上复核由验收方执行，本记录只覆盖本地构建 + 无头浏览器实测。
