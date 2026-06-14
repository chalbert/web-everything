/**
 * Tests for the MaaS cross-language conformance suite (backlog #506, ratified in #463 fork c).
 *
 * Four things are proven here:
 *   1. The golden vectors are a deterministic projection of the reference impl, and the committed
 *      `golden.json` is in sync (the drift gate — same guard the OpenAPI projection uses, #505).
 *   2. The reference implementation (#461) conforms to its own golden vectors — by construction, but
 *      this is the canary: if a refactor changes a byte, this goes red.
 *   3. The runner actually DETECTS drift — a deliberately-broken target is caught, so a green run means
 *      "byte-identical", not "the gate never looks" (the protobuf/gRPC lesson made executable).
 *   4. The #088 identity invariants the golden freezes — a byte-determining param mints a different id.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildGoldenVectors, serialize } from '../../../renderers/module-service/conformance/generate';
import { referenceTarget } from '../../../renderers/module-service/conformance/referenceTarget';
import {
  runConformance,
  compareVector,
  formatReport,
  type ConformanceTarget,
  type ConformanceVector,
} from '../../../renderers/module-service/conformance/runner';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(here, '../../../renderers/module-service/conformance/golden.json');
const committed: ConformanceVector[] = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));

describe('golden vectors — generation is deterministic & in sync', () => {
  it('regenerates byte-identically (deterministic — no AI, no clock, no randomness)', async () => {
    const a = serialize(await buildGoldenVectors());
    const b = serialize(await buildGoldenVectors());
    expect(a).toBe(b);
  });

  it('matches the committed golden.json (drift gate — run `npm run gen:maas-conformance` if this fails)', async () => {
    const fresh = serialize(await buildGoldenVectors());
    expect(readFileSync(GOLDEN_PATH, 'utf8')).toBe(fresh);
  });

  it('covers every serve-path IR response status', () => {
    const statuses = [...new Set(committed.map((v) => v.expect.status))].sort((x, y) => x - y);
    // 500 (the injected transform throwing) is exercised by the handler unit suite, not a golden vector
    // (it has no stable body to freeze); every other IR row is covered here.
    expect(statuses).toEqual([200, 302, 304, 400, 404]);
  });
});

describe('reference implementation conforms to its golden vectors', () => {
  it('passes all golden vectors with zero mismatches', async () => {
    const report = await runConformance(referenceTarget, committed);
    expect(formatReport(report)).toContain(`${committed.length}/${committed.length}`);
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(committed.length);
  });
});

describe('the runner detects drift (the gate is not vacuous)', () => {
  /** A target that corrupts every response by appending a byte — must fail every vector. */
  const brokenTarget: ConformanceTarget = {
    name: 'broken (appends a stray byte)',
    async run(vector) {
      const actual = await referenceTarget.run(vector);
      return { ...actual, body: `${actual.body}X` };
    },
  };

  it('flags a byte-level body difference on every vector', async () => {
    const report = await runConformance(brokenTarget, committed);
    expect(report.failed).toBe(committed.length);
    expect(report.passed).toBe(0);
    const flat = report.results.flatMap((r) => r.mismatches.map((m) => m.field));
    expect(flat).toContain('bodyHash');
    expect(formatReport(report)).toContain('✗');
  });

  it('flags a wrong status code', async () => {
    const wrongStatus: ConformanceTarget = {
      name: 'wrong-status',
      async run(vector) {
        const actual = await referenceTarget.run(vector);
        return { ...actual, status: actual.status === 200 ? 503 : actual.status };
      },
    };
    const served = committed.find((v) => v.expect.status === 200)!;
    const result = await compareVector(served, await wrongStatus.run(served));
    expect(result.pass).toBe(false);
    expect(result.mismatches.some((m) => m.field === 'status')).toBe(true);
  });

  it('flags a missing contract header (a dropped Cache-Control)', async () => {
    const served = committed.find((v) => v.expect.status === 200)!;
    const actual = await referenceTarget.run(served);
    const stripped = { ...actual, headers: { ...actual.headers } };
    delete (stripped.headers as Record<string, string>)['Cache-Control'];
    const result = await compareVector(served, stripped);
    expect(result.mismatches.some((m) => m.field === 'header:Cache-Control')).toBe(true);
  });
});

describe('#088 identity invariants frozen in the golden', () => {
  it('mints a different content-hash id when a byte-determining param (target) moves', () => {
    const base = committed.find((v) => v.name === 'hash-pin-served-immutable')!;
    const withTarget = committed.find((v) => v.name === 'param-target-changes-id')!;
    expect(base.expect.headers.ETag).toBeTruthy();
    expect(withTarget.expect.headers.ETag).toBeTruthy();
    expect(withTarget.expect.headers.ETag).not.toBe(base.expect.headers.ETag);
    // Same authored source ⇒ same served bytes ⇒ same SRI integrity, even though the id differs.
    expect(withTarget.expect.headers['X-MaaS-Integrity']).toBe(base.expect.headers['X-MaaS-Integrity']);
  });

  it('serves every resolved artifact with a sha256 ETag and SRI integrity', () => {
    for (const v of committed.filter((x) => x.expect.status === 200)) {
      expect(v.expect.headers.ETag).toMatch(/^"sha256-[A-Za-z0-9_-]+"$/);
      expect(v.expect.headers['X-MaaS-Integrity']).toMatch(/^sha256-[A-Za-z0-9+/]+=*$/);
    }
  });
});
