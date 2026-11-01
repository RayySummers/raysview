/**
 * RAY-608：blur-up 图片占位数据的读取层。
 *
 * 数据来自 `src/data/image-meta.json`，由 `scripts/gen-image-meta.mjs`（`pnpm images:meta`）
 * 生成：每条记录是「图片地址 → 原始宽高 + 24px 宽 webp 缩略图（base64 data URI）」。
 *
 * 为什么不在构建期现算：
 *   1. 文章正文的图大多在外链图床（imgdb），构建期抓图会让 `pnpm build` 依赖外网，
 *      图床一限流/一超时，CI 就红；离线构建也会直接挂掉。
 *   2. 站内图片（public/ 下的 banner）虽然本地可读，但生成缩略图要 sharp 解码，
 *      而 sharp 只是 astro 的传递依赖，构建环境里不保证在。
 * 所以缩略图在「新增/替换图片时」生成一次、随代码入库；构建只做查表，产物完全可复现。
 */
import imageMeta from '../data/image-meta.json';

/** 图片地址 → { w, h, lqip, lqipW, lqipH } 的只读表 */
export const IMAGE_META = imageMeta;

/**
 * 查一张图片的占位元数据。
 * @param {string | undefined} src 图片地址（站内 `/images/...` 或外链绝对地址）
 * @returns {{ w: number, h: number, lqip: string, lqipW: number, lqipH: number } | null}
 */
export function imageMetaFor(src) {
  if (typeof src !== 'string' || !src) return null;
  return imageMeta[src] ?? null;
}

/**
 * 容器用的内联 CSS 变量：宽高比（防布局跳动）+ 模糊占位图 + 原生宽度上限。
 * 占位图走 `--blur-up-lqip`，页面里只出现一次 data URI，CSS 侧不用再拼字符串。
 * @param {{ w: number, h: number, lqip?: string } | null} meta
 * @param {string} [ratio] 覆盖默认的自然宽高比（例如列表卡片要求 3:1 裁切）
 */
export function blurUpVars(meta, ratio) {
  if (!meta) return '';
  const parts = [
    `--blur-up-ratio: ${ratio ?? `${meta.w} / ${meta.h}`}`,
    // 小于正文宽度的图（如 710px 的表情贴纸截图）按原尺寸显示，不拉伸 —— 与改造前
    // `img { max-width: 100% }` 的观感一致；大图仍然铺满栏宽。
    `--blur-up-max-width: ${meta.w}px`
  ];
  if (meta.lqip) parts.push(`--blur-up-lqip: url("${meta.lqip}")`);
  return parts.join('; ');
}
