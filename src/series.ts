/**
 * 文章系列（RAY-465 抽出）
 *
 * 系列既是一组文章（按标签聚合），也是一组固定路由（`/posts/<系列>/` 系列索引页）。
 * 路由层需要它来区分「系列索引页」和「文章页」，页面需要它来取文章和标题，
 * 所以单独放一处，避免两边各写一份。
 */
import { getCollection } from 'astro:content';
import type { Lang } from './i18n';

export const SERIES = ['justthinking', 'biweekly', 'raydesign'] as const;
export type Series = (typeof SERIES)[number];

export function isSeries(value: string): value is Series {
  return (SERIES as readonly string[]).includes(value);
}

/** 各系列在文章 frontmatter 里使用的标签（历史原因大小写不统一，照旧） */
export const SERIES_TAGS: Record<Series, string> = {
  justthinking: 'JustThinking',
  biweekly: 'biweekly',
  raydesign: 'RayDesign',
};

/** 某语言的某系列文章，按日期倒序 */
export async function getSeriesPosts(series: Series, lang: Lang) {
  const posts = await getCollection(lang === 'zh' ? 'posts' : 'postsEn');
  return posts
    .filter(post => post.data.tags?.includes(SERIES_TAGS[series]))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** 列表里的标题：RayDesign 的文章标题带「 | RayDesign」后缀，系列页里去掉（沿用改动前的行为） */
export function seriesPostTitle(series: Series, title: string): string {
  return series === 'raydesign' ? title.replace(' | RayDesign', '') : title;
}
