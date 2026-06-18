---
type: issue
workItem: story
size: 5
status: resolved
blockedBy: ["855"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: wrapper-conformance/runner.ts
tags: []
---

# Author behavioral wrapper conformance vectors + runner (CEM-input → runtime-behavior assertions) — WE-owned

Ratified by #855 (B2): WE owns the wrapper conformance contract, not the codegen. Author a small corpus of behavioral vectors — each a hand-written CEM custom-element fixture (tagName + attributes + properties + events + slots) paired with runtime assertions a conformant React/Vue wrapper must satisfy: renders the tag, forwards attributes, assigns properties (not serialized), bridges events to handler props, projects slots. Ship a headless-DOM runner that mounts a wrapper, drives props/events, checks the assertions — generator-agnostic, so FUI's generator stays swappable. Mirrors the #506 golden-vectors+runner model. Synthetic fixtures, so no #822 dependency.

## Progress (resolved 2026-06-18)

New WE-owned top-level dir `wrapper-conformance/` (the standard artifact, not a script — generator stays in FUI):

- **`we:vectors.ts`** — `WrapperVector` type + a 5-vector corpus (`attributes-forwarded`, `rich-property-assigned`,
  `event-bridged`, `slots-projected`, and a `combo` exercising all five). Synthetic CEM fixtures — no `fui:blocks.json`
  / #822 dependency.
- **`we:runner.ts`** — a headless-DOM runner. **Generator-agnostic via a `WrapperSubject` adapter**: the runner
  never imports a generator; the wrapper-under-test plugs in (FUI implements one subject per framework). Per
  vector it asserts the five contract behaviours: renders `<tagName>`, forwards string attributes, assigns rich
  properties as DOM *properties* (and checks they are **not** serialized to an attribute), bridges host
  CustomEvents to handler props with `detail` intact, and projects default + named slots. Returns a structured
  pass/fail report.
- **`we:index.ts`** — public re-exports.
- **`we:__tests__/runner.test.ts`** — proves the runner BOTH passes a conformant reference subject across the whole
  corpus AND detects each non-conformance (property serialized instead of assigned, event not bridged, wrong tag,
  render throws). 6 tests green; full `check:standards` green (0 errors). Wired into `we:vitest.config.ts`.

FUI consumes this (its generated React/Vue wrappers run as `WrapperSubject`s) — the #892 re-home leaves the
generator in FUI while this gate stays WE-owned (the #855 B2 boundary). The #506 model, applied to behaviour.
