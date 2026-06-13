/**
 * Tests for the neutral MaaS serve-path IR and its OpenAPI projection (backlog #505, #463 fork b).
 *
 * Two things are proven here:
 *   1. The IR is the *authority* and the #461 Fetch handler is its *reference implementation* — the
 *      handler emits exactly the cache strings, header names, and status codes the IR declares. If the
 *      two ever disagree this suite goes red, which is the enforcement mechanism behind "the IR wins
 *      and the handler is fixed."
 *   2. The OpenAPI projection is a faithful, deterministic function of the IR, and the committed
 *      `maas-servepath.openapi.json` is in sync (the drift gate).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  SERVE_PATH,
  CACHE_POLICY,
  MAAS_HEADERS,
  HTTP_STATUS,
  HASH_PIN_PATTERN,
  DEFAULT_BASE_PATH,
} from '../../../renderers/module-service/servePathIR';
import { servePathToOpenAPI } from '../../../renderers/module-service/servePathOpenAPI';
import { createMaaSFetchHandler, computeArtifactIdentity } from '../../../renderers/module-service/fetchHandler';
import type { DefinitionResolver } from '../../../renderers/module-service/definitionRegistry';
import type { ServeResult, ServeOptions } from '../../../renderers/module-service/moduleService';

const DEFINITION = '<component name="user-card"></component>';
const CODE = 'export class UserCard extends HTMLElement {}';
const PRODUCER = 'webadapters/1.2.3; esbuild/0.21.5';
const resolver: DefinitionResolver = { resolve: (id) => (id === 'user-card' ? DEFINITION : null) };
const stubResolve = vi.fn(
  async (_def: string, opts: ServeOptions): Promise<ServeResult> => ({
    form: opts.form,
    code: CODE,
    language: 'javascript',
    lossy: false,
    diagnostics: [],
  }),
);
const build = () => createMaaSFetchHandler({ resolver, resolve: stubResolve, producer: PRODUCER });
async function currentId(): Promise<string> {
  const result: ServeResult = { form: 'wc-class', code: CODE, language: 'javascript', lossy: false, diagnostics: [] };
  return (await computeArtifactIdentity(DEFINITION, result, { form: 'wc-class' }, PRODUCER)).id;
}

describe('serve-path IR — shape', () => {
  it('is a frozen, single-GET contract under the default base path', () => {
    expect(Object.isFrozen(SERVE_PATH)).toBe(true);
    expect(SERVE_PATH.method).toBe('GET');
    expect(SERVE_PATH.basePath).toBe(DEFAULT_BASE_PATH);
    expect(SERVE_PATH.params.map((p) => p.name)).toEqual(['form', 'target', 'strategy']);
    expect(SERVE_PATH.responses.map((r) => r.status).sort()).toEqual([200, 302, 304, 400, 404, 500]);
  });
});

describe('reference handler conforms to the IR (the handler is impl, the IR is definition)', () => {
  it('emits the IR immutable cache string on a resolved hash pin', async () => {
    const id = await currentId();
    const res = await build()(new Request(`http://x/_maas/user-card@${id}.js?form=wc-class`));
    expect(res.status).toBe(HTTP_STATUS.ok);
    expect(res.headers.get('Cache-Control')).toBe(CACHE_POLICY.immutable);
    expect(res.headers.get(MAAS_HEADERS.integrity)).toMatch(new RegExp(`^${SERVE_PATH.hashAlgorithm}-`));
    expect(res.headers.get(MAAS_HEADERS.producer)).toBe(PRODUCER);
  });

  it('emits the IR floating cache string + redirect status on an unpinned request', async () => {
    const res = await build()(new Request('http://x/_maas/user-card.js?form=wc-class'));
    expect(res.status).toBe(HTTP_STATUS.redirect);
    expect(res.headers.get('Cache-Control')).toBe(CACHE_POLICY.floating);
  });

  it('uses the IR bad-request status for an unknown form', async () => {
    const res = await build()(new Request('http://x/_maas/user-card.js?form=nope'));
    expect(res.status).toBe(HTTP_STATUS.badRequest);
  });

  it('uses the IR not-found status for a non-MaaS path', async () => {
    const res = await build()(new Request('http://x/elsewhere.js'));
    expect(res.status).toBe(HTTP_STATUS.notFound);
  });

  it('honours the IR hash-pin grammar for the immutable/redirect split', async () => {
    // A pin that does not match the IR grammar is treated as floating (redirected), not served direct.
    const res = await build()(new Request('http://x/_maas/user-card@1.2.3.js?form=wc-class'));
    expect(res.status).toBe(HTTP_STATUS.redirect);
    const id = await currentId();
    expect(new RegExp(HASH_PIN_PATTERN).test(id)).toBe(true);
  });
});

describe('OpenAPI projection', () => {
  const doc = servePathToOpenAPI();

  it('projects the single GET route with every IR param and response', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.version).toBe(SERVE_PATH.version);
    const op = doc.paths[`${SERVE_PATH.basePath}{spec}`].get;
    expect(op.parameters.find((p) => p.in === 'path')?.required).toBe(true);
    for (const p of SERVE_PATH.params) expect(op.parameters.some((q) => q.name === p.name)).toBe(true);
    for (const r of SERVE_PATH.responses) expect(op.responses[String(r.status)]).toBeDefined();
  });

  it('carries the structured error schema on a 4xx', () => {
    const op = doc.paths[`${SERVE_PATH.basePath}{spec}`].get;
    expect(op.responses['404'].content?.['application/json']).toBeDefined();
    expect(doc.components.schemas.MaaSError).toBeDefined();
  });

  it('is deterministic — same IR projects byte-identically', () => {
    expect(JSON.stringify(servePathToOpenAPI())).toBe(JSON.stringify(servePathToOpenAPI()));
  });

  it('matches the committed maas-servepath.openapi.json (drift gate)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const committed = readFileSync(
      join(here, '../../../renderers/module-service/maas-servepath.openapi.json'),
      'utf8',
    );
    expect(JSON.parse(committed)).toEqual(doc);
  });
});
