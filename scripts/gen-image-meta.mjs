#!/usr/bin/env node
/**
 * RAY-608：为站内图片生成 blur-up 占位元数据（`src/data/image-meta.json`）。
 *
 * 每条记录 = 「图片地址 → 原始宽高 + 24px 宽的模糊缩略图（webp base64）」。
 * 构建时只读这份 JSON（见 `src/lib/blur-up.mjs`），**不联网、不依赖 sharp**：
 *   - 占位图在渲染时直接用 data URI 内联，页面不会再为占位发一次请求；
 *   - 构建可复现，CI / 离线 / 限流都不会因为抓图失败而变红。
 * 因此新增或替换图片后需要重跑本脚本（`pnpm images:meta`），否则该图只会退化为
 * 「无占位、无宽高」的普通 <img>（仍在 check-build 里被允许，但会少一层防护）。
 *
 * 用法：
 *   node scripts/gen-image-meta.mjs            # 补全并重写整份 JSON
 *   node scripts/gen-image-meta.mjs --force    # 忽略已有记录，全部重新生成
 *
 * 支持两类来源：
 *   - 站内图片（public/ 下的文件，如 /images/posts/xxx-banner.jpg）：直接读本地文件；
 *   - 正文里的外链图片（如 imgdb 图床）：构建期抓一次，只把 24px 缩略图与宽高写进 JSON，
 *     运行时仍走原地址，不引入新的图片 CDN（RAY-608 Out of Scope）。
 */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIRS = ['src/content/posts', 'src/content/posts-en'];
const PUBLIC_DIR = path.join(ROOT, 'public');
const OUT_FILE = path.join(ROOT, 'src/data/image-meta.json');

const LQIP_WIDTH = 24; // 验收口径：≤ 24px 宽
const LQIP_QUALITY = 40;
const FETCH_TIMEOUT_MS = Number(process.env.IMAGE_META_TIMEOUT_MS ?? 30_000); // 图床偶尔很慢，可用环境变量放大
const FETCH_CONCURRENCY = 4;

/** sharp 是 astro 的依赖，项目没有直接声明；依次尝试，找不到时给出可执行的提示。 */
async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    /* 继续尝试 astro 的依赖树 */
  }
  const pnpmDir = path.join(ROOT, 'node_modules/.pnpm');
  if (existsSync(pnpmDir)) {
    for (const entry of await readdir(pnpmDir)) {
      if (!entry.startsWith('sharp@')) continue;
      const candidate = path.join(pnpmDir, entry, 'node_modules/sharp/lib/index.js');
      if (existsSync(candidate)) {
        const mod = await import(new URL(`file://${candidate}`).href);
        return mod.default ?? mod;
      }
    }
  }
  throw new Error(
    ' 找不到 sharp。它通常是 astro 的传递依赖；如果没有（例如用了 --prod 安装），' +
      '可临时 `pnpm add -D sharp` 后重跑本脚本。构建本身不需要 sharp。'
  );
}

/** 收集需要生成元数据的图片地址：frontmatter 封面 + 正文里的 markdown 图片。 */
async function collectSources() {
  const sources = new Set();
  const files = [];
  for (const dir of CONTENT_DIRS) {
    for (const entry of await readdir(path.join(ROOT, dir), { recursive: true })) {
      if (entry.endsWith('.md')) files.push(path.join(ROOT, dir, entry));
    }
  }
  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    const frontmatter = raw.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatter) {
      for (const key of ['banner', 'listBanner']) {
        const found = frontmatter[1].match(new RegExp(`^${key}:\\s*['"]?([^'"\\n]+?)['"]?\\s*$`, 'm'));
        if (found) sources.add(found[1].trim());
      }
    }
    // 正文 markdown 图片：![alt](url)，跳过 title 与尖括号包裹形式（本仓库未使用）
    for (const match of raw.matchAll(/!\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)/g)) {
      sources.add(match[1].replace(/^<|>$/g, '').trim());
    }
  }
  return [...sources].filter(src => /^(?:https?:\/\/|\/)/.test(src));
}

async function loadInput(sharp, src) {
  if (src.startsWith('/')) {
    const file = path.join(PUBLIC_DIR, decodeURIComponent(src));
    if (!existsSync(file)) throw new Error(`站内图片不存在：${file}`);
    return { input: file, label: 'local' };
  }
  const res = await fetch(src, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      // 图床（imgdb）对无 UA 的请求可能直接 403；带上浏览器 UA 才拿得到原图
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      accept: 'image/avif,image/webp,image/png,image/jpeg,*/*'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { input: Buffer.from(await res.arrayBuffer()), label: 'remote' };
}

async function buildEntry(sharp, src) {
  const { input } = await loadInput(sharp, src);
  // rotate() 无条件按 EXIF 方向摆正：缩略图与宽高都按「浏览器实际显示的方向」计算，
  // 否则竖拍照片的占位比会跟成品图对不上（CLS 又回来了）。
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: LQIP_WIDTH, withoutEnlargement: true })
    .webp({ quality: LQIP_QUALITY, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  const meta = await sharp(input).metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const width = swap ? meta.height : meta.width;
  const height = swap ? meta.width : meta.height;
  if (!width || !height) throw new Error('读不到图片宽高');
  return {
    w: width,
    h: height,
    // webp 占位在现代浏览器全绿（Safari 14+ / 全量 Chromium / Firefox 65+）
    lqip: `data:image/webp;base64,${data.toString('base64')}`,
    lqipW: info.width,
    lqipH: info.height
  };
}

async function main() {
  const force = process.argv.includes('--force');
  const sharp = await loadSharp();
  const sources = await collectSources();

  let existing = {};
  if (!force && existsSync(OUT_FILE)) {
    try {
      existing = JSON.parse(await readFile(OUT_FILE, 'utf8'));
    } catch {
      existing = {};
    }
  }

  const result = {};
  const failures = [];
  let reused = 0;
  let generated = 0;

  // 限并发：一次抓十几张原图，串行太慢、全并发容易被图床限流
  let cursor = 0;
  async function worker() {
    while (cursor < sources.length) {
      const src = sources[cursor++];
      if (existing[src] && existing[src].lqip && existing[src].w) {
        result[src] = existing[src];
        reused++;
        continue;
      }
      try {
        result[src] = await buildEntry(sharp, src);
        generated++;
        console.log(`  ✓ ${src} (${result[src].w}×${result[src].h})`);
      } catch (err) {
        failures.push({ src, message: err.message });
        console.log(`  ✗ ${src} — ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, worker));

  // 键排序：JSON diff 稳定，图片增删在 PR 里一眼可见
  const sorted = Object.fromEntries(Object.keys(result).sort().map(key => [key, result[key]]));
  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

  const size = (await readFile(OUT_FILE)).byteLength;
  console.log(
    `\n写入 ${path.relative(ROOT, OUT_FILE)}：${Object.keys(sorted).length} 张（新生成 ${generated} / 复用 ${reused}），${(size / 1024).toFixed(1)} KB`
  );
  if (failures.length) {
    console.log(`\n⚠ ${failures.length} 张图片没拿到元数据，这些图会退化为普通 <img>：`);
    for (const item of failures) console.log(`  - ${item.src}：${item.message}`);
  }
}

await main();
