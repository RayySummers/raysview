# RAY-632 自测记录：目录浮层滚动高亮 + Esc / 焦点管理

## 改了什么

只动 `src/components/TableOfContents.astro`（组件 + 组件内 scoped 样式）。
`ArticlePage.astro` 布局结构、`global.css`、任何依赖都没碰。

| # | 位置 | 改动 |
|---|---|---|
| 1 | `<button id="toc-toggle">` | 加 `aria-expanded="false"` / `aria-controls="toc-panel"`，开关时由脚本同步 |
| 2 | `<div id="toc-panel">` | 加 `role="navigation"` + `aria-label`（读作「目录 导航区」）；内层 `<nav>` 改为 `<div class="toc-nav">`，避免嵌套两个导航区 |
| 3 | 目录链接 | 加 `data-toc-target={slug}`，脚本据此定位标题，绕开中文 slug 的 URL 编码问题 |
| 4 | `.toc-item.is-active` | 颜色 + **字重 600** + **左侧 2px 竖线**（`inset box-shadow`，不产生布局位移），不只靠颜色区分 |
| 5 | `<script>` | 开关收敛为 `openPanel()` / `closePanel()`；`Esc` 关闭并回焦按钮；`IntersectionObserver` 高亮 + 停稳后按位置校对 |

## 高亮实现（IntersectionObserver，零依赖）

```js
// 顶部收掉 48px（导航高度，与点击滚动偏移同源），底部收成一条 0 高的分隔线
new IntersectionObserver(cb, { rootMargin: '-48px 0px -100% 0px' })
```

- 标题**穿过**这条线才点亮 → 刚滚到某节开头（标题还在导航条下方）不会被提前判成下一节。
- 标题离线后不清空高亮 → 文末最后一节保持点亮，不会出现「空档」。
- 另加一条 150ms 节流的 scroll 校对（`reconcile`）：直接跳到底部、拖滚动条、点目录项
  这类**没有穿越过程**的移动不会触发 IO 回调，靠它把高亮摆正（实测 `scrollTo(bottom)`
  时只上 IO 会停在旧项）。

`prefers-reduced-motion: reduce` 下 `.toc-item` 的 `transition: none`，高亮直切。

## 验收结果

构建：`pnpm build`（Astro 6.3.5，44 页，0 错误）。
浏览器：系统 Chrome（Playwright，headless），桌面 1440×900、手机 390×844。
样本文章：`/posts/raydesign/emoji-everything/`（7 个 h2/h1 章节）。

| 验收项 | 结果 |
|---|---|
| 第 2 个标题高亮 | `active=emoji-与日本`、`aria-current="true"`、`activeCount=1`（桌面 / 390 均通过） |
| 第 3 个标题高亮 | `active=如何创造一个新的-emoji`、`aria-current="true"`（桌面 / 390 均通过） |
| 键盘 | Tab 到按钮 ✅ → Enter 打开、`aria-expanded="true"`、焦点落到第一项「什么是 emoji？」✅ → Esc 关闭、`aria-expanded="false"`、`hidden=true`、焦点回到 `#toc-toggle` ✅ |
| 打开不抢滚动 | 打开/关闭前后 `window.scrollY` 相同（14733 = 14733） |
| `aria-expanded` | 关：`aria-expanded="false"`；开：`aria-expanded="true"`（DOM 片段见 `results.json` 的 `ariaExpandedDom`） |
| 点击目录项（零回归） | hash 更新为 `#emoji-%E4%B8%8E%E6%97%A5%E6%9C%AC`（中文 slug 照旧编码）、标题距顶 **48px**、高亮同步到该项 |
| 点外部关闭（零回归） | `hidden=true`、`aria-expanded="false"` |
| 文末 | `active=emojipedia` = 最后一个目录项，`activeCount=1` |
| 深色 + reduced-motion | 无 JS 报错；`transition: none 0s`；高亮正常 |
| 新增依赖 | `git diff package.json pnpm-lock.yaml` 为空 |

### 截图

| 文件 | 内容 |
|---|---|
| `desktop-spy-1.png` / `desktop-spy-2.png` | 1440 宽：第 2、第 3 节高亮（浮层开着） |
| `mobile390-spy-1.png` / `mobile390-spy-2.png` | 390 宽：同上 |
| `kb-1-focus-on-toggle.png` → `kb-2-opened-first-item-focused.png` → `kb-3-closed-focus-back-on-toggle.png` | 键盘三步：按钮聚焦 → 打开且第一项聚焦 → Esc 关闭且焦点回按钮 |
| `end-of-article-last-item-active.png` | 文末 Emojipedia 保持高亮 |
| `dark-reduced-motion.png` | 深色 + reduced-motion |

## 复跑

```bash
pnpm build
pnpm preview --host 127.0.0.1 --port 4321   # 另一个终端
python3 docs/qa/RAY-632/verify.py http://127.0.0.1:4321
```

脚本会把全部断言结果写入 `results.json`，任一条不满足则以非零退出。

## 备注

- 构建时 `prebuild`（`pnpm fonts:subset`）会重写 `public/fonts/MiSans-VF.woff2`，与本改动无关；
  提交前已 `git checkout -- public/fonts/MiSans-VF.woff2` 还原，PR 里不含该文件。
- 键盘 Tab 遍历时页面会滚动到已聚焦元素（y=14733），这是浏览器既有行为，非本次改动；
  探针确认 Enter 打开浮层前后 `window.scrollY` 不变。
