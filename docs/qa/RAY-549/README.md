# RAY-549 自测记录（AI 声明折叠区：左对齐修正 ＋ 平滑开合动画）

## 改了什么

| # | 文件 | 位置 | 改动 |
|---|---|---|---|
| 1 | `src/styles/global.css` | `article.heti .ai-disclosure__summary` | 新增 `padding-inline-start: 0` + `padding-left: 0`（覆盖 heti.min.css 的 `summary{padding-inline-start:1em}`） |
| 2 | `src/styles/global.css` | `.ai-disclosure` | 新增 `interpolate-size: allow-keywords`（只挂折叠区，不做全站 opt-in） |
| 3 | `src/styles/global.css` | 新增 `@supports selector(::details-content)` 块 | `::details-content` 的 `block-size` 0 ↔ auto 过渡（200ms，`--transition-base`）+ `content-visibility … allow-discrete`；`prefers-reduced-motion` 直切 |
| 4 | `src/styles/global.css` | `.ai-disclosure__chevron` | `transform` 时长 180ms → `var(--transition-base)`（200ms），与内容动画同步 |
| 5 | `src/components/pages/ArticlePage.astro` | 末尾 `<script>` | 渐进增强兜底：不支持 `::details-content` / `interpolate-size` 的浏览器用 WAAPI 补同一段 200ms 动画（约 30 行、无依赖） |
| 6 | `.github/scripts/check-build.sh` | RAY-544 断言之后 | 新增 2 条产物断言：`padding-inline-start:0` 与 `::details-content` 过渡必须在 CSS 产物里 |

「AI 声明」的文案、浅深配色、默认展开、键盘可达性都没动。

## 实现口径

1. **左对齐**：18px 缩进来自 heti.min.css 的 `summary{padding-inline-start:1em}`（18px 字号 → 18px）。
   我们的选择器特异性更高，显式归零即可；逻辑属性与物理属性各写一遍，覆盖各引擎。
2. **平滑开合（CSS 优先）**：`::details-content` 是 details 内容区的 UA 伪元素，
   `block-size: 0` → `auto` 配合 `interpolate-size: allow-keywords` 才可插值；
   `content-visibility` 必须一起过渡并加 `allow-discrete` —— 否则收起时内容在动画开始前就被
   hidden，看到的仍是瞬跳。
3. **兜底（JS）**：特性检测 `CSS.supports('selector(::details-content)')` **且**
   `CSS.supports('interpolate-size','allow-keywords')`，缺一即接管：拦截 summary 的 click
   （`preventDefault`，键盘 Enter/Space 也走 click），用 Web Animations 把
   `.ai-disclosure__body` 的高度从当前值动到目标值，收起动画结束后再摘 `open`。
   `prefers-reduced-motion: reduce` 直接切；脚本没跑起来时保持原生 details 行为。
   `disclosures.length &&` 守卫让没有折叠区的文章页空跑（8 个文章页共用这段脚本）。
4. **`overflow: clip` 而不是 `hidden`（踩坑记录）**：`hidden` 会把 `::details-content`
   变成滚动容器（BFC），实测展开态块高 **194.34px → 206.34px（多 12px）**、整页下移 12px。
   `clip` 只裁剪、不建滚动容器，展开态几何与改动前逐像素一致（见「四」的几何断言）。

## 一、几何读数（`getComputedStyle` + `getBoundingClientRect`）

视口 1280×900、DPR 2；`justthinking-04` 中/英文章页。参考左缘取「折叠区之前的正文段落」
（`article.heti > p`），单位 px。

| 浏览器 | 页面 | padding-left / inline-start | summary 左缘 | 「※ AI 声明」文字左缘 | 折叠区内段落左缘 | 正文段落左缘 |
|---|---|---|---|---|---|---|
| Chromium 151 | 中文 · 浅色 | **0px / 0px** | 348 | 348 | 348 | 348 |
| Chromium 151 | 中文 · 深色 | **0px / 0px** | 348 | 348 | 348 | 348 |
| Chromium 151 | 英文 · 浅色 | **0px / 0px** | 348 | 348 | 348 | 348 |
| Firefox 153 | 中文 · 浅色 | **0px / 0px** | 348 | 348 | 348 | 348 |
| Firefox 153 | 中文 · 深色 | **0px / 0px** | 348 | 348 | 348 | 348 |
| Firefox 153 | 英文 · 浅色 | **0px / 0px** | 348 | 348 | 348 | 348 |

改前同一处是 `padding-left: 18px`、文字左缘 366 —— 正是报障里那 18px。

## 二、开合曲线（逐帧采样 details 高度）

点击后用 `requestAnimationFrame` 采样 details 的 `getBoundingClientRect().height`，
「中间帧」= 严格落在起止值之间的采样数；时长 = 首次偏离起始值 → 首次到达终值。

| 浏览器 | 动作 | 起 → 止 | 中间帧 | 不同高度值 | 时长 |
|---|---|---|---|---|---|
| Chromium 151 | 中文收起 | 248.3 → 54 | 11 | 13 | 180ms |
| Chromium 151 | 中文展开 | 54 → 248.3 | 11 | 13 | 183ms |
| Chromium 151 | 英文收起 | 237.5 → 43.2 | 11 | 13 | 191ms |
| Firefox 153 | 中文收起（JS 兜底） | 248.4 → 54 | 11 | 13 | 183ms |
| Firefox 153 | 中文展开（JS 兜底） | 54 → 248.4 | 11 | 13 | 182ms |
| Firefox 153 | 英文收起（JS 兜底） | 216 → 43.2 | 11 | 13 | 181ms |

两条路径（Chromium 的 CSS 过渡 / Firefox 的 WAAPI 兜底）曲线形状与时长一致，都 ≈200ms ease-out，
不再是报障里的 248px → 54px 瞬跳。收起后 `details.open === false`、
`::details-content` 的 `content-visibility: hidden`、块高回到 summary 的 54px。

## 三、交互 / 无障碍 / 降级

| 检查项 | Chromium | Firefox |
|---|---|---|
| chevron 展开态 `transform: none` / 收起态 `matrix(-1,0,0,-1,0,0)` | ✅ | ✅ |
| 键盘：聚焦 summary 后 Enter 收起、Space 展开 | ✅ / ✅ | ✅ / ✅ |
| 深色主题（`data-theme=dark`）下左缘与 chevron 正常 | ✅ | ✅ |
| `prefers-reduced-motion: reduce`：中间帧 0、直切，仍能收起 | ✅ | ✅ |
| JS 关闭：默认展开（块高 248.4）→ 点击收起（54、内容不可见）→ Enter 再展开 | ✅ | ✅ |
| 控制台无 error | ✅ | ✅ |

## 四、几何不变断言（防止「修一个坑引入另一个」）

把新规则中和掉（`block-size:auto / overflow:visible / transition:none`）后与改动前对比，
展开态块高与文档总高必须一致：

| 浏览器 | 有新 CSS | 中和后 |
|---|---|---|
| Chromium 151 | details 248.33 / doc 5410 | details 248.33 / doc 5410 |
| Firefox 153 | details 248.40 / doc 5411 | details 248.40 / doc 5411 |

（就是这条断言抓出了 `overflow: hidden` 带来的 +12px。）

## 五、构建产物自检（`check-build.sh`）

新增 2 条断言，正常构建：

```
AI 声明区 : 6 个页面（源文件 6 篇），默认展开 + chevron
折叠区样式: 左对齐修正 + ::details-content 过渡 已在 Base.BVE-5RZW.css
自检通过
```

负向测试：拿 `main`(d9be2c5d) 的产物跑新版脚本，按预期失败：

```
::error::构建产物里的折叠区 summary 没有 padding-inline-start:0，左对齐修正丢了（RAY-549）
exit 1
```

## 六、未变项（与 `main` d9be2c5d 产物逐页对比）

- 归一化资源 hash 后：44 个页面里 **只有 8 个文章页不同** —— 差异是 CSS/JS 资源名，
  以及新增的兜底脚本（753 字符）；其余 36 页逐字节相同。
  文章页里剩余的零散单字符差异是压缩器重排短变量名（`const t=` → `const c=`），行为不变。
- CSS 产物规则级 diff：**只动了 3 条规则、新增 3 条规则**，全部是 `.ai-disclosure*`；
  无既有规则被改写。`images/`、`fonts/` 文件集合不变。

## 七、截图

| 文件 | 内容 |
|---|---|
| `qa-zh-light-expanded.png` | 中文页展开态：summary 文字与正文段落左缘平齐 |
| `qa-zh-light-collapsed.png` | 中文页收起态 |
| `qa-zh-mid-animation.png` | 收起动画中间帧（110px，内容被逐步裁掉，chevron 转了一半） |
| `qa-zh-dark-expanded.png` | 深色主题展开态 |
| `qa-en-light-expanded.png` | 英文页展开态 |

（元素级裁剪，`deviceScaleFactor: 2`。）

## 八、复现

```bash
pnpm build
python3 -m http.server 44488 --directory dist
node docs/qa/RAY-549/verify.mjs http://127.0.0.1:44488 docs/qa/RAY-549/readings.json docs/qa/RAY-549
bash .github/scripts/check-build.sh
```

`verify.mjs` 跑两遍：Chromium 用系统 Chrome（`/usr/bin/google-chrome`），
再跑一遍 Playwright 自带 Firefox（覆盖 JS 兜底路径）；读数全量写在 `readings.json`。

## 未覆盖 / 待确认

- **Safari / WebKit 未实测**：本机 Playwright WebKit 缺系统依赖（`libgtk-4.so.1`、`libgraphene-1.0.so.0`），
  起不来。按特性检测推断：Safari 若同时支持 `::details-content` 与 `interpolate-size` 走 CSS 路径，
  否则由兜底脚本接管（Firefox 走的就是这条，已实测）。线上 Safari 复核建议由验收方补一次。
- 部署后线上复核由验收方执行，本记录只覆盖本地构建 + 无头浏览器实测。
