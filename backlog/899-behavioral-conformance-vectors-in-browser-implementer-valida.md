---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-18"
tags: []
---

# Behavioral conformance vectors + in-browser implementer-validation tool (WE vectors / plateau runner)

How does an implementer prove a component conforms to a WE standard, given the contract is build-agnostic (the final rendered component is all that counts; how it's built varies)? A static manifest check (capability-manifest check.ts) cannot capture behavioral/temporal conformance (e.g. validator-resolution must drop a stale async generation). Direction (discussed across sessions, leaning — not ratified): WE publishes a conformance KIT — the vector corpus (declarative JSON: given + timed interaction script + observable expected outcome in contract vocab, read via DOM/ARIA), the vector schema, a dependency-free reference verifier (assertion semantics), and a binding interface; the implementer supplies a binding for their component + their own browser driver (Playwright/testing-library) and verifies in their own CI with no hosted dependency (the escapable floor, minimize-lock-in). plateau hosts the zero-setup in-browser exerciser (controllable clock, dashboards, pass/fail over time) as the convenience/paid product. Maps to WPT: tests + testharness.js are the kit (anyone runs them), wpt.fyi is the product. Open forks: (1) plateau vs FUI home for the runner (leaning plateau per #091 served-product layering); (2) how thin the WE reference verifier is — pure assertion semantics only vs a small reference driver (clock + DOM dispatch). Relates to #314 exercise-app conformance loop, #809 FUI block workbench (distinct surface — do not conflate), #817 (which established WE keeps only contract, runtime to FUI).

## What a conformance vector looks like (concrete)

A vector is declarative data: a setup, a (possibly *timed*) interaction script, and the **observable** outcome on the final component — in contract vocabulary, read through the platform surface (DOM/ARIA/events), never impl internals.

**Algebraic case — `validity-merge` `source-reduction` default (precedence `['native','schema','async','manual']`):**

```json
{
  "id": "validity-merge/source-reduction/async-overrides-native",
  "contract": "@webeverything/validity-merge",
  "given": {
    "strategy": "source-reduction",
    "sources": [
      { "source": "native", "state": "valid" },
      { "source": "async",  "state": "invalid", "message": "Username taken" }
    ]
  },
  "expect": { "merged": { "state": "invalid", "message": "Username taken" } }
}
```

**Temporal case — `validator-resolution` `versioning` default (stale async dropped). This is the one that *needs* the in-browser exerciser with a controllable clock:**

```json
{
  "id": "validator-resolution/versioning/stale-async-dropped",
  "contract": "@webeverything/validator-resolution",
  "steps": [
    { "atMs": 0,  "do": "setInput",   "field": "email", "value": "a@b.com" },
    { "atMs": 0,  "do": "beginAsync", "token": "v1", "settlesInMs": 200, "result": { "state": "invalid", "message": "taken" } },
    { "atMs": 50, "do": "setInput",   "field": "email", "value": "c@d.com" },
    { "atMs": 50, "do": "beginAsync", "token": "v2", "settlesInMs": 80,  "result": { "state": "valid" } }
  ],
  "expect": {
    "finalState": "valid",
    "neverObserved": [ { "renderedMessage": "taken" } ],
    "aria": { "aria-invalid": "false" }
  },
  "observeVia": ["aria", "renderedMessage", "validity"]
}
```

v1 settles *after* v2 but is a stale generation → a conforming component must drop it. "Never observed 'taken'" can only be checked by running real time — which is why how-it's-built (debounce / AbortController / generation token) is irrelevant: only the observable result is judged.

**The one impl-specific glue: a binding.** The vector is universal; to drive any component the implementer supplies a tiny adapter ("set this field's input → call X; read its validity → read attribute Y"). The binding *interface* is a small WE-owned contract; the binding *implementation* is the implementer's (or FUI's, for FUI components).

## Layer split

- **WE (standard):** vector corpus (JSON) + vector schema + dependency-free reference verifier (assertion semantics) + binding interface. The escapable floor — runnable data + contract, no hosted dependency.
- **plateau (product):** the hosted in-browser runner — loads a component + binding, executes vectors with a controllable clock, reports pass/fail + dashboards. Convenience/paid surface.
- **implementer / FUI:** the binding impl for their components; their own browser driver (or plateau's).

Guardrail: the floor must stay escapable — an implementer must be able to run the vectors themselves without the plateau tool (else the product becomes lock-in). Same free-floor / paid-hosted split as the #775 assembler.

## Open forks (to resolve when this is picked up — not prepared)

1. **Runner home — plateau vs FUI.** Leaning plateau (#091 served-product layering, #475 plateau-service-consumed-by-WE). Residual: a thin local runner could be a FUI zero-lock-in devtool.
2. **Reference-verifier thinness.** Pure assertion semantics only (driving fully delegated to the implementer's test runner) vs WE also shipping a small reference *driver* (clock control + DOM dispatch). The assertion semantics is clearly WE (executable conformance spec, consumed by a test like check.ts); the browser driver is the pluggable part. Worth its own decision.
