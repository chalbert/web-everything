---
kind: task
status: open
scope: ["we:scripts/__tests__/lane-verify.test.mjs", "we:docs/agent/backlog-workflow.md", "we:agent-memory-src/single-session-should-use-a-lane.md", "we:agent-memory-src/lane-pr-is-universal-delivery-all-repos.md"]
blockedBy: ["3321"]
dateOpened: "2026-08-27"
tags: []
---

# Caller sweep should require gate-scoping consistency across the documented lane-local verify arcs

#3321 made `pr-land`'s finish-guard mandatory and re-pointed four documented lane-local arcs to run
`we:scripts/operations/run.mjs verify` after the item commit. Only one of the four scopes its gate;
the other three inherit `verify-lane`'s default, which scans the WHOLE repo. So a pre-existing,
unrelated error inherited from `main` can record a RED marker for an otherwise-correct commit, and the
mandatory guard then refuses the land. It fails closed and visibly — a debug cycle, not a bad landing.
Scope the other three arcs, and add the check that would have caught the drift.

## Provenance

Filed as the OWED prevention from the review of PR #1609 (#3321 round 6). The reviewing operator
recorded the finding as **CONFIRMED and real, but explicitly non-blocking**, and noted it was *"NOT
captured anywhere yet"* — this card is that capture. It is **not** a defect in #3321's diff: that PR
claims scoping only for the `/batch` arc, so nothing it states is false.

## The gap, measured

Measured in a lane clone at #3321's head, not taken from the review —
`grep -n "we:scripts/operations/run.mjs verify"` over the four arcs:

| arc | file:line | gate |
| --- | --- | --- |
| `/batch` close-out | `we:skills-src/batch-backlog-items/SKILL.md:85` | `--gate="npm run test:unit && npm run check:standards -- --scope=<batch-slug>"` — **scoped** |
| canonical per-item | `we:docs/agent/backlog-workflow.md:1003` | no `--gate` — **unscoped** |
| single-session lane note | `we:agent-memory-src/single-session-should-use-a-lane.md:27` | no `--gate` — **unscoped** |
| cross-repo delivery | `we:agent-memory-src/lane-pr-is-universal-delivery-all-repos.md:18` | no `--gate` — **unscoped** |

The default is `we:scripts/verify-lane.mjs:52` — `npm run test:unit && npm run check:standards`, with
no `--scope`.

The existing `#3321` caller sweep cannot catch this. It asserts verify-command **adjacency** — that a
`pr-land` invocation declares a posture — and never inspects the **gate** the adjacent verify runs.

## Done when

1. **Executable** — a command that fails before this item lands and passes after: stripping the
   `--gate` from `we:skills-src/batch-backlog-items/SKILL.md:85` reddens the new check, and the
   failure names that file:line. Green with the arcs as this item leaves them.
2. The three unscoped arcs either forward a `--gate` scoped to the item the way the `/batch` arc does,
   **or** this card records a measured reason why an unscoped gate is correct for that arc
   specifically. "It seemed fine" is not a reason; a run showing the scoped gate would miss a real
   failure is.
3. A check exists asserting gate-scoping consistency across every documented lane-local verify arc —
   either an extension of the `#3321` caller sweep in `we:scripts/__tests__/lane-verify.test.mjs`
   (which already enumerates these arcs **by name**, so it is the natural seat) or a `check:standards`
   rule.
4. That check is **mutation-proven** per criterion 1. A guard that cannot be shown to fire is the
   failure mode #3321 was bounced five rounds for; do not ship a third un-mutated claim.
5. `npm run check:standards` shows no new errors and no new warnings versus `main`, measured on both
   sides in the same session.
