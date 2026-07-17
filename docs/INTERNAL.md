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
| `banner` | ❌ | 头图 URL (16:9 推荐) | `banner: https://.../image.jpg` |

---

## ✏️ 写作规范

- **语言**：中文为主，技术术语可用英文
- **段落**：中文行高 1.8，英文 1.65（Heti 会自动优化）
- **标点**：中文全角标点，英文半角
- **图片**：建议先压缩，尺寸 < 200KB
- **代码**：使用标准 Markdown 代码块语法

---

## 🌐 部署

| 项目 | 详情 |
|------|------|
| **仓库** | [github.com/RayySummers/raysview](https://github.com/RayySummers/raysview) |
| **服务器** | 腾讯云轻量应用服务器 47.109.61.171 |
| **Web 服务** | Nginx |
| **部署路径** | `/www/raysview/` |
| **域名** | [raysview.fun](https://raysview.fun) |
| **SSL** | 已启用 HTTPS |

推送代码到 `main` 分支后，GitHub Actions 自动构建并部署至服务器。

访问：**https://raysview.fun**

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
A: 确保 `banner` 字段填入的是可公开访问的图片 URL。

**Q: 如何彻底回退到某个版本？**
A: 使用 Git 回退：`git revert <commit>` 或 `git reset --hard <commit>`
