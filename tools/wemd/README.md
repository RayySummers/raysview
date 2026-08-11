# wemd — Obsidian → 微信公众号 HTML 转换工具链

> **We**Chat **M**ark**D**own：把 Obsidian 写的文章，一键转换成「纯内联样式」的公众号成品 HTML。

## 工具简介与解决的问题

微信公众号编辑器**只保留内联样式**，且不支持 `<style>` / `class`、`flex`、`position:absolute`、伪元素（`::before` / `::after`）、`min-width:max-content`、`overflow-x:scroll` 等特性。直接粘贴普通 Markdown 渲染结果，样式会大面积丢失。

本工具链把 Obsidian 文章转换为**单个「纯内联样式」HTML**：

- 每个元素的所有样式全部内联在 `style=""` 属性里，**没有 `<style>` 标签、没有 class**；
- 浏览器直接打开即为成品预览，可直接复制粘贴进公众号后台；
- 列表序号 / 符号用手动 `<span>` 渲染（微信粘贴常剥离 `list-style`）；
- 链接用「外层 `<a>` + 内层 `<span>`」双层同色包裹，防止微信剥离 `<a>` 样式后链接被染成默认蓝色。

工具链包含 4 个文件：

| 文件 | 作用 |
|------|------|
| `convert.mjs` | 主转换器：Markdown → 内联样式 HTML |
| `verify.mjs` | 自检脚本：对产物跑 32 项断言 |
| `qa-browser.py` | Playwright 浏览器渲染 QA + 全页预览截图 |
| `image-map.json` | 图片 文件名 → 图床 URL 映射（示例） |

转换产物（HTML、截图、QA JSON）输出到 `output/`，该目录已加入仓库 `.gitignore`，**不入库**。

## 前置依赖

- **Node.js ≥ 18**（`convert.mjs` / `verify.mjs` 使用 ESM `import` 与 `String.matchAll`，实测 Node v24 通过）
- **Python 3**（仅 `qa-browser.py` 需要）+ Playwright：
  ```bash
  pip install playwright
  playwright install chromium
  ```

## 快速上手

```bash
node convert.mjs "D:\文章.md" -o ./output/文章.html --map ./image-map.json
```

- `<input.md>`：Obsidian 源文件（含 `![[图片.png]]` 嵌入、`[^n]` 脚注、frontmatter 均可）
- `-o`：输出 HTML 路径（缺省为当前目录 `output.html`；目录不存在会自动创建）
- `--map`：图片映射 JSON 路径；**不带 `--map` 时默认读取脚本同目录 `image-map.json`**（可缺省）

转换完成后直接双击打开输出 HTML 预览，或进入「完整工作流」继续自检与 QA。

## 完整工作流

从写作到发布公众号的完整流程：

1. **Obsidian 写作**：正常写作即可，支持：
   - frontmatter（`title:` 会作为标题兜底）与站内元信息行（`标题：` / `发表时间：` / `封面图：`，转换时自动剥离）
   - `![[xxx.png]]` 图片嵌入、`[^n]` 脚注、`#` 标题、表格、代码块、引用块、`---` 分隔线
2. **上传图片到图床**：把文章用到的图片传到图床（如 imgdb），拿到 URL。
3. **更新 `image-map.json`**：为每个 `![[文件名.png]]` 添加 文件名 → 图床 URL 映射（见下文「image-map.json 维护说明」）。
4. **转换**：
   ```bash
   node convert.mjs "D:\Obsidian\文章.md" -o ./output/文章.html --map ./image-map.json
   ```
5. **自检**（32 项断言）：
   ```bash
   node verify.mjs ./output/文章.html
   ```
   输出结尾应为 `全部通过`（详见「verify.mjs 用法」）。
6. **浏览器预览 QA**（可选但推荐）：
   ```bash
   python qa-browser.py ./output/文章.html ./output/preview-full.png
   ```
   生成全页截图 `preview-full.png` 与样式检查结果 `文章.html.qa.json`（详见「qa-browser.py 用法」）。
7. **粘贴到公众号后台**：浏览器打开 HTML → 全选复制 → 粘贴到公众号编辑器图文正文。
8. **发布前确认**：
   - **图片转存**：公众号会提示/自动把图床图片转存到微信服务器，确认转存成功；
   - **链接色**：正文链接应为深金 `#b8860b` 且带下划线，若被染成默认蓝色说明样式被剥离（内层 span 已最大程度缓解）；
   - **页边距**：容器 `padding: 12px`，文字贴近边缘但不贴边；
   - **图注间距**：图注紧贴图片（图底距 12px、图注上距 0），若明显分离需检查图片后是否独立成行的「（……）」；
   - **引用/脚注区**：blockquote 内容引号、文末「参考资料」列表渲染正常。

## image-map.json 维护说明

`image-map.json` 是 **文件名 → 图床 URL** 的映射（**精确匹配**）：

```json
{
  "Pasted image 20260811134526.png": "https://pic1.imgdb.cn/i/0345F65p7Myv3bJnGXN721.png",
  "词元安全警示中对token的混淆.png": "https://pic1.imgdb.cn/i/0345F66hVbYTZwd6MuILtS.png"
}
```

- **为新文章补映射**：把文中每个 `![[文件名.png]]` 的文件名（含扩展名、原样照抄）作为 key，值为图床 URL。未添加映射的图片会在产物中渲染为 `[图片缺失: 文件名]` 占位段落。
- **未命中时的回退**：`--map` 指定（或默认）的 JSON 里查不到时，`convert.mjs` 会再尝试匹配 `image-hosting/_urls.json`（相对**当前工作目录**解析，仓库外的 `E:\Creative\Projects\RayView\image-hosting\_urls.json`）。该文件是 `[key, url]` 数组，key 形如 `NN-文件名`；脚本去掉 `NN-` 前缀后用完整文件名再查一次，**只补显式映射中缺失的条目**。
- `image-map.json` 里 4 张图即 RAY-222《谁有权给一个概念命名？》的映射，可作为新文章的模板。

## 主题与常量说明

所有主题常量集中在 `convert.mjs` 头部 `---------- 主题常量 ----------` 区（约第 35–42 行）：

| 常量 | 值 | 用途 |
|------|-----|------|
| `PRIMARY` | `#edd363`（第 40 行） | 主色，装饰性元素：H1 左色条、H2 下划线、列表符号 `•`、参考资料标题 |
| `PRIMARY_50` | `rgba(237,211,99,0.5)`（第 41 行） | 主色 50%，行内代码下划线 |
| `TEXT_ACCENT` | `#b8860b`（第 42 行） | 文字级强调色：链接、上标、行内代码、脚注编号、有序列表序号（白底可读，对比度约 3.25:1） |
| `FONT_STACK` | 系统字体栈（第 36 行） | 正文字体 |
| `MONO_STACK` | 等宽字体栈（第 39 行） | 代码字体 |

**行高**：正文 `line-height: 1.8`（`STYLE.section` 第 46 行、`STYLE.p` 第 48 行、`STYLE.li` 第 70 行）。

**调整主色**：改 `PRIMARY` 即可带动 H1/H2/列表/参考资料标题；**文字级元素（链接/上标/行内代码/脚注编号）必须单独改 `TEXT_ACCENT`**——浅黄 `#edd363` 在白底上对比度仅 1.49:1，不可作文字色。若改主色，记得同步替换 `PRIMARY_50` 的 rgba 值。其余段落级样式（页边距 `padding:12px`、图注色 `#999` 等）在 `STYLE` 对象（第 44–88 行）中按元素调整。

## 脚注与图注规则

**脚注 `[^n]`**：

- 行内 `[^n]` → 上标 `<sup>[n]</sup>`（深金 `#b8860b`）；
- 文末 `[^n]: 内容` 定义 → 收集为「参考资料」区块，**插回首个脚注定义出现的位置**（保持「正文 → 参考资料 → ■ → AI 声明」的顺序）；
- 脚注定义中的 URL 自动着色为深金（与正文链接一致）；定义文本**不**做直角引号转换（保留原文）；
- 站内脚注区标题（`#### 引用资料…`）会被「参考资料」块替代，不再单独渲染。

**图注**：

- 图片嵌入行**后紧邻的独立「（……）」行**（全文行 ≤ 60 字符）会被识别为图注；
- 图注渲染为居中、`#999`、12px 的小字段落；
- 有图注的图片使用收紧样式 `margin: 20px auto 12px`（图注紧贴图片），无图注图片 `margin: 20px auto`；
- 识别是启发式的：图注必须是**独立一行**、以全角括号开头结尾、长度受限，否则按普通段落处理。

## verify.mjs 用法

对转换产物跑 32 项断言（**注意：断言中的数量是写死绑定 RAY-222 词元文章的**——4 张图、19 个上标、18 条定义、2 条图注等。转换新文章后需同步修改这些数字，或仅用它验证本文的回归）：

```bash
node verify.mjs ./output/文章.html
```

全部通过时输出结尾为 `全部通过`，退出码 0；有失败项则打印 `N 项未通过`，退出码 1。

覆盖的 32 项断言清单：

**样式合规（8 项）**：无 `<style>` 标签；无 class 属性；无 flex；无 `position:`；无 `::before`；无 `::after`；无 `max-content`；无 `overflow-x`。

**主题色（4 项）**：无旧主色 `#FAAD14`（含 rgba 形式）；无旧主色 `#ffe576`；装饰性主色 `#edd363` 出现 ≥ 5 次；文字级强调色 `#b8860b` 出现 ≥ 20 次。

**对齐（3 项）**：无 `text-align: justify`；`text-align: left` 出现 ≥ 20 次；图注保持居中（恰好 2 条）。

**链接与脚注 URL（2 项）**：所有 `<a>` 及其内层 span 均为 `#b8860b`；脚注 URL span 着色恰好 17 条。

**图片（4 项）**：图片数量 = 4；全部为 imgdb 图床 URL；四张图与图床映射一一对应；**无本地路径引用**（`file://` / `src="./`）。

**脚注（5 项）**：上标引用 = 19；脚注定义 = 18；引用编号均在 1..18；定义编号 1..18 齐全；每个被引用编号都有定义。

**图注与间距（3 项）**：图注 = 2；带图注图片 `margin: 20px auto 12px`；图注上距为 0（`margin: 0 0 20px`）。

**布局与内容（3 项）**：页边距 `padding: 12px`；关键内容（标题 H1 → 封面图 → Tokenizer → 词元安全警示 → DeepSeek 用量 → 参考资料 → AI 声明）存在且顺序正确；正文无英文/弯双引号残留（已转直角引号）。

## qa-browser.py 用法

用 Playwright 真实渲染 HTML，检查计算样式是否符合预期，并输出全页预览截图：

```bash
python qa-browser.py <input.html> [output.png]
```

- `<input.html>`：转换产物
- `[output.png]`：可选全页截图路径（缺省只做 QA 不截图）

运行后：

- 终端打印 `QA_DONE`（及 `SHOT_SAVED:<路径>`）；
- 在 `<input.html>.qa.json` 写入检查结果：标题、H1 样式（左色条/字号/对齐）、容器样式（字号/行高/字距/颜色/内边距）、图片加载状态、脚注数、列表符号色、链接色、图注间距、页面横向溢出等；
- 移动端视口 414×896，等待网络空闲后再取数。

示例：

```bash
python qa-browser.py ./output/文章.html ./output/preview-full.png
```

## 已知限制

- **链接染蓝风险**：微信粘贴时可能剥离 `<a>` 的样式；已用「内层 span 同色包裹」缓解，但极端情况下仍可能被染成默认蓝——发布前在后台确认链接色；
- **图片转存依赖微信**：粘贴后图片由公众号后台转存到微信服务器，转存失败需手动处理；
- **blockquote 大引号**：微信不支持 `::before` 伪元素，引用块改用内容字符 `"` 渲染（半透明、`pointer-events: none`），视觉近似但不可选中样式化；
- **列表符号**：微信常剥离 `list-style`，因此列表用手动 `<span>` 渲染 `•` / `1.`，粘贴后不依赖 CSS 列表样式；
- **verify.mjs 与文章绑定**：32 项断言中的数量（图片 4 张、上标 19、定义 18、图注 2 等）写死为 RAY-222 词元文章的期望值，换文章需调整；
- **表格/代码块**：使用朴素的边框/背景内联样式，公众号内保真度有限。

## 常见问题

**Q：转换后样式丢失怎么办？**
公众号编辑器只认内联样式。检查产物 HTML 是否含 `<style>` 标签或 `class="`（`verify.mjs` 前两项断言）；若转换时误用了非本工具的渲染器，请改用 `convert.mjs` 重新生成。粘贴后样式仍丢，多半是微信对个别属性的剥离，按「已知限制」逐项排查。

**Q：图挂了（图片不显示）？**
- 产物中是 `[图片缺失: xxx.png]` 占位文字 → `image-map.json` 缺该文件名映射，补上后重新转换；
- 产物中 `<img>` 存在但打不开 → 图床 URL 失效，重新上传并更新映射；
- 粘贴到公众号后变红叉 → 微信转存失败，在后台重新插入图片。

**Q：如何调试？**
1. 直接浏览器打开产物 HTML，F12 检查元素（所有样式都是内联的，一目了然）；
2. 跑 `python qa-browser.py xxx.html` 看 `xxx.html.qa.json` 里的计算样式是否与预期一致；
3. 调整 `convert.mjs` 的 `STYLE` 常量 → 重新转换 → `node verify.mjs` 自检；
4. 主色相关的调整改 `PRIMARY` / `TEXT_ACCENT`，见「主题与常量说明」。
