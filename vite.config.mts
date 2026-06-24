import { defineConfig, Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// #1579 (per #1565 devtools-placement): the dev-panel / spec-explorer plugin is a Plateau-owned
// developer tool — the single canonical copy lives in plateau-app. WE consumes it dev-time from the
// sibling checkout (a build-time plugin can't go through `resolve.alias`, so this is a direct sibling
// import — same `../<sibling>` assumption the `@frontierui/*` aliases below already rely on).
import { devPanel } from '../plateau-app/tools/dev-panel/vite-plugin';
import { moduleService } from './tools/maas/vite-plugin';

// #449 (per #606): plugs is FUI's impl; WE consumes it as a no-leakage client via the
// `@frontierui/plugs` package, dev-time-resolved to the sibling Frontier UI source (mirrors FUI's
// proven `weRoot = resolve(__dirname, '../webeverything')` sibling-alias). Release builds use the
// published package (#877-style). `__dirname` is this config file's directory = the WE repo root.
const __dirname = dirname(fileURLToPath(import.meta.url));
const fuiPlugsRoot = resolve(__dirname, '../frontierui/plugs');
// #1768 (per #1282): the 6 bootstrap-runtime block families (parsers, text-nodes, for-each,
// transient, stores, attributes) graduated to FUI — their WE-local impls are deleted. The demos'
// only *value* import of a graduated family is `SimpleStore` from `/blocks/stores/simple`; alias it
// to the FUI sibling so the demos resolve the graduated impl (mirrors the `/plugs` repoint above).
const fuiBlocksRoot = resolve(__dirname, '../frontierui/blocks');

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
      // #1234 (per #449/#606): the residual local-plugs consumers (the injected bootstrap
      // `<script src="/plugs/bootstrap.ts">`, the hard-coded demo bootstrap tags, the test-pages, and
      // the sub-aliases below) all resolve to the sibling FUI `plugs/` tree now that #1250 reconciled
      // FUI up to a superset. The `/plugs` prefix alias is the linchpin: Vite applies it to bare
      // `/plugs/…` URL imports AND to the HTML `<script type="module" src="/plugs/…">` the dev server
      // fetches, so the whole demo surface lands on FUI without per-file rewrites. Release builds use the
      // published `@frontierui/plugs` package.
      '/plugs': fuiPlugsRoot,

      // #1768: the demos' lone value-import of a graduated family resolves to FUI (the family's
      // new home); the runtime registrations come from the FUI-resolved `/plugs/bootstrap.ts`.
      '/blocks/stores/simple': resolve(fuiBlocksRoot, 'stores/simple'),

      // The Enforcer relocated to FUI (#894), so `virtual:trait-manifest` is no longer provided by a
      // plugin here — alias it to FUI's empty static manifest so bootstrap's `import 'virtual:trait-manifest'`
      // still resolves (WE authors no trait modules, docs-rendering boundary).
      'virtual:trait-manifest': `${fuiPlugsRoot}/webbehaviors/traitManifest`,
      // The vestigial sub-aliases bare specifiers still use — repointed off the local `/plugs/…` URLs
      // onto the FUI tree (an alias substitution is single-pass, so these must target FUI directly, not
      // re-route through the `/plugs` prefix alias above).
      '@core': `${fuiPlugsRoot}/core`,
      '@webregistries': `${fuiPlugsRoot}/webregistries`,
      '@webinjectors': `${fuiPlugsRoot}/webinjectors`,
      '@webcomponents': `${fuiPlugsRoot}/webcomponents`,
      '@webcontexts': `${fuiPlugsRoot}/webcontexts`,
      '@webbehaviors': `${fuiPlugsRoot}/webbehaviors`,
      '@webstates': `${fuiPlugsRoot}/webstates`,
      '@webexpressions': `${fuiPlugsRoot}/webexpressions`,

      // #449 (per #606): WE's block runtime imports the plug platform layer as the `@frontierui/plugs`
      // package — FUI owns the impl, WE consumes it as a no-leakage client. Dev-time-resolved to the
      // sibling FUI source (Vite object aliases prefix-match, so this also resolves the deep subpaths
      // `@frontierui/plugs/webbehaviors/CustomAttribute` etc.). Release builds use the published package.
      '@frontierui/plugs': fuiPlugsRoot,

      // #1234: FUI's plugs transitively re-export from the WE-resident `@webeverything/*` contract graph
      // (the #872/#804 contract-distribution end-state). FUI's own vite.config provides these via a
      // `weRoot`-anchored map; serving FUI plugs through WE's dev server needs the mirror image, anchored
      // at this repo root. Mirrors `frontierui/vite.config.mts`'s `@webeverything/*` block exactly — keep
      // the two in step. Release builds use the published `@webeverything/*` packages.
      '@webeverything/capability-manifest': resolve(__dirname, 'capability-manifest/index.ts'),
      '@webeverything/validation-generation/provider': resolve(__dirname, 'validation-generation/provider.ts'),
      '@webeverything/validation-generation/registry': resolve(__dirname, 'validation-generation/registry.ts'),
      '@webeverything/validation-generation/fieldError': resolve(__dirname, 'validation-generation/fieldError.ts'),
      '@webeverything/validation-generation/cel': resolve(__dirname, 'validation-generation/cel.ts'),
      '@webeverything/validation-generation/service': resolve(__dirname, 'validation-generation/service.ts'),
      '@webeverything/webcases/requirementValidator': resolve(__dirname, 'webcases/requirementValidator.ts'),
      '@webeverything/contracts/guard': resolve(__dirname, 'contracts/guard.ts'),
      '@webeverything/contracts/analytics': resolve(__dirname, 'contracts/analytics.ts'),
      '@webeverything/contracts/charts': resolve(__dirname, 'contracts/charts.ts'),
      '@webeverything/contracts/graph': resolve(__dirname, 'contracts/graph.ts'),
      '@webeverything/contracts/credential-management': resolve(__dirname, 'contracts/credential-management.ts'),
      '@webeverything/contracts/push-delivery': resolve(__dirname, 'contracts/push-delivery.ts'),
      '@webeverything/contracts/resources': resolve(__dirname, 'contracts/resources.ts'),
      '@webeverything/contracts/transport-negotiation': resolve(__dirname, 'contracts/transport-negotiation.ts'),
      '@webeverything/contracts/validity-merge': resolve(__dirname, 'contracts/validity-merge.ts'),
      '@webeverything/contracts/validator-resolution': resolve(__dirname, 'contracts/validator-resolution.ts'),
      '@webeverything/contracts/audit': resolve(__dirname, 'contracts/audit.ts'),
      '@webeverything/contracts/lifecycle': resolve(__dirname, 'contracts/lifecycle.ts'),
      '@webeverything/contracts/master-detail': resolve(__dirname, 'contracts/master-detail.ts'),
      '@webeverything/contracts/selection': resolve(__dirname, 'contracts/selection.ts'),
      '@webeverything/contracts/stepper': resolve(__dirname, 'contracts/stepper.ts'),
      '@webeverything/contracts/tree-select': resolve(__dirname, 'contracts/tree-select.ts'),
      '@webeverything/commitment-policy': resolve(__dirname, 'commitment-policy/index.ts'),
      '@webeverything/error-summary': resolve(__dirname, 'error-summary/index.ts'),
      '@webeverything/interaction-state': resolve(__dirname, 'interaction-state/index.ts'),
    },
  },
});
