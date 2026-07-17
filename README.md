# 睿见 RayView

何睿的个人博客网站，同步微信公众号 @睿见RayView。用于分享个人经历、语言学知识科普、社会现象的思考与分析。

域名：[raysview.fun](https://raysview.fun)

---

## 栏目介绍

| 栏目 | 说明 |
|------|------|
| **半月记** | 每两周分享一次个人生活、学习经历的回顾与反思 |
| **正在输入中** | 语言学知识科普专栏，从日常语言现象中剖析语言学原理 |
| **随便想想 / JustThinking** | 对社会现象/日常问题的深度推演与多方案分析 |
| **关于我** | 个人简介 |

---

## 🏗️ 技术架构

| 组件 | 说明 |
|------|------|
| **Astro** | 静态站点框架，零 JS 默认 |
| **Markdown** | 内容格式，内容与表现分离 |
| **Source Han Sans SC** | 思源黑体，font-feature-settings: "palt" |
| **Heti** | 中文排版优化（标点挤压、段落间距） |
| **Lenis** | 平滑滚动，duration: 0.1 |
| **腾讯云 (Tencent Cloud)** | 自托管服务器，Nginx + SSL |
| **GitHub Actions** | push 到 main 自动构建部署至服务器 |

---

## 📂 目录结构

```
raysview/
├── src/
│   ├── content/posts/
│   │   ├── biweekly/        # 半月记
│   │   ├── justthinking/    # 随便想想 / JustThinking
│   │   └── raydesign/       # Ray 的设计课
│   ├── components/          # Header, Footer 等组件
│   ├── layouts/             # 页面布局
│   ├── pages/               # 路由页面
│   └── styles/global.css    # 全局样式
├── public/                  # 静态资源 (favicon.png 等)
├── .github/workflows/       # GitHub Actions 配置
└── astro.config.mjs         # Astro 配置
```

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

## 📋 备案信息

| 项目 | 详情 |
|------|------|
| **备案号** | 渝 ICP 备 2026010610 号 |
| **备案日期** | 2026-07-01 通过 |

Footer 中已包含备案号，符合工信部要求。
