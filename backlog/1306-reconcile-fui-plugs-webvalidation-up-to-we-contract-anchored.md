---
kind: story
size: 5
parent: "1250"
locus: frontierui
status: open
blockedBy: ["1345", "1358"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
tags: []
---

> **Sliced 2026-06-20 (`we:reports/2026-06-20-backlog-split-analysis.md`).** The size-13 lump split
> into 4: the alias prereq → #1344, the 2 WE-only file port + index exports → #1345, the independent
> `AsyncValidatorField` reconcile → #1346, and this card now scoped to its **core** — the
> `ValidityMergeField` hand-merge (the +151-line commitment-policy/interaction-state body). Re-sized
> 13 → 5, `blockedBy` #1345 (this file imports the ported `CustomCommitmentPolicyRegistry`).

# Reconcile fui:plugs/webvalidation/ValidityMergeField.ts UP to WE (contract-anchored core)

Hand-merge `fui:plugs/webvalidation/ValidityMergeField.ts` (192 lines) up to
`we:plugs/webvalidation/ValidityMergeField.ts` (343 lines) — contract-anchored audit first (#1270
principle 1), preserving FUI's observed-attributes/runner bits.

The WE-only delta (+151) is:
- **#1113 commitment scope** — `resolveCommitmentRegistry()` (`we:plugs/webvalidation/ValidityMergeField.ts:47-52`),
  `static observedAttributes = ['strategy', 'commitment']` (`:59`, vs FUI's `['strategy']`),
  `#resolveCommitment` / `#reflectStaleness` (`:163-191`). Imports the ported
  `CustomCommitmentPolicyRegistry` (`:28`) — hence `blockedBy` #1345.
- **interaction-state tracking** — `#interaction`/`#unsubInteraction`/`#prevFocused`/etc. fields
  (`:73-83`), subscription + `#reflectInteraction` (`:267-296`).
- **#1111 transition events** — became-valid / became-invalid + commitment staleness reconciliation in
  `#reflectValidity` (`:299-324`).

The alias prereq (#1344), the 2 WE-only file port + index exports (#1345), and the `AsyncValidatorField`
reconcile (#1346) are carved as siblings under #1250; FUI's `@webeverything/*` index alias imports are
already correct (#700/#872) and must be preserved.

## Blocked on a second, unencoded alias prereq → #1358 (batch-2026-06-20-1344-1342)

Pre-flighted during the batch: the WE `ValidityMergeField` also imports `InteractionStateTracker` from
`../../interaction-state/model`, but FUI has **no local `interaction-state/` dir and no
`@webeverything/interaction-state` alias** — so the hand-merge cannot resolve that import. The `/split`
that scoped this card carved #1344 for commitment-policy/error-summary but **missed** this third
WE-resident model. Filed the prereq as **#1358** (wire the `@webeverything/interaction-state` alias,
mirroring #1344) and added it to `blockedBy`. The port itself is otherwise ready (the +151 delta is
diffed and clean; the commitment-policy import retargets onto the #1344 `@webeverything/commitment-policy`
alias, and `CustomCommitmentPolicyRegistry` is the #1345-ported local file). Resume once #1358 lands.
