/**
 * Behavioral conformance-vector **schema** (#1016, the substrate for the #899 conformance KIT).
 *
 * The audit (§10) found that none of the 12 implemented standards ships a behavioral conformance vector
 * set — only unit tests of the impl, which prove the *current build* works, not that *any* build meets
 * the spec. A conformance vector closes that: declarative data describing a setup, a (possibly *timed*)
 * interaction script, and the **observable** outcome read through the platform surface (DOM / ARIA /
 * events / validity), **never impl internals** — so "is this impl conformant?" becomes checkable rather
 * than asserted, independent of how the component is built (#899).
 *
 * This module is the WE-owned, build-agnostic half: the vector **shape** + a dependency-free structural
 * **validator**. The runtime *driver* that executes a vector's steps against a candidate component and
 * judges the observable outcome lives in plateau/FUI per #899 (#817 split · #091 hosted→plateau) — it
 * consumes this schema, it is not defined here. Sibling of `wrapper-conformance/` (the per-wrapper
 * instance of the same golden-vectors model, #506/#891); this generalizes it to any standard.
 */

/**
 * One step of a vector's interaction script. `do` is the action verb the driver dispatches (`setInput`,
 * `beginAsync`, `setSource`, `enterRegion`, …); the remaining keys are action-specific arguments. `atMs`
 * is present only for the **temporal** case — a vector that must run a controllable clock (e.g. proving a
 * stale async result is dropped); omit it for synchronous steps.
 */
export interface ConformanceStep {
  /** The action verb the driver dispatches. */
  readonly do: string;
  /** Virtual-clock offset (ms) for temporal vectors; omitted = synchronous / order-only. */
  readonly atMs?: number;
  /** Action-specific arguments (field, value, token, settlesInMs, …). */
  readonly [arg: string]: unknown;
}

/**
 * The observable outcome a conformant component must produce — read only through the platform surface.
 * `finalState`/`aria`/`validity` assert end-state; `neverObserved` is the temporal guard (a rendering
 * that must *never* appear at any point, e.g. a stale async message) the driver checks across the run.
 */
export interface ConformanceExpectation {
  /** The terminal observable state (contract vocabulary, not an impl field). */
  readonly finalState?: string;
  /** Observable outcomes that must never appear during the run (the temporal guard). */
  readonly neverObserved?: ReadonlyArray<Record<string, unknown>>;
  /** Expected ARIA attribute values on the final component. */
  readonly aria?: Record<string, string>;
  /** Other observable assertions (validity, renderedMessage, …). */
  readonly [assertion: string]: unknown;
}

/**
 * One behavioral conformance vector — a stable id, the contract it exercises, the interaction script, the
 * observable expectation, and the platform surfaces through which the outcome is read.
 */
export interface ConformanceVector {
  /** Stable, hierarchical id — `<standard>/<feature>/<case>` (used in the conformance report). */
  readonly id: string;
  /** The contract package the vector judges, e.g. `@webeverything/validator-resolution`. */
  readonly contract: string;
  /** The (possibly timed) interaction script. */
  readonly steps: ReadonlyArray<ConformanceStep>;
  /** The observable outcome a conformant component must produce. */
  readonly expect: ConformanceExpectation;
  /** Platform surfaces the outcome is read through (`aria`, `renderedMessage`, `validity`, `events`, …). */
  readonly observeVia: ReadonlyArray<string>;
  /**
   * Optional conformance tier the outcome is asserted at (the fixed WE tier vocabulary). Carried by vectors
   * lowered from a webcases requirement (#1162, ruling #1233-A) so a tiered conformance run can scope which
   * vectors apply; absent on hand-authored vectors. The only schema change #1162 introduces.
   */
  readonly tier?: string;
  /** Optional human-facing note on what the vector proves. */
  readonly description?: string;
}

/** A per-standard corpus — the unit a standard ships and the #899 driver runs against a candidate. */
export interface ConformanceVectorSuite {
  /** The standard this suite covers, e.g. `validator-resolution`. */
  readonly standard: string;
  /** The contract package every vector in the suite judges. */
  readonly contract: string;
  /** The vectors. */
  readonly vectors: ReadonlyArray<ConformanceVector>;
}

/** A vector suite failed the structural schema (a malformed corpus the driver would mis-run). */
export class ConformanceSchemaError extends Error {
  constructor(suite: string, why: string) {
    super(`Conformance vector suite "${suite}" is malformed: ${why}`);
    this.name = 'ConformanceSchemaError';
  }
}

/**
 * Dependency-free structural validator — the WE half of the KIT's "schema + verifier". Asserts a suite is
 * well-formed (so the FUI/plateau driver can run it without defensive parsing): a `standard`/`contract`,
 * at least one vector, each vector with a non-empty `id`/`contract`/`steps`/`observeVia` and an `expect`,
 * unique ids, and every step carrying a `do` verb. Returns the suite typed when valid; throws
 * `ConformanceSchemaError` otherwise. It validates *shape*, never the build — judging the observable
 * outcome is the driver's job.
 */
export function assertConformanceSuite(suite: ConformanceVectorSuite): ConformanceVectorSuite {
  const label = suite?.standard ?? '(unknown)';
  if (!suite || typeof suite !== 'object') throw new ConformanceSchemaError(label, 'not an object');
  if (!suite.standard) throw new ConformanceSchemaError(label, '`standard` is required');
  if (!suite.contract) throw new ConformanceSchemaError(label, '`contract` is required');
  if (!Array.isArray(suite.vectors) || suite.vectors.length === 0)
    throw new ConformanceSchemaError(label, '`vectors` must be a non-empty array');

  const seen = new Set<string>();
  for (const vector of suite.vectors) {
    if (!vector.id) throw new ConformanceSchemaError(label, 'a vector is missing `id`');
    if (seen.has(vector.id)) throw new ConformanceSchemaError(label, `duplicate vector id "${vector.id}"`);
    seen.add(vector.id);
    if (!vector.contract) throw new ConformanceSchemaError(label, `vector "${vector.id}" missing \`contract\``);
    if (!Array.isArray(vector.steps) || vector.steps.length === 0)
      throw new ConformanceSchemaError(label, `vector "${vector.id}" has no \`steps\``);
    for (const step of vector.steps) {
      if (!step || typeof step.do !== 'string' || step.do.length === 0)
        throw new ConformanceSchemaError(label, `vector "${vector.id}" has a step with no \`do\` verb`);
    }
    if (!vector.expect || typeof vector.expect !== 'object')
      throw new ConformanceSchemaError(label, `vector "${vector.id}" missing \`expect\``);
    if (!Array.isArray(vector.observeVia) || vector.observeVia.length === 0)
      throw new ConformanceSchemaError(label, `vector "${vector.id}" must declare at least one \`observeVia\` surface`);
  }
  return suite;
}
