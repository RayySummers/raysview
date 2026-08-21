# MiSans VF 字体文件说明

Stage 1 决策纪要（RAY-383）推荐使用官方 VF 单文件 `MiSans-VF.woff2`（`wght 100 900`）自托管于 `/public/fonts/MiSans-VF.woff2`。

## 获取方式

官方下载页（需人工交互点击）：https://hyperos.mi.com/font/zh/download
- 选择 MiSans → 下载 VF 版本（10 字重 + VF，约 12–18MB TTF）
- 本地转换 woff2 子集化（按推荐 unicode-range）：

```bash
pip install fonttools brotli
pyftsubset MiSansVF.ttf \
  --unicodes="U+2013-2014,U+2026,U+2E80-2EFF,U+2F00-2FDF,U+3000-303F,U+31C0-31EF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FE30-FE4F,U+FF00-FFEF" \
  --layout-features="ss04,tnum,liga,kern" \
  --flavor=woff2 --output-file=public/fonts/MiSans-VF.woff2

# 日期专用（可选另切，不必单独文件，同一 VF 通过 unicode-range 区分即可）
# pyftsubset MiSansVF.ttf --unicodes="U+0030-0039,U+002D" --layout-features="ss04" --flavor=woff2 --output-file=public/fonts/MiSans-Date.woff2
```

> **互补关系**：`--layout-features` 中保留 `ss04,tnum` 是子集化阶段保留 OpenType 特性表（避免被裁），运行时仍需通过 CSS `font-feature-settings: "ss04" 1,"tnum" 1` 与 `font-variant-numeric: lining-nums tabular-nums` 显式开启；两者互补——子集化保留数据，CSS 决定是否启用。

转换后文件应置于 `public/fonts/MiSans-VF.woff2`，`global.css` 已配置 `font-weight: 100 900` + `format('woff2-variations')` + `unicode-range` 隔离（含 `U+2013-2014,U+2026` 破折号/省略号）。

## 许可

字体版权归小米所有，许可见 https://hyperos.mi.com/font-download/MiSans字体知识产权许可协议.pdf
- 允许 Web 嵌入与自托管，但需署名（建议在 about 页或 LICENSE 中注明 “MiSans © Xiaomi”）
- 禁止二次分发字体文件本身、禁止改编
- 用其创作的作品（页面）可自由分发

## 当前状态

本仓库已完成 CSS 与页面侧接入（`src/styles/global.css`、`src/layouts/Base.astro` 预加载、`src/pages/posts/*` 与 `src/pages/tags/[tag].astro` 日期 `time.font-date`），本地 `pnpm build` 已通过。若 `public/fonts/MiSans-VF.woff2` 暂未放置，构建仍通过，浏览器将回退至 `Source Han Sans SC`，待字体文件到位后中文/标点即自动切换为 MiSans，日期数字启用 SS04 齐线等宽。
