/**
 * Web Policy — the **pure-contract half** (#1028, slice #1077): the #406 DMN-aligned rule meta-schema.
 *
 * Types and interfaces only: this module is fully **compile-erased** (no runtime emit) and is the
 * `@webeverything/contracts/webpolicy` entry (#872/#874) that FUI depends on (the FUI→WE arrow),
 * superseding byte-replication — exactly like `guard/contract.ts`. The runtime half — the PDP
 * (`PolicyDecisionPoint`), PEP, the built-in `comparatorEvaluator`, and the hit-policy combination logic —
 * is impl and **lives in FUI** (`fui:webpolicy/enforcement.ts` + `fui:webpolicy/proof.ts`, relocated #1799
 * per #1282 — WE holds zero executable). FUI's engine imports these types via the scoped specifier and
 * re-exports them so importers reach types + runtime from one site (mirroring `validity-merge/provider.ts`);
 * WE keeps only this contract + the behavioral vectors (`conformance-vectors/webpolicy.vectors.ts`), which
 * prove any engine conformant through the plateau-hosted runner (#1800/#1801).
 *
 * Web Policy fixes the **rule meta-schema** — how a rule is expressed, versioned, and scoped — by
 * adopting the OMG **DMN** vocabulary (decision tables + FEEL-style entry expressions). It standardizes
 * the meta-schema, NOT the rule list (the same doctrine as the intents). This is a genuine Protocol — an
 * interchange schema that makes rulesets portable and a decision reproducible (per the Project/Protocol
 * bar; #406/#407/#408 design).
 *
 * One ruling is encoded here, not redecided downstream: **the policy *language* behind a rule (DMN/FEEL
 * vs Rego vs Cedar) is a build choice** (#093). The meta-schema is the lock; `RuleEvaluator` is the
 * swappable seam a project backs with Rego/Cedar without touching the PDP/PEP. Expression evaluation
 * composes Web Expressions, input-data resolution composes Web Contexts, proof composes Web Traces — all
 * referenced, not redefined.
 */

/** DMN hit policy — how multiple matching rules combine into one verdict. */
export type HitPolicy = 'UNIQUE' | 'FIRST' | 'PRIORITY' | 'COLLECT';

/** One condition cell of a rule's `when`: an input reference, a comparator, and the value to compare. */
export interface InputEntry {
  /** Names one of the ruleset's `inputs` (the fact key). */
  readonly input: string;
  /** Comparator op — interpreted by the {@link RuleEvaluator}; the built-in covers eq/ne/lt/lte/gt/gte/in. */
  readonly op: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | string;
  /** The value the fact is compared against (omitted ops like a bare truthiness check ignore it). */
  readonly value?: unknown;
}

/** One output cell of a rule's `then`: a named result the verdict carries. */
export interface OutputEntry {
  readonly name: string;
  readonly value: unknown;
}

/** A decision-table row: all `when` cells must match for the row to fire its `then` cells. */
export interface PolicyRule {
  readonly when: readonly InputEntry[];
  readonly then: readonly OutputEntry[];
  /** Used only by the PRIORITY hit policy — higher wins. */
  readonly priority?: number;
}

/** A versioned ruleset expressing one decision — the #406 protocol shape. */
export interface PolicyRuleSet {
  readonly id: string;
  readonly version: string;
  /** Optional context/tenant scope this ruleset binds to. */
  readonly scope?: string;
  readonly hitPolicy: HitPolicy;
  /** The fact keys the rules reference. */
  readonly inputs: readonly string[];
  readonly rules: readonly PolicyRule[];
  /** The verdict outcome when NO rule matches (default `'not-applicable'`). */
  readonly default?: string;
}

/** The facts a ruleset is evaluated against — resolved by the caller (e.g. from Web Contexts). */
export type Facts = Readonly<Record<string, unknown>>;

/**
 * The rule-evaluator seam — matches a rule's `when` cells against facts. Swappable so Rego/Cedar/DMN can
 * each back the same PDP (the policy language is a build choice, #093). The built-in `comparatorEvaluator`
 * is runtime impl (→ `./enforcement.ts`).
 */
export interface RuleEvaluator {
  readonly id: string;
  /** True iff every `when` cell of the rule is satisfied by the facts. */
  matches(rule: PolicyRule, facts: Facts): boolean;
}

/** The PDP's output: the combined verdict, the rules that fired, and the merged outputs. */
export interface Verdict {
  /** The decision (open vocabulary; the `then` `verdict` output, or the ruleset `default`). */
  readonly verdict: string;
  /** The rules that matched (after the hit policy is applied). */
  readonly matched: readonly PolicyRule[];
  /** Merged `then` outputs across the matched rules (later/earlier per hit policy). */
  readonly outputs: Readonly<Record<string, unknown>>;
  /** Human-readable explanation of how the verdict was reached. */
  readonly reason: string;
}
