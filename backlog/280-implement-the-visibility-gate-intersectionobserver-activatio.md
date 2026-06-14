---
type: issue
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: "project:webtraits"
tags: [webtraits, webbehaviors, activation-lifecycle, visibility, intersection-observer, native-first]
relatedProject: webtraits
relatedReport: reports/2026-06-02-lazy-traits-loading.md
---

# Implement the visibility gate (IntersectionObserver activation) in CustomAttributeRegistry

Build the visibility-activation gate ruled in #221: an IntersectionObserver in CustomAttributeRegistry that defers a trait's activation (and, for lazy delivery, its chunk fetch) until the host element enters the viewport, toggling the shared activatedCallback/deactivatedCallback lifecycle (#223). Add the reserved runtime-read <trait>-when="visible" per-usage override (manifest default stays activate-on-connect). Re-entry policy derives from activationSurface (#222): ambient=recurring, interaction=once. Compose with delivery (#202): visible+lazy=fetch-on-view, visible+eager=apply-on-view. Lands in both repos (webeverything plug + Frontier UI impl fork) plus a below-the-fold conformance demo and e2e spec. Spec: /projects/webtraits/ visibility_gate.

The design is fully ruled in [#221](/backlog/221-behaviour-activation-gated-on-visibility/) → **Resolution** and the
`visibility_gate` section of [/projects/webtraits/](/projects/webtraits/) — this item is the agent-ready build.

## Scope

- **Registry gate** — in `plugs/webbehaviors/CustomAttributeRegistry.ts`, add an `IntersectionObserver`
  alongside the existing `inert` `MutationObserver`. For a host whose trait is visibility-gated, defer
  the activation path until first intersection, then toggle `activatedCallback()` (and
  `deactivatedCallback()` on exit per the re-entry policy) — never touching connectedness.
- **`<trait>-when="visible"`** — parse the reserved per-usage attribute at **runtime** (like
  `<trait>-active`), binding to the named trait. Manifest default stays `activate-on-connect`; the
  attribute is the opt-in. Must not collide with the value slot, `-delivery`, or `-active`.
- **Compose with `delivery`** — `visible` + lazy ⇒ **fetch-on-view** (don't `import()` the chunk until
  intersecting; the bundle/runtime win); `visible` + eager ⇒ **apply-on-view** (defer construction only).
- **Re-entry policy from `activationSurface`** (#222) — `ambient` ⇒ recurring (deactivate on exit /
  re-activate on re-entry); `interaction` ⇒ once (activate-and-stay). Allow a trait-author override.
- **Both repos** — the contract lands in the webeverything plug; the runtime fork lands in Frontier UI
  (mirror the #223 split). Keep the `CustomAttribute` base identical across both.
- **Conformance** — a below-the-fold demo (`demos/visibility-gate*.html`) where a gated trait neither
  loads nor applies until scrolled into view, plus an e2e spec
  (`plugs/__tests__/e2e/visibility-gate.spec.ts`). Compose-with-`content-visibility:auto` worth a demo.

## Acceptance

- A visibility-gated **lazy** trait below the fold issues **no** chunk request until its host scrolls
  into view (verifiable in the e2e/network trace) — the case the presence-keyed observer can't deliver.
- A visibility-gated **eager** trait's `activatedCallback` does not fire until first intersection.
- An `ambient` gated trait re-activates on re-entry; an `interaction` gated trait activates once and stays.
- `npm run check:standards` green; the webtraits spec page renders the visibility-gate section.

## Progress

- **Status:** resolved 2026-06-11 (batch `batch-2026-06-11`). Two-repo build mirroring the #223 split — **contract** in the WE plug, **runtime** in the Frontier UI fork. The `visibility_gate` spec section already existed in `traits.json` (#221); this is the implementation, built to match it.
- **Contract — WE plug (`plugs/webbehaviors/CustomAttribute.ts`, copied byte-identical to the FUI fork per #223):**
  - `static activationWhen: 'connect' | 'visible' = 'connect'` — the trait-author manifest default (status quo `connect`, so strictly opt-in).
  - `static visibilityReentry?: 'once' | 'recurring'` — the optional trait-author re-entry override; absent, the policy derives from `activationSurface`.
  - Both added to the `ImplementedAttribute` type. WE's registry stays runtime-free (the #223 split — WE is the contract reference, FUI the runtime).
- **Runtime — Frontier UI (`plugs/webbehaviors/CustomAttributeRegistry.ts`):**
  - A single lazily-created `IntersectionObserver` (the activation analogue of the inert `MutationObserver`); **gracefully degrades** to activate-on-connect where `IntersectionObserver` is absent (SSR/jsdom).
  - **Eager (apply-on-view):** `#addAttribute` branches on `#isVisibilityGated` — a gated instance stays dormant (connected, not activated) until first intersection, then `#setActivated` runs (still inert-aware, so the two gates compose).
  - **Lazy (fetch-on-view):** both lazy-trigger sites (`#applyOnTree` add, `#update`) defer `#loadLazy` to intersection when `<name>-when="visible"` is present — the chunk is not `import()`ed below the fold.
  - **Re-entry** from `#reentryPolicy`: `interaction` → `once` (activate-and-stay, unobserve after), `ambient` → `recurring` (deactivate on exit, re-activate on re-entry); `visibilityReentry` overrides. A `#revealed` set lets a lazy `once` trait that attaches after its host is already visible activate immediately. Gate entries are cleaned on removal/downgrade.
- **Conformance:**
  - Unit (FUI): `CustomAttributeRegistry.visibility.test.ts` (9) — dormant-until-view, once-stays, ambient-recurring, manifest-default gating, `-when="connect"` override, inert composition, `visibilityReentry` override, lazy fetch-on-view, IO-absent fallback (mocked IntersectionObserver, since jsdom lacks it).
  - Demo (FUI): `demos/visibility-gate.{html,ts}` + `demos/visibility-gate-heavy.ts` — below-the-fold `reveal` (eager/once), `pulse` (ambient/recurring), `heavy` (lazy fetch-on-view).
  - E2e (FUI): `plugs/__tests__/e2e/visibility-gate.spec.ts` — real-browser proof: no lazy chunk request below the fold, activation only on intersection, recurring-pause vs once-stay, fetch-on-view on reaching `#heavy`; zero page errors.
- **Gate:** FUI full unit suite **1389 passing** (+9 new), the new e2e green, `tsc -p tsconfig.json` clean; WE webbehaviors **114 passing**, `check:standards` 0 errors, the `/projects/webtraits/` visibility-gate section renders.
