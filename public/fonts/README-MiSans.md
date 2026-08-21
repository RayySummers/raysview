# MiSans VF 字体文件说明

Stage 1 决策纪要（RAY-383）推荐使用官方 VF 单文件 `MiSans-VF.woff2`（`wght 150 700`，`fvar` 实测 150–700）自托管于 `/public/fonts/MiSans-VF.woff2`。Stage 2 已完成 CSS 与页面侧接入，Stage 3（RAY-387）新增按仓库实际用字自动化子集化，11.6MB → <1MB。

## 获取方式

官方下载页（需人工交互点击）：https://hyperos.mi.com/font/zh/download
- 选择 MiSans → 下载 VF 版本（10 字重 + VF，约 12–18MB TTF）
- 首次全量 CJK 子集化（按当前 `global.css` 的 `unicode-range`，已排除全角/CJK 标点回退至 Source Han）：

```bash
pip install fonttools brotli
# RAY-390 后 MiSans 仅保留 CJK 汉字区间，显式排除全角标点（见下「标点回退」）
pyftsubset MiSansVF.ttf \
  --unicodes="U+2E80-2EFF,U+2F00-2FDF,U+3000,U+3003-300B,U+3012-303F,U+31C0-31EF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FE30-FE4F,U+FF00,U+FF02-FF07,U+FF0A-FF0B,U+FF0D-FF1E,U+FF20-FFEF" \
  --layout-features="ss04,tnum,liga,kern" \
  --flavor=woff2 --output-file=public/fonts/MiSans-VF.woff2

# 日期专用（可选另切，不必单独文件，同一 VF 通过 unicode-range 区分即可）
# pyftsubset MiSansVF.ttf --unicodes="U+0030-0039,U+002D" --layout-features="ss04" --flavor=woff2 --output-file=public/fonts/MiSans-Date.woff2
```

> **互补关系**：`--layout-features` 中保留 `ss04,tnum` 是子集化阶段保留 OpenType 特性表（避免被裁），运行时仍需通过 CSS `font-feature-settings: "ss04" 1,"tnum" 1` 与 `font-variant-numeric: lining-nums tabular-nums` 显式开启；两者互补——子集化保留数据，CSS 决定是否启用。

转换后文件应置于 `public/fonts/MiSans-VF.woff2`，`global.css` 已配置 `font-weight: 100 900` + `format('woff2-variations')` + `unicode-range` 隔离（已排除全角/CJK 标点，详见「标点回退」）。首次放置后，自动化脚本会自动备份为 `scripts/cache/MiSans-VF.src.woff2`（不在 `public`，避免被部署）供后续重压使用；旧路径 `public/fonts/MiSans-VF.src.woff2` 亦兼容并自动迁移。

## 自动化子集化（RAY-387 新增）

为将 11.6MB 全量 CJK 压至 <1MB 且“写文章后无需手动重压，新字自动纳入”，仓库新增 `scripts/subset-misans.mjs` 与 `pnpm` 钩子。

### 原理

- 扫描 `src/content/**/*.{md,mdx}` + `src/pages/**/*.{astro,md,mdx}` + `src/components/**/*.{astro,ts}`，提取全量文本去重字符，**过滤** `EXCLUDED_PUNCT` 中的全角/CJK 标点（`，` `、` `。` `？` `（` `）` `【` `】` `「` `」` `『` `』` `‘` `’` `“` `”` `！` `…` `–` `—`，即 `U+FF0C/U+3001/U+3002/U+FF1F/U+FF08/U+FF09/U+3010/U+3011/U+300C/U+300D/U+300E/U+300F/U+2018/U+2019/U+201C/U+201D/U+FF01/U+2026/U+2013/U+2014`），仅强制保留数字 `0-9`/`-`，写入临时 `chars.txt`。
- 以 `scripts/cache/MiSans-VF.src.woff2`（首次运行时由现有 `MiSans-VF.woff2` 自动备份，不在 `public`）或官方 `MiSansVF.ttf` 为输入源，执行:
  ```bash
  pyftsubset <source> --text-file=chars.txt --layout-features=ss04,tnum,liga,kern --flavor=woff2 --output-file=public/fonts/MiSans-VF.woff2
  ```
  保留 `fvar 150-700` 与 `GSUB ss04/tnum`，其余字形按实际用字裁剪（实测约 430–650KB，<1MB）；`EXCLUDED_PUNCT` 中的标点不打入 MiSans，回退至 `Source Han Sans SC`。
- 偶发遗漏字符（未被扫描到或生僻字）会回退到 `global.css` 中 `Source Han Sans SC` 兜底，不阻断发布；下次构建时被新文章纳入会自动补齐。

### 使用

```bash
# 一键重压（本地可复现，输出至 public/fonts/MiSans-VF.woff2）
pnpm fonts:subset

# 或直接
node scripts/subset-misans.mjs
```

- `package.json` 已配置 `prebuild` / `predev` 钩子（`pnpm fonts:subset`），执行 `pnpm build` / `pnpm dev` 前自动重压；写文章后直接构建或开发即自动更新，无需手动。
- 依赖：`pip install fonttools brotli`（提供 `pyftsubset`）；缺失时脚本会警告并跳过重压，构建仍通过，回退到 `Source Han`。
- 源字体优先级：`scripts/cache/MiSans-VF.src.woff2` > `MiSansVF.ttf` / `MiSans-VF.ttf` > `public/fonts/MiSans-VF.src.woff2`（旧路径兼容） > `scripts/cache/*` > `MiSans-VF.woff2`；首次运行后 `src.woff2` 即为全量备份，后续增量子集均以其为源，避免已压缩产物丢失新字。

### 校验

- `ls -lh public/fonts/MiSans-VF.woff2` 应 <1MB
- `python3 -c "from fontTools.ttLib import TTFont; f=TTFont('public/fonts/MiSans-VF.woff2'); print([r.FeatureTag for r in f['GSUB'].table.FeatureList.FeatureRecord])"` 应含 `ss04`/`tnum`
- `pnpm build` 27 pages 通过；`dist/assets/*.css` 含双 `@font-face`（`MiSans`/`MiSans Date`）及 `time.font-date { ss04, tnum }` 未回归

## 标点回退（RAY-390 新增）

**策略**：全角/CJK 标点回退至 `Source Han Sans SC`，半角标点保留给英文（`Roboto Flex` / `Geist`），保持现有英文排版一致。

- **需回退（全角/CJK）— 移出 MiSans，fallback 至 Source Han Sans**：
  | 类别 | 字符 | 码点 |
  |------|------|------|
  | 逗号 | `，` `、` | `U+FF0C` `U+3001` |
  | 句号 | `。` | `U+3002` |
  | 问号 | `？` | `U+FF1F` |
  | 括号 | `（` `）` `【` `】` | `U+FF08` `U+FF09` `U+3010` `U+3011` |
  | 直角引号 | `「` `」` `『` `』` | `U+300C` `U+300D` `U+300E` `U+300F` |
  | 蝌蚪引号 | `‘` `’` `“` `”` | `U+2018` `U+2019` `U+201C` `U+201D` |
  | 感叹号 | `！` | `U+FF01` |
  | 省略号 | `…` | `U+2026` |
  | 破折号 | `–` `—` | `U+2013` `U+2014` |
- **保持不变（半角）— 仍走现有栈**：`!` `,` `.` `?` `(` `)` 等 `U+0021/U+002C/U+002E/U+003F/U+0028/U+0029` 保留给 `Roboto Flex` / `Geist` / `MiSans Date`，不纳入回退。

**`unicode-range` 原理**：CSS 无法“排除”，只能“包含”。因此将 `MiSans` 原有的 `U+3000-303F` 拆为 `U+3000, U+3003-300B, U+3012-303F`（剔除 `U+3001-3002, U+300C-300F, U+3010-3011`），`U+FF00-FFEF` 拆为 `U+FF00, U+FF02-FF07, U+FF0A-FF0B, U+FF0D-FF1E, U+FF20-FFEF`（剔除 `U+FF01, U+FF08-FF09, U+FF0C, U+FF1F`），并移除 `U+2013-2014, U+2026`。对应码点不再命中 `MiSans`，浏览器沿 `--font-sans: "MiSans" > "Zhudou Sans" > "Roboto Flex Variable" > "Geist Sans" > "Source Han Sans SC"` 栈 fallback，最终由 `Source Han Sans SC` 渲染；半角标点因 `MiSans` 从未覆盖且 `Roboto Flex` 的 `unicode-range: U+0000-00FF` 覆盖，保持英文栈不变。

**脚本侧**：`scripts/subset-misans.mjs` 新增 `EXCLUDED_PUNCT` 集合，在收集 `chars.txt` 时过滤该集合（`SCAN_CONFIG` 扫描到的全角标点亦过滤），确保 `pyftsubset --text-file=chars.txt` 不再打入上述码点；`REQUIRED_CHARS` 已移除 `U+2013/U+2014/U+2026`，仅保留 `0-9`/`-`。

## 许可

字体版权归小米所有，许可见 https://hyperos.mi.com/font-download/MiSans字体知识产权许可协议.pdf
- 允许 Web 嵌入与自托管，但需署名（建议在 about 页或 LICENSE 中注明 “MiSans © Xiaomi”）
- 禁止二次分发字体文件本身、禁止改编
- 用其创作的作品（页面）可自由分发

## 当前状态

本仓库已完成 CSS 与页面侧接入（`src/styles/global.css`、`src/layouts/Base.astro` 预加载、`src/pages/posts/*` 与 `src/pages/tags/[tag].astro` 日期 `time.font-date`）及自动化子集化（`scripts/subset-misans.mjs` + `prebuild`/`predev`）与标点回退（RAY-390）。`public/fonts/MiSans-VF.woff2` 已由 11.6MB 压至 <1MB（约 430–650KB），全角/CJK 标点已回退至 `Source Han Sans SC`、半角保留 `Roboto Flex`，`font-display: swap` + `preload` + `preconnect https://cdn.jsdelivr.net` 就位，`FnHover` 未回归。若字体文件缺失，构建仍通过，浏览器将回退至 `Source Han Sans SC`，待字体到位后中文/汉字即自动切换为 MiSans，日期数字启用 SS04 齐线等宽。

回答“是否每次都要重压”：**无需手动**，构建时自动扫描全量文本重压；偶发遗漏字符回退到 `Source Han`，不阻断发布。
