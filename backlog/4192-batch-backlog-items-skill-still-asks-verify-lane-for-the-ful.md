---
bornAs: xgmqm8t
kind: story
size: 1
parent: "4075"
status: open
scope: ["we:skills-src/batch-backlog-items/SKILL.md"]
dateOpened: "2026-09-25"
tags: []
---

# batch-backlog-items skill still asks verify-lane for the full test:unit suite, not the selected gate

we:skills-src/batch-backlog-items/SKILL.md:86 hardcodes --gate="npm run test:unit && npm run check:standards -- --scope=<batch-slug>" on every verify call, forcing the FULL unscoped unit suite every seam. we:scripts/verify-lane.mjs has supported a diff-driven SELECTED gate as its own default since #3372 (much faster; an explicit --gate= override skips that selection entirely). Switch the skill to the selected gate (drop the --gate= test:unit override, or otherwise invoke the diff-driven default) so a batch session's per-item verify seam is fast, matching #3372's own intent.

## Done when

1. **Executable** — `grep -n 'test:unit' we:skills-src/batch-backlog-items/SKILL.md` finds the hardcoded full-suite `--gate=` before this lands and finds none (or only the selected-gate wording) after.
2. **Live proof** — time a real batch seam's verify call before and after on the same lane/diff: before, `we:scripts/verify-lane.mjs` runs the full `npm run test:unit`; after, it runs the diff-driven selected gate, with a real elapsed-time before/after comparison recorded.
3. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
