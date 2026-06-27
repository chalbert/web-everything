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
 *
 * The #436 policy/rule model + the gate verdict types ({@link Severity}/{@link PolicyRule}/
 * {@link CompliancePolicy}/{@link Measure}/{@link GateViolation}/{@link GateResult}/{@link RunGateOptions})
 * are the pure-contract half — they live in `./contract.ts` (the `@webeverything/contracts/webcompliance`
 * entry, #1294 C1). Re-exported here so importers reach the types + the runtime from one site (mirrors
 * `webpolicy/enforcement.ts`); the split is at the file seam, not the public surface.
 */
import type {
  CompliancePolicy,
  GateResult,
  GateViolation,
  Measure,
  PolicyRule,
  RunGateOptions,
} from './contract';

export type * from './contract';

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
