---
kind: epic
parent: "715"
status: open
dateOpened: "2026-06-15"
tags: [webtraits, trait-enforcer, build-tooling, deferred, swc, babel]
---

# SWC-native trait transform (Turbopack/rspack) + Babel pre-step — deferred toolchain reach (umbrella)

**Epic (re-typed 2026-06-23 — was mis-filed `kind: decision`; no merit fork, mirrors #232):** #127-class
precedent settled the Enforcer's toolchain reach as **configurable strategy axes** with native-first
defaults; the trait baseline shipped (#717 Rollup/webpack/esbuild/Parcel, #722 conformance). The two
deferred mechanisms below each join a **different** axis, are additive, and break nothing —
*support-all*, not branches of a fork. "Which to build / on what trigger" is pure prioritisation, and a
fork is never a prioritisation tool. They split because they carry **different hold-states**, which one
card cannot hold.

Not a double-count with #232/#1629: that is the `<component>` compiler's SWC plugin; this is the **trait
Enforcer's** transform against the #716 manifest contract — a parallel, distinct artifact (#715 is
explicit that traits split a different artifact than `<component>`).

## Child slices (each joins an existing axis, no breakage)

- **#1658 — Babel transform pre-step for the trait Enforcer** — documented pre-step against #716,
  mirroring the #234/#744 documented-pre-step template. Specifiable now → `priority: low` (built ahead of
  a concrete consumer in a slack window, not gated on adoption). Toolchain-reach axis.
- **#1659 — SWC-native trait transform (Turbopack/rspack)** — the Rust/WASM SWC plugin. Building now
  tunes it against no real SWC/Turbopack integration to validate → `maturityGated`, `maturityTrigger:
  adoptionSignal: a real SWC/Turbopack trait consumer`. Toolchain-depth axis.

## Notes

- Neither blocks #715's resolved baseline — each is an additive opt-in on an axis #717/#722 establish.
- The config-surface question (which strategies a project selects, data-driven) is a Technical
  Configurator domain, not here.
