/**
 * Drift gate for the language-neutral JSON export of the Web Directives SSR wire-format golden vectors
 * (#2354). `webdirectives-ssr.vectors.ts` is the source of truth; `webdirectives-ssr.vectors.json` is a
 * generated, committed projection of it (`scripts/gen-webdirectives-ssr-vectors.mjs`,
 * `npm run gen:webdirectives-ssr-vectors`) — the form any non-JS renderer harness (#2069) reads without a
 * Node/TS toolchain. This test asserts the committed file is byte-identical to a fresh projection of the TS
 * suite, so the JSON can never silently go stale relative to the source vectors.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { assertSsrWireSuite, webdirectivesSsrSuite } from '../index.js';
import { serialize } from '../../scripts/gen-webdirectives-ssr-vectors.mjs';

describe('webdirectives-ssr.vectors.json (language-neutral export, #2354)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const jsonPath = join(here, '../webdirectives-ssr.vectors.json');

  it('matches a fresh projection of the TS suite byte-for-byte (drift gate)', () => {
    const committed = readFileSync(jsonPath, 'utf8');
    const fresh = serialize(assertSsrWireSuite(webdirectivesSsrSuite));
    expect(committed).toBe(fresh);
  });

  it('is valid JSON whose shape matches the TS suite (standard, contract, vectors)', () => {
    const parsed = JSON.parse(readFileSync(jsonPath, 'utf8'));
    expect(parsed.standard).toBe(webdirectivesSsrSuite.standard);
    expect(parsed.contract).toBe(webdirectivesSsrSuite.contract);
    expect(parsed.vectors.length).toBe(webdirectivesSsrSuite.vectors.length);
    expect(parsed.vectors.map((v: { id: string }) => v.id)).toEqual(
      webdirectivesSsrSuite.vectors.map((v) => v.id),
    );
  });

  it('every vector carries a plain-JSON `data` object and a byte-exact `expectedHtml` string', () => {
    const parsed = JSON.parse(readFileSync(jsonPath, 'utf8'));
    for (const v of parsed.vectors) {
      expect(typeof v.data, `${v.id}: data must be a plain object`).toBe('object');
      expect(Array.isArray(v.data), `${v.id}: data must not be an array`).toBe(false);
      expect(v.data, `${v.id}: data must not be null`).not.toBeNull();
      expect(typeof v.expectedHtml, `${v.id}: expectedHtml must be a string`).toBe('string');
      expect(v.expectedHtml.length, `${v.id}: expectedHtml must be non-empty`).toBeGreaterThan(0);
    }
  });
});
