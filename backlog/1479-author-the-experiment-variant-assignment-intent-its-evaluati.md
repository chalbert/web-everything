---
kind: story
size: 5
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/experiment.json"
tags: []
---

# Author the experiment (variant-assignment) intent + its evaluation-provider contract

Ratified by #1414 (Forks 1+2). Author a new experiment / variant-assignment intent under Web Intents: declarative 'this subtree renders the arm assigned to the current unit', open variant dimension (the arm set), most-permissive default = control/default arm (OpenFeature DEFAULT). Compose a DISTINCT evaluation-provider contract reusing the Guard seam pattern (native-first → project override → custom plug, we:src/_data/projects/webguards.json) returning {value, variant, reason} (OpenFeature vocab) with NO security semantics — a variant arm is not an authz verdict. Borrow the OpenFeature reason enum verbatim; bucketing stays impl behind the provider. May itself split intent-vs-provider-contract slices.

## Progress (batch-2026-06-21-1429-1487)

Authored **both forks together** (no split — they are tightly coupled and the contract is authored
*here*, not deferred, so the contract-ts-is-a-separate-slice concern "FUI can't import till it
lands" is satisfied; the contract exists for FUI to import):

- **`we:experiment/contract.ts`** (new, Fork 2) — the **pure-contract half**, type-only/compile-erased
  (the `@webeverything/contracts/experiment` entry, FUI→WE arrow), modelled verbatim on
  `we:guard/contract.ts`. `CustomEvaluationProvider` (swappable: `key` + async `evaluate(flagKey,
  defaultVariant, context) → Promise<EvaluationResult>` + optional `subscribe` for revocation);
  `EvaluationResult<T> = { variant, value, reason }`; `EvaluationContext` (`targetingKey` + attributes);
  `EvaluationReason` = the **OpenFeature reason enum borrowed verbatim** (STATIC/DEFAULT/TARGETING_MATCH/
  SPLIT/CACHED/DISABLED/UNKNOWN/ERROR). Encodes the #1414 divergences from Guard: **no `allow`/security
  semantics** (an arm ≠ authz verdict), bucketing stays impl behind the provider, async + UX-mirror.
- **`we:contracts/experiment.ts`** (new) — the type-only re-export entry (mirrors `we:contracts/guard.ts`
  / `we:contracts/graph.ts`).
- **`we:src/_data/intents/experiment.json`** (new, Fork 1) — the **UX-only** intent: declarative
  arm rendering, **open `variant` dimension** (author-defined arm set; canonical values control/treatment)
  with most-permissive default = the control/DEFAULT arm. Description cross-links the Guard pattern reuse,
  the OpenFeature vocab, and the boolean-gate-vs-multivariate distinction (#1481).
- **`we:src/_data/semantics/experiment.json`** (new) — glossary term (#1327).

Runtime (the native-first control-arm provider, any bucketing/SDK provider, the swap registry) → FUI per
the constellation statute; only the contract crosses the seam. Gate green (0 errors), contract typechecks
clean. #1481 (the doc note recording the boolean-flag-vs-experiment split) is the sibling.
