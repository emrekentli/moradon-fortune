import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/moradon-fortune/' : '/',
  server: {
    watch: {
      ignored: ['**/.chrome-preview-profile*/**', '**/*runtime-check*.png', '**/preview*.png', '**/references/**'],
    },
  },
}));
