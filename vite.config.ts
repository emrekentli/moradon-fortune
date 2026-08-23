import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/moradon-fortune/' : '/',
  build: {
    rollupOptions: {
      external: ['pixi.js'],
    },
  },
  server: {
    watch: {
      ignored: ['**/.chrome-preview-profile*/**', '**/*runtime-check*.png', '**/preview*.png', '**/references/**'],
    },
  },
}));
