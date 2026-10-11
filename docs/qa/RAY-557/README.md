# RAY-557 自测记录：跨页闪白（主题 FOUC）修复

## 改了什么

| # | 文件 | 位置 | 改动 |
|---|---|---|---|
| 1 | `src/layouts/Base.astro` | `<head>` 最前部（`<meta charset>` 之后） | 新增 `<script is:inline>` **经典内联**主题初始化脚本：读 `localStorage.theme`（缺省 `system`），`system` 时按 `prefers-color-scheme` 解析成 light/dark，写入 `document.documentElement.dataset.theme` |
| 2 | `src/styles/global.css` | `:root` | 补 `color-scheme: light` |
| 3 | `src/styles/global.css` | `[data-theme="dark"]` | 补 `color-scheme: dark` |
| 4 | `.github/scripts/check-build.sh` | RAY-547 词表断言之后 | 新增 RAY-557 产物断言（见下「四」） |

**没动的**：`Header.astro` 的任何逻辑（`applyTheme` / 三态循环 / 图标态 / 搜索 / 语言切换）、
localStorage 键名与三态语义、`data-page` 皮肤机制（关于页蛋黄色）、除 `color-scheme` 外的任何样式。

## 一、根因与实测

`Header.astro` 里的 `<script>` 不带 `is:inline`，Astro 会把它打包成**延迟执行**的
`type="module"`，并且落在 `<body>`（构建产物实测）：

```
HEAD <script type="application/ld+json">
HEAD <script type="module" src="/assets/Base.astro_astro_type_script_index_0_lang.*.js">
HEAD <script>                       ← copy 按钮
HEAD <script>                       ← 图片灯箱
BODY <script type="module">         ← 语言切换
BODY <script type="module">         ← Header：主题初始化就在这里
```

module 脚本一律延迟：浏览器解析完文档、跑完延迟脚本之前就已经可以完成首绘。
默认（`data-theme` 未写入）走 `:root` 的浅色那套 —— 于是「先白一下，再翻深色」。
`global.css` 里 `.ms-icon` 那段注释（「脚本执行前 data-theme 尚未写入时默认走浅色那套」）
记的就是这个顺序。

## 二、首帧主题读数（`verify.mjs`）

口径：系统 Chrome 151、900×600 @DPR 1、CPU 节流 ×20；
`earliest` = `readystatechange → 'interactive'` 的第一个事件里读到的 `data-theme`
（规范顺序上这一时刻早于所有 defer / module 脚本）；
`帧` = CDP `Page.startScreencast` 在导航后收到的合成帧数，
`首帧`/`末帧` = 顶部 48px 条带的平均亮度（深色 AMOLED 底 ≈ 0，浅色 tone98 底 ≈ 245–248），
`反向帧` = 与期望主题相反的底色帧数（深色期望下 > 120 即白闪）。

同一份 `verify.mjs`、同一台机器、同一套参数：先跑**修复后**的构建，再把 `Base.astro` / `global.css`
还原成基线内容重建后跑**修复前**的构建（`check-build.sh` 的改动只影响产物自检、与渲染无关，未还原）。

### 修复前（基线 `880dd857`）— 0/12

| 页面 | stored | 系统 | 期望 | earliest 时刻的 data-theme | 帧 | 首帧 | 末帧 | 反向帧 | 结论 |
|---|---|---|---|---|---|---|---|---|---|
| zh-home | dark | light | dark | **null** | 10 | 246 | 4 | 4 | ❌ 白闪 |
| en-home | dark | light | dark | **null** | 8 | 246 | 4 | 3 | ❌ 白闪 |
| zh-home | dark | dark | dark | **null** | 9 | 246 | 4 | 3 | ❌ 白闪 |
| en-home | dark | dark | dark | **null** | 9 | 246 | 4 | 3 | ❌ 白闪 |
| zh-home | light | light | light | **null** | 8 | 246 | 245 | 0 | ❌ 时刻不对 |
| en-home | light | light | light | **null** | 8 | 246 | 245 | 0 | ❌ 时刻不对 |
| zh-home | light | dark | light | **null** | 8 | 246 | 245 | 0 | ❌ 时刻不对 |
| en-home | light | dark | light | **null** | 8 | 246 | 245 | 0 | ❌ 时刻不对 |
| zh-home | system | dark | dark | **null** | 8 | 248 | 4 | 5 | ❌ 白闪 |
| en-home | system | dark | dark | **null** | 10 | 246 | 4 | 4 | ❌ 白闪 |
| zh-home | system | light | light | **null** | 8 | 245 | 245 | 0 | ❌ 时刻不对 |
| en-home | system | light | light | **null** | 8 | 245 | 245 | 0 | ❌ 时刻不对 |

- 6 组「期望深色」里有 6 组抓到浅色帧（首帧亮度 246–248 = 浅色底），
  其中 `system-dark` 的 5 帧全是浅色 —— 这就是 Ray 看到的白闪。
- 「期望浅色」的组合配色上不会闪（要闪的颜色和最终颜色一样），但 `earliest` 仍是 `null`，
  说明主题确实晚于「解析完成」才写入。

### 修复后（本 PR）— 12/12

| 页面 | stored | 系统 | 期望 | earliest 时刻的 data-theme | 帧 | 首帧 | 末帧 | 反向帧 | 结论 |
|---|---|---|---|---|---|---|---|---|---|
| zh-home | dark | light | dark | **dark** | 10 | 0 | 4 | 0 | ✅ |
| en-home | dark | light | dark | **dark** | 8 | 0 | 4 | 0 | ✅ |
| zh-home | dark | dark | dark | **dark** | 10 | 3 | 4 | 0 | ✅ |
| en-home | dark | dark | dark | **dark** | 9 | 3 | 4 | 0 | ✅ |
| zh-home | light | light | light | **light** | 9 | 248 | 245 | 0 | ✅ |
| en-home | light | light | light | **light** | 11 | 248 | 245 | 0 | ✅ |
| zh-home | light | dark | light | **light** | 10 | 248 | 245 | 0 | ✅ |
| en-home | light | dark | light | **light** | 8 | 246 | 245 | 0 | ✅ |
| zh-home | system | dark | dark | **dark** | 8 | 0 | 4 | 0 | ✅ |
| en-home | system | dark | dark | **dark** | 10 | 3 | 4 | 0 | ✅ |
| zh-home | system | light | light | **light** | 8 | 246 | 245 | 0 | ✅ |
| en-home | system | light | light | **light** | 10 | 248 | 245 | 0 | ✅ |

- 首帧亮度直接就是终态（深色 0–3 / 浅色 246–248），导航后**没有任何反向底色帧**。
- 同一时刻（`readyState=interactive`）`data-theme` 已等于最终值 —— 主题不再依赖延迟脚本。

### 逐帧对照图（`shots/`）

- `baseline__zh-home__dark-dark__wrong.png`：修复前，stored=dark 的页面首帧是**浅色**
  （白底 + 黑 Logo）——即闪的那一帧。
- `fixed__zh-home__dark-dark__first.png`：修复后同一组合的**首帧**已直接是深色（纯黑底 + 白 Logo）。
- 其余 `*__first.png` 是各组合的首帧，`baseline__*__wrong.png` 是基线抓到的反向帧。

## 三、主题按钮三态循环（`toggle-verify.mjs`）

初始 `localStorage.theme='light'`、系统偏好 dark，连点三次（点完立刻读）：

| 页面 | 初始 | 点击 1 | 点击 2 | 点击 3 | 结论 |
|---|---|---|---|---|---|
| zh-home | light / sun | dark / moon (stored dark) | dark / system (stored system) | light / sun (stored light) | ✅ |
| en-home | light / sun | dark / moon (stored dark) | dark / system (stored system) | light / sun (stored light) | ✅ |
| zh-about | light / sun | dark / moon (stored dark) | dark / system (stored system) | light / sun (stored light) | ✅ |

三态（浅 → 深 → 跟随系统）与「点击即时生效」都和修复前一致；关于页（`data-page="about"`）一并覆盖。

`color-scheme` 的 computed 值（`color-scheme` 只影响滚动条这类浏览器自绘 UI，不参与配色）：

| 组合 | `data-theme` | computed `color-scheme` | html 底色 |
|---|---|---|---|
| stored=light, sys=light | light | light | `rgb(249, 249, 249)` |
| stored=dark, sys=light | dark | dark | `rgb(0, 0, 0)` |
| stored=system, sys=dark | dark | dark | `rgb(0, 0, 0)` |

## 四、构建产物与回归断言

`pnpm build`（Astro 6.3.5）44 页面全部成功；`bash .github/scripts/check-build.sh` 通过，
新增两行输出：

```
  主题初始化: <head> 内联经典脚本，产物中无 type=module / src（RAY-557）
```

`check-build.sh` 里新增的断言（延续 RAY-463 / 467 / 544 / 547 / 549 / 552 的做法）：

1. 每个页面 `</head>` 之前必须有那段读 `localStorage.theme` 的脚本；
2. 承载它的开标签必须是最朴素的 `<script>`；带 `type` / `src` 一律判失败。

负向测试（都在临时目录里改产物，不动仓库）：

| 负例 | 结果 |
|---|---|
| 删掉 `dist/index.html` 里的主题脚本 | `::error file=…/index.html::<head> 里没有主题初始化内联脚本` → exit 1 |
| 44 个页面的主题脚本开标签改成 `<script type="module">` | `主题初始化脚本的开标签是「<script type="module"」…` → exit 1 |

实现这两个断言时踩到的两个坑（已写在脚本注释里）：

- `set -o pipefail` 下 `sed -n '1,/<\/head>/p' "$f" | grep -q …` 会因 `grep -q` 命中即退出、
  `sed` 收到 SIGPIPE（141）而把**命中**判成失败 —— 改用命令替换。
- grep 逐行匹配跨不过 `<script>` 与脚本正文之间的那个换行，需先 `tr -d '\n'` 压平。

## 五、怎么复现这套自测

```bash
pnpm build
python3 -m http.server 44557 --directory dist &
NODE_PATH=$(npm root -g) node docs/qa/RAY-557/verify.mjs \
  http://127.0.0.1:44557 readings-fixed.json shots fixed 20
NODE_PATH=$(npm root -g) node docs/qa/RAY-557/toggle-verify.mjs \
  http://127.0.0.1:44557 readings-toggle.json
```

依赖 `playwright`（走系统 Chrome `/usr/bin/google-chrome`）与 `sharp`（解码 screencast 帧），
两者只用于本目录的自测脚本，不进构建依赖。

## 六、没覆盖到的

- Firefox / WebKit：只跑了 Chromium。经典内联脚本同步执行是 HTML 规范行为，
  三端一致；但本记录只以 Chromium 实测为准。
- 真实网络下的 CDN 往返（`heti.min.css`、Google Fonts）：自测用 CPU 节流模拟「解析跨过合成帧」，
  没有真去复现线上那几跳延迟。构建产物与协议层面的结论不受影响。
- 线上页面显示以合并部署后为准。
