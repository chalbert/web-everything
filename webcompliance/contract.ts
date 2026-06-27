/**
 * Web Compliance — the **pure-contract half** (#436 policy/rule model + the #437/#438/#439 gate/waiver/audit
 * result types). Slice C1 of the #1294 relocation cascade ([[project_contract_ts_is_separate_slice]]).
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) so it is the
 * `@webeverything/contracts/webcompliance` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication — exactly like `webpolicy/contract.ts` (#1077). The runtime half — the gate
 * runner (`runGate`/`resolvePolicy`), the waiver machinery (`applyWaivers`/`isActive`), and the audit
 * mapping (`auditToReport`/`recordAudit`) — is impl and relocates to FUI (`fui:webcompliance/`, #1294 C2,
 * per #1282 — WE holds zero executable); the runtime modules `import type` from here and re-export this
 * surface so importers reach types + runtime from one site (mirroring `webpolicy/enforcement.ts`).
 *
 * Web Compliance fixes the **policy/rule meta-schema** — how a conformance measure is promoted to an
 * enforced hard rule, and the shape of the gate verdict / waiver / audit record that results — adopting the
 * #436 model. It standardizes the schema, not the rule list (a project policy `extends` a platform-default
 * baseline and authors only its deltas). The verdict is *data*, so a runner, a report, and an audit trail
 * all consume the same result.
 */

// ── #436 policy/rule model (gate) ────────────────────────────────────────────────

/** Gate severity — `block` fails CI; `error`/`warn` report; `off` disables the rule. */
export type Severity = 'block' | 'error' | 'warn' | 'off';

/** One promoted conformance criterion — a measure enforced at a severity, optionally above a threshold. */
export interface PolicyRule {
  readonly id: string;
  /** The conformance signal this rule promotes, e.g. `'app-conformance:aria-sort'`. */
  readonly measure: string;
  readonly severity: Severity;
  /** Where it applies — a scope tag (project | path glob | app id); informational for the gate. */
  readonly scope?: string;
  /** The bar to clear: a number (`measured >= threshold`) or a level string like `'L2'`. Omitted ⇒ presence. */
  readonly threshold?: number | string;
  /** The policy version this criterion was promoted in. */
  readonly since?: string;
}

/** A versioned policy that `extends` a baseline — the #436 shape. */
export interface CompliancePolicy {
  readonly id: string;
  readonly version: string;
  /** The baseline policy this builds on (resolved by `resolvePolicy`). */
  readonly extends?: CompliancePolicy;
  readonly rules: readonly PolicyRule[];
}

/** A measured conformance signal the gate evaluates rules against. */
export interface Measure {
  readonly measure: string;
  readonly value: number | string;
}

// ── #437 gate verdict ────────────────────────────────────────────────────────────

/** A rule the measured signals failed to satisfy. */
export interface GateViolation {
  readonly rule: PolicyRule;
  /** The value measured for the rule's `measure` (undefined ⇒ the signal was absent). */
  readonly measured: number | string | undefined;
  readonly reason: 'below-threshold' | 'missing-measure';
}

export interface GateResult {
  /** True iff no `block`-severity rule was violated (CI may proceed). */
  readonly passed: boolean;
  /** True iff a `block`-severity rule was violated (CI must fail). */
  readonly blocked: boolean;
  /** Every violated rule (any severity except `off`), in resolved-policy order. */
  readonly violations: readonly GateViolation[];
  /** The resolved rules that were evaluated (after `extends`, excluding `off`). */
  readonly evaluated: readonly PolicyRule[];
}

export interface RunGateOptions {
  /** Override the pass test for a measure (e.g. a domain-specific comparator). Defaults to the built-in `clears`. */
  readonly clears?: (measured: number | string | undefined, threshold: number | string | undefined) => boolean;
}

// ── #438 waivers ─────────────────────────────────────────────────────────────────

/** A tracked, expiring, audited override of one policy rule's violation. */
export interface Waiver {
  /** The {@link PolicyRule.id} this waives. */
  readonly ruleId: string;
  /** Who granted the waiver — the accountable party. */
  readonly who: string;
  /** Why it was granted — the justification on record. */
  readonly why: string;
  /** Expiry — an ISO date (`YYYY-MM-DD` or full timestamp). On/after `now` the waiver is inert. */
  readonly until: string;
  /** Optional scope note, carried for the audit record (mirrors {@link PolicyRule.scope}). */
  readonly scope?: string;
}

/** A violation suppressed by an active waiver — kept for the audit trail, not counted as failing. */
export interface WaivedViolation extends GateViolation {
  readonly waiver: Waiver;
}

/** The gate verdict after waivers are applied. */
export interface WaiveredGateResult {
  /** True iff no *unwaived* `block`-severity rule was violated (CI may proceed). */
  readonly passed: boolean;
  /** True iff an *unwaived* `block`-severity rule was violated (CI must fail). */
  readonly blocked: boolean;
  /** Violations that remain after waivers (an active waiver removed the rest). */
  readonly violations: readonly GateViolation[];
  /** Violations suppressed by an active waiver — the audit trail (who/why/until). */
  readonly waived: readonly WaivedViolation[];
  /** Waivers that were present but expired (`until <= now`) — surfaced for renewal/removal, never silent. */
  readonly expiredWaivers: readonly Waiver[];
  /** The resolved rules that were evaluated (unchanged from the input result). */
  readonly evaluated: readonly PolicyRule[];
}

// ── #439 audit record ────────────────────────────────────────────────────────────

/** A gate verdict in either form — the raw {@link GateResult} or the post-waiver {@link WaiveredGateResult}. */
export type AnyGateResult = GateResult | WaiveredGateResult;

/**
 * One enforcement event: the policy that was enforced (id + version), when, and its verdict. This is the
 * unit the audit trail records and `auditToReport` renders — the defensible "what/when/version/result".
 */
export interface AuditRecord {
  /** The policy enforced — its id. */
  readonly policyId: string;
  /** The policy version enforced (the "which standard version" of the record). */
  readonly policyVersion: string;
  /** When enforcement ran — an ISO timestamp, passed in (no clock read). */
  readonly at: string;
  /** The gate verdict (raw or post-waiver). */
  readonly result: AnyGateResult;
}

export interface AuditToReportOptions {
  /**
   * Emit a `pass` finding for every evaluated rule that was *not* violated (the full defensible record).
   * Default `true` — an audit trail records what passed, not only what failed. Set `false` for a
   * failures-only view.
   */
  readonly includePasses?: boolean;
}
