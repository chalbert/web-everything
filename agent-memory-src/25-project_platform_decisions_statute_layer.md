---
name: project_platform_decisions_statute_layer
description: docs/agent/platform-decisions.md is the statute layer — cite a named rule instead of re-opening placement/naming/monetization/boundary decisions; set codifiedIn on resolve
metadata: 
  node_type: memory
  type: project
  originSessionId: d6825fca-35eb-4978-919e-965c3b5ff231
---

#911 (2026-06-18) established a **statute layer** separate from the decision case-law chain, after a
166-decision sweep found **64% were "case-law-only"** (rule lived only in its backlog file → the same
axis got re-decided; constellation placement alone = 10 decisions).

- **`docs/agent/platform-decisions.md`** = the source-of-truth doc: 8 named, citable cluster rules
  (constellation placement, WE↔FUI embed boundary, Project/Protocol bar, intents-UX-only, monetization
  *(soft)*, no-leakage Plateau client, tagName naming, Guard/Gate, `<component>` DC table), each with
  lineage `#NNN`s. Routed from AGENTS.md "Where to look". **Cite the rule; don't re-open a decision.**
- **`codifiedIn:` frontmatter** on `type:decision` → guideline path carrying the rule, or sentinel
  `one-off`. `codifiedIn` is exempt from the #883 repo-locus scan.
- **HARD GATE at resolve (2026-06-18, strengthened):** `backlog.mjs resolve` now REFUSES a `type:decision`
  with no `codifiedIn` — pass `--codified-to=<doc#anchor>` (CLI stamps the field) or `--codified-to=one-off`.
  Enforced in `applyTransition` (scripts/backlog/frontmatter.mjs `validateCodifiedIn`); 29 vitest cases.
  Captures orientation at the moment deliberation is freshest, not a later sweep.
- **`check:health` flag G6** = legacy catch-up pool ONLY (decisions resolved before the gate); 106 at
  strengthening. New decisions can't add to it. Non-failing, should only shrink.
- **`check:health` flag G7 (new):** a work item citing a CODIFIED decision's `#N` but not its statute
  anchor → re-point to `platform-decisions.md#<anchor>` ("cite the rule, not the case"). 348 at landing —
  the citation drift the user flagged; candidate pool, computes the suggested anchor per ref.
- Full per-decision status: `audits/2026-06-18-decision-codification-register.md`. Rules stay reversible
  (supersede the statute entry with lineage). Relates to [[feedback_conventions_fold_into_compliance]],
  [[project_placement_test_does_fui_consume_runtime]], [[feedback_ratified_decisions_are_reversible_stay_agile]].
