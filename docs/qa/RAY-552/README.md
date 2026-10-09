# RAY-552 自测记录：字体栈重排（Zhudou Sans → Roboto Flex Variable → MiSans）

## 改了什么

| # | 文件 | 位置 | 改动 |
|---|---|---|---|
| 1 | `src/styles/global.css` | `:root` | `--font-sans` 顺序由 `MiSans → Zhudou → Roboto → …` 改为 `Zhudou → Roboto → MiSans → …`（单行） |
| 2 | `src/styles/global.css` | `:root` Typography 注释块 | 改写为「认领模型」说明：unicode-range 决定谁认领什么、栈序决定归属、Zhudou 必须排在 Roboto 之前 |
| 3 | `src/styles/global.css` | `MiSans` `@font-face` 头注释 | 同步：排除项由「前面的 Zhudou Sans 认领」而非「回退至 Source Han」；注明 RAY-552 起该名单不再承担移交职责（**名单本身未动**） |
| 4 | `DESIGN.md` | Font Stack 节 | 更新现状说明与代码块；新增「认领模型（RAY-552）」小节（分工表 + Zhudou<Roboto 约束 + 与 RAY-390 逐字排除模型的关系）；字体族表同步 |
| 5 | `.github/scripts/check-build.sh` | RAY-549 断言之后 | 新增产物断言：`--font-sans` 顺序必须是 `Zhudou Sans → Roboto Flex Variable → MiSans`，并在自检摘要里打印 |

**没动的**：字体文件、各 `@font-face` 的 `unicode-range`（含 MiSans 的排除名单）、
`--font-display` / `--font-mono` / `--font-date`、620 与 hover 权重体系、任何页面组件。

## 实现口径

1. **栈序就是「谁认领谁」**：`unicode-range` 决定一个 `@font-face` 认领哪些码位，浏览器从左到右
   取「先认领且真有字形」的那个。所以把 Zhudou 提到栈首，`：；《》` 这些**以前漏挖**的标点
   自动归位到煮豆，不需要再去改 MiSans 的排除名单。
2. **为什么必须 Zhudou 在 Roboto 之前**：两家都认领 `U+2000-206F`（引号 / 破折号 / 省略号）。
   现状与目标都要求这些字符由煮豆渲染，顺序颠倒会把引号让给 Roboto。
3. **`--font-display` 不在本单范围**，且全站没有任何组件引用它（`grep 'var(--font-display)' src/` 为空），
   所以只有 `--font-sans` 一处生效点。
4. **构建产物断言**：Astro 不压缩自定义属性值，产物里是逐字的
   `--font-sans: "Zhudou Sans", "Roboto Flex Variable", "MiSans", …`，可以直接做顺序断言。

## 一、标点挤压读数（`Range.getBoundingClientRect()`）

视口 1280×900、DPR 2、Chromium 151（系统 Chrome）。正文 18px，1em 实测 18.375px。
`ratio` = 字符对宽度 ÷ 1em，**1.5 = 压半格，1.0 = 压一格**。

| 样本 | 位置 | 新栈（after） | 旧栈（before） | 期望 | 结论 |
|---|---|---|---|---|---|
| `：“` | JT#04《广州地铁志愿有感》真实正文 | 27.73px · **1.509em** | 36.73px · 1.999em | 1.5em | ✅ 压半格（−9px） |
| `，「` | JT#02《词元》真实正文 | 27.73px · 1.509em | 27.73px · 1.509em | 1.5em | ✅ 不变 |
| `。》` | 正文合成探针 | 27.73px · **1.509em** | 36.73px · 1.999em | 1.5em | ✅ 压半格 |
| `》《` | 正文合成探针 | 18.73px · **1.020em** | 36.73px · 1.999em | 1.0em | ✅ 压一格 |
| `。。` | 正文合成探针 | 27.73px · 1.509em | 27.73px · 1.509em | 不变 | ✅ 不变 |
| `：“` | 620 标题探针（40px / weight 620） | 58.41px · **1.49em** | 78.41px · 2.000em | 1.5em | ✅ 标题同样生效 |

> `：“` 在真实正文里的读数与 Ray 线上模拟的 128→96 完全一致（18px 下 36.73→27.73px）。
> `。》` / `》《` 目前正文里没有实际用例，用与正文同栈同字号的合成探针量，读数同样落在 1.5em / 1.0em。

## 二、运行时字体（CDP `CSS.getPlatformFontsForNode`）

CDP 报的是字体**内部名**：`煮豆黑體 ExtraLight` = Zhudou Sans。

| 字符 | 类别 | 新栈（after） | 旧栈（before） | 结论 |
|---|---|---|---|---|
| 乘 / 这 | 汉字 | MiSans VF | MiSans VF | ✅ 不变 |
| 2 | 数字 | Roboto Flex | Roboto Flex | ✅ 不变 |
| R | 西文 | Roboto Flex | Roboto Flex | ✅ 不变 |
| `：` | 全角冒号 | **煮豆黑體 ExtraLight** | MiSans VF | ✅ 归位（报障根因） |
| `；` | 全角分号 | **煮豆黑體 ExtraLight** | MiSans VF | ✅ 归位 |
| `《` | 书名号 | **煮豆黑體 ExtraLight** | MiSans VF | ✅ 归位 |
| `“` | 左双引号 | 煮豆黑體 ExtraLight | 煮豆黑體 ExtraLight | ✅ 不变 |
| `。` | 句号 | 煮豆黑體 ExtraLight | 煮豆黑體 ExtraLight | ✅ 不变 |
| `「` | 直角引号 | 煮豆黑體 ExtraLight | 煮豆黑體 ExtraLight | ✅ 不变 |
| `,` / `.` | 半角标点 | Roboto Flex | Roboto Flex | ✅ 不变 |

**回退安定性**（煮豆认领但无字形的符号，两套栈最终字体必须一致）：

| 字符 | 新栈 | 旧栈 | 结论 |
|---|---|---|---|
| `〃` U+3003 | Geist | Geist | ✅ 一致 |
| `〇` U+3007 | Source Han Sans SC VF | Source Han Sans SC VF | ✅ 一致 |
| `～` U+FF5E | Source Han Sans SC VF | Source Han Sans SC VF | ✅ 一致 |

新栈没有引入任何新的回退路径。

## 三、视觉扫页 + before↔after 像素 diff

同一份 `dist`，`before` 上下文只在 `page.route` 里把构建产物 CSS 的 `--font-sans` 改回旧顺序 ——
除栈序外 HTML / CSS / 字体文件逐字节相同。顶栏走秒闪烁的冒号已用 `addInitScript` 钉死
（否则两次截图差几秒会凭空多出十几个差异像素）。1280 宽、DPR 1、`prefers-reduced-motion: reduce`。

| 页面 | 浅色 diff | 深色 diff | 页高 before→after | header/main/footer 几何 |
|---|---|---|---|---|
| 首页 `/` | **0** | **0** | 900 → 900 | 一致 |
| 列表 `/posts/` | **0** | **0** | 2719 → 2719 | 一致 |
| CN 文章 JT#04 | 89125（1.219%） | 90285（1.234%） | 5714 → 5714 | 一致 |
| EN 文章 JT#04 | **0** | **0** | 6188 → 6188 | 一致 |
| 关于页 `/about/` | 20330（0.877%） | 20672（0.892%） | 1811 → 1811 | 一致 |

**差异全部可归因，没有结构性变化**（页高与 header/main/footer 几何逐页一致，说明没有整体位移）：

- CN 文章：JT#04 正文里有 22 个 `：`、10 个 `；`，每个字形由 MiSans 换成煮豆；
  每个 `：“` 省下 9px 会让该行后续文字左移甚至改变断行 —— 差异图上就是「孤立标点红点 + 若干整行红」。
- 关于页：8 处《…》系列名换成煮豆字形并触发重排，同样是「书名号红点 + 整行红」。
- 首页 / 列表 / EN 文章：**逐像素零差异** —— EN 正文是拉丁与半角标点，走的还是 Roboto，栈序对它无影响。

差异图见 `shots/DIFF-*.png`（红=差异像素，灰=相同），正文特写对照见 `shots/COMPARE-paragraph-*.png`
（上=旧栈，下=新栈，可直观看到 `：“` 从 2 字宽收到 1.5 字宽）。

## 四、构建产物断言（`.github/scripts/check-build.sh`）

```
$ bash .github/scripts/check-build.sh
  …
  字体栈顺序: Zhudou Sans → Roboto Flex Variable → MiSans（RAY-552）
自检通过
```

负向测试（把产物 CSS 改回旧顺序，验证断言真的能拦住回退）：

```
$ sed -i 's/"Zhudou Sans", "Roboto Flex Variable", "MiSans"/"MiSans", "Zhudou Sans", "Roboto Flex Variable"/' dist/assets/*.css
$ bash .github/scripts/check-build.sh ; echo "exit=$?"
::error::--font-sans 顺序不是 Zhudou Sans → Roboto Flex Variable → MiSans（RAY-552）：--font-sans: "MiSans", …
exit=1
```

还原后同一脚本 `exit=0`。

## 五、怎么复跑

```bash
pnpm build
python3 -m http.server 44552 --directory dist &
node docs/qa/RAY-552/verify.mjs http://127.0.0.1:44552 ./docs/qa/RAY-552/readings.json ./docs/qa/RAY-552/shots
# 60 项检查，failures: 0
```

`verify.mjs` 依赖 `playwright`（Chromium 走系统 `/usr/bin/google-chrome`）与 `sharp`；
CDN 字体需要外网，脚本会把宿主机的 `HTTPS_PROXY` 传给浏览器（本地静态服务走 bypass）。
`diffimg.mjs` 是单独把两张截图做成 diff 可视化的小工具（`verify.mjs` 已内置同样的输出）。

## 六、遗留与不确定性

1. `：；《》` 换成煮豆字形后，字面形态与原来 MiSans 的版本不同 —— 这是本单**预期**的字形变化
   （Ray 已在线上模拟中确认），不是回归；同段的 `。“「` 本来就走煮豆，现在一组标点风格统一了。
2. MiSans 的 `unicode-range` 排除名单本单未动，属于「留着无害」；「清理成只管汉字」是后续可选项。
3. 本次 QA 只跑 Chromium。旧栈的 `：“` 挤压失效是字体认领层面的问题（CSS 字体匹配算法），
   与引擎无关；如需 Firefox 复核可复用 `verify.mjs`（把 `chromium` 换成 `firefox` 即可）。
4. 线上复核（Ray 报障的 CN 文章实测、四类字符抽查）按 issue 约定由 Hari 在部署后进行。

## 七、回滚

单文件单行：把 `src/styles/global.css` 的 `--font-sans` 恢复成
`"MiSans", "Zhudou Sans", "Roboto Flex Variable", "Geist Sans", "Source Han Sans SC", …` 即可
（同时删掉 `check-build.sh` 里 RAY-552 的断言，否则部署会被自己拦下）。
