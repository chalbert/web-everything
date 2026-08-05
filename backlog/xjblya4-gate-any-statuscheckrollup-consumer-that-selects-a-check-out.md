---
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

`check:standards` has no rule over `statusCheckRollup`, so a fourth reader can re-hand-roll the per-name lookup
and silently disagree with the drain again — as three already did.

## Why it is owed

`#xkfv491` fixed the drain to read the LATEST rollup entry per check name. The same assumption was hand-rolled
in three sibling readers as `roll.find((c) => (c?.name || c?.context) === requiredCheck)`, i.e. the FIRST entry,
and all three were wrong in the same way for months without anything noticing. PR #1049 adopted the shared
`latestRequiredCheck` in two of them ([we:scripts/conveyor/pr-watch.mjs](../scripts/conveyor/pr-watch.mjs) and
both [we:scripts/lane-resume.mjs](../scripts/lane-resume.mjs) sites); nothing stops a fifth from being written
tomorrow.

The failure mode is silent by construction: a hand-rolled lookup returns a plausible entry, so the reader
produces a confident wrong answer (`red` on a green PR) rather than an error. `we:scripts/conveyor/pr-watch.mjs`
even carried a docstring asserting parity with the drain while holding the opposite rule — a false in-repo
parity claim that no test could catch, because both sides were self-consistent.

`statusCheckRollup` appears nowhere in `we:scripts/check-standards-rules.mjs` today.

## Build

Add a `check:standards` rule that **errors** on any file under `we:scripts/` that mentions `statusCheckRollup`
and also selects a single entry by name — `.find(`, `.filter(` or an index-returning loop whose predicate
compares against a check name — outside the shared helper.

- Allowlist the helper's own definition site (`latestRequiredCheck` / `rollupRowKind` in
  `we:scripts/merge-ai-prs.mjs`) and the whole-rollup folders that legitimately scan every entry rather than
  picking one (`ciRollup` in `we:scripts/readiness/conveyor-state.mjs`, `ciWindow` in
  `we:scripts/readiness/conveyor-instrument.mjs`, `rollupToCheckRows` in `we:scripts/fetch-parked.mjs`) — these
  do not select "the" check and are not the defect class.
- The error message must name the fix: import `latestRequiredCheck` from `we:scripts/merge-ai-prs.mjs`.
- Document the rule in `we:docs/agent/conventions.md` beside the other script-shape gates.

Carved out of [#2925](2925-three-rollup-readers-still-take-the-first-entry-per-check-na.md), which owns the
remaining reader repair (`ciRollup`'s per-name collapse). The gate is filed separately because it is the
PREVENTION — it must outlive the specific readers it was written for.

## Acceptance

- The gate fires on a re-introduced `roll.find((c) => (c?.name || c?.context) === requiredCheck)` in a new
  `we:scripts/` file, and on the exact pre-#xkfv491 text of `we:scripts/lane-resume.mjs:439`.
- The gate is green on the repaired tree, with the whole-rollup folders above allowlisted rather than rewritten.
- `npm run check:standards` stays at 0 errors.
