import { defineConfig } from 'astro/config';
import gfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

// remark-gfm 生成的脚注区结构调整：
// 1. 标题默认是 "Footnotes"（带 sr-only class）→ 改写为「引用资料与脚注」并去掉 sr-only，让标题可见；
// 2. 把每条脚注的返回箭头（data-footnote-backref）从内容末尾移到内容开头（紧跟在 [N] 序号后）；
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