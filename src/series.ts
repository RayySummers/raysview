/**
 * 文章系列（RAY-465 抽出）
 *
 * 系列既是一组文章（按标签聚合），也是一组固定路由（`/posts/<系列>/` 系列索引页）。
 * 路由层需要它来区分「系列索引页」和「文章页」，页面需要它来取文章和标题，
 * 所以单独放一处，避免两边各写一份。
 *
 * RAY-545 起还负责两件展示层的事：标题去掉「 | 系列名 #NN」后缀（`displayPostTitle`）、
 * 标签行把系列标签提到首位并渲染成 pill（`displayTags` + `seriesOfTag`）。
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

/** 标签 → 系列。大小写不敏感，frontmatter 里写成 justthinking 也能命中（标签页路由仍按原样） */
const SERIES_BY_TAG = new Map<string, Series>(
  SERIES.map(series => [SERIES_TAGS[series].toLowerCase(), series])
);

/** 这个标签属于哪个系列？不是系列标签则返回 undefined */
export function seriesOfTag(tag: string): Series | undefined {
  return SERIES_BY_TAG.get(tag.trim().toLowerCase());
}

/** 某语言的某系列文章，按日期倒序 */
export async function getSeriesPosts(series: Series, lang: Lang) {
  const posts = await getCollection(lang === 'zh' ? 'posts' : 'postsEn');
  return posts
    .filter(post => post.data.tags?.includes(SERIES_TAGS[series]))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/**
 * 标题里的系列后缀（RAY-545）
 *
 * frontmatter 的标题形如「广州地铁志愿有感 | 随便想想 #04」「关于 Emoji 的一切 | RayDesign #1」
 * 「…… | 半月记2026.05.A」「Metro Volunteering | JustThinking #04」。
 * 展示层统一去掉「 | <系列名>…」这一段（含后面的 #NN / 期号）；
 * 只认已知的系列名，普通标题里恰好出现「 | 」不会被误伤。
 * frontmatter 原文、`<title>`、OG / JSON-LD 仍用带后缀的原标题。
 */
const TITLE_SUFFIX_MARKERS = [
  ...SERIES.map(series => SERIES_TAGS[series]), // JustThinking / biweekly / RayDesign
  '随便想想', // = i18n series.*.pill（中文短名）
  '半月记',
  'Ray 的设计课',
];

export function displayPostTitle(title: string): string {
  const separator = title.lastIndexOf(' | ');
  if (separator < 0) return title;
  const suffix = title.slice(separator + 3).trim().toLowerCase();
  const isSeriesSuffix = TITLE_SUFFIX_MARKERS.some(marker =>
    suffix.startsWith(marker.toLowerCase())
  );
  return isSeriesSuffix ? title.slice(0, separator).trimEnd() : title;
}

/** 标签行里的一枚标签：命中系列时带上系列 id，由调用方决定渲染成 pill 还是普通链接 */
export interface DisplayTag {
  tag: string;
  series?: Series;
}

/**
 * 标签行的展示顺序（RAY-545）：系列标签提到第一位（＝ pill 的位置），其余保持 frontmatter 原顺序。
 * biweekly 的系列标签在 frontmatter 里排最后（ai / anthropic / … / biweekly），
 * 原位渲染会让 pill 埋在行尾，与「系列以第一枚 hashtag 呈现」不符，故只在展示层重排 —— frontmatter 不动。
 */
export function displayTags(tags?: string[]): DisplayTag[] {
  const entries: DisplayTag[] = (tags ?? []).map(tag => ({ tag, series: seriesOfTag(tag) }));
  const index = entries.findIndex(entry => entry.series);
  if (index > 0) entries.unshift(...entries.splice(index, 1));
  return entries;
}
