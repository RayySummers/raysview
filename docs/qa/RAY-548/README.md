# RAY-548 自测记录（英文版 logo 本地化 ＋ 标签英文化）

## 改了什么

| # | 文件 | 改动 |
|---|---|---|
| 1 | `src/tags-map.ts` | **新增**：标签中英对照表（单一来源）＋ `tagInLang()` / `tagsInLang()` / `assertEnglishTags()` |
| 2 | `src/components/Header.astro` | logo 链接改用 `hrefFor('/', lang)`：中文 `/`、英文 `/en/`（原来写死 `/`） |
| 3 | `src/content/posts-en/.../justthinking-04-metro-volunteer.md` | frontmatter `tags`：`志愿服务 → Volunteering`、`地铁 → Metro` |
| 4 | `src/i18n/routes.ts` | 标签页语言切换按对照表换写法；英文集合出现中文标签时构建报错 |
| 5 | `src/components/pages/{ArticlePage,PostListPage}.astro` | 标签文字与链接过 `tagsInLang()`（按界面语言取规范写法） |
| 6 | `src/pages/tags/[tag].astro`、`src/pages/en/tags/[tag].astro` | 路由目录名同样按对照表规范化 |
| 7 | `src/search-index.ts` | 搜索索引里的 tags 与页面显示保持一致 |
| 8 | `public/fonts/MiSans-VF.woff2` | 构建时自动重新子集化（新增代码注释用字），与历史提交同惯例 |

对照表口径（`src/tags-map.ts`）：

| 中文标签 | 英文标签 |
|---|---|
| 静音车厢 | Quiet Carriage |
| 高铁 | High-Speed Rail |
| 词元 | Ciyuan |
| 颜色词 | Color Terms |
| 语义学 | Semantics |
| 志愿服务 | Volunteering |
| 地铁 | Metro |

其余标签（`ai` / `anthropic` / `mint` / `toothpaste` / `website` / `github` / `emoji` / `token` /
`biweekly` / `JustThinking` / `RayDesign`）中英同形，也登记在表里，因此该文件即全站标签清单。

## 验证

### 构建产物断言（`pnpm build`，44 页通过）

| 断言 | 结果 |
|---|---|
| `/en/` 首页与全部英文页 logo `href` | `/en/` ✓ |
| 中文页 logo `href` | `/` ✓ |
| 英文文章页标签 | `#JustThinking #Volunteering #Metro` ✓ |
| 中文文章页标签 | `#JustThinking #志愿服务 #地铁` ✓ |
| 英文标签页目录 | `dist/en/tags/{JustThinking,Metro,Volunteering}/` ✓ |
| 中文标签页目录 | 18 个，与改动前逐一相同 ✓ |
| `/tags/志愿服务/` 的英文 alternate | `/en/tags/Volunteering/` ✓（页面内 hreflang 与语言菜单均正确） |
| 改动前后 dist 逐文件对比 | 中文页面除「英文 alternate 链接」外**逐字节相同**；英文页面差异仅为 logo `href` 与标签文字/链接 ✓ |

### 新增的两道构建期闸门（反向测试，均按预期失败）

1. 把 `志愿服务` 写回英文文章 frontmatter →
   `[tags-map] 英文文章的标签还是中文：志愿服务。…` 构建失败 ✓
2. 把两枚中文标签指向同一个英文词（`颜色词: 'Semantics'`）→
   `[tags-map] 英文标签「Semantics」被「语义学」和「颜色词」同时占用…` 构建失败 ✓

### 浏览器实测（Playwright + `python3 -m http.server`，单次通过）

| 检查 | 结果 |
|---|---|
| `/en/posts/justthinking/justthinking-04-metro-volunteer/` logo `href` | `/en/` ✓ |
| 点击 logo 后落地 URL | `/en/` ✓（报障的「跳回中文首页」不再出现） |
| 英文文章标签行 | `2026-10-08 #JustThinking #Volunteering #Metro` ✓ |
| 中文文章标签行 | `2026-10-08 #JustThinking #志愿服务 #地铁` ✓ |
| `/tags/志愿服务/` 语言菜单 → 英文 | `/en/tags/Volunteering/` ✓ |
| `/en/tags/Volunteering/` 标题 / 语言菜单 → 中文 | `Tag: Volunteering` / `/tags/志愿服务/` ✓ |

截图：[en-article-tags.png](en-article-tags.png)（英文标签）、[zh-article-tags.png](zh-article-tags.png)（中文标签，未变）。

## 已知副作用（非本次改动引入，但值得记一笔）

`@astrojs/sitemap` 的 `i18n` 选项按**同名 slug** 配对中英页面。标签写法分语言之后，
`/en/tags/Volunteering/` 与 `/tags/志愿服务/` 无法自动配对，这两个标签页在 sitemap 里
不再带 `xhtml:link alternate`（页面自身的 `<link rel="alternate">` 仍然正确）。
标签页本身是 `noindex`，暂不处理；若日后要补，可在 sitemap 的 `serialize` 里按对照表手写 `links`。
