/**
 * Unit tests for the MaaS distribution-origin Fetch handler (backlog #461). Proves the framework-free
 * `(Request) => Response` origin: the #088 content-addressed identity, the pin ladder (floating/exact
 * 302 → terminal hash served `immutable`), the cache/ETag/SRI headers, conditional requests, and the
 * provenance + lossy/diagnostic contract — all with `Request`/`Response` fixtures, no Vite/Node server.
 *
 * The transform `resolve` is stubbed so the suite stays DOM-free: the handler's contract is HTTP +
 * identity, which is exactly what's exercised here (the real DOM-wrapped resolve is the Vite caller's).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createMaaSFetchHandler,
  computeArtifactIdentity,
  sha256Id,
  type MaaSHandlerOptions,
} from '../../../renderers/module-service/fetchHandler';
import type { DefinitionResolver } from '../../../renderers/module-service/definitionRegistry';
import type { ServeResult, ServeOptions } from '../../../renderers/module-service/moduleService';

const DEFINITION = '<component name="user-card"></component>';
const CODE = 'export class UserCard extends HTMLElement {}';
const PRODUCER = 'webadapters/1.2.3; esbuild/0.21.5';

const resolver: DefinitionResolver = {
  resolve: (id) => (id === 'user-card' ? DEFINITION : null),
};
const stubResolve = (code = CODE, extra: Partial<ServeResult> = {}) =>
  vi.fn(async (_def: string, opts: ServeOptions): Promise<ServeResult> => ({
    form: opts.form,
    code,
    language: 'javascript',
    lossy: false,
    diagnostics: [],
    ...extra,
  }));

const build = (over: Partial<MaaSHandlerOptions> = {}) =>
  createMaaSFetchHandler({ resolver, resolve: stubResolve(), producer: PRODUCER, ...over });

/** The id the handler will mint for the canonical wc-class request — used to address the hash pin. */
async function currentId(opts: ServeOptions = { form: 'wc-class' }, code = CODE): Promise<string> {
  const result: ServeResult = { form: opts.form, code, language: 'javascript', lossy: false, diagnostics: [] };
  const identity = await computeArtifactIdentity(DEFINITION, result, opts, PRODUCER);
  return identity.id;
}

describe('createMaaSFetchHandler — pin ladder', () => {
  it('302-redirects a floating (unpinned) request to the terminal content-hash URL', async () => {
    const handle = build();
    const res = await handle(new Request('http://x/_maas/user-card.js?form=wc-class'));
    expect(res.status).toBe(302);
    const loc = res.headers.get('Location')!;
    const id = await currentId();
    expect(loc).toBe(`/_maas/user-card@${id}.js?form=wc-class`);
    // A floating pin is revalidatable, never immutable.
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60, must-revalidate');
    expect(res.headers.get('Cache-Control')).not.toContain('immutable');
  });

  it('302-redirects an @latest tag and an exact semver to the same hash URL', async () => {
    const handle = build();
    const id = await currentId();
    for (const pin of ['@latest', '@1.4.2']) {
      const res = await handle(new Request(`http://x/_maas/user-card${pin}.js?form=wc-class`));
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe(`/_maas/user-card@${id}.js?form=wc-class`);
    }
  });

  it('serves a terminal content-hash pin directly with immutable cache + ETag + SRI integrity', async () => {
    const handle = build();
    const id = await currentId();
    const res = await handle(new Request(`http://x/_maas/user-card@${id}.js?form=wc-class`));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(CODE);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('ETag')).toBe(`"${id}"`);
    // SRI integrity is over the served bytes, standard base64, sha256-prefixed.
    expect(res.headers.get('X-MaaS-Integrity')).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/);
    expect(res.headers.get('Content-Type')).toBe('text/javascript; charset=utf-8');
  });

  it('404s a content-hash pin that no longer matches the current artifact (no historical store in v1)', async () => {
    const handle = build();
    const stale = await sha256Id('something-else');
    const res = await handle(new Request(`http://x/_maas/user-card@${stale}.js?form=wc-class`));
    expect(res.status).toBe(404);
  });
});

describe('createMaaSFetchHandler — conditional + provenance', () => {
  it('returns 304 when If-None-Match matches the artifact ETag', async () => {
    const handle = build();
    const id = await currentId();
    const res = await handle(
      new Request(`http://x/_maas/user-card@${id}.js?form=wc-class`, {
        headers: { 'If-None-Match': `"${id}"` },
      }),
    );
    expect(res.status).toBe(304);
    expect(res.headers.get('ETag')).toBe(`"${id}"`);
  });

  it('emits the X-MaaS-Producer provenance header on every response shape', async () => {
    const handle = build();
    const floating = await handle(new Request('http://x/_maas/user-card.js?form=wc-class'));
    expect(floating.headers.get('X-MaaS-Producer')).toBe(PRODUCER);
    const id = await currentId();
    const served = await handle(new Request(`http://x/_maas/user-card@${id}.js?form=wc-class`));
    expect(served.headers.get('X-MaaS-Producer')).toBe(PRODUCER);
  });

  it('surfaces lossy + diagnostic headers over the wire (the #081 contract, url-encoded)', async () => {
    const handle = build({ resolve: stubResolve(CODE, { lossy: true, diagnostics: ['target — ignored'] }) });
    const id = await currentId();
    const res = await handle(new Request(`http://x/_maas/user-card@${id}.js?form=wc-class`));
    expect(res.headers.get('X-MaaS-Lossy')).toBe('1');
    expect(decodeURIComponent(res.headers.get('X-MaaS-Diagnostic')!)).toBe('target — ignored');
  });
});

describe('createMaaSFetchHandler — errors', () => {
  it('400s an unknown form', async () => {
    const res = await build()(new Request('http://x/_maas/user-card.js?form=bogus'));
    expect(res.status).toBe(400);
  });
  it('404s an unknown component', async () => {
    const res = await build()(new Request('http://x/_maas/ghost.js?form=wc-class'));
    expect(res.status).toBe(404);
  });
  it('404s a non-MaaS path', async () => {
    const res = await build()(new Request('http://x/elsewhere.js'));
    expect(res.status).toBe(404);
  });
});

describe('trait chunks on the served path (#743) — union resolver, no more 404', () => {
  const TRAIT_SOURCE = 'export class SortableTrait {}';
  // The union: component names resolve to <component> defs; a trait name to its pre-built module.
  const unionResolver: DefinitionResolver = {
    resolve: (id) => (id === 'user-card' ? DEFINITION : id === 'sortable' ? TRAIT_SOURCE : null),
  };
  // The real, DOM-free serve passthrough for a pre-built module (a trait needs no parseDefinition).
  const serveModule = stubResolve(TRAIT_SOURCE);
  const buildUnion = () =>
    createMaaSFetchHandler({ resolver: unionResolver, resolve: serveModule, producer: PRODUCER });

  it('resolves a trait name instead of 404ing (302-redirects to the terminal hash, like any artifact)', async () => {
    const res = await buildUnion()(new Request('http://x/_maas/sortable.js'));
    expect(res.status).toBe(302); // found + redirected down the pin ladder — NOT the old 404
    expect(res.headers.get('Location')).toMatch(/^\/_maas\/sortable@sha256-[A-Za-z0-9_-]+\.js/);
  });

  it('serves the trait module bytes verbatim at its terminal content-hash pin', async () => {
    const result: ServeResult = { form: 'wc-class', code: TRAIT_SOURCE, language: 'javascript', lossy: false, diagnostics: [] };
    const id = (await computeArtifactIdentity(TRAIT_SOURCE, result, { form: 'wc-class' }, PRODUCER)).id;
    const res = await buildUnion()(new Request(`http://x/_maas/sortable@${id}.js?form=wc-class`));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('javascript');
    expect(await res.text()).toBe(TRAIT_SOURCE);
  });

  it('still 404s a name that is neither a component nor a trait', async () => {
    const res = await buildUnion()(new Request('http://x/_maas/no-such-trait.js'));
    expect(res.status).toBe(404);
  });
});

describe('computeArtifactIdentity — #088 identity invariant', () => {
  it('is stable for identical inputs and changes when the compiler version moves', async () => {
    const result: ServeResult = { form: 'wc-class', code: CODE, language: 'javascript', lossy: false, diagnostics: [] };
    const opts: ServeOptions = { form: 'wc-class' };
    const a = await computeArtifactIdentity(DEFINITION, result, opts, 'v1');
    const b = await computeArtifactIdentity(DEFINITION, result, opts, 'v1');
    const c = await computeArtifactIdentity(DEFINITION, result, opts, 'v2');
    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(c.id); // a compiler bump alone mints a new id (#088 §3)
    expect(a.id).toMatch(/^sha256-[A-Za-z0-9_-]+$/); // base64url, no padding
  });

  it('changes the id when a param (form/target) moves, but keeps integrity tied to the bytes', async () => {
    const opts1: ServeOptions = { form: 'wc-class' };
    const opts2: ServeOptions = { form: 'wc-class', transpileTarget: 'es2017' };
    const result: ServeResult = { form: 'wc-class', code: CODE, language: 'javascript', lossy: false, diagnostics: [] };
    const a = await computeArtifactIdentity(DEFINITION, result, opts1, 'v1');
    const b = await computeArtifactIdentity(DEFINITION, result, opts2, 'v1');
    expect(a.id).not.toBe(b.id); // params are part of identity
    expect(a.integrity).toBe(b.integrity); // same bytes → same SRI hash
  });
});
