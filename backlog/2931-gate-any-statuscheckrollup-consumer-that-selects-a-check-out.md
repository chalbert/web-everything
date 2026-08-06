---
bornAs: xjblya4
kind: task
status: open
dateOpened: "2026-08-05"
tags: [drain, ci, gate, check-standards]
scope:
  - we:scripts/check-standards-rules.mjs
  - we:scripts/__tests__/check-standards-rules.test.mjs
  - we:docs/agent/conventions.md
---

# Gate any statusCheckRollup consumer that selects a check outside the shared latestRequiredCheck helper

`check:standards` has no rule over `statusCheckRollup`, so yet another reader can re-hand-roll the per-name
lookup and silently disagree with the drain again — as five already did, in two different shapes.

## Why it is owed

`#2932` fixed the drain to read the LATEST rollup entry per check name. The same assumption was hand-rolled
in three sibling readers as `roll.find((c) => (c?.name || c?.context) === requiredCheck)`, i.e. the FIRST entry,
and all three were wrong in the same way for months without anything noticing. PR #1049 adopted the shared
`latestRequiredCheck` in two of them ([we:scripts/conveyor/pr-watch.mjs](../scripts/conveyor/pr-watch.mjs) and
both [we:scripts/lane-resume.mjs](../scripts/lane-resume.mjs) sites); nothing stops the next one from being
written tomorrow.

Two MORE readers hold the same assumption in the opposite shape — they fold EVERY rollup entry into one verdict
rather than picking one, which lets a superseded `CANCELLED` poison a green PR just as effectively (`ciRollup` in
`we:scripts/readiness/conveyor-state.mjs`, `rollupToCheckRows` in `we:scripts/fetch-parked.mjs`, the latter
reaching the `/review` bundle and the drain's state line). So the gate cannot be written against the `.find(`
shape alone — despite this item's title, it has to cover both, or it certifies the half of the defect that is
still live. Those two repairs belong to
[#2925](2925-three-rollup-readers-still-take-the-first-entry-per-check-na.md); the rule is what stops a sixth.

The failure mode is silent by construction: a hand-rolled lookup returns a plausible entry, so the reader
produces a confident wrong answer (`red` on a green PR) rather than an error. `we:scripts/conveyor/pr-watch.mjs`
even carried a docstring asserting parity with the drain while holding the opposite rule — a false in-repo
parity claim that no test could catch, because both sides were self-consistent.

`statusCheckRollup` appears nowhere in `we:scripts/check-standards-rules.mjs` today.

## Build

Add a `check:standards` rule that **errors** on any file under `we:scripts/` that mentions `statusCheckRollup`
and does either of the two things that produce the same wrong answer:

- **(a) selects a single entry by name** — `.find(`, `.filter(` or an index-returning loop whose predicate
  compares against a check name — outside the shared helper; or
- **(b) folds the rollup into a pass/fail/pending verdict without collapsing to the latest entry per check name
  first.** Selecting the first entry and folding every entry are ONE defect in two shapes: a superseded
  `CANCELLED` beside a later `SUCCESS` reads red either way.

Allowlisting:

- Allowlist the shared helper's own definition site — `latestRequiredCheck` / `rollupRowKind`, and the
  per-name collapse #2925 proposes to add beside them (`collapseRollupToLatestPerName`), all in
  `we:scripts/merge-ai-prs.mjs`. That is where the rule is implemented, so it cannot also be governed by it.
- Allowlist `ciWindow` (`we:scripts/readiness/conveyor-instrument.mjs`): it scans every entry only for the min
  `startedAt` / max `completedAt` and derives no verdict, so a per-name collapse would be meaningless there.
  This is the ONLY genuine "scans every entry, not the defect class" case.
- **Do NOT allowlist the whole-rollup folders** — `ciRollup` (`we:scripts/readiness/conveyor-state.mjs`) and
  `rollupToCheckRows` (`we:scripts/fetch-parked.mjs`). Both are shape (b) and both are currently WRONG; they are
  [#2925](2925-three-rollup-readers-still-take-the-first-entry-per-check-na.md)'s remaining repair. Exempting
  them here would bake the live defect in permanently, and would contradict #2925, which says the same two
  readers still need fixing. The rule they must satisfy is POSITIVE — collapse per name, then fold — so the gate
  **requires** the collapse of them rather than excusing its absence.
- Sequencing: those two files are the gate's known-red cases until #2925 lands. Land this gate AFTER that repair,
  or ship it warning-only first and promote it to `error` once the tree is clean — never by adding them to the
  allowlist.
- The error message must name the fix: import `latestRequiredCheck` from `we:scripts/merge-ai-prs.mjs`.
- Document the rule in `we:docs/agent/conventions.md` beside the other script-shape gates.

Carved out of [#2925](2925-three-rollup-readers-still-take-the-first-entry-per-check-na.md), which owns the
remaining reader repairs — the per-name collapse in BOTH `ciRollup` and `rollupToCheckRows`, and the shared
`collapseRollupToLatestPerName` seam they and the drain would cite. The gate is filed separately because it is
the PREVENTION — it must outlive the specific readers it was written for.

## Acceptance

- The gate fires on a re-introduced `roll.find((c) => (c?.name || c?.context) === requiredCheck)` in a new
  `we:scripts/` file, and on the exact pre-#2932 text of `we:scripts/lane-resume.mjs:439`.
- The gate fires on a rollup FOLD that skips the per-name collapse — e.g. the exact pre-repair text of
  `ciRollup` (`we:scripts/readiness/conveyor-state.mjs`) or `rollupToCheckRows` (`we:scripts/fetch-parked.mjs`).
- The gate is green on the repaired tree — i.e. once #2925 has given those two their per-name collapse. `ciWindow`
  passes by allowlist; the two folders pass by being FIXED, never by being exempted.
- `npm run check:standards` stays at 0 errors.
