/**
 * 路由层（RAY-465）
 *
 * 回答一个问题：**当前页面在目标语言下有没有对应版本？**
 * 语言切换菜单只负责渲染，答案由这里给出 —— 菜单里那个「灰色不可点」的项，
 * 就是这里返回 `null` 的那个语言。
 *
 * 判定规则（从上到下命中即返回）：
 *   1. 404：静态托管只在站点根输出一份 404.html，没有英文版。
 *   2. 文章页 `/posts/<id>/`：由内容集合决定。中文文章来自 `posts`，英文文章来自 `posts-en`；
 *      `posts-en` 的条目用 frontmatter `translationOf` 指向中文原文（id 相同时可省略）。
 *      现阶段 `posts-en` 只有目录骨架、没有正文，所以中文文章页的「英文」项一律置灰 ——
 *      这正是第二阶段翻译完成后会自动点亮的地方，不需要再改一行代码。
 *   3. 标签页 `/tags/<tag>/`：该标签在目标语言的文章集合里出现过，才有对应页面。
 *   4. 其余静态页面（首页 / 关于 / 视频 / 文章索引 / 系列索引）：中英各一份，见 STATIC_SLUGS。
 *   5. 其它一切路径（例如 404 页面实际收到的那个不存在的地址）：只有当前语言。
 */

import { getCollection } from 'astro:content';
import {
  isLang,
  langFromPath,
  langPrefix,
  LANGUAGE_MENU_ORDER,
  type Lang,
} from './index';
import { isSeries, SERIES } from '../series';

/** 中英各有一份的静态页面（语言无关路径） */
const STATIC_SLUGS = new Set<string>([
  '/',
  '/posts/',
  '/videos/',
  '/about/',
  ...SERIES.map(series => `/posts/${series}/`),
]);

/** 语言无关路径：无语言前缀、首尾都带 `/`，中文段落保持原样（如 `/tags/设计/`） */
export type Slug = string;

function safeDecode(value: string): string {
  try {
    // 404 页面拿到的是用户随手输入的地址，可能含非法转义序列
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 去掉语言前缀，得到语言无关路径 */
export function stripLang(pathname: string): Slug {
  const segments = safeDecode(pathname || '/').split('/').filter(Boolean);
  if (segments.length && isLang(segments[0])) segments.shift();
  return segments.length ? `/${segments.join('/')}/` : '/';
}

/**
 * 语言无关路径 → 目标语言下的 URL（逐段编码，中文标签不会被拼坏）。
 *
 * ⚠️ 仅供**页面路由**使用：输出一定带尾斜杠，并按语言加 `/en` 前缀（或 subpath base 前缀）。
 * 静态资源（`public/` 下的图片 / 字体 / favicon）**不要**走这个函数 —— 它产出的是页面地址，
 * 拿去当 `img src` / `link href` 会 404（RAY-467：公众号图标被拼成 `/images/wechat-icon.png/`）。
 * 静态资源自行拼 base：`base === '/' ? '/x.png' : `${base}/x.png``（见 Header 的 logo、Base 的 favicon）。
 */
export function localizePath(slug: Slug, lang: Lang): string {
  const path = slug
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  const prefix = langPrefix(lang);
  if (!path) return prefix ? `${prefix}/` : '/';
  return `${prefix}/${path}/`;
}

/**
 * 可直接写进 `href` 的站内链接：语言前缀 + 站点 base 前缀。
 * 同样**仅限页面路由**，静态资源见上面的告警（RAY-467）。
 */
export function hrefFor(slug: Slug, lang: Lang): string {
  const base = import.meta.env.BASE_URL || '/';
  const localized = localizePath(slug, lang);
  return base === '/' || base === '' ? localized : `${base.replace(/\/$/, '')}${localized}`;
}

interface RouteIndex {
  /** 中文文章 id → 英文对应文章 id */
  translations: Map<string, string>;
  /** 英文文章 id → 中文原文 id */
  originals: Map<string, string>;
  /** 各语言的文章 id 集合 */
  articleIds: Record<Lang, Set<string>>;
  /** 各语言的文章实际用到的标签 */
  tags: Record<Lang, Set<string>>;
}

function collectTags(posts: { data: { tags?: string[] } }[]): Set<string> {
  const tags = new Set<string>();
  for (const post of posts) {
    for (const tag of post.data.tags ?? []) tags.add(tag);
  }
  return tags;
}

let indexPromise: Promise<RouteIndex> | null = null;

/** 内容集合索引（每个构建进程只算一次；getCollection 本身也是缓存过的） */
export function getRouteIndex(): Promise<RouteIndex> {
  indexPromise ??= (async (): Promise<RouteIndex> => {
    const [zhPosts, enPosts] = await Promise.all([
      getCollection('posts'),
      getCollection('postsEn'),
    ]);
    const zhIds = new Set(zhPosts.map(post => post.id));
    const translations = new Map<string, string>();
    const originals = new Map<string, string>();
    for (const post of enPosts) {
      const source = post.data.translationOf ?? post.id;
      // 只登记真实存在的中文原文，避免 translationOf 写错时生成死链
      if (zhIds.has(source)) translations.set(source, post.id);
      originals.set(post.id, source);
    }
    return {
      translations,
      originals,
      articleIds: {
        zh: zhIds,
        en: new Set(enPosts.map(post => post.id)),
      },
      tags: {
        zh: collectTags(zhPosts),
        en: collectTags(enPosts),
      },
    };
  })();
  return indexPromise;
}

/** 语言无关路径 → 目标语言下的语言无关路径；`null` 表示目标语言没有这个页面 */
function resolveSlug(
  slug: Slug,
  from: Lang,
  to: Lang,
  index: RouteIndex
): Slug | null {
  if (from === to) return slug;

  // 文章页
  if (slug.startsWith('/posts/')) {
    const id = slug.slice('/posts/'.length).replace(/\/$/, '');
    if (id && !isSeries(id) && index.articleIds[from].has(id)) {
      const other = from === 'zh' ? index.translations.get(id) : index.originals.get(id);
      if (other && index.articleIds[to].has(other)) return `/posts/${other}/`;
      return null;
    }
  }

  // 标签页
  if (slug.startsWith('/tags/')) {
    const tag = slug.slice('/tags/'.length).replace(/\/$/, '');
    return tag && index.tags[to].has(tag) ? `/tags/${tag}/` : null;
  }

  // 静态页面
  return STATIC_SLUGS.has(slug) ? slug : null;
}

export interface LanguageLink {
  lang: Lang;
  /** 目标语言下的 URL */
  href: string;
  /** 目标语言是否存在这个页面；`false` 时菜单项置灰、不可点击 */
  available: boolean;
  /** 是不是正在浏览的语言 */
  current: boolean;
}

export interface LanguageResolution {
  /** 当前页面的界面语言 */
  lang: Lang;
  /** 当前页面的语言无关路径 */
  slug: Slug;
  /** 按菜单固定顺序（英文在前、简体中文在后）排列 */
  links: LanguageLink[];
  /** 存在对应版本的语言（含当前语言），供 hreflang 使用 */
  alternates: LanguageLink[];
}

/** 页面渲染时调用一次：拿到界面语言 + 语言切换菜单项 + hreflang 候选 */
export async function resolveLanguage(pathname: string): Promise<LanguageResolution> {
  const lang = langFromPath(pathname);
  const slug = stripLang(pathname);
  const index = await getRouteIndex();

  const links = LANGUAGE_MENU_ORDER.map((target): LanguageLink => {
    if (target === lang) {
      return {
        lang: target,
        href: localizePath(slug, target),
        available: true,
        current: true,
      };
    }
    const resolved = resolveSlug(slug, lang, target, index);
    return {
      lang: target,
      href: localizePath(resolved ?? slug, target),
      available: resolved !== null,
      current: false,
    };
  });

  return { lang, slug, links, alternates: links.filter(link => link.available) };
}
