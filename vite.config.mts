import { defineConfig, Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { devPanel } from './tools/dev-panel/vite-plugin';
import { moduleService } from './tools/maas/vite-plugin';

// #449 (per #606): plugs is FUI's impl; WE consumes it as a no-leakage client via the
// `@frontierui/plugs` package, dev-time-resolved to the sibling Frontier UI source (mirrors FUI's
// proven `weRoot = resolve(__dirname, '../webeverything')` sibling-alias). Release builds use the
// published package (#877-style). `__dirname` is this config file's directory = the WE repo root.
const __dirname = dirname(fileURLToPath(import.meta.url));
const fuiPlugsRoot = resolve(__dirname, '../frontierui/plugs');

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
 * A client-side router owns paths that have no file on disk (e.g. `/counter`). A hard reload of such a
 * deep link hits the dev server, which would 404 — so we rewrite the request to the demo's HTML entry and
 * let the router re-match the path in the browser. Each demo mounted under its own base path needs an
 * entry here. (The loan-origination + auto-insurance exercise apps moved to FUI in #823/#824, so their
 * base-path entries were removed.)
 */
function routerDemoFallback(): Plugin {
  // [pathTest, htmlEntry] — first match wins.
  const fallbacks: Array<[RegExp, string]> = [
    [/^\/(counter|todos|users|admin|login)(\/|$)/, '/demos/declarative-spa-router.html'],
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
    // The Enforcer (the build-time trait-manifest generator) relocated to FUI with the rest of the
    // trait-enforcer plugins (#894 / ratified #905) — WE iframe-embeds FUI demos and authors no trait
    // modules, so its traitMap is empty by design and the plugin earned no place in WE's build. The
    // empty `virtual:trait-manifest` is now served by the `resolve.alias` below (the byte-identical
    // fallback vitest already used). WE keeps only the neutral #716 contract it owns.
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
      '^/(projects|adapters|intents|capabilities|compat|protocols|design-systems|presets|plugs/(?!.*\\.ts)|cases|mission|semantics|states|resources|author|governance|research|backlog|validation-rules|conformance|project-lifecycle|assets|css|js|sitemap.xml|build-id.json)': {
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
      // The Enforcer relocated to FUI (#894), so `virtual:trait-manifest` is no longer provided by a
      // plugin here. Alias it to the empty static manifest — the byte-identical fallback vitest.config.ts
      // already uses (#116/#448) — so bootstrap's `import 'virtual:trait-manifest'` still resolves and the
      // manifest stays empty (WE authors no trait modules, docs-rendering boundary).
      'virtual:trait-manifest': '/plugs/webbehaviors/traitManifest',
      '@core': '/plugs/core',
      '@webregistries': '/plugs/webregistries',
      '@webinjectors': '/plugs/webinjectors',
      '@webcomponents': '/plugs/webcomponents',
      '@webcontexts': '/plugs/webcontexts',
      '@webbehaviors': '/plugs/webbehaviors',
      '@webstates': '/plugs/webstates',
      '@webexpressions': '/plugs/webexpressions',

      // #449 (per #606): WE's block runtime imports the plug platform layer as the `@frontierui/plugs`
      // package — FUI owns the impl, WE consumes it as a no-leakage client. Dev-time-resolved to the
      // sibling FUI source (Vite object aliases prefix-match, so this also resolves the deep subpaths
      // `@frontierui/plugs/webbehaviors/CustomAttribute` etc.). Release builds use the published package.
      '@frontierui/plugs': fuiPlugsRoot,
    },
  },
});
