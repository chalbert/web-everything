/**
 * @file webpolicy/enforcement.ts
 * @description Web Policy enforcement seam — backlog #408 (Fork 3 of the #093 ruling): the OPA-style
 *   **PDP / PEP** pattern, runtime baseline. Built on the #406 DMN-aligned rule meta-schema and the
 *   #407 proof-of-compliance chain ({@link ./proof}).
 *
 * Three pieces, mirroring the OPA decision-point / enforcement-point split:
 *
 *   - **PDP — {@link PolicyDecisionPoint}.** Evaluates a {@link PolicyRuleSet} against a set of *facts*
 *     (the data references the rule names — resolved by the caller from Web Contexts) and returns a
 *     {@link Verdict}, applying the DMN **hit policy** (UNIQUE / FIRST / PRIORITY / COLLECT) to combine
 *     matching rules. The PDP is **pure** — facts in, verdict out — so the *same* decision logic serves
 *     every venue (runtime, build-time, gate).
 *   - **PEP — {@link PolicyEnforcementPoint}.** Attaches at an action/component, asks the PDP, **enforces**
 *     the verdict (permit → allow, otherwise deny), and at the **runtime** venue appends a
 *     {@link ProofRecordInput proof record} to the #407 hash chain, anchored to a Web Traces span. Runtime
 *     is the baseline proof-emitting venue — the only one that proves a rule actually ran *for a given
 *     user + action*; build-time and gate venues reuse the same PDP without the proof sink.
 *   - **Rule evaluator — {@link RuleEvaluator}.** The PDP matches a rule's `when` cells through a swappable
 *     evaluator, because **the PDP/PEP is the PATTERN; the policy language (OPA/Rego vs Cedar vs DMN/FEEL)
 *     is a build choice** (#093 ruling). The built-in {@link comparatorEvaluator} covers the common
 *     comparator cells; a project swaps in Rego/Cedar behind the same interface with no PEP change.
 *
 * Pure + dependency-free: the clock, the proof `hash`/`signer`, and the fact source are all injected.
 */
import type { ProofChain, ProofRecordInput } from './proof';
import type { Facts, PolicyRule, PolicyRuleSet, RuleEvaluator, Verdict } from './contract';

// The #406 rule meta-schema (HitPolicy/InputEntry/OutputEntry/PolicyRule/PolicyRuleSet/Facts/
// RuleEvaluator/Verdict) is the pure-contract half — it lives in `./contract.ts` (the future
// `@webeverything/contracts/policy` entry, slice #1077). Re-exported here so importers reach the types
// and the runtime (PDP/PEP) from one site; the split is at the file seam, not the public surface
// (mirrors `guard/provider.ts`).
export type * from './contract';

// ── Rule evaluator — built-in impl (the swappable seam interface lives in ./contract) ─────────

/** The built-in comparator evaluator — the baseline DMN-cell semantics (eq/ne/ordering/membership). */
export const comparatorEvaluator: RuleEvaluator = {
  id: 'comparator',
  matches(rule, facts) {
    return rule.when.every((cell) => {
      const fact = facts[cell.input];
      switch (cell.op) {
        case 'eq': return fact === cell.value;
        case 'ne': return fact !== cell.value;
        case 'lt': return typeof fact === 'number' && fact < (cell.value as number);
        case 'lte': return typeof fact === 'number' && fact <= (cell.value as number);
        case 'gt': return typeof fact === 'number' && fact > (cell.value as number);
        case 'gte': return typeof fact === 'number' && fact >= (cell.value as number);
        case 'in': return Array.isArray(cell.value) && (cell.value as unknown[]).includes(fact);
        default: return false; // an unknown op never silently matches
      }
    });
  },
};

// ── PDP — the decision point (the Verdict output type lives in ./contract) ───────

/** Thrown when a ruleset violates its own hit-policy contract (e.g. UNIQUE matched more than one rule). */
export class HitPolicyViolation extends Error {
  constructor(reason: string) {
    super(`webpolicy enforcement — ${reason}`);
    this.name = 'HitPolicyViolation';
  }
}

/**
 * The Policy Decision Point. Evaluates a ruleset against facts and combines the matching rows per the
 * DMN hit policy. Pure — no I/O, no clock, no proof — so build-time and gate venues reuse it unchanged.
 */
export class PolicyDecisionPoint {
  constructor(private readonly evaluator: RuleEvaluator = comparatorEvaluator) {}

  decide(ruleSet: PolicyRuleSet, facts: Facts): Verdict {
    const hits = ruleSet.rules.filter((r) => this.evaluator.matches(r, facts));
    const fallback = ruleSet.default ?? 'not-applicable';

    if (hits.length === 0) {
      return { verdict: fallback, matched: [], outputs: {}, reason: 'no rule matched' };
    }

    let chosen: readonly PolicyRule[];
    switch (ruleSet.hitPolicy) {
      case 'UNIQUE':
        if (hits.length > 1) {
          throw new HitPolicyViolation(`UNIQUE ruleset "${ruleSet.id}" matched ${hits.length} rules`);
        }
        chosen = hits;
        break;
      case 'FIRST':
        chosen = [hits[0]]; // document order; `rules` is authored in order
        break;
      case 'PRIORITY': {
        const top = hits.reduce((a, b) => ((b.priority ?? 0) > (a.priority ?? 0) ? b : a));
        chosen = [top];
        break;
      }
      case 'COLLECT':
        chosen = hits; // all matches contribute
        break;
      default:
        throw new HitPolicyViolation(`unknown hit policy "${ruleSet.hitPolicy}"`);
    }

    // Merge outputs in chosen order (a later rule's output wins on key collision).
    const outputs: Record<string, unknown> = {};
    for (const rule of chosen) for (const cell of rule.then) outputs[cell.name] = cell.value;
    const verdict = String(outputs.verdict ?? fallback);

    return {
      verdict,
      matched: chosen,
      outputs,
      reason: `${chosen.length} rule(s) matched under ${ruleSet.hitPolicy}`,
    };
  }
}

// ── PEP — the enforcement point ──────────────────────────────────────────────────

/** What the PEP did: the verdict, whether the action was allowed, and (runtime venue) the emitted proof. */
export interface EnforceResult {
  readonly allowed: boolean;
  readonly verdict: Verdict;
  /** The proof record appended to the chain — present only when a proof chain is wired (runtime venue). */
  readonly proof?: ProofRecordInput & { readonly seq: number; readonly hash: string };
}

export interface EnforcementOptions {
  /** The PDP to consult (default: a fresh PDP on the built-in comparator evaluator). */
  readonly pdp?: PolicyDecisionPoint;
  /**
   * The proof sink — the #407 hash chain. Present ⇒ runtime venue: every decision is logged as tamper-
   * evident proof. Absent ⇒ build-time/gate venue: the PDP still decides, but nothing is proven (there is
   * no live user/action/span to anchor).
   */
  readonly chain?: ProofChain;
  /** Injected clock — the ISO time stamped on each proof record (the core never reads the clock). */
  readonly now?: () => string;
  /** The verdicts that permit the action (default: just `'permit'`). Anything else denies. */
  readonly permits?: ReadonlySet<string>;
}

/**
 * The Policy Enforcement Point. Attaches at an action/component: it asks the PDP for a verdict, enforces
 * it (permit → allow, else deny), and — at the runtime venue (a {@link ProofChain} wired) — appends a
 * proof record anchored to the action's Web Traces span. The same instance with no chain is the
 * build/gate venue: it decides and enforces but emits no proof.
 */
export class PolicyEnforcementPoint {
  private readonly pdp: PolicyDecisionPoint;
  private readonly chain?: ProofChain;
  private readonly now: () => string;
  private readonly permits: ReadonlySet<string>;

  constructor(opts: EnforcementOptions = {}) {
    this.pdp = opts.pdp ?? new PolicyDecisionPoint();
    this.chain = opts.chain;
    this.now = opts.now ?? (() => new Date().toISOString());
    this.permits = opts.permits ?? new Set(['permit']);
  }

  /**
   * Enforce a ruleset for one action. Decides via the PDP, records proof when a chain is wired, and
   * returns whether the action is allowed. `context.actor`/`traceSpan` tie the proof back to the live
   * request (Web Traces); `time` is taken from the injected clock so the core stays deterministic in tests.
   */
  enforce(
    ruleSet: PolicyRuleSet,
    facts: Facts,
    context: { actor: string; traceSpan?: string } = { actor: 'anonymous' },
  ): EnforceResult {
    const verdict = this.pdp.decide(ruleSet, facts);
    const allowed = this.permits.has(verdict.verdict);

    if (!this.chain) {
      return { allowed, verdict }; // build/gate venue — no proof emitted
    }

    const record = this.chain.append({
      rule: { id: ruleSet.id, version: ruleSet.version },
      inputs: facts,
      verdict: verdict.verdict,
      actor: context.actor,
      time: this.now(),
      traceSpan: context.traceSpan,
    } satisfies ProofRecordInput);

    return { allowed, verdict, proof: { ...record } };
  }

  /**
   * Guard a callable: run `action` only if the policy permits, returning the action's result; otherwise
   * return `onDeny` (or throw if it's omitted). The component-attachment ergonomic over {@link enforce} —
   * a PEP wrapping a click handler / a route transition / a service call.
   */
  guard<T>(
    ruleSet: PolicyRuleSet,
    facts: Facts,
    action: () => T,
    context: { actor: string; traceSpan?: string } = { actor: 'anonymous' },
    onDeny?: (result: EnforceResult) => T,
  ): T {
    const result = this.enforce(ruleSet, facts, context);
    if (result.allowed) return action();
    if (onDeny) return onDeny(result);
    throw new Error(`webpolicy enforcement — action denied by "${ruleSet.id}" (verdict: ${result.verdict.verdict})`);
  }
}
