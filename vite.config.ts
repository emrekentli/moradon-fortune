import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/moradon-fortune/' : '/',
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    watch: {
      ignored: ['**/.chrome-preview-profile*/**', '**/*runtime-check*.png', '**/preview*.png', '**/references/**'],
    },
  },
}));
