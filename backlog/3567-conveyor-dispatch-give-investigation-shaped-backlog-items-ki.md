---
bornAs: x6qdz9n
kind: story
size: 5
parent: "3029"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:skills-src/conveyor/investigation-agent-brief.md", "we:scripts/check-standards-rules.mjs", "we:docs/agent/backlog-workflow.md"]
dateOpened: "2026-09-07"
tags: []
---

# Conveyor dispatch: give investigation-shaped backlog items (kind: investigation) their own auto-selected brief

Gap found live 2026-09-06/07: build-shaped backlog items auto-get a doctrine-loaded brief (we:skills-src/conveyor/delivery-agent-brief.md) via we:scripts/operations/dispatch-lane.mjs's launchKind selection (build/prepare/prepare-decision/fix/ci-heal, we:scripts/conveyor/tick-core.mjs's five spawn lists). 'Investigate and report' work has no equivalent: every such request required a hand-composed Agent() prompt restating check-first-before-proposing, route-discovered-gaps-through-file-item, root-cause-only-fix doctrine, and a short-plain final-report shape from scratch. #3150 (declare explore operation, delivered 2026-08-17) is the closest prior art but is a manually-invoked, on-demand N-panelist committee (we:scripts/operations/explore.mjs) never wired into the conveyor's own automatic dispatch cycle -- it answers 'a live session wants to run a committee now', not 'a filed card gets picked up and investigated on its own'. Recommended shape (a real design fork, resolved here with reasoning): add kind: investigation as a genuine new value on the existing kind axis (we:docs/agent/backlog-workflow.md), NOT a label/tag on an existing kind. Precedent: we:scripts/readiness/dispatch-plan.mjs already special-routes kind: decision (item.kind === 'decision' -> held needs-decision, its own prepare/present lifecycle) and grouping kinds (epic/feature -> needs-slice) OUTSIDE the plain build path -- kind is already the multiplexor for 'this item follows a different resolution lifecycle', exactly investigation's shape (investigate -> synthesize -> report, optionally file children, no build/PR). Add an analogous item.kind === 'investigation' branch; give we:scripts/conveyor/tick-core.mjs a 6th spawn list (spawnInvestigations) beside spawnBuilds/spawnPrepareScope/spawnPrepareDecision/spawnFixes/spawnCiHeals; give we:scripts/operations/dispatch-lane.mjs an 'investigate' launchKind (LAUNCH_KINDS, BRIEF_REQUIRED_BY_KIND, sessionSlugFor); author we:skills-src/conveyor/investigation-agent-brief.md parallel to we:skills-src/conveyor/delivery-agent-brief.md baking in check-first-before-proposing, route-discovered-gaps-through-file-item, root-cause-only-fix doctrine, and a required short-plain final-report shape. This is a single dispatched investigator, distinct from and NOT a replacement for #3150's multi-panelist we:scripts/operations/explore.mjs, which stays the on-demand ad hoc committee tool a live session invokes by hand -- the two are complementary. Done when: kind: investigation is a valid tested kind-axis value; a cleared investigation item routes through the new spawnInvestigations list instead of spawnBuilds; dispatch-lane fills we:skills-src/conveyor/investigation-agent-brief.md the same way it fills the delivery brief today; a report-only run produces no backlog file and a file-item-terminal run produces one, mirroring #3150's own parameterized-terminal test; we:docs/agent/backlog-workflow.md's kind vocabulary is updated.

## Done when

1. **`kind: investigation` is a valid, tested kind-axis value** — check:standards' kind-axis validation
   (we:scripts/check-standards-rules.mjs) accepts it, and it is documented in
   we:docs/agent/backlog-workflow.md's kind vocabulary alongside `story | epic | task | decision | feature`.
2. **A cleared `kind: investigation` item routes to a new path, not `spawnBuilds`.** we:scripts/readiness/dispatch-plan.mjs
   gets an `item.kind === 'investigation'` branch analogous to its existing `kind === 'decision'` branch (held
   `needs-investigation` or an equivalent direct route), and we:scripts/conveyor/tick-core.mjs's `planTick` gains
   a 6th spawn list (`spawnInvestigations`) beside `spawnBuilds`/`spawnPrepareScope`/`spawnPrepareDecision`/
   `spawnFixes`/`spawnCiHeals`. A test asserts an investigation-kind item never lands in `spawnBuilds`.
3. **`dispatch-lane` gains an `investigate` launchKind** — we:scripts/operations/dispatch-lane.mjs's
   `LAUNCH_KINDS`, `BRIEF_REQUIRED_BY_KIND` and `sessionSlugFor` all cover it, and it fills a new
   we:skills-src/conveyor/investigation-agent-brief.md template the same way `build` fills
   we:skills-src/conveyor/delivery-agent-brief.md today.
4. **The new brief bakes in the four doctrines this item exists to stop hand-composing every time**:
   check-first-before-proposing, route any discovered gap through `file-item` (never a hand-rolled scaffold),
   root-cause-only fixes (no band-aid/symptom patches), and a required short-plain final-report shape.
5. **Test coverage mirrors #3150's own parameterized-terminal pattern** — the SAME harness exercised twice,
   asserting a report-only run writes nothing while a file-item-terminal run produces a real backlog file via
   `we:scripts/backlog.mjs scaffold --json` (or the declared `file-item` operation).
6. **Explicitly out of scope**: this does NOT change we:scripts/operations/explore.mjs (#3150's manually-invoked
   N-panelist committee) — that stays the on-demand tool a live session calls by hand; this item only wires the
   conveyor's own automatic per-item dispatch to recognize and correctly brief an investigation-shaped card.

## Placement note (2026-09-07)

This item's kind-based dispatch routing generalizes we:backlog/2445's own "item selection/authoring" AI seam
past the build-only path. we:backlog/3620 tracks generalizing it into the Loop's own item-selection
substrate under the existing Plateau Loop epic (we:backlog/2445). Build and land this item for WE's own
conveyor regardless; this note is a forward pointer, not a dependency.
