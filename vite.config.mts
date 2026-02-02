import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
  },
  esbuild: {
    target: 'esnext',
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
