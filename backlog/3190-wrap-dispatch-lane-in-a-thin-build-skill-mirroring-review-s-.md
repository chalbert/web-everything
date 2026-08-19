---
bornAs: xj1d04h
kind: story
size: 3
parent: "3029"
relatedTo: ["3152", "3172"]
status: open
dateOpened: "2026-08-17"
tags: [operations, epic-3029, skills]
---

# Wrap dispatch-lane in a thin /build skill, mirroring /review's shape

Surfaced by tonight's (2026-08-17) operations audit: `we:scripts/operations/dispatch-lane.mjs` is a declared
operation (`node we:scripts/operations/run.mjs dispatch-lane --num=<NNN> …`) that takes `--num` and dispatches
the ONE build the tick core already selected for that item (or reports why it was suppressed — a live guard
already holds the num or its lane). No skill wraps it for a human who just wants to build one named item:
`we:skills-src/conveyor/SKILL.md` explicitly disclaims this use case ("NOT for landing PRs... and NOT for one
item — that is /batch or a solo lane"), and `we:skills-src/batch-backlog-items/SKILL.md` still hand-rolls a raw
`node we:scripts/lane-pool.mjs acquire` followed by a manually spawned build agent instead of calling
`dispatch-lane` — confirmed via a repo-wide grep showing zero `we:SKILL.md` files reference `dispatch-lane` or
`dispatchLaneOperation` by name. This is the same class of gap `/review` (`we:skills-src/review/SKILL.md`)
already closed for `review-pr`: invoke the declared operation and present its output, rather than re-deriving
the lane-acquire/dispatch/observe ceremony by hand each time.

Related, not the same item: /backlog/3152-genericize-prepare-into-a-kind-polymorphic-operation-absorbi/
genericizes the `prepare` OPERATION so it applies to stories as well as decisions (already covers the
"consolidated prepare, not just decision" ground). /backlog/3172-declare-a-file-backlog-gap-operation-prove-it-for-one-use-ca/
is building the general skill-plug mechanism for operations, proven first on `file-backlog-gap`. This item is narrower than
either — it is the ONE skill file that wraps the ALREADY-DECLARED `dispatch-lane` operation, following the
same by-hand pattern `/review`'s skill file already used (no shared plug mechanism required to do this one).

## Done when

1. **Executable** — a new `we:skills-src/build/SKILL.md` (symlinked to `we:.claude/skills/build`, matching
   every other skill's layout) documents invoking `dispatch-lane` for a single named item:
   `node we:scripts/operations/run.mjs dispatch-lane --num=<NNN> --json`, and a test or manual run against a
   fixture item shows the skill's documented command line actually dispatches (or correctly reports a
   suppression reason) rather than silently no-op'ing.
2. The skill file explicitly tells the operator what `/batch`'s current hand-rolled path (`we:scripts/lane-pool.mjs
   acquire` + a manually spawned agent) still covers that this skill does not (multi-item batching), so `/build`
   is scoped to "one item" the same way `/review`'s own doc scopes itself to one PR.
3. `we:skills-src/batch-backlog-items/SKILL.md` is updated to either call the new `/build` skill's underlying
   `dispatch-lane` invocation per item, or to explicitly note (with a reason) why it still hand-rolls — not left
   silently diverging from the new skill once it exists.
4. `npm run check:standards` is 0 errors.
