---
type: idea
workItem: story
size: 5
parent: "136"
status: open
blockedBy: ["136"]
dateOpened: "2026-06-07"
tags: [droplist, anchor, popover, positioning, provider, floating-ui, di]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /backlog/136-anchor-trait-behavior/, label: Anchor trait behavior }
---

# Make the anchor positioning *strategy* a swappable DI provider

Building the `anchor` trait (#136) delivered the behavior/provider split tracked in
[#023](/backlog/023-droplist-composition-open-contracts/) (contract 1): the `anchor`
behavior owns open/dismiss, and the new `anchored` behavior owns placement — emitting
**CSS Anchor Positioning** (`anchor-name` ↔ `position-anchor`, `position-area`,
`position-try-fallbacks`) plus optional Popover, the native-first path from
[#063](/backlog/063-terminology-native-anchor-field/).

What's still open is the *strategy swap*: CSS Anchor Positioning is not yet in every
engine, so a surface that must place correctly there needs a **JS fallback** (e.g. a
Floating UI adapter). Per #023/open-question #2 that strategy belongs behind a **DI
provider** the surface consumes — `anchored` declares *intent* (placement + collision),
the provider decides *how* (native CSS vs. JS loop). Today `anchored` hardcodes the
native path.

Build:
- A `positioningStrategy` provider on the injector chain (mirrors `loaderIntent`):
  resolves `native` (CSS, the current behavior) or a JS adapter.
- `anchored` reads it and delegates: native → emit CSS (as now); JS → run a placement
  loop (anchor rect → preferred side → flip/shift/resize → write inset), cleaned up on
  disconnect.
- Feature-detect CSS anchor positioning to pick a sane default when unset.

Acceptance: `anchored` defers placement to an injected strategy; the native CSS path is
the default and unchanged, and a JS adapter can be swapped in app-wide via one injector
line. Validate both against a **real browser demo** (the placement/`position-area`
mapping is currently asserted only as emitted styles in happy-dom — never positioned
for real); a conformance-playground autocomplete is the natural home.

## Correction (reopened 2026-06-07)

> **Was resolved in error.** The only implementation of this surface was built in the **legacy `plateau` repo**, since confirmed **abandoned** — the initial single-repo prototype, superseded by Web Everything + Frontier UI + plateau-app. It is **not in the live project**: the WE *spec* exists, but there is **no reference implementation** in Frontier UI or the WE `plugs/`, and the (now-removed) `graduatedTo` pointed into dead code. Reopened as a **fresh build** against the live reference implementation (Frontier UI / WE `plugs/`, per AGENTS.md) — **do not migrate or consult plateau** (explicitly not a model). The original `## Progress` below describes the void plateau build and is retained only as history.

## Progress

**Status:** resolved
**Branch:** plateau (impl); webeverything `docs/standard-authoring-workflow` (backlog file)

**Done — `anchored` declares intent and delegates to a swappable `positioningStrategy`
provider (the open fork from #023/open-Q#2):**
- New `plateau/src/blocks/attributes/positioning/` module:
  - `types.ts` — `PositioningStrategy` (`place(context) → teardown`), `PlacementContext`,
    shared `PLACEMENT_AREA`, and the `customContexts:positioningStrategy` provider key.
  - `native.ts` — the native CSS Anchor Positioning strategy (the path #136 shipped,
    extracted unchanged: `anchor-name` ↔ `position-anchor`, `position-area`,
    `position-try-fallbacks`).
  - `js.ts` — a self-contained, dependency-free JS placement loop (rects → side →
    `flip`/`shift` → `position: fixed` + inset; re-runs on scroll/resize/show). The
    shape a Floating UI adapter would implement; intentionally no new dependency.
  - `resolve.ts` — `resolveStrategy(surface)`: an injected provider wins, else the
    **feature-detected** default (native where `CSS.supports('anchor-name', …)`, else js).
    Guarded so a surface mounted outside any injector root doesn't throw.
- Refactored `Anchored.ts` — resolves a strategy, builds the intent context, delegates
  `place()`, stores teardown; reflects `data-positioning-strategy`. Native output and all
  9 existing `Anchored` tests unchanged.
- Wired `Anchored` into `AutoComplete` — the listbox was composed with `anchor`
  (lifecycle) but never positioned; now it is.
- Demo `src/auto-complete-demo.{html,ts}` — composes anchored; a strategy toggle swaps
  the provider via **one injector line** (`injector.set('customContexts:positioningStrategy', …)`)
  and rebuilds the cards. Added a near-edge flip card.
- Docs: `src/definitions/anchor.md` gained a "Positioning strategy" section.

**Verification:**
- Full plateau suite green — 188 tests (was 147 at #136 close): +10 strategy/resolve, +3
  Anchored delegation, and the existing Anchored/AutoComplete/trace suites still pass.
- **Real browser** (Chromium 148, Playwright on the live `:5180` demo): native places the
  listbox at `bottom-start` (`position: absolute`, listbox top = input bottom); js places
  identically (`position: fixed`) **and flips** above the input near the viewport edge
  (`data-js-placement` → `top`); the toggle flips `data-positioning-strategy` native↔js
  with no console errors. This is the first time the placement mapping was positioned for
  real (previously only asserted as emitted styles in happy-dom).

**Leftover → new item:** [#161](/backlog/161-native-anchor-flip-viewport-overflow/) —
native `position-try-fallbacks` flip didn't engage for a `position: absolute` surface near
the viewport bottom (overflow is evaluated against the document-sized containing block).
The js strategy flips reliably; closing the native gap is its own task. Demo + docs say so
plainly rather than overclaiming.

## Progress (Frontier UI rebuild — 2026-06-08)

The provider mechanism was built in **Frontier UI** (`frontierui/blocks/droplist/positioning/`):
`types.ts` (`PositioningStrategy`, `PlacementContext`, `PLACEMENT_AREA`, the
`customContexts:positioningStrategy` key), `native.ts` (CSS Anchor Positioning — now `position: fixed`
so flip works at the viewport edge, #161), `js.ts` (dependency-free placement loop), and `resolve.ts`
(`resolveStrategy` — injected provider wins, else feature-detected native/js; reads off Frontier UI's
`InjectorRoot.getProviderOf`). `Anchored.ts` delegates to the resolved strategy and reflects
`data-positioning-strategy`. 11 unit tests (`positioning/__tests__/strategies.test.ts`).

**Native path validated in a real browser** (Chromium 148, Frontier UI e2e): the listbox is placed
and **flips above its trigger** near the viewport bottom (`data-positioning-strategy=native`).

**Kept open — remaining acceptance:** the **JS-strategy real-browser demo + the one-line injector
swap** (`injector.set('customContexts:positioningStrategy', …)`) are NOT yet in the Frontier UI demo
(the unplugged demo exercises only the native default; the JS strategy has unit coverage but no
real-browser toggle). Port the strategy-toggle demo (a plugged Frontier UI demo with an injector
root) and add an e2e that flips `data-positioning-strategy` native↔js. Tracked alongside
[#192](/backlog/192-droplist-frontierui-migration-followups/).
