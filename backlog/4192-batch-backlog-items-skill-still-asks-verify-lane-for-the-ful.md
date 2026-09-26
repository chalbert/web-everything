---
bornAs: xgmqm8t
kind: story
size: 1
parent: "4075"
status: resolved
scope: ["we:skills-src/batch-backlog-items/SKILL.md"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-26"
dateResolved: "2026-09-26"
graduatedTo: none
tags: []
---

# batch-backlog-items skill still asks verify-lane for the full test:unit suite, not the selected gate

we:skills-src/batch-backlog-items/SKILL.md:86 hardcodes --gate="npm run test:unit && npm run check:standards -- --scope=<batch-slug>" on every verify call, forcing the FULL unscoped unit suite every seam. we:scripts/verify-lane.mjs has supported a diff-driven SELECTED gate as its own default since #3372 (much faster; an explicit --gate= override skips that selection entirely). Switch the skill to the selected gate (drop the --gate= test:unit override, or otherwise invoke the diff-driven default) so a batch session's per-item verify seam is fast, matching #3372's own intent.

## Done when

1. **Executable** — `grep -n 'test:unit' we:skills-src/batch-backlog-items/SKILL.md` finds the hardcoded full-suite `--gate=` before this lands and finds none (or only the selected-gate wording) after.
2. **Live proof** — time a real batch seam's verify call before and after on the same lane/diff: before, `we:scripts/verify-lane.mjs` runs the full `npm run test:unit`; after, it runs the diff-driven selected gate, with a real elapsed-time before/after comparison recorded.
3. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.

## Resolution — DUPLICATE, already fixed by #4182 (landed before this card was worked)

`we:skills-src/batch-backlog-items/SKILL.md`'s exact hard-coded `--gate="npm run test:unit && npm run
check:standards -- --scope=<batch-slug>"` line was already removed in commit `c119ad6b4` (PR resolving
`#4182`/bornAs `4182`, "align batch-parallel-execute workflow with the diff-selected gate +
no-subagent policy"), landed 2026-09-25 19:19 — the same day this card was filed. That commit's own
message calls out fixing "the equivalent stale gate in we:skills-src/batch-backlog-items/SKILL.md's
serial `/batch` close-out" as part of its broader `we:skills-src/batch-backlog-items/parallel-execute.workflow.js`
alignment.

**Grep before/after** (`grep -n 'test:unit' we:skills-src/batch-backlog-items/SKILL.md`):
- **Before** (`c119ad6b4~1`): `86:   node we:scripts/operations/run.mjs verify --checkout=<lane>
  --gate="npm run test:unit && npm run check:standards -- --scope=<batch-slug>" --json` — the exact
  hardcode this card describes.
- **After** (current `origin/main`): the only hit is line 94's cautionary prose — never add a
  hand-written `--gate=`, since a hand-written `--gate="npm run test:unit && …"` now only forces the
  OLD, slower, unscoped full suite back on — i.e. the live instruction now reads
  `node we:scripts/operations/run.mjs verify --checkout=<lane> --json` (verify-lane's own diff-selected
  default, no override), and the doc explicitly warns future editors never to reintroduce the override.
  Satisfies this card's own Done-when #1 verbatim ("finds none, or only the selected-gate wording").

**Broader sweep** (this card's own ask): `grep -rn -- '--gate=' we:skills-src/ we:docs/agent/` and
`grep -rln 'npm run test:unit' we:skills-src/ we:docs/agent/` turn up no other live instruction forcing
the unscoped full suite as a verify-lane gate — the remaining hits are `we:skills-src/use-codex/SKILL.md`
and `we:skills-src/use-gemini/SKILL.md`'s own unrelated `--gate=none|standards|full` option on
`we:scripts/codex-direct-task.mjs`/`we:scripts/gemini-direct-task.mjs` (a different, deliberately opt-in
escape-hatch script, out of this card's scope), plus prohibitions ("never run the full suite yourself")
in the conveyor dispatched-agent briefs, and historical decision-log prose in
`we:docs/agent/platform-decisions.md`. `we:.claude/skills/batch-backlog-items/SKILL.md` (the deployed
copy) is byte-identical to `we:skills-src/`'s own copy — already in sync, no separate sync step needed.

No code change needed here — closing as a duplicate so the backlog reflects reality. `graduatedTo:
none` (the fix lives under #4182, not a new entity of this card's own).
