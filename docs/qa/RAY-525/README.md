# RAY-525 自测记录（文章列表标题 hover：变粗 ＋ 下划线）

## 改了什么

`/posts/`、`/tags/xxx/`、`/series/xxx/`（`/posts/<series>/`）三处列表的文章标题链接，由内联
样式改为组件内 scoped 类名（`.post-title-link` / `.post-title`），hover 时：

| 属性 | 静止 | hover | 过渡 |
|---|---|---|---|
| `font-weight` | 320 | **700** | `100ms ease-out`（与 `.nav-link` 同参数） |
| `text-decoration-color` | `transparent` | **`currentColor`** | `var(--transition-fast)`＝150ms ease-out（原有） |

静止态样式逐字保留（字号 / 字重 / 颜色 / 下划线偏移 / 过渡），只把内联样式搬进 `<style>`，
并给标题加 `width: fit-content`：外层 `<a>` 仍是整行点击热区，但 hover 反馈与下划线只落在文字上
（与 `.nav-link` 的 `fit-content` 同款处理）。

## 这些数是怎么来的

`pnpm build` 出两份 `dist/`：**before** = `main`（356b359e）原样，**after** = 本分支。
两份都用 `python3 -m http.server` 起静态服务，Playwright + 无头 Chrome 151、视口 1280×900
（特写图 `deviceScaleFactor: 2`），读数全部来自 `getComputedStyle` / `getBoundingClientRect` /
`Range.getClientRects()`，不靠肉眼。

## 一、`/posts/` 六条标题逐条实测（hover 前 → hover 后）

| 标题（截断） | 字重 | 下划线色 | 行数 | 文字宽 (Δ) | 标题盒高 | 卡片高 |
|---|---|---|---|---|---|---|
| 你的蓝色和我的蓝色一样吗？ \| 随便想想 #03 | 320→**700** | `rgba(0,0,0,0)`→`rgb(27,27,27)` | 1→1 | 317.78→319.16 (+1.38) | 28.8→28.8 | 54.39→54.39 |
| 谁有权给一个概念命名？——从 Token 与「词元」之争说起 \| … | 320→**700** | 同上 | 1→1 | 527.28→532.00 (+4.72) | 28.8→28.8 | 54.39→54.39 |
| 「静音车厢」为何总是静不下来？我推演了 6 种解法 \| … | 320→**700** | 同上 | 1→1 | 478.44→479.97 (+1.53) | 28.8→28.8 | 54.39→54.39 |
| AI 的 4D 框架、AI 诚信声明、薄荷是牙膏味的、建站 \| 半月记… | 320→**700** | 同上 | 1→1 | 498.84→506.56 (+7.72) | 28.8→28.8 | 54.39→54.39 |
| RayView 有博客网站啦！ | 320→**700** | 同上 | 1→1 | 174.81→180.41 (+5.60) | 28.8→28.8 | 54.39→54.39 |
| 关于 Emoji 的一切 \| RayDesign #1 | 320→**700** | 同上 | 1→1 | 236.77→247.72 (+10.95) | 28.8→28.8 | 54.39→54.39 |

改前同样六条：字重恒 320、下划线色恒 `rgba(0,0,0,0)`、文字宽 Δ 全部 0.00（hover 无任何反应）。

**回流结论**：六条标题行数、标题盒高、卡片高、卡片 y 坐标 hover 前后全部不变 —— 没有换行点漂移、
没有纵向位移。唯一的横向变化是拉丁字形加粗带来的字宽增加（+1.38 ~ +10.95 px），中文全角字形定宽
不参与；这与同页系列链接「Ray 的设计课 / RayDesign」hover 时已有的行为完全同源（同一套
MiSans VF + Roboto Flex wght 轴），未引入新的处理方式。

**过渡平滑**：hover 后 60ms 取样 `font-weight` = 580（320 与 700 之间），说明是插值过渡而非瞬跳。

## 二、同型列表（TagPage / SeriesPage）与英文版

| 页面 | 组件 | 标题数 | 结果 |
|---|---|---|---|
| `/tags/website/` | TagPage（`h3.post-title`） | 2 | 320→700、下划线渐显、卡片高不变 |
| `/posts/justthinking/` | SeriesPage（`h2.post-title`） | 3 | 320→700、下划线渐显、卡片高不变 |
| `/en/posts/` | PostListPage（英文集合） | 0（英文集合目前为空） | 用临时探针文章构建后实测：320→700、下划线渐显、1 行、卡片高不变（纯拉丁标题 +23.95px 字宽，无换行） |

英文列表页与中文共用 `PostListPage.astro`，构建产物里 `data-astro-cid-ckesl6pj` 作用域下的
`.post-title*` 规则一字不差（`diff` 仅多出这三条规则）。探针文章验证后已删除，未入库。

## 三、回归检查

- **系列链接 `.nav-link`（参考样式）**：改前改后都是 320→700、`::after` `scaleX(0)→scaleX(1)`，未受影响。
- **标签链接 `#tag`**：改前改后 hover 都是 `rgb(71,71,71)` 不变 —— 本单未动（见 PR 说明）。
- **正文链接 / 脚注 / 卡片日期**：`article.heti a`、`.footnotes a` 规则在 `global.css` 里未被触碰；
  构建产物 diff 显示文章页 `/posts/welcome/`、首页 `/` 的 markup 与样式**完全一致**（忽略 style/script 后逐字节相同）。
- **静止态像素级不变**：改前静止、改前 hover、改后静止三张截图 SHA-256 完全相同
  （`3b1d5bbec9c33cd7940175380989efa1aa0e36194e02c83dae379377ada862de`）——
  既证明改前 hover 毫无反馈，也证明改后静止态零变化。
- **JS 报错**：0。
- `pnpm build` ✅（37 pages）。

## 图

| 文件 | 说明 |
|---|---|
| `post-title-before-rest.png` | 改前静止（= 改前 hover，也是改后静止，三者像素相同） |
| `post-title-after-hover.png` | 改后 hover（变粗 + 下划线；日期行位置未动） |
