/**
 * @file blocks/renderers/module-service/conformance/generate.ts
 * @description Generate the frozen golden vectors from the reference implementation (backlog #506).
 *
 * Golden generation is the one place the reference impl is authoritative: it resolves each input's
 * `{id}` placeholder to a real #088 content-hash id, issues the request against the #461 handler, and
 * freezes the exact response as the vector's `expect`. The committed `golden.json` is that output; a
 * vitest drift test (`maasConformance.test.ts`) asserts it equals a fresh generation, so it can never go
 * stale — the same guard the OpenAPI projection uses (#505). The script `scripts/gen-maas-conformance.mjs`
 * bundles + runs this.
 */

import { VECTOR_INPUTS } from './vectors';
import { referenceTarget, resolveVectorId } from './referenceTarget';
import { hashBody, type ConformanceVector } from './runner';

/** Substitute every `{id}` token in a string with the resolved content-hash id. */
const subst = (s: string, id: string): string => s.replace(/\{id\}/g, id);

/**
 * Build the complete golden vector set: resolve placeholders, run the reference origin, freeze the
 * response. Deterministic — identical inputs always produce byte-identical golden vectors.
 */
export async function buildGoldenVectors(): Promise<ConformanceVector[]> {
  const out: ConformanceVector[] = [];
  for (const input of VECTOR_INPUTS) {
    const needsId = input.request.url.includes('{id}') ||
      Object.values(input.request.headers ?? {}).some((v) => v.includes('{id}'));
    const id = needsId ? await resolveVectorId(input.fixture, input.request.url.replace(/\{id\}/g, '')) : '';

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.request.headers ?? {})) headers[k] = subst(v, id);

    const vectorWithoutExpect: Omit<ConformanceVector, 'expect'> = {
      name: input.name,
      description: input.description,
      fixture: input.fixture,
      request: { url: subst(input.request.url, id), method: input.request.method ?? 'GET', headers },
    };

    const actual = await referenceTarget.run(vectorWithoutExpect as ConformanceVector);
    out.push({
      ...vectorWithoutExpect,
      expect: {
        status: actual.status,
        headers: actual.headers,
        body: actual.body,
        bodyHash: await hashBody(actual.body),
      },
    });
  }
  return out;
}

/** Stable, pretty JSON with a trailing newline — the on-disk form the drift test compares against. */
export const serialize = (vectors: ConformanceVector[]): string => `${JSON.stringify(vectors, null, 2)}\n`;
