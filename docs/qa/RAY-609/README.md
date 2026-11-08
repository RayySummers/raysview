# RAY-609 自测记录（中文正文断行：pretty / balance / auto-phrase）

## 改了什么

| # | 文件 | 位置 | 改动 |
|---|---|---|---|
| 1 | `src/styles/global.css` | `article.heti p` | 新增 `text-wrap: pretty` |
| 2 | `src/styles/global.css` | 新增 `article.heti h1/h2/h3` | 新增 `text-wrap: balance` |
| 3 | `src/styles/global.css` | 新增 `@supports (word-break: auto-phrase)` 块 | 中文正文 `p`/`li` 加 `word-break: auto-phrase` |
| 4 | `.github/scripts/check-build.sh` | RAY-552 断言之后 | 4 条产物断言（选择器 + 声明成对出现） |
| 5 | `docs/qa/RAY-609/` | 新增 | 本 README、`verify.mjs`、`readings.json`、三档截图 |

字号、行高（中文 1.8 / 英文 1.4）、对齐、字体栈、`article.heti pre` 的代码块规则都没动。

## 实现口径

1. **段末孤字**：`article.heti p { text-wrap: pretty }`。引擎在段末只剩一个词/字时回退调整前面的断点。
   Chrome 117+ 生效，不支持的引擎直接忽略（断行回到默认 `wrap`），不需要 `@supports`。
2. **标题行长度**：`article.heti h1, h2, h3 { text-wrap: balance }`。只挂正文实际用到的三层；
   Chrome 对 `balance` 有行数上限（约 4 行），超长标题自动退回默认断行 —— 正是想要的降级。
3. **按词组断行**：`@supports (word-break: auto-phrase)` 内给 `p:lang(zh)` / `li:lang(zh)` 加
   **`word-break: auto-phrase`**。
   > **属性名与原单不一致（需要 Ray 知情）**：issue 写的是 `line-break: auto-phrase`，但 CSS Text 4
   > 只给 **`word-break`** 定义了 `auto-phrase`；`line-break` 的取值是 auto / loose / normal / strict / anywhere
   > （MDN；Chrome 157 与 Firefox 148 的 `CSS.supports('line-break','auto-phrase')` 都返回 **false**）。
   > 按原单写会是一条永远不生效的死规则，`@supports` 也永远进不去 —— 所以这里用了能真正命中的属性名。
4. **只作用于中文正文**：`auto-phrase` 需要语言标注，选择器限 `:lang(zh)`；英文正文没有词组切分需求。

## 一、三档宽度读数（`getComputedStyle` + 逐字符 Range 归行）

页面：`/posts/justthinking/justthinking-04-metro-volunteer/`（正文无站外图片，49 段）。
「关闭」= 同时把 `text-wrap` 中和成 `wrap`、`word-break` 中和成 `normal`（只覆盖 RAY-609 的声明）；
统计对象是 ≥2 行的正文段落（AI 声明折叠区、脚注、blockquote 不计入）。
「末行填充率」= 末行墨迹宽度 / 段落内容宽。

| 视口 | 正文栏宽 | 段落数 | 末行 1 字的段 | 末行 ≤2 字 | 末行 ≤3 字 | 末行填充率 | 正文高度 |
|---|---|---|---|---|---|---|---|
| 1440 | 584 | 21 | 0 → **0** | 1 → **0** | 1 → 1 | 0.562 → **0.563** | 4630.7 → 4630.7 |
| 768 | 584 | 21 | 0 → **0** | 1 → **0** | 1 → 1 | 0.562 → **0.563** | 4630.7 → 4630.7 |
| 390 | 342 | 21 | 0 → **0** | 2 → **0** | 3 → 3 | 0.529 → **0.534** | 6793.2 → 6793.2 |

（箭头左侧＝关闭新规则，右侧＝开启。1440 与 768 的正文栏同为 584px —— 文章栏有 `--max-width`
上限，两档只差页面留白与页头，换行完全一致，所以读数相同。）

**结论**：`text-wrap: pretty` 在 Chrome 157 的中文正文上确实生效 —— 三档宽度下「末行只剩 1–2 字」
的段落从 1/1/2 段降到 **0/0/0**，末行填充率小幅上升，行数与总高度不变（没有为了避孤字把段落撑长）。

## 二、标题 `balance` 读数（390 宽，biweekly-26.05-a）

| 标题 | 行数（关→开） | 末行字数（关→开） | 末行填充率（关→开） |
|---|---|---|---|
| 一、AI 的说明书（4D 框架） | 2 → 2 | **2 → 7** | **0.187 → 0.604** |
| 五、这周发生的有趣的事 | 2 → 2 | **1 → 6** | **0.094 → 0.561** |

关闭 `balance` 时，第二个标题末行只剩一个「事」；开启后两行长度接近。1440 / 768 下这两条标题
本来就是单行，`balance` 不介入（行数 1 → 1）。

## 三、控制实验（证明规则本身生效，不是「写了没用」）

同一引擎（Chrome 157）、同一 300px 容器，分别量 `wrap → pretty` 与 `wrap → balance`：

- **pretty（英文段落）**：21 个不同长度样本里，9 个「末行 ≤12 字」的窄样本中有 **4 个**被改写断点，
  例如末行字数 `6 → 10`、`4 → 10`、`8 → 14`、`4 → 10`（`controls.paragraph.changed = 4`）。
- **balance（标题）**：英文 4 行标题末行字数 `[19,21,13,10] → [19,18,12,14]`；
  中文 2 行标题 `[12,10] → [11,11]`。

> **踩坑记录**：第一版脚本用 `text-wrap: normal` 做「关闭」基线，结果开/关读数完全一样 ——
> 因为 Chrome 157 已按 CSS Text 4 实现，`normal` 不是 `text-wrap` 的合法值，整条声明被丢弃，
> 页面其实一直是 `pretty`。改成 `text-wrap: wrap` 后才量出上面的差异。
> 同理，`el.style.textWrap = 'normal'` 不会把 `pretty` 关掉。

## 四、能力检测与降级

| 检测项 | Chrome 157 | Firefox 148 |
|---|---|---|
| `CSS.supports('line-break', 'auto-phrase')` | false | false |
| `CSS.supports('word-break', 'auto-phrase')` | **true** | false |
| `CSS.supports('text-wrap', 'pretty')` | **true** | false |
| `CSS.supports('text-wrap', 'balance')` | **true** | true |
| 正文 `computed text-wrap` | **pretty** | wrap（回落） |
| 正文 `computed word-break` | **auto-phrase** | normal（`@supports` 未进入） |

- 不支持的引擎：`@supports` 整块不解析、`text-wrap` 声明被忽略，断行与改动前一致（Firefox 148 实测）。
- **中文 `auto-phrase` 目前没有可见变化**：Chromium 119+ 支持该值，但词组分析只覆盖日文
  （Chrome 官方博客：中文「plan to support in future」）。Chrome 157 下中文正文的 `word-break`
  已经是 `auto-phrase`、断行结果与 `normal` 相同 —— 规则就位，等引擎的词典。
  三档宽度的正文高度在 `auto-phrase` 开/关下也完全一致（见第一节），可以确认没有副作用。

## 五、截图

同一篇 `justthinking-04`（长文、正文无站外图），页面顶部 1600px：

| 宽度 | 文件 | 说明 |
|---|---|---|
| 1440 | `docs/qa/RAY-609/zh-1440.png` | 正文栏 584px 居中，页面留白最宽 |
| 768 | `docs/qa/RAY-609/zh-768.png` | 同一 584px 正文栏，留白收窄 |
| 390 | `docs/qa/RAY-609/zh-390.png`（DPR 2） | 正文栏 342px，段落换行最密 |

> 站外图床（pic1.imgdb.cn）在自测环境不可达，所以截图选了正文无外链图的一篇；
> 页面本身没有做任何「隐藏图片」处理。

## 六、复跑方式

```bash
pnpm build
python3 -m http.server 44488 --directory dist &
node docs/qa/RAY-609/verify.mjs http://127.0.0.1:44488 docs/qa/RAY-609 docs/qa/RAY-609/readings.json
bash .github/scripts/check-build.sh
```

`verify.mjs` 依赖 `playwright`（本机为 `/home/hunde/raysview/node_modules` 的副本）与
`/usr/bin/google-chrome`；Firefox 段需要 `RAY609_FF=1` 才跑。
退出码 0 表示无回归（孤字段不增加、末行填充率不下降、computed 值正确、无 JS 报错）。

## 七、还没解决的

- 中文按词组断行要等浏览器把中文词典做完；在那之前 `word-break: auto-phrase` 对本站是空转。
- `text-wrap: pretty` 的「避孤字」力度各引擎不同（Safari 的实现更强），本次只测了 Chrome / Firefox。
- 只测了三档固定宽度；真实设备上的字体回退（尤其 Android 缺 MiSans 时）未覆盖。
