import { defineConfig } from 'astro/config';
import gfm from 'remark-gfm';
import { visit } from 'unist-util-visit';

// remark-gfm 生成的脚注标题默认是 "Footnotes"（带 sr-only class）；
// 这里在 rehype 阶段改写为「引用资料与脚注」并去掉 sr-only，让标题可见。
function rehypeFootnoteLabel() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'h2' && node.properties?.id === 'footnote-label') {
        node.properties = { ...node.properties, className: [] };
        node.children = [{ type: 'text', value: '引用资料与脚注' }];
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