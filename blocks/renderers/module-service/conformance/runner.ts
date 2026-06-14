/**
 * @file blocks/renderers/module-service/conformance/runner.ts
 * @description The MaaS cross-language conformance runner — the language-neutral gate (backlog #506,
 * ratified in #463 fork c).
 *
 * The serve-path IR (`../servePathIR.ts`, #505) is the contract; the JS Fetch origin
 * (`../fetchHandler.ts`, #461) is its reference implementation. This runner is the third leg #463
 * ratified: a **deterministic** conformance gate that drives ANY origin target against a frozen set of
 * golden vectors and asserts byte-identical / identity-stable fidelity. The fidelity check lives HERE,
 * once, for every language — not as per-language ad-hoc tests (the protobuf/gRPC lesson: one spec, 0 vs
 * 1,847 failures depending on whether a shared conformance suite gates it). It is orthogonal to the
 * generation mechanism (#507): whatever emits a .NET / Java / Go origin, THIS is what makes it safe.
 *
 * Neutrality: this module is pure data + comparison logic over Web-standard `crypto.subtle`. It knows
 * nothing about how a target is implemented — a {@link ConformanceTarget} is just `(vector) =>
 * Promise<ActualResponse>`. The JS reference is one target (`./referenceTarget.ts`); a generated origin
 * is driven via a subprocess target that reads the very same `golden.json`.
 */

import type { ServeResult } from '../moduleService';

// ── The golden vector shape — the portable artifact (`golden.json`) ──────────────────
//
// A golden vector is fully self-describing: the origin state to seed (`fixture`), the request to issue
// (`request`, with every content-hash already baked in), and the exact response any conforming origin
// must produce (`expect`). A non-JS origin reads this JSON unchanged — no TypeScript needed.

/** A served-artifact transform output, frozen per vector so the suite is DOM-free + deterministic. */
export interface VectorTransform {
  readonly code: string;
  readonly language: ServeResult['language'];
  readonly lossy: boolean;
  readonly diagnostics: readonly string[];
}

/** The deterministic origin state a vector is evaluated against — what any target seeds before serving. */
export interface VectorFixture {
  /** The component name the resolver knows. */
  readonly component: string;
  /** The authored `<component>` source the resolver returns for {@link component}. */
  readonly definition: string;
  /** `X-MaaS-Producer` value, folded into the identity hash (#088 §3). */
  readonly producer: string;
  /** The injected transform's frozen output for this fixture (the orthogonal, generation-mechanism half). */
  readonly transform: VectorTransform;
}

/** A request to issue against a seeded origin. In a golden vector every `{id}` is already substituted. */
export interface VectorRequest {
  /** Path (or absolute URL) to request. `{id}` placeholders are resolved at golden-generation time. */
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
}

/** The frozen expected response — the golden bytes every origin must reproduce exactly. */
export interface VectorExpectation {
  readonly status: number;
  /** Only the IR-relevant headers ({@link OBSERVED_HEADERS}) that were present, by exact name. */
  readonly headers: Readonly<Record<string, string>>;
  /** The exact response body bytes (as text) — empty string for a 302 / 304. */
  readonly body: string;
  /** `sha256-<base64>` over {@link body} — the byte-identity assertion a reviewer can eyeball. */
  readonly bodyHash: string;
}

/** One complete golden vector: seed + request + the response it must produce. */
export interface ConformanceVector {
  readonly name: string;
  readonly description: string;
  readonly fixture: VectorFixture;
  readonly request: VectorRequest;
  readonly expect: VectorExpectation;
}

/** The normalized response a target returns — status + observed headers + raw body bytes (as text). */
export interface ActualResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/**
 * An origin under test. The JS reference is `referenceTarget`; a generated .NET/Java/Go origin is a
 * subprocess target. The runner seeds `vector.fixture`, issues `vector.request`, and the target returns
 * exactly what its origin produced — the runner owns the comparison, so every target is held to one rule.
 */
export interface ConformanceTarget {
  readonly name: string;
  run(vector: ConformanceVector): Promise<ActualResponse>;
}

/**
 * The IR-relevant response headers the gate observes, by exact wire name. A target that emits a spurious
 * one of these (or drops one) fails — this is the bounded header set the byte-identity rule covers, so a
 * target's incidental headers (Date, Content-Length) are ignored while every contract header is asserted.
 */
export const OBSERVED_HEADERS: readonly string[] = Object.freeze([
  'Content-Type',
  'Cache-Control',
  'ETag',
  'Location',
  'X-MaaS-Producer',
  'X-MaaS-Integrity',
  'X-MaaS-Lossy',
  'X-MaaS-Diagnostic',
]);

// ── Body hashing — the byte-identity primitive, one algorithm for every target ───────

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** `sha256-<base64>` over the response body bytes. The runner computes it so every target uses one algorithm. */
export async function hashBody(body: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  return `sha256-${toBase64(new Uint8Array(digest))}`;
}

// ── Comparison — the deterministic verdict ───────────────────────────────────────────

/** One field on which a target's response diverged from the golden vector. */
export interface VectorMismatch {
  readonly field: string;
  readonly expected: string;
  readonly actual: string;
}

/** The verdict for one vector against one target. */
export interface VectorResult {
  readonly name: string;
  readonly pass: boolean;
  readonly mismatches: readonly VectorMismatch[];
}

/** Compare a target's response to a golden vector, field by field. Empty mismatches ⇒ conformant. */
export async function compareVector(
  vector: ConformanceVector,
  actual: ActualResponse,
): Promise<VectorResult> {
  const mismatches: VectorMismatch[] = [];
  const { expect } = vector;

  if (actual.status !== expect.status)
    mismatches.push({ field: 'status', expected: String(expect.status), actual: String(actual.status) });

  // Compare the observed-header set exactly: every expected header must match, and no observed header
  // may appear that the golden didn't record (a spurious contract header is drift).
  for (const name of OBSERVED_HEADERS) {
    const exp = expect.headers[name];
    const act = actual.headers[name];
    if (exp === undefined && act === undefined) continue;
    if (exp !== act)
      mismatches.push({ field: `header:${name}`, expected: exp ?? '(absent)', actual: act ?? '(absent)' });
  }

  if (actual.body !== expect.body)
    mismatches.push({ field: 'body', expected: truncate(expect.body), actual: truncate(actual.body) });

  const actualHash = await hashBody(actual.body);
  if (actualHash !== expect.bodyHash)
    mismatches.push({ field: 'bodyHash', expected: expect.bodyHash, actual: actualHash });

  return { name: vector.name, pass: mismatches.length === 0, mismatches };
}

const truncate = (s: string, max = 120): string => (s.length > max ? `${s.slice(0, max)}…` : s);

/** The full report for a target across the whole vector suite. */
export interface ConformanceReport {
  readonly target: string;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly results: readonly VectorResult[];
}

/** Drive a target through every golden vector and tally the verdict. Deterministic — no AI, no network. */
export async function runConformance(
  target: ConformanceTarget,
  vectors: readonly ConformanceVector[],
): Promise<ConformanceReport> {
  const results: VectorResult[] = [];
  for (const vector of vectors) {
    let actual: ActualResponse;
    try {
      actual = await target.run(vector);
    } catch (e) {
      results.push({
        name: vector.name,
        pass: false,
        mismatches: [{ field: 'threw', expected: '(a response)', actual: (e as Error).message }],
      });
      continue;
    }
    results.push(await compareVector(vector, actual));
  }
  const passed = results.filter((r) => r.pass).length;
  return { target: target.name, total: results.length, passed, failed: results.length - passed, results };
}

/** A one-line-per-failure human summary — what a CI log prints when a target drifts. */
export function formatReport(report: ConformanceReport): string {
  const lines = [`${report.target}: ${report.passed}/${report.total} vectors conformant`];
  for (const r of report.results) {
    if (r.pass) continue;
    lines.push(`  ✗ ${r.name}`);
    for (const m of r.mismatches) lines.push(`      ${m.field}: expected ${m.expected} · got ${m.actual}`);
  }
  return lines.join('\n');
}
