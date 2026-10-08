/**
 * 站内搜索索引的构造（RAY-465）
 *
 * url 用 localizePath 生成（带尾斜杠、带语言前缀），与站内其它链接保持同一种规范形式。
 * tags 按界面语言规范化（RAY-548，对照表见 ./tags-map），与页面上显示的标签保持一致。
 */
import { getCollection } from 'astro:content';
import type { Lang } from './i18n';
import { localizePath } from './i18n/routes';
import { tagsInLang } from './tags-map';

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
      tags: tagsInLang(post.data.tags, lang),
      date: post.data.date.toISOString().split('T')[0]
    }));
}
