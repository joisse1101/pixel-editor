import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pixel-editor/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        pixel: resolve(__dirname, 'pixel.html'),
      },
    },
  },
});
