import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://rayview.github.io',
  base: '/raysview',
  output: 'static',
  build: {
    assets: 'assets'
  },
  markdown: {
    smartypants: {
      quotes: false
    }
  },
  vite: {
    build: {
      cssMinify: true
    }
  }
});