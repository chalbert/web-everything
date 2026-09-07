---
kind: story
size: 3
parent: "2445"
status: open
blockedBy: ["3567"]
dateOpened: "2026-09-07"
tags: [plateau-loop, item-selection, dispatch, constellation-placement]
---

# Plateau Loop: generalize WE's investigation-kind dispatch routing into the coordinator's own item-selection/authoring seam

we:backlog/2445's Extraction seams name 'item selection/authoring' as one of the three bounded AI seams and 'backlog CLI' as part of the deterministic substrate the coordinator inherits. we:backlog/3567 extends WE's own conveyor dispatch to give investigation-shaped items (not just builds) their own kind-routed brief — a first-class generalization of item-selection beyond the build-only path. Tracks that the Loop's own item-selection/authoring seam should generalize kind-routing the same way once it exists to consume it; does not rebuild the WE-side dispatch work.

## Grounding — checked against we:backlog/2445's actual text, not assumed

- **we:backlog/2445's own "Extraction seams" section**: "AI enters at exactly three bounded points — lane workers, diff judging, item selection/authoring, each behind a stable contract... backlog CLI" is named as part of the deterministic substrate. we:backlog/3567 is squarely item-selection work: which *kind* of dispatch a cleared backlog card gets routed to.
- **The pattern generalizes past "build vs. not build."** we:backlog/3567's own reasoning notes `we:scripts/readiness/dispatch-plan.mjs` already special-routes `kind: decision` and grouping kinds (epic/feature) outside the plain build path — "kind is already the multiplexor for 'this item follows a different resolution lifecycle.'" A coordinator managing a registry of projects (we:backlog/2472) with heterogeneous backlogs will need the identical multiplexing: not every dispatchable unit of work across WE/FUI/plateau-app is a build.
- **`file-item` itself (we:scripts/operations/file-item.mjs)** — the mechanism this very tracker item was filed through — is exactly the "backlog CLI" piece of the extraction seams. we:backlog/3567's kind-vocabulary extension (`kind: investigation`) is a direct extension of that same CLI's own vocabulary, not a separate mechanism.

## What's actually being generalized

- **we:backlog/3567** adds `kind: investigation` as a first-class value on the existing kind axis, gives it its own spawn list (`spawnInvestigations`) beside the five existing ones, its own `dispatch-lane` launch kind, and its own doctrine-loaded brief (check-first-before-proposing, route-through-file-item, root-cause-only, short-plain final report) — parallel to, not a replacement for, we:backlog/3150's manually-invoked N-panelist committee tool.

## Not in scope

- Rebuilding, rescoping, or re-deciding the WE-side item above.
- Deciding what other kinds (beyond `investigation`) the Loop's own item-selection seam should eventually route — that is future scoping, not decided here.
- Any plateau-app-side filing or `locus:` field, per we:docs/agent/platform-decisions.md#backlog-tracking-locus-now-distributed-next.

## Cross-references added

- we:backlog/3567 — now carries a short pointer to this item.

## Done when

1. **Executable** — TODO: once we:backlog/3567 lands and `kind: investigation` has run for real dispatched work, this item is `/prepare`d into a concrete plateau-app build scope (how the Loop's own item-selection seam represents and routes multiple work-kinds across a multi-project registry) rather than left as a placeholder.
