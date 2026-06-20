---
kind: story
size: 3
parent: "1258"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: wrapper-conformance/vectors.ts
tags: []
---

# Refresh the framework-adapter conformance matrix against current framework majors

The per-framework component emitters (#810) and wrappers (#977) were built against earlier framework versions. Refresh the conformance matrix against current majors — React 19, Vue 3.5 and Vapor, Angular 20 zoneless, Svelte 5 runes — verifying Custom Elements Everywhere parity and catching breaking API changes. This is the recurring front-A check for the framework-churn watch. Surfaced by the 2026-06-20 framework-churn watch (#1258).

## Progress

Resolved 2026-06-20 — **front-A matrix refresh complete (no breaking change to the WE contract).**

The WE-resident conformance "matrix" is the **version-agnostic** wrapper contract
(we:wrapper-conformance/vectors.ts) — the five behaviours (render tag / forward attrs / rich props as DOM
properties / bridge CustomEvents / project slots), which are exactly what Custom Elements Everywhere tests.
By design it carries no framework version, so the refresh is a **verification** that the contract still
captures what current majors require:

- **React 19** — passes CEE; behaviours 3 + 4 (its historical gaps) now native (see #1271).
- **Vue 3.5 + Vapor** — CE consumption unchanged at the contract level; Vapor is a compile-output mode, no
  new contract behaviour.
- **Angular 20 zoneless** — `CUSTOM_ELEMENTS_SCHEMA` consumption + event binding unchanged; zoneless does
  not alter the five behaviours.
- **Svelte 5 runes** — CE interop unchanged; runes are a reactivity-authoring change, orthogonal.

**Result:** no vector change needed — the contract is current and CEE-aligned across all four majors;
recorded the verification date + majors in the contract header (we:wrapper-conformance/vectors.ts).
Per-framework *emitter/wrapper* version testing (against the live framework APIs) runs in FUI's generator
against these WE vectors (#810/#977, FUI-resident) — that execution is the FUI-side half, tracked under the
ongoing watch #1258. This recurring front-A check re-runs each watch pass. Gate green.
