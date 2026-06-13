/**
 * @file webcompliance/policies/platform-default.ts
 * @description The seed compliance policy — backlog #440 (phase 5 of #351), built on the #436 policy
 *   model + #437 gate runner ({@link ../gate}). Re-expresses the platform's existing **hard CI gates** as
 *   *declared, severity-tagged data* rather than logic scattered across the check scripts: the gate set
 *   becomes a {@link CompliancePolicy} a project policy {@link resolvePolicy `extends`} (config-extends-
 *   platform-default), authoring only its deltas.
 *
 *   This is the baseline every project policy builds on — it does not itself `extend` anything.
 *
 * ── Measure convention (why every threshold is `1`) ──────────────────────────────────────────────
 *   The gate runner's {@link clears} comparator is a **floor** (`measured >= threshold`), designed for
 *   "higher is better" signals (coverage ≥ 80, level ≥ L2). A check that fails on *error count* is the
 *   inverse (lower is better), so each gate is modeled as a **binary pass-signal**: the producer emits
 *   `1` when the underlying check has **zero** errors and `0` otherwise, and the rule requires `>= 1`.
 *   This keeps "the gate must pass" expressible as plain policy data with the default comparator — no
 *   per-rule comparator override. Measure ids are namespaced by their producing check.
 */
import type { CompliancePolicy } from '../gate';

/**
 * The platform-default baseline. Two `block`-severity gates mirror today's hard CI failures (both
 * enforced by `check:standards`, which exits non-zero on any error — the standards conformance pass and
 * the backlog-item structural validation it folds in), and one `warn`-severity rule records the
 * `check:readiness` structural scan, which is **informational** today (the script exits 0) — tagged
 * `warn` so it reports without blocking, honest to its current wiring. Bump `version` when the rule set
 * changes; a rule's `since` records the version it entered in.
 */
export const platformDefaultPolicy: CompliancePolicy = {
  id: 'platform-default',
  version: '1',
  rules: [
    {
      id: 'standards-conformance',
      measure: 'check-standards:pass',
      severity: 'block',
      scope: 'repo',
      threshold: 1, // 1 ⇔ `check:standards` reported 0 errors
      since: '1',
    },
    {
      id: 'backlog-well-formed',
      measure: 'check-standards:backlog-pass',
      severity: 'block',
      scope: 'repo',
      threshold: 1, // 1 ⇔ no backlog-item validation errors (status/type enums, required fields, immutable NNN)
      since: '1',
    },
    {
      id: 'readiness-structural',
      measure: 'check-readiness:well-formed',
      severity: 'warn', // check:readiness is informational today (exits 0) — reported, not blocking
      scope: 'repo',
      threshold: 1, // 1 ⇔ the readiness scan found no malformed frontmatter
      since: '1',
    },
  ],
};
