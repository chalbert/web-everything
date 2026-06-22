---
kind: story
size: 5
locus: frontierui
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "fui:tools/scope-isolator/runtime.ts"
tags: []
---

# webisolation L3: runtime polyfill (constructable adoptedStyleSheets fallback)

The fallback conformant impl of the #1362 webisolation contract for no-build-step / dynamically-scoped cases: a runtime polyfill that applies a unique scope class and adopts a constructable CSSStyleSheet via adoptedStyleSheets (Baseline since Mar 2023). Polyfills the Layer-1 @scope isolated semantics; dropped when #11002 ships natively. Conforms to the contract ratified in #1349.

## Progress (batch-2026-06-21) — BUILT

The earlier pre-flight deferred this to a "focused FUI session" because live verify was blocked by a
concurrent breakage of the dev server. That breakage (plateau 500-ing on a missing
`@webeverything/error-summary` alias) was **fixed first this session**, and the polyfill's logic is pure
+ a DOM API, so it verifies via vitest/happy-dom (which models constructable `adoptedStyleSheets`) — no
live-browser blocker remained.

- Built `fui:tools/scope-isolator/runtime.ts` — a thin wrapper around the shipped #1363 core
  (`transform` / `generateScopeClass`). Exports `adoptScopedStyles` (lower `@scope` CSS + adopt a
  constructable `CSSStyleSheet` once on a target's `adoptedStyleSheets`, idempotent, shared per scope
  class), `applyScopeClass` (system-delivered unique class on the root), `scopeElement` (one-call:
  class + adopt; adopts into the host shadow root when present = S2, else the document = S1), `isAdopted`.
  Feature-detects constructable sheets and **gracefully degrades** to a cached `<style>` element when
  unsupported (no throw).
- Tested `fui:tools/scope-isolator/__tests__/runtime.test.ts` — 6 tests: class application, constructable
  adoption keyed to the unique class (no raw `@scope`), idempotency (one sheet, no duplication), distinct
  scopes → distinct sheets, one-call `scopeElement`, and the shadow-root S2 target path. All green
  (17/17 in the suite). FUI `check:standards` → 0 errors; `fui:runtime.ts` typechecks clean (the 2 tree-wide
  tsc errors are pre-existing, in unrelated `webexpressions`/`webstates` plugs — not this changeset).

## Pre-flight state-fix (batch-2026-06-21) — locus→frontierui (mis-flagged impl)

Cascade-freed by #1363 (the L2 PostCSS core, resolved + built in fui:tools/scope-isolator/) and surfaced
in a batch top-up; pre-flighted and left for a focused FUI session:
- **Locus corrected `→ frontierui`.** A runtime polyfill is an **impl** (per #855/#817 + the #1377 ruling
  that names #1364 a "Host" wrapper around the pure core) — runtime, not a contract — so it gates in
  frontierui. It had `locus: we` (defaulted); set `locus: frontierui`. blockedBy cleared (#1363 resolved).
- Tractable next step: it can **reuse the shipped `fui:tools/scope-isolator` core** (`transform()` /
  `generateScopeClass`) for the runtime path — apply the unique class + adopt the lowered CSS via a
  constructable `CSSStyleSheet` on `adoptedStyleSheets`. Left for a focused FUI session because its
  acceptance is **runtime browser behaviour** (adoptedStyleSheets application), and that live verify is
  currently blocked by a concurrent-session breakage of the FUI/plateau dev server (an unresolved
  `@webeverything/error-summary` import 500-ing bootstrap — see #1236 progress); don't start a
  browser-verified runtime build against a broken server.
