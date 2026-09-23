# RAY-479 验收截图（footer 次要文字 tone 30 → tone 40）

## 这些图是怎么拍的

`astro preview` 跑 `pnpm build` 的 `dist/`，Playwright + 无头 Chromium，视口 1280×900、
`deviceScaleFactor: 2`（故 PNG 为 2560 px 宽）。主题通过 `localStorage.theme`
预置后重新加载页面，与线上切换主题的代码路径一致（`Header.astro` 的 `applyTheme`）。

每张图是 footer 区域裁切（footer 外扩上下各 48 px，保留页面底色），并同时用
`getComputedStyle` 读回真实渲染色，按 WCAG 2.1 相对亮度公式算对比度。

## 实测值与对比度

| 截图 | URL | 页面底（实测） | footer 文字（实测） | 对比度 | 等级 |
|---|---|---|---|---|---|
| `footer-light-home.png` | `/`（`theme=light`） | `#F9F9F9` | `#5E5E5E` | 6.16:1 | AA |
| `footer-dark-home.png` | `/`（`theme=dark`） | `#000000` | `#919191` | 6.66:1 | AA |
| `footer-light-about.png` | `/about/`（`theme=light`） | `#FFEFCD` | `#745B00` | 5.71:1 | AA |
| `footer-dark-about.png` | `/about/`（`theme=dark`） | `#241A00` | `#B08C09` | 5.40:1 | AA |

版权行与备案号在同一场景下 computed color 完全相同（同色，无一行深一行浅）。

回归：四套作用域下 `--color-text-secondary` 仍解析为
`#474747` / `#C6C6C6` / `#584400` / `#EBC246`，与改动前一致 —— 文章区的日期 / 注释 / 标签未受影响。

## 关于页暗色（issue 正文未列举的第四种组合）

`html[data-page="about"]` 的底色在暗色下是 primary tone 10 `#241A00`。若照搬亮色的
`#745B00`，实测只有 2.65:1 —— 既不满足 4.5:1，也不满足备案号的清晰可辨要求。
故按同一镜像规则（亮 tone t ↔ 暗 100−t，即 40 ↔ 60）取 primary tone 60 `#B08C09`。
