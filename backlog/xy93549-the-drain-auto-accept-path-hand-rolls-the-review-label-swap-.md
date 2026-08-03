---
kind: story
size: 3
status: open
blockedBy: ["2882"]
relatedTo: ["2409", "2644", "2439"]
scope:
  - we:skills-src/drain/SKILL.md
  - we:scripts/review-set-label.mjs
  - we:scripts/lib/review-skill-guard.mjs
  - we:scripts/lib/__tests__/review-skill-guard.test.mjs
  - we:scripts/__tests__/review-set-label.test.mjs
dateOpened: "2026-08-02"
tags: [gate, review, drain, invariant]
---

# The drain auto-accept path hand-rolls the review label swap too

The convergence path in the drain skill applies `redteam:accepted` plus `review:accepted` with a raw `gh pr edit` — same lost `reviewed-sha` marker and same unenforced INVARIANT 2 as the `/review` path, but on the flow that then lands the PR automatically.

## How it was found — and the correction

The `check:standards` rule added by #2882 (`we:scripts/lib/review-skill-guard.mjs`) was written to lock the `/review` skill's swap into its single home. Running it repo-wide surfaced a second, unlooked-for instance in `we:skills-src/drain/SKILL.md`: the step where a combined panel + independent-validator `land` verdict applies `redteam:accepted` then `review:accepted` with a raw `gh pr edit`.

**Correction (PR #1005 review, major 2).** The first cut of this item — and of #2882's PR body and module header — claimed the gate had *flagged* that instance. It had not. The rule was line-anchored, and the drain skill wraps that command across two lines, so the real swap went unmatched; what the gate actually flagged was a benign "the label must exist" note elsewhere in the same file. A false positive reported as the true one. The instance is real and was found by reading, not by the gate.

The rule now matches across wrapped lines and carries those verbatim bytes as a fixture, so the claim and the code agree. The drain file stays out of `GUARDED_DOC_PREFIXES` until this item lands — the rule catches it, the scope deliberately does not.

It is recorded here rather than fixed in #2882 because the fix is a behaviour change, not a doc edit — see below.

## Why this instance is worse than the /review one

The `/review` path ends with a human deciding and a drain pass landing later. This path **lands the PR automatically** once the label goes on. So the two defects the raw swap carries bite harder:

- **No `reviewed-sha` marker.** The auto-accept records nothing about which tree it accepted, so #2409's staleness gate has nothing to check on the landing pass. The `/review` case at least re-parked loudly (#983); here a silently-stale acceptance is the merge criterion.
- **INVARIANT 2 unenforced.** `decideSetLabel`'s refusal to clear a `review:human` PR binds only callers that come through `we:scripts/review-set-label.mjs`. The skill's surrounding prose *does* say "do NOT apply `review:accepted`" when `autoLand: false` (gate-self) — but that is an instruction to a model, not a gate. The unbypassable core is bypassed exactly where an agent is deciding, unattended, whether to clear a trust-chain edit.

## Why it was not fixed inside #2882

Two concrete blockers, both pointing at design rather than wording:

- The CLI has **no `redteam:accepted` target**. `decideSetLabel` knows `accepted` / `changes` / `rearm`. The #2439 independent-validator label needs either a new target or a separate step, and inventing one while fixing an unrelated skill is how single-sourced deciders grow accidental members.
- Routing the accept through the CLI **posts a comment**, and this flow already posts its own `renderPanelVerdictTable` panel comment. Either the panel body moves into `--body-file` (restructuring the drain's comment flow) or the PR gains a second comment. Either way it is a change to the auto-land path and deserves its own review.

`GUARDED_DOC_PREFIXES` is therefore scoped to `skills-src/review/` + `docs/agent/` for now, with the reason written into the module. Widen it to `skills-src/` as part of this item — the narrow-and-honest set is deliberate, not an oversight to be waived later.

## Definition of done

- The drain skill's convergence step records its verdict through `we:scripts/review-set-label.mjs`, so the auto-accept stamps a `reviewed-sha` marker and is bound by INVARIANT 2.
- `redteam:accepted` has a defined home — either a CLI target or an explicitly-separate step — decided rather than defaulted.
- The panel comment and the verdict comment are reconciled into one durable record, not two.
- `GUARDED_DOC_PREFIXES` widens to `skills-src/`, and the scope note in `we:scripts/lib/review-skill-guard.mjs` is removed rather than left describing a state that no longer holds.
- The widening also has to settle the **label-must-exist note** in the same file, which the rule matches too. It is prose about label provisioning, not a swap instruction, but the rule keys on an edit carrying a review label and cannot tell the difference. Reword the note (it only needs to name the label, not a command) rather than adding a second carve-out — the first carve-out had three holes and was deleted for it.
- A test pins the gate-self case: an auto-accept attempt on a `review:human` PR is refused by the core, not merely discouraged by prose.
