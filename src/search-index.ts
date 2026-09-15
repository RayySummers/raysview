/**
 * 站内搜索索引的构造（RAY-465）
 *
 * url 用 localizePath 生成（带尾斜杠、带语言前缀），与站内其它链接保持同一种规范形式。
 */
import { getCollection } from 'astro:content';
import type { Lang } from './i18n';
import { localizePath } from './i18n/routes';

export interface SearchIndexEntry {
  title: string;
  url: string;
  tags: string[];
  date: string;
}

export async function buildSearchIndex(lang: Lang): Promise<SearchIndexEntry[]> {
  const posts = await getCollection(lang === 'zh' ? 'posts' : 'postsEn');
  return posts
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .map(post => ({
      title: post.data.title,
      url: localizePath(`/posts/${post.id}/`, lang),
      tags: post.data.tags || [],
      date: post.data.date.toISOString().split('T')[0]
    }));
}
