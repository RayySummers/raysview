# RayView Blog

A hyper-minimalist blog for [@睿见RayView](https://github.com/rayview).

## Tech Stack

- **Astro** - Static site generator
- **Markdown** - Content format
- **GitHub Pages** - Hosting

## Writing Posts

Create a `.md` file in `src/content/posts/`:

```markdown
---
title: Your Post Title
date: 2024-12-15
tags: [tech, thoughts]
banner: https://example.com/banner.jpg
---

Your content here...
```

## Development

```bash
pnpm install
pnpm dev     # Start dev server
pnpm build   # Build for production
pnpm preview # Preview production build
```

## Deploy

Push to `main` branch. GitHub Actions will automatically build and deploy to GitHub Pages.