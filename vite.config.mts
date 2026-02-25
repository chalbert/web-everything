import { defineConfig, Plugin } from 'vite';
import { devPanel } from './tools/dev-panel/vite-plugin';

/**
 * Vite plugin that automatically injects Web Everything patches into demo HTML files.
 * This allows demos to use patched DOM APIs without manually importing and applying patches.
 */
function webEverythingPatches(): Plugin {
  return {
    name: 'web-everything-patches',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        // Only inject patches for demo HTML files
        if (!ctx.filename?.includes('/demos/')) {
          return html;
        }

        // Skip injection for unplugged demos - they handle their own imports
        if (ctx.filename?.includes('-unplugged')) {
          return html;
        }

        // Skip if the demo already has bootstrap.ts included
        if (html.includes('/plugs/bootstrap.ts')) {
          return html;
        }

        // Inject the bootstrap script as the first script in the body
        const patchScript = `<script type="module" src="/plugs/bootstrap.ts"></script>`;

        // Insert before the closing </body> tag but before any other scripts
        // Find the first <script in body and insert before it
        const bodyMatch = html.match(/<body[^>]*>/i);
        if (bodyMatch) {
          const bodyStart = html.indexOf(bodyMatch[0]) + bodyMatch[0].length;
          const firstScriptInBody = html.indexOf('<script', bodyStart);

          if (firstScriptInBody !== -1) {
            // Insert before the first script
            return html.slice(0, firstScriptInBody) +
                   '\n  ' + patchScript + '\n  ' +
                   html.slice(firstScriptInBody);
          }
        }

        // Fallback: insert before </body>
        return html.replace('</body>', `  ${patchScript}\n</body>`);
      },
    },
  };
}

/**
 * Vite plugin that provides SPA fallback for the router demo.
 * Routes like /counter, /todos, /users/1 etc. are served the router demo HTML.
 */
function routerDemoFallback(): Plugin {
  return {
    name: 'router-demo-fallback',
    configureServer(server) {
      // Must run before Vite's internal middleware
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] || '';
        if (/^\/(counter|todos|users|admin|login)(\/|$)/.test(url)) {
          req.url = '/demos/declarative-spa-router.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [devPanel(), routerDemoFallback(), webEverythingPatches()],
  root: './',
  server: {
    port: 3000,
    fs: {
      strict: false,
    },
    proxy: {
      // Proxy Eleventy's live reload script
      '^/\\.11ty/': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Proxy doc pages and assets to 11ty server (but not demos/*.html, TypeScript plugs, or blocks)
      // Note: /blocks/*.ts are served by Vite, /blocks/ doc pages are proxied
      '^/(projects|intents|plugs/(?!.*\\.ts)|cases|mission|semantics|states|resources|author|research|project-lifecycle|assets|css|js)': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Proxy /blocks/ doc pages but not /blocks/*.ts files
      '^/blocks/(?!.*\\.ts)': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Proxy demos directory and detail pages to 11ty (not individual .html demo files)
      // Demo HTML files are served directly by Vite for HMR and bootstrap injection
      '^/demos/?$': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '^/demos/index\\.html$': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Proxy demo detail pages (e.g., /demos/declarative-spa/) to 11ty
      '^/demos/[\\w-]+/$': {
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
    jsxFactory: 'jsx.createElement',
    jsxFragment: 'jsx.Fragment',
    jsxInject: `import jsx from '/blocks/renderers/jsx'`,
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
