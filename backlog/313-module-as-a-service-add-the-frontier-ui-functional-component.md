---
kind: story
size: 2
parent: "081"
status: open
blockedBy: ["1746"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-24"
tags: []
---

# Module-as-a-Service — add the Frontier UI functional-component adapter as a FORMS entry

Spun out of #081. Adds the Frontier UI functional-component adapter (we:plans/functional-component-adapter.md) as a new FORMS entry once it lands, replacing the WE-internal generator stub. Independent of the other #081 follow-ons.

> **Parked (2026-06-12).** Gated on a prerequisite that hasn't landed: the FUI functional-component adapter itself is still a plan (`we:plans/functional-component-adapter.md`) with **no implementation in `frontierui/`** (no `FunctionalComponent` source, no tracked build item). This task is "add it as a FORMS entry *once it lands*" — there is nothing to register yet. Surfaced and parked during batch pre-flight (mis-flagged Tier-A). Un-park when the adapter ships in Frontier UI.

## Re-scope finding (batch-2026-06-23-1725-1665) — premise superseded; `blockedBy: 1746`

Un-parked when blocker #1602 resolved, but working it surfaced that the original premise is **stale**, not buildable as written:

- #1602 landed `fui:tools/maas/functionalAuthoringForm.mjs` — but its importable output `produceFunctionalBytes(caseId)` has **no consumer** (wired into no serve path / demo / panel), and the polyglot/author-mode panel (`fui:workbench/authorMode.ts`) already shows the functional **source** via WE's `we:src/_data/authorModeSource.json` data-emit.
- Per #954 (data-emit) the WE `generateFunctionalSource` (`we:blocks/renderers/functional/functionalComponent.ts`) is the **emitter** and the FUI adapter is the **consumer** — two ends of one pipe, **not substitutes**. So "replace the WE-internal generator stub with the FUI adapter" is architecturally incoherent (deleting the emitter starves the data-emit the panel reads).
- Per #1619 Fork-1 / #1681, `functional` is **separate** from the wrapper `?form=` catalog, so "add as a FORMS entry" doesn't apply either.

The coherent remaining work is a **design call** — where (if anywhere) the importable/runnable functional form is served (own MaaS endpoint vs live-mount vs author-mode-source-only). Filed as **#1746** and re-pointed `blockedBy: 1746`. Not pure-agent buildable until that settles; `/batch` declined it as not-batchable (fork) and released the claim.
