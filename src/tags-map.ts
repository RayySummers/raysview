/**
 * 标签中英对照表（RAY-548）
 *
 * 全站标签的**唯一出处**：同一枚中文标签只有一个英文写法，不允许两篇文章各译一个
 * （「志愿服务」译成 volunteering 又译成 volunteer，英文站就会裂成两个标签页）。
 * 三个地方都从这里取词，所以「同词恒同译」是代码保证的，不靠人记：
 *   1. `posts-en` 的 frontmatter `tags` —— 新译文按本表填英文值；
 *   2. 标签页路由 `/tags/<中文>/` ↔ `/en/tags/<英文>/` —— 见 src/i18n/routes.ts；
 *   3. 页面渲染 —— 标签文字与链接都过 `tagInLang()`（ArticlePage / PostListPage / search-index）。
 *
 * 表里同时登记「中英同形」的标签（ai / emoji / JustThinking…），因此本文件就是全站标签
 * 清单；`assertEnglishTags()` 拿它挡住「英文文章里还写着中文标签」的漏网之鱼。
 *
 * 与系列的关系：SERIES_TAGS（JustThinking / biweekly / RayDesign，见 src/series.ts）
 * 本来就是英文，这里登记为同形 —— 系列 pill（RAY-545）按 SERIES_TAGS 判定，照旧命中。
 */
import type { Lang } from './i18n';

/**
 * 中文标签 → 英文标签。
 *
 * 翻译口径：用英文读者认得的说法（多词标签 Title Case），拼音只在英文里确实没有对应词时用。
 */
export const TAG_TRANSLATIONS: Record<string, string> = {
  // —— 需要翻译的中文标签 ——
  静音车厢: 'Quiet Carriage',
  高铁: 'High-Speed Rail',
  /**
   * 「词元」是 Token 的中文造词，JT#02 讲的就是这个词与 Token 之争；英文里没有对应词，
   * 按拼音保留（译成 word token 会和同一篇里的 `token` 标签撞车，两枚标签本就不是一回事）。
   */
  词元: 'Ciyuan',
  颜色词: 'Color Terms',
  语义学: 'Semantics',
  志愿服务: 'Volunteering',
  地铁: 'Metro',

  // —— 中英同形（本来就写成英文的标签，登记在此以便清单完整）——
  ai: 'ai',
  anthropic: 'anthropic',
  biweekly: 'biweekly',
  emoji: 'emoji',
  github: 'github',
  JustThinking: 'JustThinking',
  mint: 'mint',
  RayDesign: 'RayDesign',
  token: 'token',
  toothpaste: 'toothpaste',
  website: 'website'
};

/** 英文标签 → 中文标签（对照表反向索引，模块加载时建好） */
const CHINESE_BY_ENGLISH: ReadonlyMap<string, string> = new Map(
  Object.entries(TAG_TRANSLATIONS).map(([zh, en]) => [en, zh])
);

// 两枚中文标签译成同一个英文词 → 两枚标签在英文站会互相吞并。构建时直接报错，别等上线才发现。
for (const [zh, en] of Object.entries(TAG_TRANSLATIONS)) {
  const owner = CHINESE_BY_ENGLISH.get(en);
  if (owner !== zh) {
    throw new Error(
      `[tags-map] 英文标签「${en}」被「${owner}」和「${zh}」同时占用：一枚英文标签只能对应一枚中文标签`
    );
  }
}

/** 中文标签 → 英文标签；表里没有的原样返回（新标签先写进内容也不会渲染成空） */
export function toEnglishTag(tag: string): string {
  return TAG_TRANSLATIONS[tag] ?? tag;
}

/** 英文标签 → 中文标签；表里没有的原样返回 */
export function toChineseTag(tag: string): string {
  return CHINESE_BY_ENGLISH.get(tag) ?? tag;
}

/** 按界面语言取标签的规范写法：中文页用中文标签，英文页用英文标签 */
export function tagInLang(tag: string, lang: Lang): string {
  return lang === 'en' ? toEnglishTag(tag) : toChineseTag(tag);
}

/** 一组标签按语言规范化，顺序不变 */
export function tagsInLang(tags: readonly string[] | undefined, lang: Lang): string[] {
  return (tags ?? []).map(tag => tagInLang(tag, lang));
}

/**
 * 英文集合里出现中文标签 = posts-en 没按对照表取词（漏登记的词还会让英文页直接显示中文）。
 * 构建时调用一次（见 src/i18n/routes.ts 的 getRouteIndex），直接抛错而不是静默上线。
 */
export function assertEnglishTags(tags: Iterable<string>): void {
  const stray = [...tags].filter(tag => /[\u3400-\u9fff]/.test(tag));
  if (stray.length) {
    throw new Error(
      `[tags-map] 英文文章的标签还是中文：${stray.join('、')}。` +
        '请在 src/tags-map.ts 的 TAG_TRANSLATIONS 里补上英文写法，并让 posts-en 的 frontmatter 用英文值。'
    );
  }
}
