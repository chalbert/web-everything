/**
 * 6-response servePathIR conformance test for the MaaS wrapper-serve endpoint (#1086, #912/#1029).
 *
 * Asserts that the reference Fetch handler (`createMaaSFetchHandler`) emits EVERY one of the 6 enumerated
 * `SERVE_PATH.responses` (200 / 302 / 304 / 400 / 404 / 500), each with the IR-declared status, the
 * IR-declared headers, and the IR-declared media type — so "is this origin conformant to the serve-path
 * IR?" is checkable, not asserted. The transform is INJECTED (a deterministic fake `resolve`), so the
 * test needs no DOM and drives the 500 branch by throwing on demand.
 *
 * This is the WE-side conformance suite the item names "FUI-side": the IR + reference handler live in WE
 * (`blocks/renderers/module-service/`), per #463 fork b — the handler imports its byte-determining
 * constants from the IR, and a generated .NET/Java/Go origin derives from the same IR (#506/#507).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createMaaSFetchHandler } from '../fetchHandler';
import { SERVE_PATH, HTTP_STATUS, MAAS_HEADERS, MEDIA_TYPES, DEFAULT_BASE_PATH } from '../servePathIR';
import type { ServeResult, ServeOptions } from '../moduleService';

const PRODUCER = 'test/9.9.9';

/** A deterministic served result — javascript form, no losses. */
const okResult: ServeResult = { code: 'export const x = 1;', language: 'javascript', lossy: false, diagnostics: [] };

/** A resolver that knows exactly one component. */
const resolver = { resolve: (id: string) => (id === 'card' ? '<component name="card"></component>' : null) };

/** Build a handler whose injected transform is controllable per-test (default: succeed). */
function handlerWith(resolve: (def: string, opts: ServeOptions) => Promise<ServeResult> = async () => okResult) {
  return createMaaSFetchHandler({ resolver, resolve, producer: PRODUCER });
}

const url = (path: string) => `https://origin.test${path}`;

/** Resolve the current artifact id for `card` by reading the Location of an unpinned (302) request. */
async function currentId(): Promise<string> {
  const res = await handlerWith()(new Request(url(`${DEFAULT_BASE_PATH}card.js`)));
  const loc = res.headers.get('Location')!;
  // /_maas/card@<id>.js  → extract <id>
  return decodeURIComponent(loc.slice(loc.indexOf('@') + 1).replace(/\.js$/, ''));
}

describe('servePathIR 6-response conformance (#1086)', () => {
  let id: string;
  beforeAll(async () => {
    id = await currentId();
  });

  it('the IR enumerates exactly the 6 expected status codes', () => {
    const statuses = SERVE_PATH.responses.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([200, 302, 304, 400, 404, 500]);
  });

  it('200 — a matching hash pin serves bytes with ETag + SRI integrity + producer', async () => {
    const res = await handlerWith()(new Request(url(`${DEFAULT_BASE_PATH}card@${id}.js`)));
    expect(res.status).toBe(HTTP_STATUS.ok);
    expect(res.headers.get('Content-Type')).toBe(MEDIA_TYPES.javascript);
    expect(res.headers.get('ETag')).toBe(`"${id}"`);
    expect(res.headers.get(MAAS_HEADERS.integrity)).toMatch(/^sha256-/);
    expect(res.headers.get(MAAS_HEADERS.producer)).toBe(PRODUCER);
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    expect(await res.text()).toBe(okResult.code);
  });

  it('302 — a floating tag redirects to the terminal content-hash URL', async () => {
    const res = await handlerWith()(new Request(url(`${DEFAULT_BASE_PATH}card@latest.js`)));
    expect(res.status).toBe(HTTP_STATUS.redirect);
    const loc = res.headers.get('Location')!;
    expect(loc).toContain(`@${id}.js`);
    expect(res.headers.get('Cache-Control')).toBe(SERVE_PATH.cachePolicy.floating);
    expect(res.headers.get(MAAS_HEADERS.producer)).toBe(PRODUCER);
  });

  it('304 — If-None-Match equal to the current ETag is Not Modified, empty body', async () => {
    const res = await handlerWith()(
      new Request(url(`${DEFAULT_BASE_PATH}card@${id}.js`), { headers: { 'If-None-Match': `"${id}"` } }),
    );
    expect(res.status).toBe(HTTP_STATUS.notModified);
    expect(res.headers.get('ETag')).toBe(`"${id}"`);
    expect(await res.text()).toBe('');
  });

  it('400 — an unknown form value is a bad request (JSON error body)', async () => {
    const res = await handlerWith()(new Request(url(`${DEFAULT_BASE_PATH}card.js?form=not-a-real-form`)));
    expect(res.status).toBe(HTTP_STATUS.badRequest);
    expect(res.headers.get('Content-Type')).toBe(MEDIA_TYPES.error);
    expect((await res.json()).error).toMatch(/Unknown form/);
  });

  it('404 — an unknown component (and a non-MaaS path) is Not Found', async () => {
    const missing = await handlerWith()(new Request(url(`${DEFAULT_BASE_PATH}ghost.js`)));
    expect(missing.status).toBe(HTTP_STATUS.notFound);
    expect(missing.headers.get('Content-Type')).toBe(MEDIA_TYPES.error);

    const nonMaas = await handlerWith()(new Request(url('/elsewhere/card.js')));
    expect(nonMaas.status).toBe(HTTP_STATUS.notFound);
  });

  it('404 — a stale hash pin that does not match current state is Not Found', async () => {
    const res = await handlerWith()(new Request(url(`${DEFAULT_BASE_PATH}card@sha256-deadbeef.js`)));
    expect(res.status).toBe(HTTP_STATUS.notFound);
    expect((await res.json()).error).toMatch(/current id is/);
  });

  it('500 — the injected transform throwing surfaces as a server error', async () => {
    const throwing = handlerWith(async () => {
      throw new Error('boom');
    });
    const res = await throwing(new Request(url(`${DEFAULT_BASE_PATH}card.js`)));
    expect(res.status).toBe(HTTP_STATUS.serverError);
    expect(res.headers.get('Content-Type')).toBe(MEDIA_TYPES.error);
    expect((await res.json()).error).toMatch(/serve failed: boom/);
  });

  it('every IR-declared response header name appears on its emitted response (200/302/304)', async () => {
    const byStatus = (s: number) => SERVE_PATH.responses.find((r) => r.status === s)!;
    const ok = await handlerWith()(new Request(url(`${DEFAULT_BASE_PATH}card@${id}.js`)));
    for (const name of byStatus(200).headers) expect(ok.headers.has(name), `200 missing ${name}`).toBe(true);

    const redirect = await handlerWith()(new Request(url(`${DEFAULT_BASE_PATH}card@latest.js`)));
    for (const name of byStatus(302).headers) expect(redirect.headers.has(name), `302 missing ${name}`).toBe(true);

    const notMod = await handlerWith()(
      new Request(url(`${DEFAULT_BASE_PATH}card@${id}.js`), { headers: { 'If-None-Match': `"${id}"` } }),
    );
    for (const name of byStatus(304).headers) expect(notMod.headers.has(name), `304 missing ${name}`).toBe(true);
  });
});
