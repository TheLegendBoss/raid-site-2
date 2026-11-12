import { defineConfig } from 'vite';

// `npm run dev` serves the game for development in a browser.
// `npm run build:web` makes dist/, which the Electron shell serves (see electron/main.cjs).
export default defineConfig({
  base: './',
  server: { port: 5173 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
