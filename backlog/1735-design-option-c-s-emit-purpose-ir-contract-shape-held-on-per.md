---
kind: story
size: 5
parent: "746"
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal:idiomatic-vue-svelte-angular-emitters-shipped"
relatedProject: webdocs
relatedReport: reports/2026-06-16-forward-component-emit-substrate.md
dateOpened: "2026-06-24"
tags: [webdocs, adapters, polyglot, generation, component-emit, deferred]
---

# Design Option C's emit-purpose IR contract shape (held on per-framework-emitter evidence)

The direction is ratified (#939): the browser-component forward-emit substrate is a dedicated emit-purpose IR, not the lossy ingest ComponentIR. This residual is the held CONTENT — designing C's actual fields/grammar (the neutral @webeverything generation contract). Parked on the evidence trigger: design it once the idiomatic Vue/Svelte/Angular emitters accumulate real cases showing where the flat declarative <component> subset stops stretching, rather than guessing the shape today (per #811's decide-with-cases). Not a backlog edge — the gate is empirical, not a phantom node.
