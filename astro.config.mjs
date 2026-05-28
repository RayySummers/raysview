import { defineConfig } from 'astro/config';
import gfm from 'remark-gfm';

export default defineConfig({
  site: 'https://raysview.fun',
  base: '/',
  output: 'static',
  build: {
    assets: 'assets'
  },
  markdown: {
    smartypants: false,
    remarkPlugins: [gfm]
  },
  vite: {
    build: {
      cssMinify: true
    }
  }
});