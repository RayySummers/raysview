import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    tags: z.array(z.string()).optional(),
    banner: z.string().optional(),
    listBanner: z.string().optional(),
    /** 社交分享卡片（og:image）专用图；缺省用 banner。宽幅封面可另配 1:1 方图，避免微信缩略图裁掉版式 */
    ogImage: z.string().optional(),
    excerpt: z.string().optional(),
    modified: z.date().optional()
  })
});

export const collections = { posts };