// @webeverything/contracts/repro-bundle — the repro-bundle's pure-contract surface (#1664, epic #1663).
//
// Type-only (zero runtime emit): the serializable SHAPE every layer agrees on for a reproduction bundle —
// the four parts a captured page-state reproduces from. WE owns ONLY this shape (+ the structural
// validator / serializer / JSON schema in the sibling `./schema`, the build-agnostic contract runtime, like
// `conformance-vectors/schema.ts`). The capture mechanism that PRODUCES a bundle is plateau (#1667); the
// viewer that consumes one is FUI; the serializer (#1666) maps a captured trace onto this shape. This is the
// FUI/plateau→WE arrow over which the bundle format resolves — distinct layer from any capture impl, so it
// has no dependency on the capture mechanism (it only fixes the shape both ends speak).
//
// A bundle's four parts (the body of #1664):
//   1. declared-state snapshot — which providers/contexts held what value;
//   2. ordered action trace — the semantic intents/transitions that produced it;
//   3. declared-rules reference — the page's conformance/visibility/validation rules in force; and
//   4. ownership — who owns each node, so the bundle self-routes.

// ── 1. Declared state ──────────────────────────────────────────────────────────────

/** A scope's declared state — `scopeId` (a provider/context seam) → its declared key/values. */
export type ReproDeclaredState = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

/** A point-in-time declared-state snapshot, ordered into the bundle by `seq` (and wall-clock `atMs`). */
export interface ReproStateSnapshot {
  /** Monotonic capture order, from 0 — the total order shared with {@link ReproTraceEvent}. */
  readonly seq: number;
  /** Capture timestamp (ms). */
  readonly atMs: number;
  /** Optional caller label (`'initial'`, `'after-submit'`, …). */
  readonly label?: string;
  readonly state: ReproDeclaredState;
}

// ── 2. Action trace ────────────────────────────────────────────────────────────────

/**
 * One ordered semantic action — an `intent` fired (with optional target/detail) or a state `transition`
 * (from→to, optionally `via` the intent that drove it). `seq`/`atMs` interleave it with the snapshots into
 * one total order.
 */
export type ReproTraceEvent =
  | {
      readonly kind: 'intent';
      readonly seq: number;
      readonly atMs: number;
      readonly intent: string;
      readonly target?: string;
      readonly detail?: Readonly<Record<string, unknown>>;
    }
  | {
      readonly kind: 'transition';
      readonly seq: number;
      readonly atMs: number;
      readonly from: string;
      readonly to: string;
      readonly via?: string;
    };

// ── 3. Declared-rules reference ──────────────────────────────────────────────────────

/** The kind of obligation a referenced rule expresses (mirrors the per-app declared-rule registry, #1689). */
export type ReproRuleKind = 'conformance' | 'visibility' | 'validation';

/**
 * A reference to one declared rule in force on the page — enough to re-resolve it against the live
 * registry/corpus, not a copy of the rule. `vectorIds` records which conformance vectors exercised it at
 * capture time (so a replay can re-run exactly those).
 */
export interface ReproDeclaredRule {
  readonly id: string;
  readonly kind: ReproRuleKind;
  /** The standard/contract package the rule derives from, e.g. `@webeverything/presentation-a11y`. */
  readonly contract: string;
  readonly description?: string;
  /** Conformance vector ids that exercised this rule at capture time. */
  readonly vectorIds?: readonly string[];
}

// ── 4. Ownership ─────────────────────────────────────────────────────────────────────

/** One node→owner edge, so a bundle self-routes to whoever owns the node it reproduces. */
export interface ReproOwnershipEntry {
  /** The node the bundle references (a stable id/locator). */
  readonly nodeId: string;
  /** The owning party (a project/team/module id the bundle routes to). */
  readonly owner: string;
  /** Optional discriminator for the owner kind (`project`, `module`, `team`, …). */
  readonly ownerKind?: string;
}

// ── The bundle envelope ──────────────────────────────────────────────────────────────

/**
 * A complete reproduction bundle — the serializable unit. `version` is the contract version it was written
 * at (see `REPRO_BUNDLE_VERSION` in `./schema`); a reader rejects an incompatible major version. The four
 * parts are independently optional-empty but always present arrays, so a consumer never branches on absence.
 */
export interface ReproBundle {
  /** Contract version the bundle was serialized at (semver). */
  readonly version: string;
  /** When the capture this bundle reproduces started (ms). */
  readonly capturedAtMs: number;
  /** 1 — ordered declared-state snapshots. */
  readonly state: readonly ReproStateSnapshot[];
  /** 2 — ordered semantic action trace. */
  readonly trace: readonly ReproTraceEvent[];
  /** 3 — the declared rules in force, by reference. */
  readonly rules: readonly ReproDeclaredRule[];
  /** 4 — node→owner edges for self-routing. */
  readonly ownership: readonly ReproOwnershipEntry[];
}
