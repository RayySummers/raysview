#!/usr/bin/env node
/**
 * Obsidian Markdown → 微信公众号 HTML 转换器（WeMD 样式 · 内联化 · 主色 #edd363）
 *
 * 背景：微信编辑器只保留内联样式，且不支持 <style>/class、flex、position:absolute、
 * 伪元素(::before/::after)、min-width:max-content、overflow-x:scroll 等特性。
 * 本脚本把 Obsidian 文章转换为单个「纯内联样式」HTML，浏览器直接打开即为成品，
 * 可直接复制粘贴进微信公众号后台。
 *
 * 转换规则：
 *   - 删除 Obsidian frontmatter（--- ... ---）与站内元信息行（标题：/发表时间：/封面图：）
 *   - 标题： 提取为 H1（WeMD h1 左色条样式）与 <title>
 *   - 封面图： 后一行的 ![[...]] 渲染为头图（紧随 H1）
 *   - ![[xxx.png]] 嵌入 → <img>，通过 --map 指定的 JSON（key=嵌入文件名，value=图床 URL）映射；
 *     若未命中，再尝试按文件名子串匹配 image-hosting/_urls.json
 *   - 图片后紧邻的独立「（……）」行 → 图注（居中、#999、12px）
 *   - [^n] 行内脚注 → <sup> 上标引用；文末 [^n]: ... 定义 → 「参考资料」列表
 *   - #/##/###/#### 标题、粗体、斜体、行内代码、链接、列表、引用、表格、代码块、--- 分隔线
 *   - 正文直角引号惯例：英文双引号 "…" → 「…」（脚注定义与链接原文保留）
 *   - 所有 WeMD 主题样式内联化；主色 #FAAD14 → #edd363（含 rgba(250,173,20,*) → rgba(237,211,99,*)）；
 *     文字级强调（链接/上标/行内代码/脚注编号/有序列表序号）用深金 #b8860b 保证白底可读性（#edd363 对比度仅 1.49:1）
 *
 * 用法：
 *   node convert.mjs <input.md> [-o <output.html>] [--map <image-map.json>]
 *
 * 示例：
 *   node convert.mjs "D:\...\文章.md" -o ./output/文章.html --map ./image-map.json
 *   不带 --map 时默认读取脚本同目录 image-map.json（可缺省）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- 主题常量（WeMD RayView_260418，主色 #edd363） ----------
const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', " +
  "'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO_STACK = "Menlo, Monaco, Consolas, 'Courier New', monospace";
const PRIMARY = '#edd363'; // 主色（装饰性元素：色条/下划线/列表符号/脚注标题区）
const PRIMARY_50 = 'rgba(237,211,99,0.5)'; // 主色 50%（原 rgba(250,173,20,0.5)）
const TEXT_ACCENT = '#b8860b'; // 文字级强调色：链接/上标/行内代码/脚注编号/ol 序号（白底可读，对比度约 3.25:1）

const STYLE = {
  section:
    `font-family:${FONT_STACK};font-size:16px;line-height:1.8;color:#333333;` +
    `letter-spacing:0.5px;padding:12px;overflow-wrap:break-word;word-break:break-word;text-align:left;`,
  p: `font-family:${FONT_STACK};font-size:16px;line-height:1.8;margin:16px 0;padding:5px 0;letter-spacing:0.5px;text-align:left;`,
  h1: `margin:40px 0 30px;font-size:24px;color:#000;font-weight:bold;letter-spacing:0px;border-left:4px solid ${PRIMARY};padding-left:10px;text-align:left;`,
  h2: `margin:30px 0 20px;font-size:20px;color:#333;font-weight:bold;letter-spacing:0px;border-bottom:2px solid ${PRIMARY};padding-bottom:8px;text-align:left;`,
  h3: `margin:25px 0 15px;font-size:18px;color:#666;font-weight:bold;letter-spacing:0px;text-align:left;`,
  h4: `margin:20px 0 10px;font-size:16px;color:#666;font-weight:bold;letter-spacing:0px;text-align:left;`,
  h5: `margin:18px 0 10px;font-size:15px;color:#666;font-weight:bold;letter-spacing:0px;text-align:left;`,
  h6: `margin:16px 0 8px;font-size:14px;color:#666;font-weight:bold;letter-spacing:0px;text-align:left;`,
  hr: `margin:20px 0;border:0;border-top:1px solid #eee;`,
  img: `display:block;width:100%;max-width:100%;height:auto;margin:20px auto;border-radius:12px;`,
  imgCaptioned: `display:block;width:100%;max-width:100%;height:auto;margin:20px auto 12px;border-radius:12px;`,
  caption: `text-align:center;margin:0 0 20px;padding:0;color:#999;font-size:12px;line-height:1.8;letter-spacing:0.5px;`,
  strong: `font-weight:bold;color:inherit;`,
  em: `font-style:italic;color:inherit;`,
  a: `color:${TEXT_ACCENT};text-decoration:none;border-bottom:1px solid ${TEXT_ACCENT};word-break:break-all;`,
  aSpan: `color:${TEXT_ACCENT};`,
  code: `color:${TEXT_ACCENT};background:transparent;padding:2px 4px;border-radius:2px;font-size:0.9em;` +
    `font-family:${MONO_STACK};white-space:normal;letter-spacing:0;font-weight:bold;border-bottom:2px solid ${PRIMARY_50};`,
  pre: `margin:16px 0;background:#f8f8f8;border-radius:8px;padding:16px;overflow:hidden;`,
  preCode: `display:block;background:transparent;font-size:13px;font-family:${MONO_STACK};white-space:pre-wrap;` +
    `word-break:break-all;text-align:left;letter-spacing:0;word-spacing:0;`,
  ul: `list-style:none;padding-left:20px;margin:16px 0;font-size:16px;text-align:left;`,
  ol: `list-style:none;padding-left:20px;margin:16px 0;font-size:16px;text-align:left;`,
  li: `font-family:${FONT_STACK};margin:4px 0;line-height:1.8;letter-spacing:0.5px;text-align:left;`,
  marker: `color:${PRIMARY};font-weight:bold;`,
  olNum: `color:${TEXT_ACCENT};font-weight:bold;`,
  blockquote:
    `margin:16px 0;padding:12px 16px 12px 56px;background:transparent;border-left:none;border-radius:4px;`,
  blockquoteMark: `display:block;height:0;font-size:60px;color:#ddd;font-family:Georgia, serif;` +
    `line-height:1;margin-left:-40px;margin-top:-6px;opacity:0.3;pointer-events:none;`,
  blockquoteP: `color:#666;margin:0;font-size:16px;line-height:1.6;text-align:left;`,
  table: `width:100%;border-collapse:collapse;margin:16px 0;`,
  th: `background:#f8f8f8;color:inherit;font-weight:bold;border:1px solid #dfe2e5;padding:8px 12px;text-align:left;`,
  td: `border:1px solid #dfe2e5;padding:8px 12px;text-align:left;`,
  sup: `color:${TEXT_ACCENT};font-weight:bold;font-size:12px;line-height:1;`,
  fnHeader:
    `font-weight:bold;font-size:18px;color:${PRIMARY};border-bottom:2px solid ${PRIMARY};` +
    `padding-bottom:6px;margin:30px 0 12px;text-align:left;`,
  fnItem: `font-size:12px;line-height:26px;color:#666;margin:0;padding:0;word-break:break-all;letter-spacing:0.5px;text-align:left;`,
  fnNum: `color:${TEXT_ACCENT};font-weight:bold;display:inline-block;width:32px;`,
  fnUrl: `color:${TEXT_ACCENT};`,
};

// ---------- 工具 ----------
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/** 正文惯例：英文/弯双引号对 → 直角引号「」（脚注定义不调用本函数） */
function normalizeQuotes(s) {
  return s
    .replace(/"([^"\n]+)"/g, '「$1」')
    .replace(/“([^”\n]+)”/g, '「$1」');
}

/** 段落文本级行内解析：行内代码 → 链接 → 脚注上标 → 粗体 → 斜体 */
function inlineParse(text) {
  const codeSpans = [];
  text = text.replace(/`([^`]+)`/g, (m, code) => {
    codeSpans.push(code);
    return `\u0000C${codeSpans.length - 1}\u0000`;
  });

  const links = [];
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    links.push({ label, url });
    return `\u0000L${links.length - 1}\u0000`;
  });

  text = text.replace(
    /\[\^(\d+)\]/g,
    (m, n) => `<sup style="${STYLE.sup}">[${n}]</sup>`
  );

  text = text.replace(/\*\*([^*]+)\*\*/g, (m, t) => `<strong style="${STYLE.strong}">${t}</strong>`);
  text = text.replace(/(^|[^*])\*([^*]+)\*/g, (m, pre, t) => `${pre}<em style="${STYLE.em}">${t}</em>`);

  text = text.replace(/\u0000C(\d+)\u0000/g, (m, i) => {
    const c = escapeHtml(codeSpans[Number(i)]);
    return `<code style="${STYLE.code}">${c}</code>`;
  });
  text = text.replace(/\u0000L(\d+)\u0000/g, (m, i) => {
    const { label, url } = links[Number(i)];
    // 内层 span 同色：防微信编辑器剥离 <a> 样式后链接被染成默认蓝
    return `<a href="${escapeAttr(url)}" style="${STYLE.a}"><span style="${STYLE.aSpan}">${escapeHtml(label)}</span></a>`;
  });
  return text;
}

/** 普通段落：转义 + 直角引号 + 行内解析；多行合并时用 <br/> */
function paragraphHtml(text) {
  const parts = text.split(/\n/).map((ln) => escapeHtml(normalizeQuotes(ln)));
  const inner = parts.map((p) => inlineParse(p)).join('<br/>');
  return `<p style="${STYLE.p}">${inner}</p>`;
}

// ---------- 文档解析 ----------
function stripFrontmatter(text) {
  if (/^---\r?\n/.test(text)) {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (m) {
      const fm = m[1];
      const title = fm.match(/^title:\s*"?([^"\n]+)"?\s*$/m);
      return { frontmatterTitle: title ? title[1].trim() : null, rest: text.slice(m[0].length) };
    }
  }
  return { frontmatterTitle: null, rest: text };
}

function loadImageMap(mapPath) {
  let map = {};
  if (mapPath && fs.existsSync(mapPath)) {
    map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  } else if (!mapPath) {
    const def = path.join(path.dirname(fileURLToPath(import.meta.url)), 'image-map.json');
    if (fs.existsSync(def)) map = JSON.parse(fs.readFileSync(def, 'utf8'));
  }
  // 兜底：匹配 image-hosting/_urls.json 的 “NN-<文件名>” 键
  try {
    const urlsFile = path.resolve('image-hosting/_urls.json');
    if (fs.existsSync(urlsFile)) {
      const pairs = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
      for (const [key, url] of pairs) {
        const name = key.replace(/^\d+-/, '');
        if (!map[name]) map[name] = url;
      }
    }
  } catch { /* 可选兜底，失败忽略 */ }
  return map;
}

const EMBED_RE = /^!\[\[(.+?)\]\]\s*$/;
const FN_DEF_RE = /^\[\^(\d+)\]:\s?(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HR_RE = /^-{3,}\s*$/;
const QUOTE_RE = /^>\s?(.*)$/;
const UL_RE = /^(\s*)[-*+]\s+(.*)$/;
const OL_RE = /^(\s*)\d+\.\s+(.*)$/;
const CAPTION_RE = /^（.+）$/;

function isCaptionLine(line) {
  return CAPTION_RE.test(line.trim()) && line.trim().length <= 60;
}

/** 解析行列表，产出 block 数组：{type:'p'|'h'|'hr'|'img'|'ul'|'ol'|'quote'|'pre'|'table', ...} */
function parseBlocks(lines, imageMap) {
  const blocks = [];
  const fnDefs = new Map(); // n -> 原文
  let fnInsertIndex = null; // 首个脚注定义出现的 block 位置（参考资料插回此处）
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (line === '') { i++; continue; }

    // 脚注定义：收集后跳过
    const fnM = line.match(FN_DEF_RE);
    if (fnM) {
      if (fnInsertIndex === null) fnInsertIndex = blocks.length;
      fnDefs.set(Number(fnM[1]), fnM[2].trim());
      i++;
      continue;
    }

    if (HR_RE.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }

    const hM = line.match(HEADING_RE);
    if (hM) {
      blocks.push({ type: 'h', level: hM[1].length, text: hM[2] });
      i++;
      continue;
    }

    // 图片嵌入（行级），吞掉紧随的图注行
    const eM = line.match(EMBED_RE);
    if (eM) {
      const name = eM[1];
      const url = imageMap[name] || null;
      let caption = null;
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && isCaptionLine(lines[j])) {
        caption = lines[j].trim();
        i = j + 1;
      } else {
        i++;
      }
      blocks.push({ type: 'img', name, url, caption });
      continue;
    }

    // 引用块：连续 > 行合并为一个 blockquote
    if (QUOTE_RE.test(line)) {
      const lines2 = [];
      while (i < lines.length && QUOTE_RE.test(lines[i].trim())) {
        lines2.push(lines[i].replace(QUOTE_RE, '$1'));
        i++;
      }
      blocks.push({ type: 'quote', lines: lines2 });
      continue;
    }

    // 代码块
    if (line.startsWith('```')) {
      i++;
      const codeLines = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // 跳过结尾 ```
      blocks.push({ type: 'pre', code: codeLines.join('\n') });
      continue;
    }

    // 表格：连续 |-| 行（含表头分隔行）
    if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (/^:?-{2,}:?$/.test(cells[0] || '')) { i++; continue; } // 表头分隔行
        rows.push(cells);
        i++;
      }
      blocks.push({ type: 'table', rows });
      continue;
    }

    // 列表：连续 -/*/+ 或 1. 行（按缩进区分层级）
    if (UL_RE.test(line) || OL_RE.test(line)) {
      const items = [];
      const ordered = OL_RE.test(line);
      while (i < lines.length) {
        const l = lines[i].trim();
        const mU = l.match(UL_RE);
        const mO = l.match(OL_RE);
        if (ordered ? mO : mU) {
          items.push({ text: (ordered ? mO : mU)[2] });
          i++;
        } else if (l === '') {
          // 列表中间空行：若下一行仍是列表则继续
          const peek = (lines[i + 1] || '').trim();
          if (peek && (UL_RE.test(peek) || OL_RE.test(peek))) { i++; continue; }
          break;
        } else {
          break;
        }
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }

    // 普通段落：连续非空、非块级开头的行合并
    const para = [];
    while (i < lines.length) {
      const l = lines[i];
      const t = l.trim();
      if (t === '') break;
      if (
        HR_RE.test(t) || HEADING_RE.test(t) || EMBED_RE.test(t) ||
        QUOTE_RE.test(t) || FN_DEF_RE.test(t) || t.startsWith('```') ||
        UL_RE.test(t) || OL_RE.test(t) || (t.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim()))
      ) break;
      para.push(l);
      i++;
    }
    if (para.length) {
      blocks.push({ type: 'p', text: para.join('\n') });
      continue;
    }
    i++;
  }
  return { blocks, fnDefs, fnInsertIndex };
}

// ---------- 渲染 ----------
function renderBlock(b, imageMap) {
  switch (b.type) {
    case 'p':
      return paragraphHtml(b.text);
    case 'h': {
      // 站内脚注区标题（#### 引用资料…）由「参考资料」块替代，不再单独渲染
      if (/^引用资料/.test(b.text)) return '';
      const key = `h${b.level}`;
      return `<h${b.level} style="${STYLE[key]}">${inlineParse(escapeHtml(normalizeQuotes(b.text)))}</h${b.level}>`;
    }
    case 'hr':
      return `<hr style="${STYLE.hr}"/>`;
    case 'img': {
      if (!b.url) return `<p style="${STYLE.p}">${escapeHtml(`[图片缺失: ${b.name}]`)}</p>`;
      // 有图注时收紧图底间距（img margin-bottom 4px），图注紧随图片
      const imgStyle = b.caption ? STYLE.imgCaptioned : STYLE.img;
      const img = `<img src="${escapeAttr(b.url)}" alt="${escapeAttr(b.name)}" style="${imgStyle}"/>`;
      if (b.caption) {
        return img + `<p style="${STYLE.caption}">${escapeHtml(b.caption)}</p>`;
      }
      return img;
    }
    case 'quote': {
      const inner = b.lines
        .map((ln) => `<p style="${STYLE.blockquoteP}">${inlineParse(escapeHtml(normalizeQuotes(ln)))}</p>`)
        .join('');
      return (
        `<blockquote style="${STYLE.blockquote}">` +
        `<span style="${STYLE.blockquoteMark}">\u201C</span>` + // “ 内容引号替代 ::before
        inner +
        `</blockquote>`
      );
    }
    case 'pre':
      return (
        `<pre style="${STYLE.pre}"><code style="${STYLE.preCode}">${escapeHtml(b.code)}</code></pre>`
      );
    case 'table': {
      const head = b.rows[0] || [];
      const body = b.rows.slice(1);
      let html = `<table style="${STYLE.table}">`;
      html += `<tr>${head.map((c) => `<th style="${STYLE.th}">${inlineParse(escapeHtml(c))}</th>`).join('')}</tr>`;
      for (const row of body) {
        html += `<tr>${row.map((c) => `<td style="${STYLE.td}">${inlineParse(escapeHtml(c))}</td>`).join('')}</tr>`;
      }
      return html + '</table>';
    }
    case 'ul':
    case 'ol': {
      // 微信编辑器粘贴常剥离 list-style，ul/ol 均用手动序号/符号渲染，保证样式稳定
      const items = b.items
        .map((it, idx) => {
          const mark =
            b.type === 'ul'
              ? `<span style="${STYLE.marker}">\u2022 </span>` // •
              : `<span style="${STYLE.olNum}">${idx + 1}. </span>`;
          return `<li style="${STYLE.li}">${mark}${inlineParse(escapeHtml(normalizeQuotes(it.text)))}</li>`;
        })
        .join('');
      return `<${b.type} style="${STYLE[b.type]}">${items}</${b.type}>`;
    }
    default:
      return '';
  }
}

function renderFootnotes(fnDefs) {
  if (!fnDefs.size) return '';
  const nums = [...fnDefs.keys()].sort((a, b) => a - b);
  const items = nums
    .map((n) => {
      // 脚注内 URL 显式着色（浅黄不可读，用深金），与正文链接一致
      const text = escapeHtml(fnDefs.get(n)).replace(
        /(https?:\/\/[^\s<>，。；、()]+)/g,
        `<span style="${STYLE.fnUrl}">$1</span>`
      );
      return `<p style="${STYLE.fnItem}"><span style="${STYLE.fnNum}">[${n}]</span>${text}</p>`;
    })
    .join('');
  return (
    `<div style="${STYLE.fnHeader}">参考资料</div>` + items
  );
}

// ---------- 主流程 ----------
function parseArgs(argv) {
  const args = { input: null, output: null, map: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--output') {
      if (!argv[i + 1] || argv[i + 1].startsWith('-')) throw new Error(`${a} 缺少输出路径参数`);
      args.output = argv[++i];
    } else if (a === '--map') {
      if (!argv[i + 1] || argv[i + 1].startsWith('-')) throw new Error(`--map 缺少映射文件参数`);
      args.map = argv[++i];
    } else if (!a.startsWith('-')) {
      if (!args.input) args.input = a;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('用法: node convert.mjs <input.md> [-o <output.html>] [--map <image-map.json>]');
    process.exit(1);
  }
  const input = fs.readFileSync(args.input, 'utf8');
  const { frontmatterTitle, rest } = stripFrontmatter(input);
  const imageMap = loadImageMap(args.map);

  const lines = rest.replace(/\r\n?/g, '\n').split('\n');

  // 站内元信息：标题：/封面图：/发表时间：等
  let title = null;
  let banner = null;
  const bodyLines = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const mTitle = t.match(/^标题：(.*)$/);
    if (mTitle) {
      title = mTitle[1].trim();
      continue;
    }
    if (/^封面图：\s*$/.test(t) || /^封面图：/.test(t)) {
      // 下一行为嵌入则作为头图
      if (i + 1 < lines.length && EMBED_RE.test(lines[i + 1].trim())) {
        const e = lines[i + 1].trim().match(EMBED_RE)[1];
        banner = e; // 保留嵌入名，渲染时经 imageMap 查 URL
        i++;
      }
      continue;
    }
    // 其余站内元信息（发表时间：等）与 Obsidian frontmatter 键一并删除
    if (/^(发表时间|标签|tags|modified|created|id|aliases)：/.test(t)) continue;
    bodyLines.push(lines[i]);
  }

  if (!title) title = frontmatterTitle || path.basename(args.input, path.extname(args.input));

  const { blocks, fnDefs, fnInsertIndex } = parseBlocks(bodyLines, imageMap);

  const parts = [];
  parts.push(`<h1 style="${STYLE.h1}">${escapeHtml(normalizeQuotes(title))}</h1>`);
  if (banner && imageMap[banner]) {
    parts.push(`<img src="${escapeAttr(imageMap[banner])}" alt="封面图" style="${STYLE.img}"/>`);
  }
  const prefix = parts.length; // h1（+可选头图）占位数量
  for (const b of blocks) parts.push(renderBlock(b, imageMap));
  const fnHtml = renderFootnotes(fnDefs);
  // 参考资料插回首个脚注定义的位置（保持「正文 → 参考资料 → ■ → AI 声明」顺序）
  if (fnHtml && fnInsertIndex !== null) {
    parts.splice(prefix + fnInsertIndex, 0, fnHtml);
  } else if (fnHtml) {
    parts.push(fnHtml);
  }

  const html =
    '<!DOCTYPE html>\n' +
    '<html lang="zh-CN">\n' +
    '<head>\n' +
    '<meta charset="UTF-8"/>\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n' +
    `<title>${escapeHtml(normalizeQuotes(title))}</title>\n` +
    '</head>\n' +
    '<body style="margin:0;padding:0;background-color:#ffffff;">\n' +
    `<section style="${STYLE.section}">\n` +
    parts.join('\n') +
    '\n</section>\n' +
    '</body>\n' +
    '</html>\n';

  const output = args.output || path.join(process.cwd(), 'output.html');
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, html, 'utf8');
  console.log(`已生成: ${output}`);
  console.log(`标题: ${title}`);
  console.log(`脚注定义: ${fnDefs.size} 条`);
}

main();
