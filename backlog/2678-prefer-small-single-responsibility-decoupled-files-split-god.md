---
bornAs: xgb22vy
kind: decision
status: open
dateOpened: "2026-07-26"
preparedDate: "2026-07-28"
relatedTo: ["2677", "2679", "2625", "2405", "2606"]
tags: [decision, authoring, files, throughput, scope-lease, parallelism]
---

# Prefer small, single-responsibility, decoupled files; split god-files

Adopt "prefer small, single-responsibility, decoupled files" as a platform authoring rule, so delivery agents split large files along their responsibility seams by default. **This is primarily a conveyor-throughput lever, not tidiness:** the scope-lease engine holds lanes apart by the files they touch, so one large file that many items edit is a single lock point forcing them to build **one-at-a-time**. Splitting it into small modules lets those items touch *disjoint* files and build in **parallel**. **OPEN, not yet ratified** — on ratify it codifies into [we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md) and sets `codifiedIn`.

## Why it is a throughput lever (the central motivation)

The conveyor dispatcher ([we:scripts/readiness/dispatch-plan.mjs](../scripts/readiness/dispatch-plan.mjs)) decides *by script* whether two queued items collide, using each item's predicted `scope:` (path prefixes). Two items whose scopes overlap on any file are held apart and built serially. So a file's **serialization cost = how many queued items name it in their scope**. A large multi-responsibility file is named by many items, so it becomes the conveyor's biggest scope-collision cluster.

**Measured collisions (items declaring the file in their `scope:` frontmatter, 2026-07-27):**

| File | Items scoping it | Lines |
|---|---|---|
| [we:scripts/merge-ai-prs.mjs](../scripts/merge-ai-prs.mjs) | **25** | 2410 |
| [we:scripts/lib/review-core.mjs](../scripts/lib/review-core.mjs) | 13 | 1472 |
| [we:scripts/lib/review-escalation.mjs](../scripts/lib/review-escalation.mjs) | 8 | 545 |
| [we:scripts/pr-land.mjs](../scripts/pr-land.mjs) | 5 | 1015 |
| [we:scripts/lane-pool.mjs](../scripts/lane-pool.mjs) | 4 | 1124 |

`we:scripts/merge-ai-prs.mjs` alone is in the predicted scope of **25** queued items — a single lock that makes those 25 build strictly one-at-a-time. Split it into modules along its responsibility seams and those items declare *narrower, disjoint* scopes, so the dispatcher can run them concurrently. **The small-file preference is therefore the enabler that makes finer scope-leases (#2679) actually deliver parallelism** — a lease is only as fine as the files are small.

The operator's standing preference frames this (context, **not** the ruling): *"finer scope seems like a winner, as well as keeping files small and decoupled."*

## What the evidence actually shows — nuance that reshapes the split target

Line count alone is a **poor** proxy for "god-file," and grounding this matters. `we:scripts/merge-ai-prs.mjs` is 2410 lines but **~1195 of those are comments and 79 blank** (~1136 code lines), and it is already **42 exported functions** (only 4 non-exported), importing 8 `we:scripts/lib/` modules. Its exports are small, pure, single-responsibility helpers — `parseNumstat`, `classifyPr`, `planLabelDrain`, `decideDrainLeaseGate`, `computeNetDiffChangedFiles`, etc. So it is **already a decoupled *barrel*, not a tangled god-object.**

This does not weaken the case — it **sharpens** it. Under today's leases the granularity is the **whole file** (#2679's sub-file leases are not shipped). So 42 logically-independent functions in one physical file still serialize all 25 items. A barrel with clean internal seams is the **lowest-risk, highest-reward** split: the seams already exist, the functions are pure, and splitting them into responsibility-clustered modules (`we:scripts/merge-ai/label-plan.mjs`, `we:scripts/merge-ai/net-diff.mjs`, `we:scripts/merge-ai/lease-gate.mjs`, …) converts existing *logical* decoupling into *lease-level* parallelism with almost no refactor risk. **Cohesion still governs** (the item's own caveat): split where a genuine responsibility seam already exists — never fragment a truly single-responsibility file just to hit a line number.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1 — how is the preference enforced?** | **(b) soft-warn gate** in `check:standards` on a size+collision signal, with a cohesion escape-hatch | (c) hard deny | med-high |
| Follow-up (dissolved from a fork — see below) | file split stories for the top collision files, ranked, blockedBy #2678, coordinated with #2679 | opportunistic-only splitting | n/a — sequencing, not a merit fork |

## Fork 1 — how is the small-file preference enforced?

*Fork exists:* the three enforcement levels are mutually exclusive standing postures — a rule is **either** doc-only guidance (no gate), **or** a non-blocking warn, **or** a blocking deny; you ratify exactly one as the default. The excluded branch that makes this a real fork: a hard deny and "no gate" cannot both be the posture, and the choice has a permanent, observable behaviour difference (below).

Crux — there is **no file-size check anywhere today** ([we:scripts/check-standards.mjs](../scripts/check-standards.mjs) emits warnings via `warn(msg)`; its header notes *"warnings don't fail"*). So this fork mints a new check and picks its severity.

- **(a) Guideline only** — a rule in `we:docs/agent/platform-decisions.md` + the delivery-agent brief, no gate. Zero footgun, zero mechanism cost. But no teeth: agents forget, files keep growing, and a regression (a file crossing back into lock-point territory) is invisible until it bites throughput.
- **(b) SOFT-WARN gate — recommended.** `check:standards` emits a **non-blocking warning** when a file crosses a threshold, with a `scopeRationale`-style **escape-hatch marker** (an in-file `// @cohesive: <reason>` comment) that suppresses the warn for a genuinely cohesive large file. Surfaces the debt on every run, stays authorable and **agent-clearable** (a warn never blocks a land), and the escape hatch honours the cohesion caveat.
- **(c) HARD gate** — `check:standards` **errors** on an oversized file. Maximum teeth, but a *footgun*: a blocking deny on a high-churn file (`we:scripts/merge-ai-prs.mjs` is edited by 25 items) blocks **every unrelated edit** to it until someone lands the whole split — turning a background hygiene goal into a foreground blocker on the busiest file in the repo. *Rejected* — the deny lands the cost on exactly the wrong (highest-traffic) files.

**Recommended default: (b) soft-warn** — surface the throughput debt without blocking a churny file, with an escape hatch that respects cohesion. **The threshold is NOT raw line count** (the item's own caveat disavows it, and the barrel above proves lines mislabel a clean file). Key the warn on the signal that actually motivates the rule — a **composite of size AND scope-collision frequency**: a file is flagged only when it is both large *and* named by many queued items' scopes (the real serialization cost), suppressible by the cohesion marker.

Code shape (faithful to the real `warn(msg)` gate surface — a rule added to [we:scripts/check-standards-rules.mjs](../scripts/check-standards-rules.mjs), called from the gate):

```js
// New rule: flag files that are BOTH large and frequent scope-collision
// points — the serialization signal, not raw line count.
export function findLockPointFiles({ files, backlogScopes }) {
  const out = [];
  for (const f of files) {
    const codeLines = f.total - f.commentLines - f.blankLines;
    const collisions = backlogScopes.filter(s => s.includes(f.path)).length;
    // cohesion escape hatch: an in-file "@cohesive: <why>" marker suppresses
    const suppressed = /@cohesive:/.test(f.head);
    if (!suppressed && codeLines > 800 && collisions >= 5) {
      out.push({ path: f.path, codeLines, collisions });   // -> warn(), never error
    }
  }
  return out;
}
```

`Skeptic: SURVIVES-WITH-AMENDMENT.` A refute-only sub-agent flipped two things and I folded both in: (1) **citation-scope** — the #2625 precedent I was handed is the *gate-self trust-tier* decision (review:human vs review:pending); its "agent-clearable" is a property of a review *label*, not authority over a file-size lint. So #2625 is downgraded from *authority* to *sibling context* (it shows the repo's graduated-review instinct); the "warn-not-deny" default now rests on the **footgun-first / proportionate-gate** posture directly. (2) **wrong proxy** — a line-count trigger is exactly the metric the item disavows and would mislabel the barrel above (50%-comment); amended the threshold to a size+collision composite with a cohesion escape hatch. The soft-warn *level* itself survives — it is the proportionate choice between toothless guidance and a churn-file footgun.

`Screen: clear.` Fresh-context screen: (1) not an impl-detail-across-a-boundary call — it governs the repo's own authoring/tooling process, a legitimate process-standard, script-decidable -> hook. (2) Genuine merit fork — the three branches behave differently forever (deny blocks legitimate large files, warn keeps author judgment, guideline enforces nothing), independent of cost/timing.

## Recommended follow-up — the prioritized split list (dissolved from a fork per the two-confusion screen)

The two-confusion screen flagged a proposed "Fork 2 — split now vs opportunistic" as **prioritization wearing a fork's clothes**: strip timing and both branches reach the same end-state (the god-files split), so ordering is sequencing, not a ratifiable merit pick. So it is **dissolved to a recommended follow-up**, not a `## Fork N`:

**On ratify, file split stories for the top scope-collision files, ranked by collision frequency (the count that measures blocked parallelism), each `blockedBy` #2678:**

1. [we:scripts/merge-ai-prs.mjs](../scripts/merge-ai-prs.mjs) — 25 collisions (split first; already a 42-export barrel, so lowest-risk)
2. [we:scripts/lib/review-core.mjs](../scripts/lib/review-core.mjs) — 13
3. [we:scripts/lib/review-escalation.mjs](../scripts/lib/review-escalation.mjs) — 8
4. [we:scripts/pr-land.mjs](../scripts/pr-land.mjs) — 5
5. [we:scripts/lane-pool.mjs](../scripts/lane-pool.mjs) — 4

Two guardrails the skeptic surfaced, carried into each split story: **(i) split along existing responsibility seams only** — verify each target actually has separable clusters (as the barrel above does) before splitting; do not fragment a genuinely cohesive file to hit a number. **(ii) coordinate with #2679, don't front-run it** — the collision count is a *prediction* artifact (items over-declare the whole file, #2619); physical splitting is the lever available **today** because leases are file-level, but if #2679 ships sub-file leases the necessity shrinks, so sequence the splits alongside that work rather than blindly ahead of it.

## On ratify

- **Codify the rule** into [we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md) (a new standing-rule section with its own `#anchor`), and set `codifiedIn` on resolve.
- **Reflect it in the delivery-agent brief** (`we:.claude/skills/conveyor/delivery-agent-brief.md`): agents split god-files along genuine seams where it aids parallelism, without fragmenting cohesion.
- If Fork 1 rules (b), **file the soft-warn gate** as a build story (blockedBy #2678); then file the ranked split stories above.

## Relationships

- **#2679** — finer scope-lease granularity: this decision is the enabler that makes file-level (and eventually sub-file) leases pay off; the files above are its first split targets. Coordinate the split sequence with it.
- **#2677** — conveyor orchestration epic: same throughput program, the structural (files) counterpart to the orchestration (sessions) work.
- **#2606** — delivery throughput & latency program: this is a front-A parallelism lever it collects; a ratified small-file/split rule graduates to statute via the program's normal `codifiedIn` path.
- **#2625** — gate-self trust-tier decision: *sibling context* for Fork 1's warn-vs-deny instinct (the repo's graduated-review posture), **not** cited as authority over a file-size lint (see Fork 1 Skeptic line).
- **#2405** — harden/self-improve the PR-validation gate: a soft-warn file-size check is new gate surface that lands under that hardening program.
