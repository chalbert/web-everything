---
type: issue
workItem: task
parent: "170"
status: open
blockedBy: ["725"]
dateOpened: "2026-06-18"
tags: []
---

# Reconcile webvalidation registries' define() override with the CustomRegistry base type (FUI tsc)

The ported webvalidation registries (CustomValidityMergeRegistry/CustomValidatorResolutionRegistry) override define(strategy, asDefault) — structurally incompatible with the base CustomRegistry.define(name: string, ...args), yielding 4 tsc --noEmit errors (2 TS2416 + 2 cascading TS2345 in bootstrap) once FUI typechecks the ported plugs tree. Latent in WE too (WE tsconfig is src-only, never typechecks plugs/), so #725 ported it faithfully rather than diverging the copy. Ungated today (FUI check:standards/vitest/build:demo don't tsc the plugs tree) but FUI's plugs tree is otherwise tsc-clean. Reconcile the registry-base contract so the typed define() override is valid in both repos (keep WE↔FUI byte-identical). #170-family registry reconciliation.
