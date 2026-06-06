/**
 * @file tools/maas/vite-plugin.ts
 * @description Module-as-a-Service delivery endpoint — backlog #081 phase 2a (native ESM over HTTP).
 *
 * Serves one authored component as a URL the consumer `import`s natively — zero build step on the
 * consumer. `GET /_maas/<name>.js?form=wc-class` resolves the component definition (v1 registry =
 * the shared component-cases fixtures), runs the SAME `serve()` resolver the demos use, and returns
 * the result with the right content-type. The `wc-class` form is self-contained ESM (it just
 * `customElements.define`s on import), so a browser can `await import('/_maas/user-card.js')` and
 * then use `<user-card>` with no bundler — the whole point of the native-only seam.
 *
 * The resolver transforms are DOM-dependent (`parseDefinition` builds elements), so the middleware
 * installs a linkedom document as `globalThis.document` for the duration of the call — mirroring the
 * 11ty `htmlToJsx` build filter exactly (.eleventy.js). Bare-specifier / import-map resolution only
 * starts to matter once a served module imports *another* served module; v1 components are
 * self-contained, so that story is deferred — this endpoint is where it will live.
 */
import type { Plugin } from 'vite';
import { parseHTML } from 'linkedom';
import { transform } from 'esbuild';
import {
  serveCompiled,
  FORMS,
  compilerRegistry,
  type ServeForm,
} from '../../blocks/renderers/module-service/moduleService';
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

const MIME: Record<string, string> = {
  javascript: 'text/javascript; charset=utf-8',
  jsx: 'text/javascript; charset=utf-8',
  html: 'text/html; charset=utf-8',
};

/** v1 registry: element-name → authored `<component>` definition, derived from the shared fixtures. */
function resolveDefinition(name: string): string | null {
  for (const c of componentCases) {
    const m = c.def.match(/<component[^>]*\bname="([^"]+)"/);
    if (m && m[1] === name) return c.def;
  }
  return null;
}

/** Run the DOM-dependent resolver (+ delegated transpile) under a transient linkedom document. */
async function serveWithDom(definition: string, form: ServeForm, transpileTarget?: string) {
  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  const prev = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = document;
  try {
    return await serveCompiled(definition, { form, transpileTarget });
  } finally {
    (globalThis as { document?: unknown }).document = prev;
  }
}

export function moduleService(): Plugin {
  return {
    name: 'module-as-a-service',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url || '';
        if (!raw.startsWith('/_maas/')) return next();

        const [path, query = ''] = raw.split('?');
        const params = new URLSearchParams(query);
        const name = decodeURIComponent(path.slice('/_maas/'.length).replace(/\.js$/, ''));
        const form = (params.get('form') || 'wc-class') as ServeForm;
        const target = params.get('target') || undefined;

        const fail = (code: number, msg: string) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: msg }));
        };

        if (!FORMS.some((f) => f.id === form))
          return fail(400, `Unknown form "${form}". Known: ${FORMS.map((f) => f.id).join(', ')}.`);

        const definition = resolveDefinition(name);
        if (!definition)
          return fail(404, `No component "${name}". Known: ${componentCases
            .map((c) => (c.def.match(/\bname="([^"]+)"/) || [])[1])
            .filter(Boolean)
            .join(', ')}.`);

        serveWithDom(definition, form, target).then((result) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', MIME[result.language] || 'text/plain; charset=utf-8');
          // Surface the lossy/diagnostic contract over the wire so consumers never get silent drops.
          // Diagnostics carry non-ASCII (em dashes) — encode so they're valid HTTP header values.
          if (result.lossy) res.setHeader('X-MaaS-Lossy', '1');
          if (result.diagnostics.length)
            res.setHeader('X-MaaS-Diagnostic', encodeURIComponent(result.diagnostics.join(' | ')));
          res.end(result.code);
        }).catch((e) => fail(500, `serve failed: ${(e as Error).message}`));
      });
    },
  };
}
