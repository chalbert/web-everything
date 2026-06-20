/**
 * @file tools/maas/vite-plugin.ts
 * @description Module-as-a-Service delivery endpoint — backlog #081 phase 2a, #461 origin.
 *
 * Serves one authored component as a URL the consumer `import`s natively — zero build step on the
 * consumer. As of #461 this middleware is **one caller of the framework-agnostic Fetch handler**
 * ({@link createMaaSFetchHandler}); all the HTTP + identity logic (pin ladder, content-hash id,
 * cache/ETag/SRI headers, redirects) lives there and runs unchanged on Node/Deno/Workers. This file
 * contributes only the two Node-specific pieces the shared handler deliberately does NOT own:
 *
 *   1. **A DOM-wrapped resolve.** The transform core (`parseDefinition`) builds DOM elements, so the
 *      resolve step runs under a transient linkedom `globalThis.document` — mirroring the 11ty
 *      `htmlToJsx` build filter (.eleventy.js). The handler injects this as its `resolve`.
 *   2. **A Fetch↔Node-stream adapter.** Vite's middleware speaks Node `IncomingMessage`/`ServerResponse`;
 *      the handler speaks `Request`/`Response`. The adapter bridges the two — the whole reason the
 *      handler could be lifted out of Vite in the first place.
 *
 * The esbuild-backed compiler is still registered here (Node-only); the browser-safe core imports none.
 */
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseHTML } from 'linkedom';
import { transform, version as esbuildVersion } from 'esbuild';
// #1202: block runtime imports the plug layer via the bare `@frontierui/plugs` specifier, which only
// Vite's app alias resolves — plain Node (which evaluates this config-loaded plugin) cannot, so a
// STATIC import of `../../blocks/*` here breaks `vite` cold-start at config-load (ERR_MODULE_NOT_FOUND).
// Keep block runtime out of the Node config-eval graph: pull the VALUE imports in lazily at
// server-start via `server.ssrLoadModule` (Vite resolves the alias there). Type-only imports are
// erased by esbuild and never reach Node resolution, so they stay static for type-safety.
import type { ServeOptions } from '../../blocks/renderers/module-service/moduleService';
import type {
  DefinitionResolver,
  TraitModule,
} from '../../blocks/renderers/module-service/definitionRegistry';

/** The block-runtime surface this plugin uses — loaded through Vite at server-start, never by Node. */
type MaaSRuntime = {
  serveCompiled: typeof import('../../blocks/renderers/module-service/moduleService').serveCompiled;
  compilerRegistry: typeof import('../../blocks/renderers/module-service/moduleService').compilerRegistry;
  indexDefinitions: typeof import('../../blocks/renderers/module-service/definitionRegistry').indexDefinitions;
  indexTraitModules: typeof import('../../blocks/renderers/module-service/definitionRegistry').indexTraitModules;
  createMaaSFetchHandler: typeof import('../../blocks/renderers/module-service/fetchHandler').createMaaSFetchHandler;
  componentCases: typeof import('../../blocks/renderers/component/__fixtures__/component-cases').componentCases;
};

/**
 * Build the framework-agnostic MaaS origin handler from Vite-resolved block runtime. Runs once at
 * server-start (the import side-effects — esbuild-compiler registration, fixture indexing — that used
 * to fire at module-eval now fire here, on the ssr-loaded instances the middleware actually uses).
 */
async function buildHandler(server: ViteDevServer) {
  const [moduleService, definitionRegistry, fetchHandlerMod, componentFixtures] = (await Promise.all([
    server.ssrLoadModule('/blocks/renderers/module-service/moduleService.ts'),
    server.ssrLoadModule('/blocks/renderers/module-service/definitionRegistry.ts'),
    server.ssrLoadModule('/blocks/renderers/module-service/fetchHandler.ts'),
    server.ssrLoadModule('/blocks/renderers/component/__fixtures__/component-cases.ts'),
  ])) as unknown as [MaaSRuntime, MaaSRuntime, MaaSRuntime, MaaSRuntime];

  const { serveCompiled, compilerRegistry } = moduleService;
  const { indexDefinitions, indexTraitModules } = definitionRegistry;
  const { createMaaSFetchHandler } = fetchHandlerMod;
  const { componentCases } = componentFixtures;

  // Phase 2b: register the esbuild-backed compiler into the shared seam. The core stays
  // browser-safe (no esbuild import there); this Node-only delivery layer injects the provider.
  compilerRegistry.register(
    {
      id: 'esbuild',
      async transpile({ code, loader, target }) {
        // jsx loader needs the same factory the app uses (vite.config.mts jsxInject); the generated
        // functional source already imports `jsx`, so esbuild lowers <x/> → jsx.createElement(…).
        const out = await transform(
          code,
          loader === 'jsx'
            ? { loader: 'jsx', target, jsxFactory: 'jsx.createElement', jsxFragment: 'jsx.Fragment' }
            : { loader: 'js', target },
        );
        return { code: out.code };
      },
    },
    { default: true },
  );

  // Pre-built trait chunks to expose on the MaaS origin (#743). WE authors no trait modules yet
  // (`traitEnforcer({ traitMap: {} })`, vite.config.mts), so this is empty today — the union seam is
  // wired ahead of the first authored trait (#359/#736) so a `/_maas/<trait>.js` fetch resolves the
  // moment one lands, with no further origin change.
  const traitModules: TraitModule[] = [];

  // v1 registry: element-name → authored `<component>` definition, indexed from the shared fixtures,
  // with the **trait-module registry unioned in as the fallback** (#743) — so one `resolve()` answers
  // for both a component name (local) and a trait name (fallback), and a trait chunk is served
  // instead of 404ing.
  const resolver: DefinitionResolver = indexDefinitions(
    componentCases.map((c) => c.def),
    { skipUnnamed: true, fallback: indexTraitModules(traitModules) },
  );

  /** Run the DOM-dependent resolver (+ delegated transpile) under a transient linkedom document. */
  async function serveWithDom(definition: string, opts: ServeOptions) {
    const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
    const prev = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = document;
    try {
      return await serveCompiled(definition, opts);
    } finally {
      (globalThis as { document?: unknown }).document = prev;
    }
  }

  // The shared, framework-agnostic origin — Vite is just one caller (#461).
  return createMaaSFetchHandler({
    resolver,
    resolve: serveWithDom,
    producer: `webadapters/0.0.0; esbuild/${esbuildVersion}`,
  });
}

// ── Fetch ↔ Node-stream adapter ────────────────────────────────────────────────────
// The single Node-specific bridge: Node `IncomingMessage` → Fetch `Request`, run the shared
// handler, then Fetch `Response` → Node `ServerResponse`. GET-only (MaaS serves, never mutates), so
// no request body needs streaming.

function toRequest(req: IncomingMessage): Request {
  const url = `http://localhost${req.url ?? '/'}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers))
    if (typeof v === 'string') headers.set(k, v);
  return new Request(url, { method: req.method ?? 'GET', headers });
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
}

export function moduleService(): Plugin {
  return {
    name: 'module-as-a-service',
    configureServer(server) {
      // #1202: build the handler off Vite-resolved block runtime, kicked off at server-start so the
      // first `/_maas/` request doesn't pay the ssr-load latency (warm the promise once, await it per
      // request). Block runtime never enters the Node config-eval graph this way.
      const handlerReady = buildHandler(server);
      server.middlewares.use((req, res, next) => {
        if (!(req.url || '').startsWith('/_maas/')) return next();
        handlerReady
          .then((handler) => handler(toRequest(req)))
          .then((response) => writeResponse(res, response))
          .catch((e) => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: `serve failed: ${(e as Error).message}` }));
          });
      });
    },
  };
}
