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
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseHTML } from 'linkedom';
import { transform, version as esbuildVersion } from 'esbuild';
import {
  serveCompiled,
  compilerRegistry,
  type ServeOptions,
} from '../../blocks/renderers/module-service/moduleService';
import {
  indexDefinitions,
  type DefinitionResolver,
} from '../../blocks/renderers/module-service/definitionRegistry';
import { createMaaSFetchHandler } from '../../blocks/renderers/module-service/fetchHandler';
import { componentCases } from '../../blocks/renderers/component/__fixtures__/component-cases';

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

/** v1 registry: element-name → authored `<component>` definition, indexed from the shared fixtures. */
const resolver: DefinitionResolver = indexDefinitions(
  componentCases.map((c) => c.def),
  { skipUnnamed: true },
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

/** The shared, framework-agnostic origin — Vite is just one caller (#461). */
const handler = createMaaSFetchHandler({
  resolver,
  resolve: serveWithDom,
  producer: `webadapters/0.0.0; esbuild/${esbuildVersion}`,
});

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
      server.middlewares.use((req, res, next) => {
        if (!(req.url || '').startsWith('/_maas/')) return next();
        handler(toRequest(req))
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
