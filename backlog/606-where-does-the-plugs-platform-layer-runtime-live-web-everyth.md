---
kind: decision
size: 3
status: resolved
codifiedIn: docs/agent/platform-decisions.md#constellation-placement
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
preparedDate: "2026-06-14"
relatedReport: reports/2026-06-14-plugs-runtime-ownership-boundary.md
tags: [plugs, runtime, packaging, constellation, architecture]
---

# Where does the plugs platform-layer runtime live — Web Everything (standard) or Frontier UI (impl)?

**Ratified 2026-06-14 → B — Frontier UI owns the runtime as `@frontierui/plugs`.**
This **supersedes the prepared "reference-implementation → A" recommendation** (and the report's archetype
call): once the runtime is correctly classified as *implementation* — not a standard artifact — the home is the
Frontier UI implementation umbrella. Resolved; #170/#449 re-pointed; spun off #635–#642 (audit, dual-mode
conformance check + backfill, `@frontierui/plugs` docs, mental-model doc update, plateau-app repoint, the
block protocol/impl boundary decision, and the deferred webplugs-brand call).

## The reframe that settles it

The prepared item framed this as "WE vs FU" via an archetype classification (polyfill / reference-implementation /
shared-substrate) and recommended **A — WE owns the reference runtime**. Discussion corrected the classification on
three grounds, each killing A's premise:

1. **plugs implements a *theoretical future* standard that mostly/never lands natively** — the **polyfill**
   archetype (`we:plugs/README.md` itself says "polyfills and patches"), *not* a reference implementation of a ratified
   spec. A polyfill is implementation that lives *outside* the spec. And because these speculative platform APIs
   (`CustomAttributeRegistry`, `CustomContext`, `CustomStore`, injectors, `CustomElementRegistry`) likely never become
   native, the "polyfill" is in fact the **permanent, canonical implementation** — still implementation, never a
   standard artifact.
2. **The real product surface is the *unplugged*, non-invasive library — not the global-patching runtime.** Every
   plug must be usable unplugged (`we:plugs/index.ts` / `we:plugs/unplugged.ts` — `register`/`upgrade`/`downgrade`, no
   `window`/prototype mutation); the plugged `we:plugs/bootstrap.ts` (patches `window`/`Node`/`Element`) is a POC/demo.
   A non-invasive library is the `@lit/reactive-element` archetype — a package, not spec content.
3. **FUI is an umbrella of granular impl sub-packages**, not a monolith — a `workspaces` monorepo already publishing
   `@frontierui/compiler`, `@frontierui/vite-plugin`, `@frontierui/jsx-runtime`, `@frontierui/component-compiler`, …
   (and `frontierui/plugs` + `frontierui/blocks` dirs exist today). So "FU owns it" = **`@frontierui/plugs` as a
   sibling sub-package**, not plugs buried in a component library. plateau-app already consumes `@we/plugs`
   (`../plateau-app/vite.config.mts:119`, `plateau:src/main.ts:9`) with **zero `@frontierui` *code* imports** (its only
   `@frontierui` reference is configurator seed-data), so it could depend on `@frontierui/plugs` alone — **no layer
   inversion, no forced dependency on blocks** (the `@lit/reactive-element`-under-`@lit/*` precedent).

This is exactly what **#239 already implies**: implementation → `@frontierui/*`, regardless of whether it imports FU.
The prepared item's "#239 does not extend to plugs" argument rested entirely on "plugs is the standard's *reference
runtime*" — retired by (1).

## Ruling — B: Frontier UI owns the runtime; WE keeps only the contracts

plugs becomes **`@frontierui/plugs`** (unplugged library + plugged showcase), a granular sub-package in the FUI impl
umbrella, sibling of `@frontierui/blocks` / `@frontierui/compiler` / adapters. **WE keeps the contracts** (`we:plugs.json`,
intents, protocols, block protocols) and **consumes `@frontierui/plugs` as a client** in its demos/site — the WE→FUI
direction already ratified by **#604** ("WE consumes Frontier UI as a client"). The "WE imports nothing from FU" rule
binds published **`@webeverything/*` standard artifacts**, not the docs site, so the demos-need-a-runtime objection
that the item raised against B does not hold.

### Invariants (hold regardless of home)

- **Every plug must have a non-invasive *unplugged* form** (no global/prototype mutation); that is the supported
  real-app surface. Plugged/global-patching mode is **POC/demo only**, never a real-app dependency.
- **Every plug ships automated tests proving *both* modes** (unplugged + plugged) green — an **enforced check**, not a
  convention.

### Rejected options

- **A — WE owns the reference runtime.** *Rejected.* plugs is implementation (polyfill / permanent library of a
  theoretical standard), not a standard artifact. Co-locating impl in the standard layer violates impl-isn't-a-standard
  and #239. The "young standard's reference proof vehicle" justification fails because the *real* artifact is the
  unplugged library, and the plugged proof vehicle is the disposable part.
- **C — standalone `webplugs` package / its own third scope+layer.** *Rejected as over-engineering.* The impl umbrella
  (`@frontierui/*`) already exists and satisfies #239; a third scope/brand is unearned. "webplugs as a marketed
  product" is a **separate, deferred positioning call** that does not require a separate layer (`@lit/reactive-element`
  is a sub-package, not its own umbrella). The earlier "own-layer to avoid inversion" argument assumed a *monolithic*
  FUI; granular umbrella publishing dissolves it.

## Resolution wiring / blast radius

This **reverses the in-flight #170 direction** and must re-point its children (not a quiet ratify):

- **#170** — was "FUI imports `@we/plugs`, delete FUI's vendored copy" (WE-owns). Now: **FUI's plugs becomes canonical
  `@frontierui/plugs`; WE deletes its `plugs/`; WE demos + plateau-app repoint to `@frontierui/plugs`.**
- **#449** — flips from "wire `@we/plugs` alias in FUI + delete vendor" → **"promote FUI plugs to canonical
  `@frontierui/plugs`, repoint WE + plateau-app."**
- **#447 / #448 / #580** — premise-dependent on #170's direction; re-evaluate at their next pickup.
- **#604** — spirit aligns (WE-consumes-FUI); only its #170 prerequisite restates.

Spin-off builds to file at resolve:

- **`@frontierui/plugs` extraction** — make FUI plugs canonical, publish the granular package, repoint consumers
  (WE demos, plateau-app); absorbs/supersedes #449's scope.
- **Dual-mode conformance check** — `check:standards` rule: every plug has passing unplugged **and** plugged tests;
  no plug may require plugged mode.

---

## Context

**What is "the runtime".** `plugs/` is ~124 files in two tiers: a **kernel** (`core/` + `web*/` registries +
`window`/`Node`/`Element` patches + base classes `CustomElement`/`CustomAttribute`/`InjectorRoot`/`CustomStore`; pure,
no `blocks/` dependency) and a **default-config** entry `we:bootstrap.ts:42-55` that wires concrete blocks
(`registerRouter`, `registerDataGrid`, `CallParser`, …) from `../blocks/`. Under B the whole tree (both tiers) lives in
`@frontierui/plugs`; the plugged showcase ships inside the package, WE references it.

**Blocks boundary (related, surfaced during this review).** WE's top-level `blocks/` are currently **byte-identical
duplicates** of `frontierui/blocks/` (e.g. `we:navigation/NavListBehavior.ts`, `we:registerNavigation.ts` diff-clean). The
intended target (per the user) is **WE blocks = protocols, FUI blocks = implementation**; that consolidation is #170 /
#604 territory, not this item — noted here so the runtime ruling stays consistent with it.

**Blast radius (refs).** Blocks **#449** (in its `blockedBy`). Premise-dependent: **#170, #447, #448, #580**. Adjacent
ruling: **#239** (npm scope — *supports* B). Mental-model source: `we:AGENTS.md:9`, `we:docs/agent/architecture.md:18`.

**Brand / marketing (deferred, non-blocking).** Whether to stand "webplugs" up as a separately-marketed product is a
positioning call, independent of code home. `@frontierui/plugs` does not preclude a later brand; decide at product time.

**Graduated to** `none` — ruling B: plugs = implementation → @frontierui/plugs; reverses #170/#449; spun off #635–#642.
