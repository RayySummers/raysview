# 线上验证（RAY-629 部署之后）

修复在 **2026-11-06 10:48** 由 GitHub Actions 部署上线（run `42152230435`，11 步全绿）。

## 文件

| 文件 | 内容 | 怎么来的 |
|---|---|---|
| `live-1440-default.png` | 1440px 宽，首屏默认态：左上角只有 logo，**没有「跳到正文」按钮** | `image.thum.io` 对 `https://raysview.fun/` 的实拍 |
| `live-390-default.png` | 390px 宽，同上 | 同上 |
| `css-evidence.txt` | 线上 CSS 的 `.skip-link` 规则，以及 `translateY(-200%)` 计数为 **0** | `curl` 抓 `https://raysview.fun/` 引用的 `Base.k0AMIHNB.css` |

截图由第三方截图服务生成，所以**不含键盘聚焦态**；聚焦态见上一级目录 `390-focus.png`（同一份 CSS，本地构建）与下面这条线上规则：

```css
.skip-link:focus{position:fixed;top:72px;left:var(--space-3);z-index:1000;width:auto;height:auto;
  margin:0;overflow:visible;padding:var(--space-2) var(--space-3);border:1px solid var(--color-border);
  border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-text-primary);
  font-size:var(--text-sm);text-decoration:none;clip-path:none;
  outline:2px solid var(--color-accent, currentColor);outline-offset:2px}
```

## 手工复现步骤

1. 打开 https://raysview.fun/ ，确认左上角只有 logo
2. 按一下 **Tab**
3. 左上角应出现「跳到正文」按钮，位置在 header 下方（`top:72px`），**不遮 logo**
4. 再按回车，页面跳到 `#main`

## 顺带修的事

这次部署能成功，是因为同时把 CI 的 pnpm 从 9 升到 11 —— `defe06c` 起 `pnpm-workspace.yaml` 用了 `allowBuilds` 写法，pnpm 9 会报 `packages field missing or empty`，导致 **11/01 之后所有合并都没上过线**。
