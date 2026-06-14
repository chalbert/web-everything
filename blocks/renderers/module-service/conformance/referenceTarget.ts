/**
 * @file blocks/renderers/module-service/conformance/referenceTarget.ts
 * @description The #461 JS Fetch origin wrapped as a conformance {@link ConformanceTarget} (backlog #506).
 *
 * The reference implementation is just one target the runner drives — but a privileged one: the golden
 * vectors (`golden.json`) are GENERATED from it (`./generate.ts`), so by construction the reference
 * passes its own suite. Its value is the inverse: a generated .NET/Java/Go origin (#507) is a *different*
 * target run against the *same* golden bytes, and any divergence is a real conformance failure. This
 * module is also where the one reference-specific operation lives — resolving a vector's `{id}`
 * placeholder by computing the #088 content-hash id, since the id IS the contract under test.
 */

import {
  createMaaSFetchHandler,
  computeArtifactIdentity,
} from '../fetchHandler';
import type { DefinitionResolver } from '../definitionRegistry';
import type { ServeOptions, ServeResult } from '../moduleService';
import {
  OBSERVED_HEADERS,
  type ActualResponse,
  type ConformanceTarget,
  type ConformanceVector,
  type VectorFixture,
} from './runner';

/** Vector paths are origin-relative; the handler needs an absolute URL, so we mount them under one host. */
const TEST_ORIGIN = 'http://maas.test';

/** Build the #461 handler seeded with a vector's fixture (resolver + frozen transform output). */
function handlerFor(fixture: VectorFixture): (request: Request) => Promise<Response> {
  const resolver: DefinitionResolver = {
    resolve: (id) => (id === fixture.component ? fixture.definition : null),
  };
  const t = fixture.transform;
  const resolve = async (_definition: string, opts: ServeOptions): Promise<ServeResult> => ({
    form: opts.form,
    code: t.code,
    language: t.language,
    lossy: t.lossy,
    diagnostics: [...t.diagnostics],
  });
  return createMaaSFetchHandler({ resolver, resolve, producer: fixture.producer });
}

/** Normalize a Fetch `Response` to the neutral {@link ActualResponse} — only the IR-observed headers. */
async function normalize(res: Response): Promise<ActualResponse> {
  const headers: Record<string, string> = {};
  for (const name of OBSERVED_HEADERS) {
    const v = res.headers.get(name);
    if (v !== null) headers[name] = v;
  }
  return { status: res.status, headers, body: await res.text() };
}

const absolute = (url: string): string => (/^https?:\/\//.test(url) ? url : `${TEST_ORIGIN}${url}`);

/** The JS reference implementation as a conformance target. */
export const referenceTarget: ConformanceTarget = {
  name: 'js-reference (#461 createMaaSFetchHandler)',
  async run(vector: ConformanceVector): Promise<ActualResponse> {
    const handle = handlerFor(vector.fixture);
    const req = new Request(absolute(vector.request.url), {
      method: vector.request.method,
      headers: vector.request.headers,
    });
    return normalize(await handle(req));
  },
};

// ── `{id}` placeholder resolution — the one reference-specific step in golden generation ──
//
// A served/conditional vector addresses an artifact by its content-hash id, which is itself the hash
// being tested. The id can't be hand-written, so vector INPUTS use a `{id}` placeholder; golden
// generation computes the id from the fixture+params (via the reference #088 identity function) and
// bakes the concrete value into url + headers. Any conforming origin, given the same fixture, MUST
// compute the same id — so the baked url resolves and the bytes match; a drifting origin mints a
// different id, its current artifact won't match the baked pin, and it 404s → a loud conformance failure.

/** Derive a vector's `{id}` (the #088 content-hash id) from its fixture and the request's query params. */
export async function resolveVectorId(fixture: VectorFixture, requestUrl: string): Promise<string> {
  const url = new URL(absolute(requestUrl));
  const opts: ServeOptions = {
    form: (url.searchParams.get('form') || 'wc-class') as ServeOptions['form'],
    transpileTarget: url.searchParams.get('target') || undefined,
    strategy: url.searchParams.get('strategy') || undefined,
  };
  const t = fixture.transform;
  const result: ServeResult = {
    form: opts.form,
    code: t.code,
    language: t.language,
    lossy: t.lossy,
    diagnostics: [...t.diagnostics],
  };
  const identity = await computeArtifactIdentity(fixture.definition, result, opts, fixture.producer);
  return identity.id;
}
