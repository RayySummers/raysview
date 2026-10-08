# RAY-544 自测记录（文章页「AI 声明」区改可折叠）

## 改了什么

正文末尾的「※ **AI 声明**」（英文文章为「※ **AI Disclosure**」）与紧随其后的说明段落，
在**渲染层**统一包成原生 `<details class="ai-disclosure" open>`：默认展开、单击 summary 收起、
再点展开。历史文章内容一个字没动，中英共用同一份模板。

| # | 文件 | 位置 | 改动 |
|---|---|---|---|
| 1 | `astro.config.mjs` | L7–25 | 图标读取通用化：`iconD(name)` 带缓存，替换原来只服务 reply 的 `REPLY_ICON_D` |
| 2 | `astro.config.mjs` | L27–68 | `msIconNode(name, {size, className})` 取代 `replyIconNode()`；reply 的产物逐字节不变（`--ms-icon-size:17px;`、无额外 class） |
| 3 | `astro.config.mjs` | L170–280 | 新增 `rehypeAiDisclosure` 插件（与 `rehypeFootnoteLabel` 同处、同风格），注册进 `rehypePlugins` |
| 4 | `src/icons/keyboard_arrow_down-{light,dark}.svg` | 新增 | chevron 素材，Material Symbols `keyboard_arrow_down`（码点 E313），wght 350 / opsz 24 / FILL 0 / GRAD 0、25，与站内图标同源同参数 |
| 5 | `src/icons/index.ts` | L29–36、L55–58、L68 | 注册 `keyboard_arrow_down`（+ 生成说明） |
| 6 | `src/styles/global.css` | L760–830 | 折叠区样式（见下） |
| 7 | `.github/scripts/check-build.sh` | L50–65 | 防回归断言 |

### 插件行为（`rehypeAiDisclosure`）

1. 从 `tree.children` 末尾往前找**最后一个**匹配 `^\s*※\s*AI\s*(声明|Disclosure)\s*` 的 `<p>`；
2. 把它连同**后续兄弟节点**一起收进 details，遇到 `section[data-footnotes]`（remark-gfm 的脚注区）
   或任何标题就停 —— 脚注区必须留在外面，否则会被一起折叠；
3. `<summary>` 里放原来的「※ + `<strong>` 标题」和一个 chevron；其余内容进 `.ai-disclosure__body`。

标题与说明**写在同一段**的文章（`justthinking-02`，源文件里标题后漏了空行）按前缀切开：
标题进 summary，说明部分单独成段。不切的话这篇文章根本折叠不了（"所有文章统一生效" 会漏掉它）。

### 样式要点

- `summary` 复刻 `article.heti p` 的字号 / 行高（中文 1.8、英文 1.2，同 RAY-528）/ 下边距 1.2em / 颜色，
  展开态与改动前逐像素一致（见下「三、视觉一致性」）；
- 去掉浏览器默认 marker（`::-webkit-details-marker` + `::marker`），`cursor: pointer`，
  点击热区贴合文字（同脚注标题的 `width: fit-content`）；
- chevron：展开态朝下，收起态 `rotate(180deg)`，`transform 180ms ease-out` + 颜色 `--transition-fast`，
  hover 时由 `--color-text-secondary` 变 `--color-text-primary`；
- **零 JS**：原生 details/summary，Enter / Space 可操作；键盘焦点用 `:focus-visible` 补了一个
  2px 焦点环（Chrome 默认不给 summary 画焦点环，实测 `outline-style: none`，WCAG 2.4.7）；
- 深浅两套主题都走 `.ms-icon` 的双图层切换，无 JS 依赖。

## 一、交互实测（Playwright + Chromium 无头，视口 1280×900，DPR 2）

`main` @ `c03bec4` 原样构建为基线（`python3 -m http.server` 各起一个静态服务）。

| 检查项 | 中文文章页 | justthinking-02（标题同段） | 英文文章页 |
|---|---|---|---|
| 折叠区存在且唯一 | ✅ | ✅ | ✅ |
| 默认展开（`open` 属性） | ✅ | ✅ | ✅ |
| 展开时说明可见 | ✅ | ✅ | ✅ |
| chevron 展开态未旋转（`transform: none`） | ✅ | ✅ | ✅ |
| 单击 summary 收起、说明不可见 | ✅ | ✅ | ✅ |
| chevron 收起态 `matrix(-1, 0, 0, -1, 0, 0)` | ✅ | ✅ | ✅ |
| 再点恢复展开 | ✅ | ✅ | ✅ |
| Tab 可聚焦 summary | ✅（1 次 Tab） | ✅ | ✅ |
| 焦点环可见（`outline: 2px solid`） | ✅ | ✅ | ✅ |
| 键盘 Enter 收起 / Space 展开 | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ |
| 展开态排版与正文段落一致 | ✅ | ✅ | ✅ |
| 深色主题走深色版 chevron | ✅ | — | — |

排版读数（`getComputedStyle`，与同页正文段落对照）：

| 页面 | 字号 | 行高 | 下边距 | 颜色 |
|---|---|---|---|---|
| 中文页 summary | 18px | 32.4px（1.8） | 21.6px | `rgb(27,27,27)` |
| 中文页正文段落 | 18px | 32.4px（1.8） | 21.6px | `rgb(27,27,27)` |
| 英文页 summary | 18px | 21.6px（1.2） | 21.6px | `rgb(27,27,27)` |
| 英文页正文段落 | 18px | 21.6px（1.2） | 21.6px | `rgb(27,27,27)` |

另测：`/posts/biweekly/biweekly-2605-a/` 的脚注区**没有被吞进折叠区**（`!details.contains(section.footnotes)`），
脚注自身的折叠交互照旧可用。

> 英文页：`src/content/posts-en/` 目前只有 `.gitkeep`（RAY-465 第一阶段），仓库里没有英文文章。
> 为实测英文渲染路径，临时放了一篇 fixture（`posts-en/tmp-verify/ray544-check.md`，正文写
> 「※ **AI Disclosure**」）构建后跑同一套断言，**验证完已删除并重新构建**，未进本 PR。
> 截图 `qa-en-light-{expanded,collapsed}.png` 即来自该 fixture。

## 二、几何对照（与基线逐项比对，非滚动状态）

| 页面 | 标题行位置/高度 | 脚注区位置/高度 | 文档总高 |
|---|---|---|---|
| justthinking-04 | 5126.22 / 32.39 ＝ 基线 | 无脚注 | 5587 ＝ 基线 |
| justthinking-01 | 7126.27 / 32.39 ＝ 基线 | 无脚注 | 7631 ＝ 基线 |
| justthinking-03 | 6629.94 / 32.39 ＝ 基线 | 6974.27 / 360.88 ＝ 基线 | 7559 ＝ 基线 |
| biweekly-26.05-a | 13444.13 / 32.39 ＝ 基线 | 13885.63 / 362.06 ＝ 基线 | 14472 ＝ 基线 |

（单位 px，`getBoundingClientRect()`。）

细节：details 的内容区在 UA 里是 shadow slot，**不参与外边距折叠** —— 最后一段的 1.2em 下边距
会实打实撑高整块、给页面底部多留 21.6px 空白。已把这段边距收进 `.ai-disclosure` 自身
（`.ai-disclosure__body > :last-child { margin-bottom: 0 }` + `.ai-disclosure { margin-bottom: 1.2em }`），
修完文档总高与基线**逐页相等**（上表）。

## 三、视觉一致性（像素级）

展开态下，说明段落的元素截图与基线**逐像素相同**（DPR 2）：

| 页面 | 尺寸 | 差异像素 |
|---|---|---|
| justthinking-04 | 1168×390 | **0** |
| justthinking-01 | 1168×454 | **0** |
| justthinking-03 | 1168×392 | **0** |
| biweekly-26.05-a | 1168×584 | **0** |
| justthinking-02 | — | 见下（唯一有意改动） |

**justthinking-02 是唯一一处超出「只多一个 chevron」的改动**：源文件里「※ **AI 声明**」与说明
之间漏了空行，改动前标题和正文挤在同一段的第一行；切开后标题独占一行（与其余 4 篇排版一致），
文章高度 +54px（1 行 32.4px + 段间距 21.6px）。文字内容零改动，见 `qa-jt02-before-after.png`。

## 四、构建产物自检

`.github/scripts/check-build.sh` 新增 3 条断言（RAY-544）：

1. 构建产物里必须存在 `<details class="ai-disclosure" …>`；
2. 每一处都必须带 `open`（默认展开）；
3. 折叠区所在页面数 ＝ 源文件里带「※ AI 声明 / ※ AI Disclosure」的文章数，
   且 chevron 数量与之相等（能抓住「插件只对部分文章生效」—— justthinking-02 就是这么发现的）。

实测：正常构建 `自检通过`（`AI 声明区 : 5 个页面（源文件 5 篇），默认展开 + chevron`）；
把插件里的 `open: true` 改成 `false` 重新构建后脚本按预期失败：
`::error::AI 声明区没有默认展开（缺 open 属性）`，exit 1。

## 五、未变项自检

- 归一化资源 hash 后比对改前/改后全部 `dist/**/*.html`：**只有 5 个带 AI 声明的文章页不同**，
  其余 35 页逐字节相同；`search.json` 未变。
- CSS 产物 diff 只有新增的那 8 条规则，无既有规则被改写。
- `pnpm build` 通过（40 页，exit 0）。
- 浏览器 console 无 error。

## 六、截图

- `qa-zh-light-expanded.png` / `qa-zh-light-collapsed.png` — 中文页 展开 / 收起
- `qa-zh-dark-expanded.png` / `qa-zh-dark-collapsed.png` — 深色主题 展开 / 收起
- `qa-zh-focus.png` — 键盘 Tab 聚焦时的焦点环
- `qa-en-light-expanded.png` / `qa-en-light-collapsed.png` — 英文渲染路径（临时 fixture）
- `qa-jt02-before-after.png` — justthinking-02 改前 / 改后对照（唯一有意改动）

（元素级裁剪，`deviceScaleFactor: 2`。）

## 七、复现

```bash
# 基线：git stash / worktree 到 c03bec4 后 pnpm build，dist 拷到 dist-baseline
pnpm build
python3 -m http.server 4321 --directory dist            # 改后
python3 -m http.server 4322 --directory dist-baseline   # 改前
bash .github/scripts/check-build.sh
```

Playwright 脚本用 `page.evaluate` / `getComputedStyle` / `getBoundingClientRect` 读数，
交互一律用真实点击（`locator.click()`）与真实按键（`keyboard.press`），
像素对照用 PIL `ImageChops.difference`。

**注意**：Astro 的 content layer 会把编译后的 markdown 缓存在 `node_modules/.astro/data-store.json`，
缓存键不含 `astro.config.mjs`。改 rehype 插件后本地复现**必须**先删掉该缓存
（`rm -rf node_modules/.astro dist`）再 `pnpm build`，否则会拿到旧产物 —— 本次排查 justthinking-02
时踩过这个坑。CI 是全新 checkout + `pnpm install`，无此问题。

## 交付说明

- 除上表 7 个文件外，`pnpm build` 的 `prebuild`（`scripts/subset-misans.mjs`）会重新生成
  `public/fonts/MiSans-VF.woff2`；该产物**已还原，未纳入本 PR diff**（保持与 `main` 一致）。
- 部署后线上复核由验收方执行，本记录只覆盖本地构建 + 无头浏览器实测。
