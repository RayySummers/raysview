/**
 * 站内搜索索引（英文）
 *
 * 第一阶段 posts-en 是空集合，这里返回 `[]` —— 英文站台搜索「查无结果」是当前的真实状态，
 * 不是 bug。译文进来后无需改动。
 */
import type { APIRoute } from 'astro';
import { buildSearchIndex } from '../../search-index';

export const GET: APIRoute = async () => {
  const index = await buildSearchIndex('en');

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
