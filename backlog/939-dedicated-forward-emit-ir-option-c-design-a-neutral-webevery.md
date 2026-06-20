---
kind: decision
size: 3
parent: "746"
status: parked
relatedProject: webdocs
blockedBy: ["818"]
dateOpened: "2026-06-18"
tags: [webdocs, adapters, polyglot, generation, component-emit, deferred]
---

# Dedicated forward-emit IR (Option C) — design a neutral @webeverything emit-purpose contract, case-informed post-subset

Phase-2 design call deferred from [#818](/backlog/818-author-mode-emit-substrate-dedicated-forward-emit-purpose-ir/): whether (and how) to design a **dedicated emit-purpose IR** — Option C from #811 Fork 2, a neutral `@webeverything` contract built *for* forward emit rather than reusing the ingest-focused `ComponentIR`. De-buried here from #818's body so the fork lives in its own card, not inline in a build item (the *Decisions Are Work Items* rule).

## Why parked, not open

The whole point of #811's subset-first ruling is to **delay this decision until it's case-informed, not guessed**. The trigger is empirical: the flat declarative `<component>` subset under-specifies Vue/Svelte/Angular binding idioms (the "wall"), and the *cases* where it stops stretching — accumulated by #818's subset-first foundation emitting against real components — are the evidence that shapes C. Deciding now would guess the IR shape; that's exactly what #811 ruled against.

## Unparks when

#818's foundation (subset emit over the existing `serve(definition,{form})` forms) has shipped and produced enough real per-framework cases that the subset "demonstrably stops stretching." At that point this becomes an `open` `type: decision` to run the C-design fork with the accumulated evidence. Until then it stays `parked` — `blockedBy: 818`.

## The fork (to be made with evidence, not now)

- **Extend `ComponentIR` bidirectionally** (reuse the ingest representation for emit) vs. **a dedicated emit-purpose IR (Option C)** — a separate neutral `@webeverything` contract authored for generation. #811 leaned toward C *eventually*, deferred until informed. The decision also covers C's contract surface and where it sits relative to the #463/#507 forward-generation family.
