---
bornAs: x00f4mm
kind: story
size: 2
parent: "3717"
status: resolved
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs", "we:docs/agent/backlog-workflow.md"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
graduatedTo: none
tags: []
---

# Fork 4 of #3801, field: a task declares an estimate in its own frontmatter field, distinct from story points, that the burndown never sums

Ruled in #3801 Fork 4 (b), consequence 1: a task needs a declared estimate that is NOT points, because a size: on a task would double-count the burndown (the validator refuses it, we:scripts/check-standards-rules.mjs:381). This slice adds one task-only frontmatter field in estimated changed lines, the unit the router already reads, validates it, documents it beside the sizing guide in we:docs/agent/backlog-workflow.md, and has the dispatch route read it for a task.

**Home:** the prototype branch `lane/mechanical-dispatcher`, together with the router that reads the field. `we:scripts/check-standards-rules.mjs` and `we:docs/agent/backlog-workflow.md` also exist on `main`; the change graduates to `main` with the rest through #3443. Commit straight to the branch, no PR, one tracker note on #3383 per push.

**The field.** One task-only frontmatter field holding a positive whole number of estimated changed lines (predicted name `estimatedLoc:`, the unit `SIZE_TO_ESTIMATED_LOC` already converts to). A story keeps `size:` only; a task keeps no `size:`. The burndown never sums the new field, so the no-double-count rule (`we:docs/agent/backlog-workflow.md:171`) holds.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs` passes with a new case that fails before: a `task` dispatch carrying the field routes on that number and records `sized: true`, and a `story` carrying it is refused as invalid.
2. **Executable** — `npm run check:standards` reports 0 errors on the branch, and a test in the check-standards rules suite shows an error for the field on a story and for a non-numeric value, and none for a task carrying it.
3. **Observable** — the sizing guide in `we:docs/agent/backlog-workflow.md` names the field, its unit, and that the burndown does not sum it.

> **Verified done, 2026-09-22.** Already built and committed straight to `lane/mechanical-dispatcher` at
> `b696d6435` ("#3839 (Fork 4 field of #3801): task-only `estimatedLoc:` dispatch estimate"), ahead of this
> card being picked up. Re-verified against the branch tip: `we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs`
> carries the named `estimatedLoc` cases (`sized: true` for a task, `estimatedLoc:task-only` refusal for a
> story) and passes; `npm run check:standards` is clean of any error this card's scope introduces. Resolved
> here as `graduatedTo: none` — the code is not yet on `main`; it reaches `main` through #3443, per this
> card's own `Home:` section.
