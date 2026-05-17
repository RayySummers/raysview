import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    tags: z.array(z.string()).optional(),
    banner: z.string().optional(),
    excerpt: z.string().optional()
  })
});

export const collections = { posts };