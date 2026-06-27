---
kind: story
size: 13
status: open
priority: low
unsplittableReason: foundational
locus: frontierui
relatedProject: webexpressions
relatedReport: reports/2026-06-27-split-analysis-1827.md
dateOpened: "2026-06-27"
tags: [webexpressions, injector-context, ssr, hydration, fui-runtime, awaiting-consumer]
---

# SSR injector-context hydration: seed the webexpressions injector chain from server-rendered state

A general capability surfaced by #1818: when a block's declarative binding (`rows="[[ @ctx ]]"`) resolves against a **non-deterministic** (client-only) context, the server cannot resolve it at build — so on upgrade the client must seed the `webexpressions` injector chain from runtime state before the binding resolves. This card covers that hydration mechanism: how an injector-chain context is populated from client-only state so declarative `[[ ref ]]` bindings have something to resolve against. General to every block's declarative-binding form, not data-table-specific.

**Off the docs critical path.** Per #1818's determinism × interactivity rule, the docs `<table>` family (#1787 / #1600) is wholly **deterministic** — the build resolves its bindings server-side and emits plain `<table>`s, needing no client payload and no hydration. This card is required only by **app / dynamic** consumers whose context is client-only. It does **not** block the docs surface; verify a real non-deterministic consumer before building (per *Prep: Verify Mechanism Has A Consumer*).

## Disposition (verified 2026-06-27, batch-2026-06-27-1787-1834)

This card is **FUI-homed and consumer-parked** — it is not buildable in `webeverything` now. Two verified facts set this:

1. **It is a standard *implementation*, not a contract — so it lives in FUI, never WE** (foundational zero-impl rule, `we:docs/agent/platform-decisions.md#constellation-placement`). The hydration mechanism is pure stateful runtime: it seeds the injector-context DI seam (`fui:plugs/webinjectors/InjectorRoot.ts` — the *same* mechanism the runtime route-view path reuses) from client-only state. No WE-side build gate consumes it over WE's own declarative data, so by the placement test the runtime → FUI. WE keeps only the **contract**, and that contract is **already codified** by the now-resolved #1818 in `we:docs/agent/platform-decisions.md#block-data-ingestion` (the non-deterministic cell + the precedence + the "carry raw typed values" correctness invariant). There is no residual WE-layer contract artifact left for this card to add. Hence `locus: frontierui`.

2. **No real non-deterministic consumer exists.** #1818 (resolved) establishes the entire docs `<table>` family (#1787 / #1600 / #1609–#1613, ~219 surfaces) is wholly **deterministic** and ships **without** this mechanism. No backlog item is `blockedBy: 1827`. Per *Prep: Verify Mechanism Has A Consumer* (`0 callers → build-vs-defer; needs the SPECIFIC orphan`) and this card's own "verify a real non-deterministic consumer before building" gate, there is nothing to build against — so it stays `priority: low` pending a real app/dynamic `we-`-block consumer whose `[[ @ctx ]]` binds to a client-only context.

**Sizing.** Bumped to `size: 13` — a *general* runtime hydration mechanism over the whole injector chain (every block's `[[ ref ]]` form), not a 5-point data-table slice; this also drops it out of the agent-ready batch pool, matching its real "FUI-homed, no-consumer" state.

**Un-park trigger:** a concrete non-deterministic consumer (an app/dynamic `we-` block whose declarative `[[ ref ]]` context is client-only) lands needing the injector chain seeded at upgrade — then build the mechanism in **FUI** against that consumer.

**Blocker note:** the former `blockedBy: ["1818"]` edge is cleared — #1818 is resolved and its contract (the non-deterministic cell) is codified; the edge was the contract dependency, now satisfied.
