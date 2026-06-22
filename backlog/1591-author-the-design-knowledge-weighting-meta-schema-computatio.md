---
kind: story
size: 5
status: resolved
blockedBy: []
parent: "1585"
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:src/_data/credibilityWeighting.js"
relatedProject: webaudit
tags: []
---

# Author the design-knowledge weighting meta-schema + computation function (graduate #1588)

Graduates the ratified #1588 ruling: author the source-admission/credibility meta-schema as WE config+data — the source-`kind` enum, the fixed named modifier vocabulary (up: breadth/diversity, independent-replication; down: narrow-sample, vendor-funded-bias, staleness), and the weight-computation function (baseline tier from kind + optional modifiers, each carrying rationale+attribution; only staleness deterministic) plus a default tier-weight flavor. Two-stage: a provenance/content admission floor (identifiable+traceable+on-topic, NOT a quality bar) then the weight, with a nonzero floor on admitted sources. Backfill the #1586 ledger's provisional equal `credibilityWeight` column with computed weights. Meta-schema frozen as the comparable spine; project config extends weights/kinds. Unblocks #1589.

## Progress (resolved 2026-06-22, batch-2026-06-22-1580-1579-1030-1564)

Graduated the ratified #1588 ruling (we:docs/agent/platform-decisions.md#credibility-weighting) into WE
config+data:

- **`we:src/_data/credibilityWeighting.js`** — the frozen meta-schema + WE default flavor + the pure
  computation function, encoding all three ruled axes. **(1) Admission ⟂ weight, two-stage:** `admit(source)`
  is a permissive provenance/content floor (`identifiable` + `traceable` + `on-topic` — attributable, NOT a
  quality bar; returns the failed gates), separate from the weight. **(2) GRADE-shaped weight:**
  `computeCredibilityWeight(source)` = a baseline tier from `kind` (`sourceKindDefault`: peer-reviewed 1.0 >
  standard 0.9 > guideline 0.75 > book 0.6 > blog 0.4) + a fixed NAMED modifier vocabulary
  (`weightModifierDefault`: up breadth-diversity/independent-replication; down narrow-sample/
  vendor-funded-bias/staleness). Every applied non-deterministic modifier MUST carry a rationale +
  attribution (throws otherwise — no un-audited free numbers); `staleness` is deterministic (auto-applies
  past the horizon from a date). **(3) Config-extends-default + nonzero floor:** the `*Default` exports are
  the platform default a project extends (add kinds/modifiers, retune); a `weightFloorDefault` of 0.05
  clamps an over-eroded weight so it can never covertly re-exclude (axis-1 mirror). Unknown kind/modifier
  throws (a misconfigured source fails loudly).
- **`we:src/_data/designKnowledgeWatch.json`** — backfilled the #1586 ledger's provisional equal `1.0`
  column with computed weights (flat tier baseline, no modifiers on the seed rows): guideline rows
  (nielsen, apple) → 0.75, standard (w3c-apg) → 0.9, peer-reviewed (uicrit) → 1.0; description +
  `credibilityWeightScale` updated from "provisional" to "computed by the #1588/#1591 meta-schema".

**Tests/verification:** `we:scripts/__tests__/credibility-weighting.test.mjs` (9) — admission floor,
flat-tier degenerate config, ruled ordering, named-modifier application, rationale-required enforcement,
deterministic staleness, unknown-kind/modifier guards, nonzero-floor clamp. `check:standards` 0 errors;
11ty `build:check` 0 errors; ledger weights recompute-match the committed values. Unblocks #1589
(distillation) + feeds #1592 (tunable-weights Configurator).
