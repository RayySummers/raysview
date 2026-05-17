# RayView Blog

A hyper-minimalist blog for [@睿见RayView](https://github.com/rayview). Synchronized with WeChat Official Account.

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

GitHub Actions 会自动构建部署，无需手动操作。

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

## 🛠️ 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器（热更新）
pnpm dev

# 构建生产版本
pnpm build

# 预览生产构建
pnpm preview
```

---

## 🏗️ 技术架构

| 组件 | 说明 |
|------|------|
| **Astro** | 静态站点框架，零 JS 默认 |
| **Markdown** | 内容格式，内容与表现分离 |
| **Source Han Sans SC** | 思源黑体，font-feature-settings: "palt" |
| **Heti** | 中文排版优化（标点挤压、段落间距） |
| **Lenis** | 平滑滚动，duration: 0.1 |
| **GitHub Pages** | 托管 + 自动部署 |
| **GitHub Actions** | push 到 main 自动构建部署 |

---

## 📂 目录结构

```
raysview/
├── src/
│   ├── content/posts/     # 所有文章 (.md)
│   ├── components/        # Header, Footer 等组件
│   ├── layouts/           # 页面布局
│   ├── pages/             # 路由页面
│   └── styles/global.css  # 全局样式
├── public/                # 静态资源 (favicon.png 等)
├── .github/workflows/     # GitHub Actions 配置
└── astro.config.mjs       # Astro 配置
```

---

## 🌐 部署

push 到 `main` 分支后，GitHub Actions 会自动：
1. 安装依赖 (`pnpm install`)
2. 构建站点 (`pnpm build`)
3. 部署到 GitHub Pages

访问：**https://rayysummers.github.io/raysview**

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