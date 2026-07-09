---
kind: report
dateOpened: "2026-07-09"
tags: [backlog, split, design-review, ai-judge, branding]
---

# Backlog split analysis — #2207 (train the design-AI reviewer)

Focused `/split 2207`. Candidate: **#2207** `train-the-design-ai-reviewer-for-branding-and-ui-guidance`
— `kind: story`, `size: 13`, `status: open`, `parent: "2208"` (child of the ongoing
*Design-intelligence watch* program).

## Investigation (what the card actually contains)

The size·13 body braids **three genuinely different work products in three homes**, plus a large
perpetual *learning log* (67 logged verdicts, method notes — accumulation, not a build):

| Stream | Work product | Home | Buildable now? |
|---|---|---|---|
| A — **eval harness** | agreement metric: run the reviewer over the proposals, score agreement vs the logged journey verdicts + stock-AI baseline | `plateau:scripts/*` + `plateau:branding-proposals/journey.json` (67 verdicts, exists) | **Yes** — labels already exist; #2208 names this as "#2207 eval harness" |
| B — **sighted-loop hooks** | fold adversarial-read / swap-test checklist + refine-to-convergence loop into `/review-design` + the vision judge | `we:skills-src/review-design/SKILL.md` + `we:docs/agent/vision-tiers.md` | Yes, but diffuse; overlaps C's file |
| C — **rubric grounding** (the training payload) | reviewer cites the owning attribute set / rule in every verdict, per **#2209 Fork 6** | `we:skills-src/review-design/SKILL.md` + `we:docs/agent/vision-tiers.md` | **No — design-gated** |

Key finding: **#2209 (the brand rubric this card explicitly consumes) is `status: open`** — prepared,
not ratified. The card itself states *"Methodology choice is #2209 Fork 6 — if (a) ratifies… this card
consumes it."* So Stream C's size is **an unresolved decision, not volume** — split-safety rubric (1)
fails for C. The card is also explicit that feature work is sequenced *after* the eval baseline
exists ("Eval loop before feature work: define the agreement metric first… then iterate").

## Could split

The safe carve **separates the buildable volume (A) from the decision-gated remainder (C)**. Stream A
is the one unambiguously clean, independent, foundational, #2208-named artifact.

Because #2207 already has `parent: "2208"`, it is **not** converted to an epic (edge case): it stays a
re-sized `story` holding its core (the training payload C), and the foundational slice A is added as a
**sibling under #2208**.

| # | Slice | workItem·size | Home | blockedBy |
|---|---|---|---|---|
| **NEW** | **Eval harness — reviewer-agreement metric vs the journey labels** (+ stock-AI baseline) | story·3 | `plateau:scripts` + `plateau:branding-proposals` | — |
| **#2207** (re-sized) | **Ground the reviewer's verdicts in the ratified brand rubric** — cite the owning attribute set/rule per #2209 Fork 6, iterate against the eval baseline | story·5 | `we:skills-src/review-design` + `we:docs/agent/vision-tiers.md` | **2209** (open decision), **NEW eval slice** |

**DAG:** `NEW eval` (unblocked) → `#2207 grounding` (also blocked on #2209).
`NEW eval` is immediately **batchable**. `#2207` is not (blocked).

**Demoable states:** NEW = a runnable script printing agreement % against `plateau:branding-proposals/journey.json`
+ a stock-AI baseline. #2207 = unchanged parked story, now correctly blocked.

### Optional further carve (marginal — declined at split time)

Stream **B** (sighted-loop hooks into `/review-design`: adversarial-read / swap-test checklist +
refine-to-convergence loop) is *technically* independent of #2209 and buildable now, so it could be a
second sibling slice (story·3). Declined for this split because: (1) it's diffuse ("should support an
iterate loop"), and (2) it edits the **same file** as the #2207 grounding residual
(`we:skills-src/review-design/SKILL.md`), so carving it risks two cards contending on one file. Left in
the #2207 residual; can be re-carved later if the #2209 wait becomes a bottleneck.

## Could not split

| Candidate | Failed condition | Unblocking action |
|---|---|---|
| **#2207 residual — rubric grounding (Stream C)** | (1) size is an unresolved decision, not volume — the attribute sets don't exist as codified until **#2209 ratifies** | **Ratify #2209** (already a prepared `decision` card, ✓ ready). Then the residual is buildable against the eval baseline. |
| Learning log / training-hooks prose | Not a build — perpetual accumulation owned by program #2208 | none — leave in place (grows via `/review-program` on #2208) |

## Outcome (executed 2026-07-09)

**+1 slice** (eval harness, story·3, sibling under #2208); **#2207** story·13 → story·5 with
`blockedBy: [2209, <eval-slice>]`. No epic conversion (kept a story per the has-parent edge case).
No blocking fork to file — **#2209 already exists** as the gating decision card.
