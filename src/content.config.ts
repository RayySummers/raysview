import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** 文章正文字段：中英两个集合共用同一套 schema */
const postSchema = z.object({
  title: z.string(),
  date: z.date(),
  tags: z.array(z.string()).optional(),
  banner: z.string().optional(),
  listBanner: z.string().optional(),
  /** 社交分享卡片（og:image）专用图；缺省用 banner。宽幅封面可另配 1:1 方图，避免微信缩略图裁掉版式 */
  ogImage: z.string().optional(),
  excerpt: z.string().optional(),
  modified: z.date().optional(),
  /** 该文在微信公众号的对应文章链接；有值时才在文章底部显示微信入口（没有对应推文的文章不显示） */
  wechatUrl: z.string().optional(),
  /**
   * 仅英文集合用：这篇译文对应的中文原文 id（相对 `src/content/posts/` 的路径，不带扩展名）。
   * 译文与原文件名相同时可以省略 —— 省略即视为同名对应。
   * 语言切换菜单靠它判断「中文文章页有没有英文版」（见 src/i18n/routes.ts）。
   */
  translationOf: z.string().optional()
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: postSchema
});

/**
 * 英文文章（RAY-465 第一阶段只有目录骨架，还没有译文）。
 * 目录里一旦出现 .md，`/en/posts/<id>/` 就会自动生成，中文对应文章页的「英文」菜单项也会自动点亮。
 */
const postsEn = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts-en' }),
  schema: postSchema
});

export const collections = { posts, postsEn };
