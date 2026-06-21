---
kind: task
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "docs/agent/platform-decisions.md#flag-gate-vs-experiment-selector"
tags: []
---

# Doc note: boolean flag = access-control gate, multivariate = experiment intent (don't re-conflate)

Ratified by #1414. Add a short doc note recording the split so the two halves are not re-conflated: a BOOLEAN feature flag IS the access-control gate (authority: feature-flag, we:src/_data/intents/access-control.json) on the Guard provider seam; a MULTIVARIATE flag (one of N arms) is the separate experiment / variant-assignment intent (#1479). Same provider SHAPE, different outcome families (allow/deny vs pick-one-of-N) and trust boundaries. OpenFeature's typed-flag distinction (boolean=gate, string/object=selector) is the upstream precedent.

## Progress (batch-2026-06-21-1429-1487)

Codified the split as a named statute rule:
- **`we:docs/agent/platform-decisions.md#flag-gate-vs-experiment-selector`** (new rule) — "A boolean flag
  is an access-control gate; a multivariate flag is the experiment intent — same provider shape, different
  outcome family." Records: boolean → `authority: feature-flag` access-control gate (allow/deny, Guard
  seam, trust-crossing); multivariate → experiment/variant-assignment intent (pick-one-of-N, no security
  semantics, distinct `@webeverything/contracts/experiment` provider); same provider *shape*, never
  re-conflated; OpenFeature typed-flag distinction as the upstream precedent. Cross-links
  decompose-overloaded-vocabulary + intents-ux-only.
- **`we:backlog/1414`** — updated `codifiedIn` from `one-off` to the new statute anchor (G6 hygiene now
  that a named rule exists).

Gate green.
