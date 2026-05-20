import { defineConfig } from 'astro/config';
import gfm from 'remark-gfm';

export default defineConfig({
  site: 'https://rayview.github.io',
  base: '/raysview',
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