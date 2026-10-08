import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import gfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { readFileSync } from 'node:fs';

// 插件里用到的图标（RAY-472 的 reply、RAY-544 的 keyboard_arrow_down）：
// 素材就是 src/icons 里注册的那两份，按路径读进来只取 path 的 d 值：
// astro.config.mjs 在配置阶段没有 Vite 的资源插件，`?raw` 导入在这里不可用，
// 所以直接读文件，避免把路径数据再抄一份到配置里。
function iconPathD(file) {
  const svg = readFileSync(new URL(`./src/icons/${file}`, import.meta.url), 'utf8');
  return svg.match(/\sd="([^"]+)"/)[1];
}

const ICON_D_CACHE = new Map();
function iconD(name) {
  if (!ICON_D_CACHE.has(name)) {
    ICON_D_CACHE.set(name, {
      light: iconPathD(`${name}-light.svg`),
      dark: iconPathD(`${name}-dark.svg`)
    });
  }
  return ICON_D_CACHE.get(name);
}

// 手搓 hast 节点树（项目没有 rehype-raw，不能在插件里塞原始 HTML 字符串）。
// 结构与 src/components/Icon.astro 的渲染结果一致：浅深两个图层由 global.css 的
// `.ms-icon` 规则按 html[data-theme] 切换，不依赖 JS。
function msIconNode(name, { size = 24, className } = {}) {
  const d = iconD(name);
  const layer = (theme, pathD) => ({
    type: 'element',
    tagName: 'span',
    properties: { className: ['ms-icon__layer', `ms-icon__layer--${theme}`] },
    children: [
      {
        type: 'element',
        tagName: 'svg',
        properties: {
          xmlns: 'http://www.w3.org/2000/svg',
          width: 24,
          height: 24,
          viewBox: '0 -960 960 960',
          fill: 'currentColor'
        },
        children: [
          {
            type: 'element',
            tagName: 'g',
            properties: { transform: 'scale(1,-1)' },
            children: [
              { type: 'element', tagName: 'path', properties: { d: pathD }, children: [] }
            ]
          }
        ]
      }
    ]
  });

  return {
    type: 'element',
    tagName: 'span',
    properties: {
      className: className ? ['ms-icon', className] : ['ms-icon'],
      dataIcon: name,
      ariaHidden: 'true',
      style: `--ms-icon-size:${size}px;`
    },
    children: [layer('light', d.light), layer('dark', d.dark)]
  };
}

// 脚注返回箭头用的 reply 图标（RAY-472）。
function replyIconNode() {
  return msIconNode('reply', { size: 17 });
}

// 把返回链接里的 ↩ 字符换成图标；链接里若还带 <sup>N</sup>
// （同一处内容被引用多次时 remark-gfm 会加），原样保留。
function replaceBackrefGlyph(a) {
  const children = [];
  let replaced = false;
  for (const child of a.children) {
    if (child.type === 'text' && child.value.includes('↩')) {
      children.push(replyIconNode());
      const rest = child.value.replaceAll('↩', '');
      if (rest) children.push({ type: 'text', value: rest });
      replaced = true;
    } else {
      children.push(child);
    }
  }
  // 兜底：万一 remark-gfm 以后换了字符，也不会把返回箭头整个弄丢
  if (!replaced) children.unshift(replyIconNode());
  a.children = children;
}

// remark-gfm 生成的脚注区结构调整：
// 1. 标题默认是 "Footnotes"（带 sr-only class）→ 改写为「引用资料与脚注」并去掉 sr-only，让标题可见；
// 2. 把每条脚注的返回箭头（data-footnote-backref）从内容末尾移到内容开头（紧跟在 [N] 序号后），
//    并把箭头字符 ↩ 换成 Material Symbols 的 reply 图标（RAY-472，与站点图标系统一致）；
// 3. 用 <div class="footnotes-body"> 包住 <ol>，供 CSS 做展开/折叠高度过渡动画。
function rehypeFootnoteLabel() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (
        node.tagName === 'section' &&
        node.properties?.dataFootnotes !== undefined
      ) {
        // 1. 标题改名并显示
        const h2 = node.children.find(
          (c) => c.type === 'element' && c.tagName === 'h2'
        );
        if (h2) {
          h2.properties = { ...h2.properties, className: [] };
          h2.children = [{ type: 'text', value: '引用资料与脚注' }];
        }

        const olIndex = node.children.findIndex(
          (c) => c.type === 'element' && c.tagName === 'ol'
        );
        if (olIndex !== -1) {
          const ol = node.children[olIndex];

          // 2. 每条脚注：返回箭头移到 <p> 开头（紧随 [N] 序号之后）
          for (const li of ol.children) {
            if (li.type !== 'element' || li.tagName !== 'li') continue;
            const p = li.children.find(
              (c) => c.type === 'element' && c.tagName === 'p'
            );
            if (!p) continue;
            const backrefs = [];
            // 递归收集 li 内所有返回箭头并移除
            (function collect(n) {
              if (n.type !== 'element' || !n.children) return;
              n.children = n.children.filter((child) => {
                if (
                  child.type === 'element' &&
                  child.tagName === 'a' &&
                  child.properties?.dataFootnoteBackref !== undefined
                ) {
                  backrefs.push(child);
                  return false;
                }
                return true;
              });
              for (const child of n.children) collect(child);
            })(li);
            if (backrefs.length) {
              for (const backref of backrefs) replaceBackrefGlyph(backref);
              p.children.unshift(...backrefs);
            }
          }

          // 3. 用 .footnotes-body 包住 ol，供动画使用
          const body = {
            type: 'element',
            tagName: 'div',
            properties: { className: ['footnotes-body'] },
            children: [ol],
          };
          node.children[olIndex] = body;
        }
      }
    });
  };
}

// 「AI 声明」区改成可折叠（RAY-544）：
// 在渲染层统一生效，不逐篇改历史文章 —— 正文里那段「※ **AI 声明**」
// （英文文章为「※ **AI Disclosure**」）连同紧随其后的说明段落一起包进
// <details class="ai-disclosure" open>：默认展开，点 summary 收起，再点展开。
// 用原生 details/summary：零 JS、键盘（Enter/Space）可达，展开态与原段落视觉一致
// （summary 里保留原来的「※ + 粗体标题」，右侧多一个 chevron 图标）。
const AI_DISCLOSURE_LABEL = /^\s*※\s*AI\s*(?:声明|Disclosure)\s*/i;

function nodeText(node) {
  if (node.type === 'text') return node.value;
  if (!node.children) return '';
  return node.children.map(nodeText).join('');
}

// 把「※ AI 声明」段落切成 summary 的标题部分和回落到正文的说明部分。
// 多数文章标题自成一段（justthinking-01/03/04、biweekly 都是），切开后 rest 为空；
// 也有标题与说明写在同一段里的（中间漏了空行，justthinking-02），
// 这时按前缀切开，说明部分单独成段 —— 与其它文章排版一致，内容一个字不动。
function splitDisclosureLabel(paragraph) {
  const match = AI_DISCLOSURE_LABEL.exec(nodeText(paragraph));
  if (!match) return null;

  const labelEnd = match[0].length;
  const label = [];
  const rest = [];
  let consumed = 0;
  for (const child of paragraph.children) {
    const len = nodeText(child).length;
    if (consumed + len <= labelEnd) {
      label.push(child);
    } else if (consumed >= labelEnd) {
      rest.push(child);
    } else if (child.type === 'text') {
      // 文本节点正好跨过边界：按字符切开
      const keep = labelEnd - consumed;
      label.push({ ...child, value: child.value.slice(0, keep) });
      rest.push({ ...child, value: child.value.slice(keep) });
    } else {
      // 元素跨过边界（理论上不会出现）：整个元素留在正文，别把内容弄丢
      rest.push(child);
    }
    consumed += len;
  }

  while (label.length && label[label.length - 1].type === 'text' && !label[label.length - 1].value.trim()) {
    label.pop();
  }
  while (rest.length && rest[0].type === 'text' && !rest[0].value.trim()) {
    rest.shift();
  }
  return { label, rest };
}

// 收进 details 的兄弟节点到此为止：脚注区（remark-gfm 生成，必须留在外面，
// 否则脚注会被一起折叠进「AI 声明」）以及任何标题。
function isDisclosureBoundary(node) {
  if (node.type !== 'element') return false;
  if (node.tagName === 'section' && node.properties?.dataFootnotes !== undefined) {
    return true;
  }
  return /^h[1-6]$/.test(node.tagName);
}

function rehypeAiDisclosure() {
  return (tree) => {
    const children = tree.children;
    // 取最后一段「※ AI 声明」：正文里偶尔会提到这个词，只有文末那段才是声明本身
    let start = -1;
    let split = null;
    for (let i = children.length - 1; i >= 0; i--) {
      const node = children[i];
      if (node.type !== 'element' || node.tagName !== 'p') continue;
      split = splitDisclosureLabel(node);
      if (split) {
        start = i;
        break;
      }
    }
    if (start === -1) return;

    let end = start + 1;
    while (end < children.length && !isDisclosureBoundary(children[end])) end++;

    // 说明段落之间不会有空白文本节点，末尾可能留一个：顺手去掉，别塞进 details
    const body = children.slice(start + 1, end);
    while (
      body.length &&
      body[body.length - 1].type === 'text' &&
      !body[body.length - 1].value.trim()
    ) {
      body.pop();
    }
    // 标题与说明同段的情况：说明部分单独成段，段落样式与其它文章一致
    if (split.rest.length) {
      body.unshift({
        type: 'element',
        tagName: 'p',
        properties: {},
        children: split.rest
      });
    }

    children.splice(start, end - start, {
      type: 'element',
      tagName: 'details',
      properties: { className: ['ai-disclosure'], open: true },
      children: [
        {
          type: 'element',
          tagName: 'summary',
          properties: { className: ['ai-disclosure__summary'] },
          children: [
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['ai-disclosure__label'] },
              children: split.label
            },
            msIconNode('keyboard_arrow_down', {
              size: 20,
              className: 'ai-disclosure__chevron'
            })
          ]
        },
        {
          type: 'element',
          tagName: 'div',
          properties: { className: ['ai-disclosure__body'] },
          children: body
        }
      ]
    });
  };
}

export default defineConfig({
  site: 'https://raysview.fun',
  base: '/',
  output: 'static',
  build: {
    assets: 'assets'
  },
  // sitemap 的 i18n 选项让中英互指的两页互相登记 xhtml:link alternate（RAY-465）。
  // 只在该语言的页面确实存在时才登记：/posts/welcome/ 找不到 /en/posts/welcome/，
  // 就不会凭空多一条指向 404 的 alternate。
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'zh',
        locales: { zh: 'zh-Hans', en: 'en' }
      }
    })
  ],
  markdown: {
    smartypants: false,
    remarkPlugins: [gfm],
    rehypePlugins: [rehypeFootnoteLabel, rehypeAiDisclosure]
  },
  vite: {
    build: {
      cssMinify: true
    }
  }
});