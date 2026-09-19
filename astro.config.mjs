import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import gfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { readFileSync } from 'node:fs';

// 脚注返回箭头用的 reply 图标（RAY-472）。
// 素材就是 src/icons 里注册的那两份，按路径读进来只取 path 的 d 值：
// astro.config.mjs 在配置阶段没有 Vite 的资源插件，`?raw` 导入在这里不可用，
// 所以直接读文件，避免把路径数据再抄一份到配置里。
function iconPathD(file) {
  const svg = readFileSync(new URL(`./src/icons/${file}`, import.meta.url), 'utf8');
  return svg.match(/\sd="([^"]+)"/)[1];
}

const REPLY_ICON_D = {
  light: iconPathD('reply-light.svg'),
  dark: iconPathD('reply-dark.svg')
};

// 手搓 hast 节点树（项目没有 rehype-raw，不能在插件里塞原始 HTML 字符串）。
// 结构与 src/components/Icon.astro 的渲染结果一致：浅深两个图层由 global.css 的
// `.ms-icon` 规则按 html[data-theme] 切换，不依赖 JS。
function replyIconNode() {
  const layer = (theme, d) => ({
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
              { type: 'element', tagName: 'path', properties: { d }, children: [] }
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
      className: ['ms-icon'],
      dataIcon: 'reply',
      ariaHidden: 'true',
      style: '--ms-icon-size:17px;'
    },
    children: [layer('light', REPLY_ICON_D.light), layer('dark', REPLY_ICON_D.dark)]
  };
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
    rehypePlugins: [rehypeFootnoteLabel]
  },
  vite: {
    build: {
      cssMinify: true
    }
  }
});