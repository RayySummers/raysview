import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const base = import.meta.env.BASE_URL;
  const posts = await getCollection('posts');
  const index = posts
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .map(post => ({
      title: post.data.title,
      url: `${base}/posts/${post.slug}`,
      tags: post.data.tags || [],
      date: post.data.date.toISOString().split('T')[0]
    }));

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
};