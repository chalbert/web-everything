---
kind: decision
parent: "099"
status: open
dateOpened: "2026-06-21"
relatedTo: ["1406"]
tags: [decision, parked, selection, marquee, spatial, residual, watch]
---

# Marquee recognizer-shape vocabulary — promote to a region-select intent?

Fork-1 residual carried from [#1406](/backlog/1406-marquee-rubber-band-selection-2-d-drag-select-standard-place/):
marquee shipped as a **behavior block** (composing `selection` + `gesture`), **not** an intent, on YAGNI
grounds — one rectangle, one algorithm bound to a surface. This card holds the open question of whether a
broader recognizer-shape vocabulary eventually earns a cross-cutting *intent* home.

**Held open (decision lane) — gated on an external trigger, not a backlog edge.** Revisit **iff a second recognizer shape
recurs** as real demand (free-form **lasso**, **center-point / nearest** selection, **polygon**). At that
point a `region-select` intent with a `shape: rect | lasso | …` dimension may earn its own home, with the
`marquee-select` block as its first realization. Until a concrete second shape lands, this stays an
open, unratified decision (YAGNI on the intent).

Invariant regardless of outcome: **`selection` stays pure** — #1406's Fork-1c rejection (`scope: spatial`
on `selection`) is untouched by this. Promotion to an intent would re-home the *gesture/geometry* layer,
never push geometry into the choice contract.
