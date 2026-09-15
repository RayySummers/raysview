/**
 * 站内搜索索引（中文）
 *
 * 只索引当前语言的文章：英文站台有自己的 /en/search.json（第一阶段还是空的）。
 * 地址由 Header 通过 data-search-index 下发给客户端脚本。
 */
import type { APIRoute } from 'astro';
import { buildSearchIndex } from '../search-index';

export const GET: APIRoute = async () => {
  const index = await buildSearchIndex('zh');

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
