# DESIGN.md - RayView Blog Design System

> **Living document** — Record all design decisions, tokens, and specifications here.
> Update as the design evolves. This prevents context loss across sessions.

---

## 🎨 Design Principles

1. **极度扁平** — No shadows, no gradients, no borders unless functionally necessary
2. **极致对齐** — 8px grid system. Everything aligns to the grid.
3. **留白为王** — Generous whitespace. Let content breathe.
4. **静默交互** — Hover states are subtle. Motion is minimal and purposeful.
5. **色彩克制** — Monochrome base. Color is used only for functional purposes (theme contrast).

> RAY-476 补注：第 5 条的「单色基础」指**文章区**；关于页是本站唯一的 expressive 例外
> （蛋黄色蛋彩皮肤）。允许的边界与推导过程见下方 **Color System**。

---

## 📐 Grid & Spacing

### Base Unit
```
base-unit: 8px
```

### Spacing Scale
```
space-1:  4px   (tight gaps)
space-2:  8px   (element internal)
space-3:  16px  (component padding)
space-4:  24px  (mobile padding)
space-5:  32px  (section gaps)
space-6:  48px  (major sections)
space-7:  64px  (large gaps)
space-8:  96px  (hero spacing)
```

### Content Width
```
max-width: 680px
reading-width: 640px
```

### Breakpoints
```
mobile:  < 640px   → padding: 24px
desktop: >= 640px  → padding: 48px
```
**Note**: No other breakpoints. Layout is fluid between these.

---

## 🎨 Color System

> **RAY-476 起，全站颜色不再是六个手写值，而是一套可推导的体系。**
> 取的是 Material Design 3 的 **color system**（tone 阶梯 + 语义角色）——**只取这一层**：
> 不接 MD3 的组件、圆角规格、阴影 / elevation、ripple / state layer、动效曲线。
> 过渡时间仍然只有 150 / 200 / 300ms 三档；8px 网格与阅读宽度（640 / 680）不变。

### 源色与两处刻意偏离

源色（seed）`#F2C94C`，蛋黄色（HCT **H = 91.67 / C = 48.72 / T = 82.47**），**只服务关于页**。
MD3 的算法色板会从源色推导出 primary / secondary / tertiary / neutral 等 tone 阶梯。
本站有两处**刻意偏离** MD3 默认行为：

1. **文章区用 chroma = 0 的纯灰，不用 MD3 默认的 neutral 组。**
   MD3 的 neutral 会继承源色色相（chroma 10 时 `surface98` = `#fff8f1` 米白、
   `on-surface10` = `#201b0d` 深棕），整站会泛黄。文章区必须永远是灰调，
   所以这里显式把 chroma 压到 0 —— ramp 里每个值都满足 `R = G = B`。
2. **关于页用 primary 组，不用 tertiary 组。**
   MD3 的 tertiary 会主动转 60° 色相，在黄色系上推出橄榄绿
   （`tertiary tone 90` = `#e7e799`，像芥末不像蛋黄）。蛋黄色只能取 primary 组。

### 灰阶 ramp（chroma = 0）

编号即 HCT tone（等价 CIELAB L\*），实测每个值的 |ΔL\*| ≤ 0.23。
变量名 `--rv-gray-<tone>`。

| tone | hex | 用途 |
|------|-----|------|
| 0 | `#000000` | 暗色页面底（AMOLED 纯黑） |
| 4 | `#0E0E0E` | 暗色 surface-container-low |
| 6 | `#131313` | 暗色 surface |
| 10 | `#1B1B1B` | 亮色 on-surface（正文）；暗色 surface-container |
| 20 | `#303030` | 暗色 outline-variant |
| 30 | `#474747` | 亮色 on-surface-variant（次要文字） |
| 40 | `#5E5E5E` | 亮色 on-surface-muted（页脚次要文字，RAY-479） |
| 50 | `#777777` | outline（分隔线） |
| 60 | `#919191` | 暗色 outline；暗色 on-surface-muted（页脚次要文字，RAY-479） |
| 70 | `#ABABAB` | — |
| 80 | `#C6C6C6` | 亮色 outline-variant（边框）；暗色 on-surface-variant |
| 90 | `#E2E2E2` | 暗色 on-surface |
| 94 | `#EEEEEE` | surface-container |
| 95 | `#F1F1F1` | — |
| 96 | `#F3F3F3` | surface-container-low |
| 98 | `#F9F9F9` | surface（亮色页面底） |
| 99 | `#FCFCFC` | — |
| 100 | `#FFFFFF` | 亮色 surface / accent |

### MD3 语义角色

| 角色 | 亮色 | 暗色 |
|------|------|------|
| `--rv-surface` | tone 98 `#F9F9F9` | tone 6 `#131313` |
| `--rv-surface-container-low` | tone 96 `#F3F3F3` | tone 4 `#0E0E0E` |
| `--rv-surface-container` | tone 94 `#EEEEEE` | tone 10 `#1B1B1B` |
| `--rv-on-surface` | tone 10 `#1B1B1B` | tone 90 `#E2E2E2` |
| `--rv-on-surface-variant` | tone 30 `#474747` | tone 80 `#C6C6C6` |
| `--rv-on-surface-muted` | tone 40 `#5E5E5E` | tone 60 `#919191` |
| `--rv-outline` | tone 50 `#777777` | tone 60 `#919191` |
| `--rv-outline-variant` | tone 80 `#C6C6C6` | tone 20 `#303030` |

### 旧 token → 新值

六个旧变量名**保持不变**，全站组件零改动，变的只是它们指向的值。
亮色指向上面亮色那列，暗色指向暗色那列。

| Token | 原值（亮） | 新值（亮） | 原值（暗） | 新值（暗） |
|-------|-----------|-----------|-----------|-----------|
| `--color-bg` | `#F0F0F0` | `#F9F9F9` | `#000000` | `#000000`（保持） |
| `--color-surface` | `#FFFFFF` | `#FFFFFF`（保持） | `#0A0A0A` | `#0A0A0A`（保持） |
| `--color-text-primary` | `#000000` | `#1B1B1B` | `#FFFFFF` | `#E2E2E2` |
| `--color-text-secondary` | `#6B6B6B` | `#474747` | `#888888` | `#C6C6C6` |
| `--color-accent` | `#000000` | `#000000`（保持） | `#FFFFFF` | `#FFFFFF`（保持） |
| `--color-border` | `#E0E0E0` | `#C6C6C6` | `#1A1A1A` | `#303030` |

**`--color-surface` 与 `--color-accent` 为什么不换：** MD3 的 `surface-container` 比 `surface`
更深，是「卡片浮在底上」的另一套层次逻辑，直接套会改变现有卡片的视觉层次；
`--color-accent` 一旦换成彩色就会破坏全站灰调（正文与链接同色是本站的硬约束）。

### 关于页蛋黄色板

挂在 `<html data-page="about">` 上（由 `Base.astro` 的可选 prop `page` 输出），
只覆盖本页作用域内的 token，`:root` 的全局值一律不动。

| 角色 | 亮色 | 暗色 | 用途 |
|------|------|------|------|
| `--rv-about-bg` | tone 95 `#FFEFCD` | tone 10 `#241A00` | 页面底 + sticky 顶栏底色 |
| `--rv-about-bg-soft` | tone 90 `#FFE08B` | tone 20 `#3D2F00` | 浮层 / 分层块的底 |
| `--rv-about-on-bg` | tone 10 `#241A00` | tone 95 `#FFEFCD` | 主文字 |
| `--rv-about-on-bg-soft` | tone 30 `#584400` | tone 80 `#EBC246` | 次要文字 |
| `--rv-about-on-bg-muted` | tone 40 `#745B00` | tone 60 `#B08C09` | 页脚次要文字（RAY-479） |
| `--rv-about-accent` | tone 40 `#745B00` | tone 80 `#EBC246` | 深色强调 |
| `--rv-about-container` | tone 50 `#927300` | tone 50 `#927300` | 分隔线 / 分层块底 |

**每个色值都能在该色板的 MD3 官方 tone 刻度（tone 0–100）上查到**，由
`@material/material-color-utilities` 的 `TonalPalette.fromHueAndChroma(91.67, 48.72)` 复核：
tone 10 `#241A00`、tone 20 `#3D2F00`、tone 30 `#584400`、tone 40 `#745B00`、
tone 50 `#927300`、tone 60 `#B08C09`、tone 80 `#EBC246`、tone 90 `#FFE08B`、tone 95 `#FFEFCD`。

`bg` / `bg-soft` 的次序照 MD3「容器比 surface 深」的规矩：页底取最淡的 tone 95，
分层块 / 浮层降一档到 tone 90；暗色是它的镜像 —— 页底压到最深（tone 10），
浮层反而升一档（tone 20）。

**暗色模式也换色**，理由：关于页是本站唯一的 expressive 页面，它的身份就是「那块蛋黄」。
按 MD3 dark scheme 的做法取**同一色相的低 tone**，底色 tone 10 与暗色文章区的
tone 10–20 区间同档，夜里不会刺眼；换成保持暗灰则这页在暗色下就失去身份了。

> **教训（RAY-476 精修）**：早先这里写的 `--rv-about-container: #F1C100` 标注为
> 「primary tone 80」，但它**不在刻度上** —— 该色 H=91.89 / C=60.34 / T=80.09，
> 色相与本色板一致（91.67）而 chroma 偏高（60.34 vs 48.72），只是「亮度等于 tone 80」。
> 官方 tone 80 是 `#EBC246`。凡写 tone 号必须以色板实际刻度为准，不能只按 L\* 反推。

### 对比度自检（WCAG 2.1，实测值）

| 组合 | 对比度 | 等级 |
|------|--------|------|
| 亮色 surface98 / on-surface10（正文） | 16.36:1 | AAA |
| 亮色 surface98 / on-surface-variant30（次要文字） | 8.82:1 | AAA |
| 亮色 surface98 / on-surface-muted40（页脚，RAY-479） | 6.16:1 | AA |
| 亮色 surface98 / outline50（分隔线，装饰） | 4.25:1 | — |
| 暗色 surface6 / on-surface90 | 14.34:1 | AAA |
| 暗色 surface6 / on-surface-variant80 | 10.88:1 | AAA |
| 暗色 bg0 / on-surface-muted60（页脚，RAY-479） | 6.66:1 | AA |
| 关于页亮色 bg95 / on-bg10 | 15.11:1 | AAA |
| 关于页亮色 bg95 / on-bg-soft30 | 8.24:1 | AAA |
| 关于页亮色 bg95 / on-bg-muted40（页脚，RAY-479） | 5.71:1 | AA |
| 关于页亮色 bg95 / accent40 | 5.71:1 | AA |
| 关于页亮色 bg95 / container50（分隔线） | 3.95:1 | ≥3:1 |
| 关于页亮色 soft90 / on-bg10 | 13.32:1 | AAA |
| 关于页亮色 soft90 / on-bg-soft30 | 7.27:1 | AAA |
| 关于页暗色 bg10 / on-bg95 | 15.11:1 | AAA |
| 关于页暗色 bg10 / on-bg-soft80 | 10.09:1 | AAA |
| 关于页暗色 bg10 / on-bg-muted60（页脚，RAY-479） | 5.40:1 | AA |
| 关于页暗色 bg10 / accent80 | 10.09:1 | AAA |
| 关于页暗色 bg10 / container50（分隔线） | 3.82:1 | ≥3:1 |
| 关于页暗色 soft20 / on-bg95 | 11.51:1 | AAA |
| 关于页暗色 soft20 / on-bg-soft80 | 7.69:1 | AAA |

### 亮色（`global.css` 的 `:root`）

```css
:root {
  /* MD3 语义角色 —— 亮色 */
  --rv-surface:               var(--rv-gray-98);  /* #F9F9F9 */
  --rv-surface-container-low: var(--rv-gray-96);  /* #F3F3F3 */
  --rv-surface-container:     var(--rv-gray-94);  /* #EEEEEE */
  --rv-on-surface:            var(--rv-gray-10);  /* #1B1B1B */
  --rv-on-surface-variant:    var(--rv-gray-30);  /* #474747 */
  --rv-on-surface-muted:      var(--rv-gray-40);  /* #5E5E5E —— 页脚次要文字（RAY-479） */
  --rv-outline:               var(--rv-gray-50);  /* #777777 */
  --rv-outline-variant:       var(--rv-gray-80);  /* #C6C6C6 */

  /* 旧 token（变量名不变，值指向上面的角色） */
  --color-bg: var(--rv-surface);                        /* #F9F9F9 */
  --color-surface: #FFFFFF;
  --color-text-primary: var(--rv-on-surface);           /* #1B1B1B */
  --color-text-secondary: var(--rv-on-surface-variant); /* #474747 */
  --color-accent: #000000;
  --color-border: var(--rv-outline-variant);            /* #C6C6C6 */

  /* Transitions */
  --transition-fast: 150ms ease-out;
  --transition-base: 200ms ease-out;
  --transition-slow: 300ms ease-out;
}
```

### 暗色（AMOLED）

```css
[data-theme="dark"] {
  /* MD3 语义角色 —— 暗色 */
  --rv-surface:               var(--rv-gray-6);   /* #131313 */
  --rv-surface-container-low: var(--rv-gray-4);   /* #0E0E0E */
  --rv-surface-container:     var(--rv-gray-10);  /* #1B1B1B */
  --rv-on-surface:            var(--rv-gray-90);  /* #E2E2E2 */
  --rv-on-surface-variant:    var(--rv-gray-80);  /* #C6C6C6 */
  --rv-on-surface-muted:      var(--rv-gray-60);  /* #919191 —— 页脚次要文字（RAY-479） */
  --rv-outline:               var(--rv-gray-60);  /* #919191 */
  --rv-outline-variant:       var(--rv-gray-20);  /* #303030 */

  --color-bg: #000000;                                  /* 保持 AMOLED 纯黑（tone 0） */
  --color-surface: #0A0A0A;
  --color-text-primary: var(--rv-on-surface);           /* #E2E2E2 */
  --color-text-secondary: var(--rv-on-surface-variant); /* #C6C6C6 */
  --color-accent: #FFFFFF;
  --color-border: var(--rv-outline-variant);            /* #303030 */
}
```

### Theme Toggle Behavior

| State | Icon | Action |
|-------|------|--------|
| Light | Sun (☀) | Click → Dark |
| Dark | Moon (☾) | Click → System |
| System | Monitor (⬜) | Click → Light |

Icon shows current target state, not current active state.

---

## 🔤 Typography

### Font Stack

> **现状（对齐 `global.css`，RAY-476 补正）** —— 本站**没有** Inter；
> CJK 汉字的主字体是 **MiSans**（`--font-sans` 的第一顺位），不是 Zhudou Sans。
> 以代码为准：两者冲突时 `global.css` 赢。

```css
/* 正文 / 界面（--font-sans）：MiSans → Zhudou Sans → Roboto Flex → Geist Sans → Source Han Sans SC */
--font-sans: "MiSans", "Zhudou Sans", "Roboto Flex Variable", "Geist Sans", "Source Han Sans SC",
             ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

/* 展示 / 纯拉丁（--font-display） */
--font-display: "Roboto Flex Variable", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

/* 等宽（--font-mono，JetBrains Mono 在前） */
--font-mono: "JetBrains Mono", "Sarasa Mono SC", ui-monospace, "SF Mono", Menlo, Consolas, monospace;

/* 已弃用，仅为 .date-cjk 的数字回退保留（RAY-391） */
--font-date: "MiSans Date", "MiSans", ui-sans-serif, system-ui, sans-serif;
```

代码块与行内代码另外**直接写死**了一串等宽栈（顺序与 `--font-mono` 相反，`article.heti pre` / `code` 用）：

```css
font-family: "Sarasa Mono SC", "JetBrains Mono", Consolas, ui-monospace, monospace;
```

### 实际加载的字体族（`@font-face`）

| 字体族 | 来源 | 覆盖范围 |
|--------|------|----------|
| `MiSans` | 本地 `/fonts/MiSans-VF.woff2`（构建时按用字子集化，见 `scripts/subset-misans.mjs`） | CJK 汉字；**排除**数字 / 拉丁，以及全角 / CJK 标点（RAY-390） |
| `MiSans Date` | 同一个 MiSans VF 文件 | 仅 `U+0030-0039` 数字与 `U+002D`，供 `.date-cjk` 齐线等宽（SS04/tnum） |
| `Zhudou Sans` | 本地 `/fonts/ZhudouSansVF.woff2` | 标点兜底：`U+3000-303F`、`U+FF00-FFEF`、`U+2000-206F`、`U+2190-21FF`、`U+2600-26FF`、`U+2700-27BF`，带 `ss02` |
| `Roboto Flex Variable` | `@fontsource-variable/roboto-flex/opsz.css` | 拉丁 / 数字 / 半角标点，可变轴 `wght` 100–1000 + `opsz` 8–144 |
| `Geist Sans` | jsDelivr CDN（`@fontsource/geist-sans`，逐字重 100–900） | 拉丁备用 |
| `Source Han Sans SC` | jsDelivr CDN（`@fontpkg/source-han-sans-sc-vf`） | CJK 兜底，含全角标点 |
| `FnHover` | 本地 `roboto-flex-latin-gradonly.woff2`（wght 钉死 400，只留 GRAD）+ Source Han Sans SC | 脚注链接 hover 加粗：**只变笔画不变字宽**，避免网址换行 |
| `JetBrains Mono` | Google Fonts | 等宽 |
| `Noto Serif SC` | Google Fonts | `article.heti blockquote` 引用块 |

`.date-cjk` 另有专用栈 `"MiSans", "MiSans Date", "Source Han Sans SC", sans-serif`。
字体栈本身在 RAY-476 **未做任何改动**。

### Roboto Flex OpenType Features
Roboto Flex is a variable font loaded with the `opsz` and `wght` axes (`@fontsource-variable/roboto-flex/opsz.css`).

- **Optical sizing (`opsz`)**: base text uses `font-optical-sizing: auto`; article headings pin explicit values mapped to the type scale (`"opsz" 32` for `--text-2xl`, `"opsz" 24` for `--text-xl`, `"opsz" 18` for `--text-lg`).
- **Kerning (`kern`)**: enabled on `article.heti`. Features unsupported by Roboto Flex (`vkrn`, `dlig`, `ccnp`) are intentionally not set — Roboto Flex only ships `kern`, `liga`, `locl`, `pnum`, `rvrn`, `mark`, `mkmk`.
- Weight (`wght`) and width (`wdth`) are available in the font but left at their defaults; grade (`GRAD`) is not used.

### Type Scale

| Token | Size | Weight | Line-height | Usage |
|-------|------|--------|-------------|-------|
| text-xs | 12px | 400 | 1.5 | Meta, dates, tags |
| text-sm | 14px | 400 | 1.5 | Secondary body |
| text-base | 16px | 400 | 1.65 | Primary body |
| text-lg | 18px | 400 | 1.65 | Large body, post content |
| text-xl | 24px | 600 | 1.3 | h3 |
| text-2xl | 32px | 600 | 1.2 | h2 |
| text-3xl | 48px | 600 | 1.1 | h1 (hero, e.g. videos 敬请期待) |

> **Article page title** — `--post-title-size: 40px` (page-scoped token in `src/pages/posts/[...slug].astro`), applied to the article H1 via `.post-title`. Slightly smaller than `--text-3xl` (48px) so the reading page feels calmer; the global token stays 48px for hero contexts.

### Letter Spacing
```css
--tracking-tight: -0.02em;  /* Headlines */
--tracking-normal: 0;        /* Body */
```

### Chinese Typography
For Chinese text, increase line-height to 1.8 for readability:
```css
:lang(zh) {
  line-height: 1.8;
}
```
Article body (reading experience) uses a slightly looser rhythm — 1.9 — scoped to the article so header/cards/code blocks are unaffected:
```css
article.heti p:lang(zh),
article.heti li:lang(zh) {
  line-height: 1.9;
}
```

---

## 🧩 Components

### Header
```css
height: 48px;
position: sticky;
top: 0;
z-index: 100;
background: color-mix(in srgb, var(--color-bg) 80%, transparent);
backdrop-filter: blur(12px);
/* Content */
display: flex;
align-items: center;
justify-content: space-between;
padding: 0 24px; /* mobile */
padding: 0 48px; /* desktop */
```
**States:**
- Default: transparent blur
- Scrolled: same (no change needed — already blurred)

### Logo/Brand
```css
font-size: 14px;
font-weight: 600;
letter-spacing: -0.02em;
color: var(--color-text-primary);
text-decoration: none;
```
**States:**
- Hover: opacity 0.7

### Theme Toggle Button
```css
width: 32px;
height: 32px;
display: flex;
align-items: center;
justify-content: center;
border: none;
background: none;
cursor: pointer;
color: var(--color-text-primary);
```
**States:**
- Hover: opacity 0.7
- Active: rotate icon 360° over 300ms

### Search Input
```css
width: 180px;
height: 32px;
padding: 8px 12px;
border: 1px solid var(--color-border);
border-radius: 0;
background: var(--color-surface);
color: var(--color-text-primary);
font-size: 14px;
```
**States:**
- Default: border-color = --color-border
- Focus: border-color = --color-accent, outline: none
- Placeholder: color = --color-text-secondary

### Navigation Links
```css
font-size: 14px;
color: var(--color-text-secondary);
text-decoration: none;
```
**States:**
- Hover: color = --color-text-primary, text-decoration: underline

### Post Card (Archive)
```css
/* Container */
margin-bottom: 16px;

/* Title */
font-size: 16px;
font-weight: 400;
color: var(--color-text-primary);
text-decoration: underline;
text-decoration-color: transparent;
text-underline-offset: 3px;
transition: text-decoration-color var(--transition-fast);

/* Meta (date) */
font-size: 12px;
color: var(--color-text-secondary);
margin-top: 4px;

/* Tags */
font-size: 12px;
color: var(--color-text-secondary);
margin-top: 4px;
span:not(:last-child)::after { content: ", "; }
```

**States:**
- Title hover: text-decoration-color = currentColor
- Tag hover: color = --color-text-primary, underline

### Month Group Header (Archive)
```css
font-size: 12px;
color: var(--color-text-secondary);
text-transform: uppercase;
letter-spacing: 0.05em;
margin-top: 48px;
margin-bottom: 16px;
```

### Tag Pill
```css
font-size: 12px;
color: var(--color-text-secondary);
text-decoration: none;
```
**States:**
- Hover: color = --color-text-primary, underline

### Footer
```css
height: 48px;
display: flex;
align-items: center;
justify-content: center;
font-size: 12px;
color: var(--rv-on-surface-muted);   /* RAY-479：版权行与备案号；关于页重定向到 --rv-about-on-bg-muted */
```
footer 的次要文字**不**走 `--color-text-secondary`（全站共用，动它会连带文章区的
日期 / 注释 / 标签），而是用专用的 `--rv-on-surface-muted`：亮 tone 40 `#5E5E5E`、
暗 tone 60 `#919191`、关于页同色板 tone 40 / tone 60。版权行与备案号同色 ——
备案号是工信部的法律展示项，取的是 4.5:1 下限那一档（浅色 tone 50 只有 4.25:1，不够）。

### Banner Image
```css
width: 100%;
max-height: 400px;
object-fit: cover;
display: block;
margin-bottom: 32px;
```
**Dark Mode:**
```css
[data-theme="dark"] img {
  filter: grayscale(100%) brightness(0.8);
}
```

### Code Blocks
```css
font-family: "Sarasa Mono SC", "JetBrains Mono", Consolas, ui-monospace, monospace;
font-size: 14px;
line-height: 1.6;
background: var(--color-surface);
padding: 16px;
overflow-x: auto;
```

---

## ✨ Motion Specifications

### Page Transitions (View Transitions API)
```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 200ms;
  animation-timing-function: ease-out;
}

::view-transition-old(root) {
  animation-name: fade-out;
}

::view-transition-new(root) {
  animation-name: fade-in;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Micro-interactions

| Element | Property | Duration | Easing |
|---------|-----------|----------|--------|
| Link underline | opacity | 150ms | ease-out |
| Theme toggle | transform (rotate) | 300ms | ease-out |
| Search focus | border-color | 150ms | ease-out |

---

## 📱 Responsive Behavior

### Layout Strategy
Single column, always. No grid changes.

### Horizontal Padding
```css
/* Mobile (< 640px) */
padding-left: 24px;
padding-right: 24px;

/* Desktop (>= 640px) */
padding-left: 48px;
padding-right: 48px;
```

### Content Max-width
```css
max-width: 680px;
margin-left: auto;
margin-right: auto;
```

### Search Bar Responsive
- Mobile: Search icon only, expands to input on tap
- Desktop: Always visible input

---

## 🖼️ Image Treatment

### Banner Images
- Aspect ratio: 16:9 (recommended)
- Max file size: 200KB
- Formats: WebP preferred, JPEG fallback
- Dark mode: `filter: grayscale(100%) brightness(0.8)`

### No Images in Post Body
- If user includes images, they render normally
- No special treatment (already minimal)

---

## 📝 Design Decisions Log

### 2024-01-XX: Initial Design
- **Decision**: Use CSS custom properties for theming
- **Rationale**: No JS required for theme switching. System preference detection via `prefers-color-scheme`.
- **Status**: Approved

### 2024-01-XX: No Comments
- **Decision**: Explicitly exclude comment functionality
- **Rationale**: User requested no comments. Simplicity.
- **Status**: Approved

### 2024-01-XX: Static Search Index
- **Decision**: Generate `/search.json` at build time
- **Rationale**: GitHub Pages can't run server-side search. Client-side fuzzy search via Fuse.js.
- **Status**: Approved

### 2026-09-23 (RAY-476): 接入 MD3 色彩系统
- **Decision**: 全站颜色改为 MD3 tonal palette 推导，源色 `#F2C94C`。
  文章区取 **chroma = 0 的纯灰** ramp（不用 MD3 默认 neutral，避免整站泛黄）；
  关于页取 **primary 组**蛋黄色（`#FFEFCD` 底 / `#241A00` 字，不用 tertiary，避免橄榄绿）。
  暗色下关于页同步换成同色相低 tone（`#241A00` 底 / `#FFEFCD` 字）。
  **只取 color system**，不接 MD3 的组件 / 圆角 / elevation / ripple / 动效。
- **Rationale**: 六个手写色值无法解释「为什么是这个值」，也无法成对推导暗色；
  tone 阶梯让亮暗两套值来自同一条轴，新增页面只需挑 tone。
  保持 `--color-surface` / `--color-accent` 与六个变量名不变，全站组件零改动。
- **Status**: Approved
- **Refs**: `src/styles/global.css`、`src/components/pages/AboutPage.astro`、`src/layouts/Base.astro`（新增可选 prop `page`）

### 2026-09-23 (RAY-476 精修 · A 方案): 关于页蛋黄色板拉开刻度两端
- **Decision**: 只改 `--rv-about-*` 六个变量的取值，结构 / 文案 / 排版一律不动。
  亮色页底升到最淡的 **tone 95**（`#FFEFCD`），分层块 / 浮层降到 tone 90（`#FFE08B`）——
  `bg` 与 `bg-soft` 对调，让容器比页底深一档；分隔线从刻度外的 `#F1C100` 换成
  刻度上的 **tone 50** `#927300`（对页底 3.95:1，≥3:1 可见）。
  暗色取镜像：页底压到 **tone 10**（`#241A00`），浮层升到 tone 20，文字拉到 tone 95 / 80。
- **Rationale**: 上一轮 `--rv-about-bg` = tone 90 是偏金的黄，刻度两端没拉开；
  且 `--rv-about-container: #F1C100` 标注「tone 80」但根本不在刻度上（同色相、chroma 偏高），
  属于手算草案值被带进实现。现在每个色值都能在官方 tone 刻度上查到，由
  `@material/material-color-utilities` 复核；正文对比度 15.11:1 AAA，较上一轮 13.32:1 更高。
- **Status**: Approved
- **Refs**: 同上一版；色值复核脚本见 issue RAY-476 评论

---

## 🔗 Reference Links

- [rsms.me](https://rsms.me) — Design inspiration
- [inter.var.com](https://inter.var.com) — Typography reference
- [Astro View Transitions](https://docs.astro.build/en/guides/view-transitions/) — Implementation guide
- [TinaCMS](https://tinacms.org) — Future CMS integration (out of scope for V1)

---

## 📌 TODO

- [ ] Verify 8px grid alignment on all components
- [ ] Test dark mode on actual AMOLED display
- [ ] Check font rendering across browsers
- [ ] Validate touch targets (44px minimum) on mobile