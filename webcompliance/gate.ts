/**
 * @file webcompliance/gate.ts
 * @description Web Compliance gate runner — backlog #437 (phase 2 of #351), built on the #436 policy/rule
 *   model. The escalation of a conformance *measure* to an enforced *hard rule*: a declared, severity-aware
 *   gate that blocks CI on a policy violation — the generalization of the benchmark's `--strict` seed.
 *
 * Two pieces:
 *   - The **policy model** (the #436 artifact, as TS): a {@link CompliancePolicy} is a versioned set of
 *     {@link PolicyRule}s, each promoting a conformance `measure` to a hard rule at a `severity` and
 *     `threshold`. A project policy {@link resolvePolicy `extends`} a fully-defined platform-default
 *     baseline (config-extends-platform-default) — it authors only its deltas.
 *   - The **gate** ({@link runGate}): evaluate measured conformance signals against the resolved policy and
 *     return a {@link GateResult}. A `block`-severity violation **fails** the gate (CI exits non-zero);
 *     `error`/`warn` are reported but don't fail; `off` disables a rule. The verdict is *data*, so a
 *     runner, a report (Web Reporting), and an audit trail all consume the same result.
 *
 * Pure + dependency-free: no process exit, no I/O — the caller maps {@link GateResult.blocked} to an exit
 * code and feeds it to a reporter. Deterministic and testable.
 */

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
  /** The baseline policy this builds on (resolved by {@link resolvePolicy}). */
  readonly extends?: CompliancePolicy;
  readonly rules: readonly PolicyRule[];
}

/** A measured conformance signal the gate evaluates rules against. */
export interface Measure {
  readonly measure: string;
  readonly value: number | string;
}

/**
 * Resolve a policy against its `extends` chain into a flat rule list: baseline first, then each override
 * layer, a later rule **replacing** an earlier rule of the same `id` (the project's delta wins). The same
 * "baseline ⊕ overrides, nearest wins" shape as every Web Everything config layer.
 */
export function resolvePolicy(policy: CompliancePolicy): PolicyRule[] {
  const chain: CompliancePolicy[] = [];
  for (let p: CompliancePolicy | undefined = policy; p; p = p.extends) chain.unshift(p); // baseline → leaf
  const byId = new Map<string, PolicyRule>();
  for (const layer of chain) for (const rule of layer.rules) byId.set(rule.id, rule);
  return [...byId.values()];
}

/** A level string like `L2` → its numeric rank (2); non-level strings → NaN. */
function levelRank(v: string): number {
  const m = /^L(\d+)$/.exec(v);
  return m ? Number(m[1]) : NaN;
}

/**
 * Does `measured` clear `threshold`? Numeric → `measured >= threshold`. `L<n>` levels → rank comparison.
 * Other strings → equality. A missing threshold → presence (any defined, non-empty measured value passes).
 */
export function clears(measured: number | string | undefined, threshold: number | string | undefined): boolean {
  if (threshold === undefined) return measured !== undefined && measured !== '';
  if (measured === undefined) return false;
  if (typeof threshold === 'number') return typeof measured === 'number' && measured >= threshold;
  const tRank = levelRank(threshold);
  if (!Number.isNaN(tRank)) {
    const mRank = typeof measured === 'string' ? levelRank(measured) : Number(measured);
    return !Number.isNaN(mRank) && mRank >= tRank;
  }
  return String(measured) === threshold;
}

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
  /** Override the pass test for a measure (e.g. a domain-specific comparator). Defaults to {@link clears}. */
  readonly clears?: (measured: number | string | undefined, threshold: number | string | undefined) => boolean;
}

/**
 * Run the gate: evaluate the resolved policy against the measured conformance signals. Each enabled rule
 * (severity ≠ `off`) checks its `measure` against its `threshold`; a failure is a {@link GateViolation}.
 * The gate is **blocked** iff any `block`-severity rule was violated. Pure — the caller decides the exit
 * code and the report.
 */
export function runGate(
  policy: CompliancePolicy,
  measures: readonly Measure[],
  opts: RunGateOptions = {},
): GateResult {
  const test = opts.clears ?? clears;
  const measured = new Map(measures.map((m) => [m.measure, m.value]));
  const evaluated = resolvePolicy(policy).filter((r) => r.severity !== 'off');

  const violations: GateViolation[] = [];
  for (const rule of evaluated) {
    const value = measured.get(rule.measure);
    if (!test(value, rule.threshold)) {
      violations.push({
        rule,
        measured: value,
        reason: value === undefined ? 'missing-measure' : 'below-threshold',
      });
    }
  }

  const blocked = violations.some((v) => v.rule.severity === 'block');
  return { passed: !blocked, blocked, violations, evaluated };
}
