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
    excerpt: z.string().optional()
  })
});

export const collections = { posts };