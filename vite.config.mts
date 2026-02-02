import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  server: {
    port: 3000,
    fs: {
      strict: false,
    },
    proxy: {
      // Proxy doc pages and assets to 11ty server (but not demos/*.html or TypeScript plugs)
      '^/(projects|blocks|intents|plugs/(?!.*\\.ts)|cases|mission|semantics|states|resources|author|research|project-lifecycle|assets|css|js)': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Proxy demos directory and subdirectory indexes
      '^/demos/?$': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '^/demos/[^/]+/?$': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '^/demos/index\\.html$': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Proxy root and other doc pages
      '^/(index\\.html)?$': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  esbuild: {
    target: 'esnext',
  },
  build: {
    outDir: '_site',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        demo: 'demos/declarative-spa.html',
      },
    },
  },
  resolve: {
    alias: {
      '@core': '/plugs/core',
      '@webregistries': '/plugs/webregistries',
      '@webinjectors': '/plugs/webinjectors',
      '@webcomponents': '/plugs/webcomponents',
      '@webcontexts': '/plugs/webcontexts',
      '@webbehaviors': '/plugs/webbehaviors',
      '@webstates': '/plugs/webstates',
      '@webexpressions': '/plugs/webexpressions',
    },
  },
});
