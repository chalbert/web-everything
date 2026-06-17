import { defineConfig, Plugin } from 'vite';
import { devPanel } from './tools/dev-panel/vite-plugin';
import { moduleService } from './tools/maas/vite-plugin';
import { traitEnforcer } from './tools/trait-enforcer/vite-plugin';

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
 * Vite plugin that provides SPA history fallback for the router-backed demos.
 *
 * A client-side router owns paths that have no file on disk (e.g. `/counter`, or the loan-origination
 * app's `/demos/loan-origination/pipeline`). A hard reload of such a deep link hits the dev server,
 * which would 404 — so we rewrite the request to the demo's HTML entry and let the router re-match the
 * path in the browser. Each demo mounted under its own base path needs an entry here.
 */
function routerDemoFallback(): Plugin {
  // [pathTest, htmlEntry] — first match wins. The loan-origination app is served under a base path,
  // so its routes are base-qualified; only its real assets (app.ts/app.css) keep an extension.
  const fallbacks: Array<[RegExp, string]> = [
    [/^\/(counter|todos|users|admin|login)(\/|$)/, '/demos/declarative-spa-router.html'],
    [
      /^\/demos\/loan-origination\/(pipeline|application|pricing|processing|underwriting|admin)(\/|$)/,
      '/demos/loan-origination/index.html',
    ],
    [
      /^\/demos\/auto-insurance\/(book|quotes|underwriting|claims)(\/|$)/,
      '/demos/auto-insurance/index.html',
    ],
  ];
  return {
    name: 'router-demo-fallback',
    configureServer(server) {
      // Must run before Vite's internal middleware
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0] || '';
        const hit = fallbacks.find(([re]) => re.test(url));
        if (hit) req.url = hit[1];
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    devPanel(),
    moduleService(),
    routerDemoFallback(),
    webEverythingPatches(),
    // The Enforcer (#170 final leg / #484): generates the real `virtual:trait-manifest` at build
    // time — a code-split chunk per scanned lazy trait, a hoisted static import per eager one. The
    // traitMap is empty until a trait is authored, so today it emits an empty manifest (same as the
    // former alias fallback) — but via real generation, so a trait dropped into the Map ships a chunk
    // with no further wiring. Scans demos/ + src/ HTML for `<el trait>` usage. vitest keeps the
    // empty-alias fallback (this plugin is Vite-only); tsc keeps the ambient plugs/virtual-trait-manifest.d.ts.
    traitEnforcer({ traitMap: {} }),
  ],
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
      '^/(projects|adapters|intents|capabilities|protocols|design-systems|presets|plugs/(?!.*\\.ts)|cases|mission|semantics|states|resources|author|governance|research|backlog|validation-rules|project-lifecycle|assets|css|js|sitemap.xml|build-id.json)': {
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
      // `virtual:trait-manifest` is now provided by the traitEnforcer plugin above (#484) — no alias
      // here, since resolve.alias would shadow the plugin's resolveId and the Enforcer would never run.
      // (vitest.config.ts keeps the empty-alias fallback: the plugin is Vite-only, absent under vitest.)
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
