import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const posts = await getCollection('posts');
  const index = posts
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .map(post => ({
      title: post.data.title,
      // 绝对路径（相对站点根）；base 前缀由客户端拼接，避免 base='/' 时拼出协议相对 URL（//posts/…）
      url: `/posts/${post.id}`,
      tags: post.data.tags || [],
      date: post.data.date.toISOString().split('T')[0]
    }));

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
};