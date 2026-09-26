---
bornAs: x9s10dt
kind: story
size: 3
parent: "3383"
status: resolved
blockedBy: ["3949"]
relatedTo: ["4029", "3690", "4035"]
scope: ["we:scripts/lib/provider-routing.mjs", "we:scripts/lib/__tests__/provider-routing.test.mjs", "we:scripts/lib/critical-work.mjs", "we:scripts/lib/__tests__/critical-work.test.mjs", "we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs", "we:scripts/lib/__tests__/dispatch-contracts.test.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-26"
dateResolved: "2026-09-26"
tags: []
---

# Wire the delegation-trial 'critical miss' test to the existing deriveRisk / never-spot-check / humanRequired proxy

Fork 4 of decision #4029 (ratified 2026-09-24, codified in we:docs/agent/platform-decisions.md#delegation-trial-record-graduation rule 5) rules that 'critical' for the post-miss step-back test reuses the existing code-grounded escalation-severity proxy, never a new bespoke scale: build isCriticalMiss(record) in we:scripts/lib/provider-routing.mjs true iff deriveRisk(...) === 'high' (we:scripts/lib/dispatch-contracts.mjs, reading isHighStakesTask at we:scripts/lib/provider-routing.mjs) OR the touched files match any NEVER_SPOT_CHECK_PATH_PREFIXES group (we:scripts/lib/dispatch-thresholds.mjs: statute, gateSelf, irreversible) OR humanRequired is true for the diff (we:scripts/lib/review-escalation.mjs, the declarative-leash/statute layer). This predicate feeds the sibling selectSupervisionLevel item's cause-aware step-back test (critical AND cannot-be-improved-by-tooling). No live effect until #3949 lands.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/provider-routing.test.mjs` gets cases showing
   `isCriticalMiss` returns true for a record whose task scores `deriveRisk(...) === 'high'`, for a record
   whose touched files match any `NEVER_SPOT_CHECK_PATH_PREFIXES` group (`statute`, `gateSelf`,
   `irreversible`), and for a record with `humanRequired: true`; and returns false for a record matching
   none of the three, reading the shared `deriveRisk`/`NEVER_SPOT_CHECK_PATH_PREFIXES`/`humanRequired`
   sources directly rather than a local re-implementation.

## Delivery notes (2026-09-26)

- **Where the predicate lives.** `isCriticalMiss` / `criticalWorkVerdict` / `criticalMissesFor` are in
  `we:scripts/lib/critical-work.mjs`, not `we:scripts/lib/provider-routing.mjs`: `we:scripts/lib/dispatch-contracts.mjs` and
  `we:scripts/lib/dispatch-thresholds.mjs` both import `we:scripts/lib/provider-routing.mjs`, and `we:scripts/lib/dispatch-thresholds.mjs` reads
  `DEFAULT_BACKDOWN_THRESHOLDS` at module top level, so `we:scripts/lib/provider-routing.mjs` importing either throws a TDZ
  error whenever it loads first. `routeDispatch` computes both verdicts and hands them to `selectProvider` as data.
- **Critical =** any of: `deriveRisk(...) === 'high'`; a `NEVER_SPOT_CHECK_PATH_PREFIXES` group (statute, gateSelf,
  irreversible); `humanRequired` (on the record, or `isPrincipleSurface(path, null)` before a diff exists); a
  trust-chain path (`isTrustChainPath`: the gate's policy + engine roster); a daemon/drain path (the conveyor trees
  or a `daemon`/`drain` file name). No scope → critical (fail closed).
- **Critical miss =** a `reworked`/`rejected` row whose scope is critical; a miss row with no scope evidence is
  critical (fail closed). A critical miss hard-vetoes its {provider, model, taskType} triple from gated kinds.
- **The gate** (`CRITICAL_WORK_GATE.openForNonCritical`) is per taskType and lands with every row `false`.
- **Follow-up owed:** the #3949 and red-team (#4195) miss writers should stamp the PR's changed files on each
  miss row, so a miss can be judged non-critical from the record instead of failing closed.

