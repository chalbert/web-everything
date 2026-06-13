/**
 * @file webcases/driftCheck.ts
 * @description Mock-vs-real drift check — backlog #334, the verification half of the #107 Fork-3
 *   ruling: **one contract, two uses.** The same interaction-bearing artifact that *mocks* an endpoint
 *   (the `mock-contract` protocol, #331, owned by the `webcases` project) is *verified* against the
 *   live service, so a mock that has silently drifted from reality is caught. `webcases` is the
 *   verification home because schema-validation ≠ contract-verification: a real response can be
 *   schema-valid yet no longer match what the mock promised.
 *
 * **Web Everything owns the comparison, not the transport.** The *recorded real response* comes from
 * the dev-server provider's `record` mode (#332, `frontierui/tools/mock-server`) — that lives in
 * Frontier UI and is **never imported here** (@webeverything never depends on Frontier UI). The caller
 * passes the recorded response in; this core is a pure, dependency-free structural comparison of the
 * **declared** response (what the mock returns) against the **observed** one (what the real service
 * returned), reporting every divergence with a JSON-Pointer to where it sits.
 *
 * Drift is *structural*, not value-level: a real API legitimately returns different field *values*, so
 * comparing values would be all false positives. What must not change without notice is the *shape* —
 * the status code, which fields exist, and their types. That is exactly the contract a mock encodes.
 */

/** A response as recorded from the real service (the dev-server `record` mode output, injected). */
export interface RecordedResponse {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

/** The response a mock declares for an interaction — the exemplar the mock returns. Same shape. */
export interface ContractResponse {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

/** One way the real response diverged from the contract. */
export interface DriftFinding {
  readonly kind: 'status' | 'missing-field' | 'extra-field' | 'type-mismatch' | 'content-type';
  /** RFC 6901-style JSON-Pointer to the body location (`''` for the whole response / status / headers). */
  readonly pointer: string;
  readonly expected?: string;
  readonly actual?: string;
}

export interface DriftReport {
  readonly drifted: boolean;
  readonly findings: DriftFinding[];
}

/** The structural type of a JSON value — the unit drift is measured in. */
type JsonType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'undefined';
function jsonType(v: unknown): JsonType {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  return t === 'object' ? 'object' : (t as JsonType);
}

const escapeToken = (k: string) => k.replace(/~/g, '~0').replace(/\//g, '~1');

/** Walk both trees in lockstep, recording missing/extra fields and type mismatches by JSON-Pointer. */
function diffShape(expected: unknown, actual: unknown, pointer: string, out: DriftFinding[]): void {
  const te = jsonType(expected);
  const ta = jsonType(actual);
  if (te !== ta) {
    out.push({ kind: 'type-mismatch', pointer: pointer || '/', expected: te, actual: ta });
    return; // a type change at this node makes a deeper diff meaningless
  }
  if (te === 'object') {
    const eo = expected as Record<string, unknown>;
    const ao = actual as Record<string, unknown>;
    for (const key of Object.keys(eo)) {
      const p = `${pointer}/${escapeToken(key)}`;
      if (!(key in ao)) out.push({ kind: 'missing-field', pointer: p, expected: jsonType(eo[key]) });
      else diffShape(eo[key], ao[key], p, out);
    }
    for (const key of Object.keys(ao)) {
      if (!(key in eo)) out.push({ kind: 'extra-field', pointer: `${pointer}/${escapeToken(key)}`, actual: jsonType(ao[key]) });
    }
  } else if (te === 'array') {
    // Arrays are homogeneous by contract: compare the real elements against the contract's first
    // exemplar element (an empty contract array asserts nothing about element shape).
    const ea = expected as unknown[];
    const aa = actual as unknown[];
    if (ea.length > 0) aa.forEach((el, i) => diffShape(ea[0], el, `${pointer}/${i}`, out));
  }
}

/**
 * Compare a recorded real response against the contract's declared response, returning every structural
 * drift. Checks: the status code, the body shape (missing/extra fields + type mismatches, by
 * JSON-Pointer), and — when the contract declares a `content-type` — that the real one matches (header
 * names compared case-insensitively, parameters like `; charset` ignored). `drifted` is true iff any
 * finding exists.
 */
export function detectDrift(expected: ContractResponse, actual: RecordedResponse): DriftReport {
  const findings: DriftFinding[] = [];

  if (expected.status !== actual.status)
    findings.push({ kind: 'status', pointer: '', expected: String(expected.status), actual: String(actual.status) });

  const expectedCt = headerValue(expected.headers, 'content-type');
  if (expectedCt !== undefined) {
    const actualCt = headerValue(actual.headers, 'content-type');
    if (mediaType(actualCt) !== mediaType(expectedCt))
      findings.push({ kind: 'content-type', pointer: '', expected: mediaType(expectedCt), actual: mediaType(actualCt) ?? 'absent' });
  }

  diffShape(expected.body, actual.body, '', findings);

  return { drifted: findings.length > 0, findings };
}

function headerValue(headers: Readonly<Record<string, string>> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === target) return v;
  return undefined;
}

/** The media type without parameters, lowercased (e.g. `application/json; charset=utf-8` → `application/json`). */
function mediaType(ct: string | undefined): string | undefined {
  return ct === undefined ? undefined : ct.split(';')[0].trim().toLowerCase();
}
