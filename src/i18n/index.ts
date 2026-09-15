/**
 * 站点 i18n 基础设施（RAY-465）
 *
 * 语言分布：中文是默认语言，留在根路径（`/`、`/about/`…）；英文挂在 `/en/` 前缀下。
 * 界面文案全部抽到 `zh.json` / `en.json`，两个文件的键一一对应；漏译或键名写错会在
 * 构建时直接抛错，不会静默渲染出键名或空串。
 *
 * 本文件只放「词条怎么取」，不含路由判断 —— 页面在目标语言下存不存在由 `./routes.ts` 回答。
 */

import zh from './zh.json';
import en from './en.json';

/** 站点支持的语言 */
export const LANGS = ['zh', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const defaultLang: Lang = 'zh';

/**
 * 语言菜单的固定顺序（RAY-465 指定）：英文在前、简体中文在后。
 * 顺序与当前界面语言无关 —— 切换界面语言只换菜单项文案，不换位置。
 */
export const LANGUAGE_MENU_ORDER: readonly Lang[] = ['en', 'zh'];

/** `<html lang>` 用的标记 */
export const HTML_LANG: Record<Lang, string> = { zh: 'zh', en: 'en' };
/** `<link rel="alternate" hreflang>` 用的标记（正文是简体中文，用 zh-Hans 更精确） */
export const HREFLANG: Record<Lang, string> = { zh: 'zh-Hans', en: 'en' };
/** `og:locale` 用的标记 */
export const OG_LOCALE: Record<Lang, string> = { zh: 'zh_CN', en: 'en_US' };

const dictionaries = { zh, en } as const;

export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

/** 从路径首段判断界面语言：`/en/…` → en，其余（含 `/`）→ zh */
export function langFromPath(pathname: string): Lang {
  const first = pathname.split('/').find(Boolean);
  return first && isLang(first) ? first : defaultLang;
}

/** 另一种语言 */
export function otherLang(lang: Lang): Lang {
  return lang === 'zh' ? 'en' : 'zh';
}

/** 语言 URL 前缀：默认语言为空串，其余为 `/<lang>` */
export function langPrefix(lang: Lang): string {
  return lang === defaultLang ? '' : `/${lang}`;
}

export type Translator = (key: string, vars?: Record<string, string | number>) => string;

/**
 * 取某个界面语言的词条函数。
 *   const t = useTranslations('en');
 *   t('posts.empty')                       // 普通词条
 *   t('tags.heading', { tag: '设计' })      // {tag} 形式的插值
 */
export function useTranslations(lang: Lang): Translator {
  const dict: unknown = dictionaries[lang];
  return (key, vars) => {
    const value = key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
        dict
      );
    if (typeof value !== 'string') {
      throw new Error(`[i18n] ${lang} 缺少词条「${key}」（检查 src/i18n/${lang}.json）`);
    }
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, (raw, name: string) =>
      name in vars ? String(vars[name]) : raw
    );
  };
}
