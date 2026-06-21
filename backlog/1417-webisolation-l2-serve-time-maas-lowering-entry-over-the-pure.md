---
kind: story
size: 3
status: open
locus: frontierui
blockedBy: ["1363"]
dateOpened: "2026-06-21"
relatedProject: webisolation
tags: [webisolation, css-isolation, frontierui, maas, adapters]
---

# webisolation L2: serve-time (MaaS) lowering entry over the pure core

The serve-time host for the #1363 pure `@scope`→unique-class lowering core: a module-as-a-service entry
that runs the **same** transform when the server delivers a component module, rather than at the consumer's
build or in the browser. Build-time *logic* executed per serve — for MaaS this beats the in-browser L3
polyfill (#1364) because the server controls delivery (no FOUC, SSR-fine). One of the three timing hosts of
the lowering (build / **serve** / runtime) per the
[standard-consumability](../docs/agent/platform-decisions.md#standard-consumability) ruling (#1377);
reuses the pure core, never forks a second transform. Locus FUI/tooling (the served product is Plateau per
constellation-placement); contract+conformance stay WE.

## Acceptance

- A serve-time entry invokes the #1363 pure lowering core on a component module at delivery time, emitting
  pre-scoped (unique-class) CSS — no consumer build step, no in-browser runtime cost.
- Shares the exact core with the build adapters (#1416) and the L3 runtime (#1364) — one transform, three
  timings; no logic duplicated.
