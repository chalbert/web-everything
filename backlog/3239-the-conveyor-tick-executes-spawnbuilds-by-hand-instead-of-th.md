---
bornAs: xbbscm5
kind: story
size: 5
parent: "3029"
status: resolved
dateOpened: "2026-08-21"
dateResolved: "2026-08-26"
graduatedTo: 3096
tags: []
---

# the conveyor tick executes spawnBuilds by hand instead of through dispatch-lane

> **Duplicate of #3096 — resolved as such, not as work done.** Nothing in this card was built. It described
> the same rewiring as `#3096` (filed 2026-08-13) and `#3147` (filed 2026-08-16); this card was filed last, on
> 2026-08-21, and #3096 survives because it was filed FIRST. The work is still open, on #3096.
>
> **Nothing unique was lost.** This card's prose is one paragraph restating the build-half routing plus a
> `TODO` Done-when — all of it already on #3096, which additionally carries the prepare half, the liveness
> hardenings and the first-live-run clause. Its one real asset was an in-code citation rather than text: the
> `<!-- @operation-home-ok: … -->` marker at `we:skills-src/conveyor/SKILL.md:77`, which suppresses the #3224
> scan on the tick-core line and pointed here by born-as hash. **That marker was repointed at #3096 in the
> same commit that resolved this card**, so the suppression names a live item instead of a resolved duplicate.

`we:skills-src/conveyor/SKILL.md` instructs `we:scripts/conveyor/tick-core.mjs` for the whole per-tick state machine, then has the agent EXECUTE the decisions — including `spawnBuilds`, which is exactly what the `dispatch-lane` operation declares over. The skill needs the full tick, so it cannot simply be renamed to the operation; the dispatch half should route through `dispatch-lane` while the rest of the decisions stay hand-executed. Found by the #3224 scan on its first run.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
