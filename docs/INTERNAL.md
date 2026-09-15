# RayView 内部文档

> 本文档包含项目内部工作流、部署配置等内容，不随公开 README 发布。

---

## 📝 发布文章

### 方法一：让我帮你发

把文章内容和需求告诉我，我来创建文件、推送、自动部署。

### 方法二：自己操作

**1. 创建 Markdown 文件**
```
src/content/posts/your-post-title.md
```

**2. 写入内容**：
```markdown
---
title: 文章标题
date: 2026-05-18
tags: [技术, 随笔]
banner: https://example.com/banner.jpg
---

正文内容...

支持 Markdown 语法：
- **粗体**
- *斜体*
- [链接](url)
- 代码块
- 图片等
```

**3. 提交并推送**：
```bash
cd raysview
git add .
git commit -m "Add: 文章标题"
git push
```

推送后自动触发构建部署至生产服务器，无需手动操作。

---

## 🎨 文章配置 (Frontmatter)

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `title` | ✅ | 文章标题 | `title: 我的第一篇文章` |
| `date` | ✅ | 发布日期 (YYYY-MM-DD) | `date: 2026-05-18` |
| `tags` | ❌ | 标签数组 | `tags: [技术, 随笔]` |
| `banner` | ❌ | 头图（文章页/列表页显示），推荐站内托管，见「文章图片托管」 | `banner: /images/posts/xxx-banner.jpg` |
| `listBanner` | ❌ | 列表页封面，缺省用 `banner` | `listBanner: /images/posts/xxx-list.jpg` |
| `ogImage` | ❌ | 分享卡片图（og:image），缺省用 `banner`；宽幅封面另配 1:1 方图 | `ogImage: /images/posts/xxx-og.jpg` |

---

## 🖼️ 文章图片托管

站外图床（imgdb 等）的图片用作分享卡片时不可靠：图床若有防盗链/限流，微信抓不到图，缩略图就退回站点 Logo。因此：

- **封面图（`banner` / `listBanner` / `ogImage`）一律放站内**：文件存到 `public/images/posts/`，frontmatter 写站内路径（如 `/images/posts/welcome-banner.jpg`）；脚本里对站外 URL 仍有保护（拿不到就不用，退回 `/og-image.png`）；
- **尺寸建议**：长边 1600px、JPEG q90（约 50–500KB），数 MB 的原图 PNG 不要直接入库；
- **宽幅封面**（2.35:1 等）在微信缩略图里会被裁成正方形、切掉版式：这类文章另存一张 1:1 方图（横幅居中、四周用自身放大模糊填充），用 `ogImage` 指向它；
- **正文配图**仍可用图床（不进分享卡片，没有上述问题）。

---

## ✏️ 写作规范

- **语言**：中文为主，技术术语可用英文
- **段落**：中文行高 1.8，英文 1.65（Heti 会自动优化）
- **标点**：中文全角标点，英文半角
- **图片**：建议先压缩，尺寸 < 200KB；封面图（banner）见「文章图片托管」，长边 1600px、JPEG q90
- **代码**：使用标准 Markdown 代码块语法

---

## 🌏 中英双语（RAY-465）

| 位置 | 说明 |
|------|------|
| **界面文案** | `src/i18n/zh.json` / `src/i18n/en.json`，两个文件的键一一对应；漏译或键名写错会在构建时直接报错，不会静默渲染成空串 |
| **「关于」页文案** | 篇幅长且带链接，单独放 `src/i18n/about.ts`，两份文案并排 |
| **路由判断** | `src/i18n/routes.ts` 回答「当前页面在目标语言下有没有对应版本」，语言切换菜单只负责渲染 |
| **英文页面** | 目录镜像中文：`src/pages/en/…`，URL 前缀 `/en/`；中文仍在根路径 |
| **英文文章** | 放进 `src/content/posts-en/`，frontmatter 用 `translationOf` 指向中文原文 id（文件名与中文同名时可省略） |
| **AI 译文声明** | 英文页面的 footer 自动显示，文案在 `en.json` 的 `footer.aiNotice` |

`src/content/posts-en/` 目前是空目录（只有 `.gitkeep`）：第一阶段只搭架构，译文留到第二阶段。
放入第一篇译文后，对应中文文章页语言菜单里的「英文」项会自动从灰色变成可点，不需要改代码。

构建时的两条提示（`No files found matching "**/*.md"` 与 `The collection "postsEn" does not exist or is empty`）
都是「英文内容目录还空着」的正常表现，不是配置错误；放进第一篇译文后自动消失。

---

## 🌐 部署

| 项目 | 详情 |
|------|------|
| **仓库** | [github.com/RayySummers/raysview](https://github.com/RayySummers/raysview) |
| **服务器** | 腾讯云轻量应用服务器 47.109.61.171 |
| **Web 服务** | Nginx |
| **部署路径** | `/www/wwwroot/raysview.fun/`（nginx `root` 指向这里） |
| **域名** | [raysview.fun](https://raysview.fun) |
| **SSL** | 已启用 HTTPS |

推送代码到 `main` 分支后，GitHub Actions 自动构建并部署至服务器。

访问：**https://raysview.fun**

### 服务器侧配置（改配置前先看这里）

- nginx vhost：`/www/server/panel/vhost/nginx/html_raysview.fun.conf`，其中 `root /www/wwwroot/raysview.fun;`；站点目录外不要再手工加 `/images/` 之类的 `location ... alias` 覆盖（RAY-463 踩过：一条指向旧目录 `/www/raysview/` 的 `location ^~ /images/` 让所有站内封面图 404，见下）。
- 站内图片放 `public/images/`，构建后由 `root` 直接提供，不需要额外规则。
- 部署流水线 `.github/workflows/deploy.yml`：构建 → 自检 `dist` → rsync 增量同步（`--delete`，保留 `.user.ini` / `.htaccess` / `.well-known`）→ 逐个校验线上资源与 `og:image`；任何一步失败 job 直接变红。
- 线上排障（不上传文件，只巡检构建产物、服务器目录与线上资源）：`gh workflow run deploy.yml --ref <branch> -f dry_run=true`。
- `/images/` 或分享卡片又出现 404 时：先确认 nginx vhost 里有没有人手加的 `location ^~ /images/` 块（`grep -n "images" /www/server/panel/vhost/nginx/html_raysview.fun.conf`），再确认 `dist/images` 是否正常上传。
- 改 nginx 配置前先 `cp -a` 备份 + `nginx -t`，服务器上仍留有一份 RAY-463 改动前的 vhost 备份（`html_raysview.fun.conf.bak-ray463-20260915064319`）。

---

## ⚙️ 自定义

### 主题色
编辑 `src/styles/global.css` 中的 CSS 变量：
```css
:root {
  --color-bg: #F0F0F0;           /* 背景色 */
  --color-text-primary: #000000;  /* 主文字色 */
  --color-text-secondary: #6B6B6B; /* 次要文字色 */
}
```

### 深色模式
深色模式会自动应用，只需确保 CSS 变量 `[data-theme="dark"]` 定义正确。

### 字体
当前使用 Source Han Sans SC (思源黑体简体中文)，通过 jsDelivr CDN 加载。

---

## ❓ 常见问题

**Q: 如何删除一篇文章？**
A: 删除对应的 `.md` 文件并推送即可。

**Q: 如何修改文章的发布日期？**
A: 编辑 Frontmatter 中的 `date` 字段并推送。

**Q: 头图不显示？**
A: 确保 `banner` 字段填入的是可公开访问的图片 URL，或存到 `public/images/posts/` 后写站内路径（见「文章图片托管」）。

**Q: 分享到微信 / 朋友圈，缩略图还是站点 Logo？**
A: 依次检查：`banner` 是否为站内路径（站外图床会被跳过，退回 Logo）；微信对分享卡片有缓存，改动后可用 `?v=2` 之类的参数或新链接验证。

**Q: 如何彻底回退到某个版本？**
A: 使用 Git 回退：`git revert <commit>` 或 `git reset --hard <commit>`
