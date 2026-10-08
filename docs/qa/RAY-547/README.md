# RAY-547 自测记录（JT#04 词表逐行 ＋ 中文篇公众号入口）

## 报障与结论

Ray 10/9 报：中英两篇 JT#04 文章页里，「中英对照词表」被渲染成**一整行**。
原因是词表 15 行写在同一个 Markdown 段落里，连续软换行会被 Markdown 并成一个段落，
HTML 里换行不换行 —— 页面上就是一整行。

改法：词表每行行尾补**两个空格**（CommonMark 硬换行），构建产物里就是词表段落内的 `<br>`。
不加 bullet，观感与公众号版一致。

| # | 文件 | 位置 | 改动 |
|---|---|---|---|
| 1 | `src/content/posts/justthinking/justthinking-04-metro-volunteer.md` | L41–54 | 词表 14 条行尾各补两个空格（末行 `…………` 不补：段落最后一行的硬换行是空操作） |
| 2 | 同上 | L9 | frontmatter 增 `wechatUrl: "https://mp.weixin.qq.com/s/sR7e_i-bN1YDzjVFOMN9wQ"` |
| 3 | `src/content/posts-en/justthinking/justthinking-04-metro-volunteer.md` | L41–54 | 词表 14 条行尾各补两个空格（末行 `…` 同上） |
| 4 | `.github/scripts/check-build.sh` | L68–95 | 新增防回归断言：词表段落 `<br>` 数 = 源文件词表行数 − 1 |

## 一、构建产物断言（`bash .github/scripts/check-build.sh`）

自检通过，其中新增一行输出：

```
  词表逐行  : JT#04 中英词表逐行渲染（硬换行数 = 源文件行数 - 1）
```

断言口径：从源文件数出词表行数（`乘车码——ride code` / `ride code——乘车码` 起，到第一个空行止），
再要求构建产物里词表段落的 `<br>` 数正好等于行数 − 1。行数不写死，以后增删词条不用改脚本。

**反向验证**：把两处内容改动 stash 掉重新构建（即修复前的状态），脚本按预期变红并报出原因：

```
::error::中文 词表段落只有 0 个硬换行，源文件是 15 行（预期 14 个）——词表被并成整行了（RAY-547）
```

（第一版脚本在 0 个 `<br>` 时被 `set -e` 静默掐断、报不出原因，已修。）

## 二、构建产物逐行核对

```
dist/posts/justthinking/justthinking-04-metro-volunteer/index.html      14 个 <br>，15 行
dist/en/posts/justthinking/justthinking-04-metro-volunteer/index.html   14 个 <br>，15 行
```

全文只有这两个页面出现 `<br>`（共 28 个），其余 42 个页面不受影响。

## 三、回归口径：文章页只差这两处

用同一份源码（修复前 / 修复后）各构建一次，把两篇文章页的 HTML 按标签归一化后逐行 diff：

| 页面 | 改动块数 | 差异 |
|---|---|---|
| 中文 `/posts/justthinking/justthinking-04-metro-volunteer/` | 2 | ① 词表 14 行尾加 `<br>`；② `.post-actions` 里多出 `.wechat-link` |
| 英文 `/en/posts/justthinking/justthinking-04-metro-volunteer/` | 1 | 只有词表 14 行尾加 `<br>`，**没有**公众号入口 |

其余段落、AI 声明折叠区、脚注、目录、样式逐字节一致。

## 四、浏览器实测（`node verify.mjs <baseUrl> <outJson> <shotsDir>`）

`astro preview` ＋ 系统 Chrome（1280×900、deviceScaleFactor 2；窄屏 390×844），**22 项全 PASS**：

- 中英两页：15 条词**每条各起一行**（逐条量 `Range.getBoundingClientRect().top`，严格递增）、
  左边缘对齐（差 0px）、无 `<li>`、段落文字与源文件逐行一致；
- 中文页底部 `.wechat-link`：href 指向 Ray 给的链接、`target=_blank` + `noopener`、
  图标真实加载（`naturalWidth > 0`）；**英文页没有**公众号入口；
- 窄屏 390px：仍逐行、无横向溢出（`scrollWidth == 390`）。

截图：`wordlist-zh-light.png`、`wordlist-en-light.png`、`wordlist-zh-narrow.png`、
`wordlist-en-narrow.png`、`wechat-entry-zh-light.png`。

### 一个已知的正常现象

英文词表第 8 条 `banknotes——纸币（as the ticket machines put it; "bills" in American English）`
共 73 字符，在 1280px 下比正文栏宽（约 550px）长，会折成两行（第二行是 `English）`）。
这是正常文本流，不是「并成一行」；每条词仍各起一行，窄屏下折行更多。
脚本因此断言「每条各起一行」而不是「行盒数 = 15」。
