import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build` makes the normal multi-file build in dist/.
// `vite build --mode release` inlines everything into one index.html in
// dist-release/ so it runs by double-click from disk, or from any web host.
export default defineConfig(({ mode }) => {
  const release = mode === 'release';
  return {
    base: './',
    server: { port: 5173 },
    plugins: release ? [viteSingleFile()] : [],
    build: {
      outDir: release ? 'dist-release' : 'dist',
      chunkSizeWarningLimit: 2000,
    },
  };
});
