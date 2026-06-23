/**
 * webcontexts — the declared **per-seam value-contract**, pure-contract half (#1700; standard webcontexts,
 * adjacent to #237).
 *
 * Types and interfaces only: fully **compile-erased** (no runtime emit) so it can become the
 * `@webeverything/contracts/webcontexts` entry (#872/#874) — like `identity/contract.ts` and
 * `permissions/contract.ts`. webcontexts already ships the runtime (claim/negotiation/lookup
 * #1091/#1115/#1117) and introspection already emits provider-consumer edges (#400), but **neither declares
 * the value SHAPE a seam promises**. This is that missing piece: the declared shape each provider/context
 * seam's value must conform to, exposed introspectably so the live contract/data inspector (#1632/#1697)
 * can validate the *actual* value crossing a seam against the *declared* shape and flag the **offending
 * path** on drift. The inspector consumes this; it does not own it. Distinct from the over-time/snapshot
 * half of #1632 (separately gated on the trace substrate #1667 — this is the static per-seam shape).
 *
 * The {@link ValueShape} vocabulary is deliberately a small, declarative, JSON-serializable tree (not a
 * code predicate) so it is introspectable and a drift can be reported at a precise {@link SeamValueDrift.path}.
 */

/**
 * A declarative description of an expected value — a small structural tree the inspector walks against an
 * actual value to report path-level drift. JSON-serializable (no predicates), so a seam's promised shape is
 * itself introspectable data.
 */
export type ValueShape =
  | PrimitiveShape
  | ObjectShape
  | ArrayShape
  | UnionShape
  | AnyShape;

/** Shared on every shape: whether the value may be absent/`undefined` at this position. */
export interface ShapeBase {
  readonly optional?: boolean;
  /** Optional human note shown in the inspector when this position drifts. */
  readonly description?: string;
}

/** A primitive-typed leaf — the `typeof` family plus the JSON `null`. */
export interface PrimitiveShape extends ShapeBase {
  readonly kind: 'primitive';
  readonly type: 'string' | 'number' | 'boolean' | 'null' | 'bigint' | 'symbol' | 'function';
}

/** An object with a declared field shape per key. `exact` rejects unexpected extra keys (default: allow). */
export interface ObjectShape extends ShapeBase {
  readonly kind: 'object';
  readonly fields: Readonly<Record<string, ValueShape>>;
  /** When true, an actual key not in `fields` is a drift (`extra`); default allows extra keys. */
  readonly exact?: boolean;
}

/** A homogeneous array — every element must conform to `items`. */
export interface ArrayShape extends ShapeBase {
  readonly kind: 'array';
  readonly items: ValueShape;
}

/** A value that may take any one of several shapes (conforms if at least one matches). */
export interface UnionShape extends ShapeBase {
  readonly kind: 'union';
  readonly anyOf: readonly ValueShape[];
}

/** An unconstrained value — any shape conforms (an explicit "not validated here" escape). */
export interface AnyShape extends ShapeBase {
  readonly kind: 'any';
}

/**
 * The contract one provider/context seam promises for its value: the seam id (the context key the
 * provider-consumer edge is keyed by, #400) and the declared {@link ValueShape} its value must conform to.
 */
export interface SeamValueContract {
  /** The seam id — the context key the provider/consumer edge is keyed on. */
  readonly seam: string;
  /** The declared shape the value crossing this seam must conform to. */
  readonly value: ValueShape;
  readonly description?: string;
}

/** The set of declared per-seam value contracts in force on a page — what the inspector enumerates. */
export type ContextValueContracts = readonly SeamValueContract[];

/** Why an actual value drifted from its declared shape at a path. */
export type SeamValueDriftKind = 'missing' | 'extra' | 'type-mismatch';

/**
 * One drift the inspector reports: the seam, the precise path to the offending node, and what was expected
 * vs. seen. `path` is dot/bracket JSON-path-ish (`''` = the seam root, `user.roles[0]` = a nested leaf), so
 * the inspector can highlight the exact offending node — the core ask of #1632/#1697.
 */
export interface SeamValueDrift {
  readonly seam: string;
  readonly path: string;
  readonly kind: SeamValueDriftKind;
  /** A structural description of the declared shape at `path` (e.g. `"string"`, `"object"`). */
  readonly expected: string;
  /** A description of the actual value/type seen at `path` (e.g. `"number"`, `"undefined"`). */
  readonly actual: string;
}

/** The inspector's verdict for one seam: conformant, or the list of drifts found. */
export interface SeamValidationResult {
  readonly seam: string;
  readonly ok: boolean;
  readonly drifts: readonly SeamValueDrift[];
}
