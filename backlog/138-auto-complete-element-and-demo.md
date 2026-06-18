---
type: idea
workItem: story
size: 8
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: frontierui/blocks/droplist/AutoComplete.ts
tags: [droplist, autocomplete, custom-element, demo, registration, traits]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Register a real `<auto-complete>` custom element + browser demo

#122 proved the `filter` + `clearable` + `focus-delegation` + `selection` composition end-to-end via
an integration test that upgrades the behaviors manually (`attach` + `connectedCallback`) — the same
"runnable" proof the rest of the plateau attribute lib uses. What does **not** exist yet is a shipping,
registered `<auto-complete>` element or a browser-runnable demo: the element glue (open-on-focus,
fetch-on-`filter`, write-on-commit) lives only inside the trace test's harness.

Build the convenience element + a demo:

- **Register `<auto-complete>`** — a form-associated custom element that internally composes the five
  traits over its `<input role="combobox">` + `<ul role="listbox">` + shared `role="status"` region,
  and owns the glue the test currently fakes (open/dismiss — ideally delegating to `anchor` #136,
  commit-write-back, source wiring). Decide the granularity question from
  [#023](/backlog/023-droplist-composition-open-contracts/): one `<drop-list>` with attributes vs. a
  distinct `<auto-complete>` tag.
- **Browser demo** — a conformance playground (per the demo-first workflow) driving a live async
  source so the "par → arrow → enter" trace is visible/clickable, not just asserted in jsdom.
- **Enhancement to fold in:** `filter`'s client matcher is plain substring (`par` won't match
  `Pärnu`). Add diacritic-insensitive normalization (NFD + strip combining marks) for the client
  path so accented options match — small, bounded, and a real autocomplete expectation.

Acceptance: `<auto-complete>` is a registered element with a green conformance playground showing the
full trace against a live source; the diacritic-insensitive client match lands with it.

## Correction (reopened 2026-06-07)

> **Was resolved in error.** The only implementation of this surface was built in the **legacy `plateau` repo**, since confirmed **abandoned** — the initial single-repo prototype, superseded by Web Everything + Frontier UI + plateau-app. It is **not in the live project**: the WE *spec* exists, but there is **no reference implementation** in Frontier UI or the WE `plugs/`, and the (now-removed) `graduatedTo` pointed into dead code. Reopened as a **fresh build** against the live reference implementation (Frontier UI / WE `plugs/`, per we:AGENTS.md) — **do not migrate or consult plateau** (explicitly not a model). The original `## Progress` below describes the void plateau build and is retained only as history.

## Progress (fresh build — Frontier UI) — resolved 2026-06-08

The fresh build is **complete and green in the live reference implementation**. The earlier "Done"
section below describes the *void plateau build* and is retained only as history (per the correction);
it is **not** what shipped. What actually shipped:

- **Element** — [`fui:frontierui/blocks/droplist/AutoComplete.ts`](../../frontierui/blocks/droplist/AutoComplete.ts):
  a registered, form-associated (`ElementInternals`) `<auto-complete>` autonomous custom element that
  composes the six trait behaviors (`Filter`, `Clearable`, `FocusDelegation`, `Selection`, `Anchor`,
  `Anchored`) plus `LiveStatus` over a private `<input role="combobox">` + `<ul role="listbox">` +
  shared `role="status"` substrate. Owns only the glue: source wiring (`.source` fn or `src` fetch,
  abort-aware through filter's `respond`/`reject` channel), commit write-back, and form
  value/reset/restore. Self-registers via `customElements.define` (guarded). Async by default;
  `filter="client"` seeds an inline set via `.items`/`<option>`s. `openOn` excludes `click`.
- **Diacritic-insensitive client match** — `fui:frontierui/blocks/droplist/Filter.ts` folds both query
  and option text (NFD + strip combining marks + lowercase), so `par` matches `Pärnu` / `aero` matches
  `Aéroport`. Async stays the source's job.
- **Conformance demo** — `frontierui/demos/autocomplete-unplugged.{html,ts}`: a 4-card runnable demo
  (async live source with the debounced/cancellable "par → arrow → enter" trace; client diacritic
  match; a failing source through the error channel; a viewport-edge flip card). Served by Frontier
  UI's Vite (`:3001`). Impl + demo live in Frontier UI (the reference implementation per we:AGENTS.md);
  webeverything has no dependency path to it by design, so the demo is **not** a webeverything
  conformance-badge playground.
- **Tests** — `fui:frontierui/blocks/droplist/__tests__/AutoComplete.test.ts` + `fui:behaviors.test.ts`
  (26 unit, green) and the Playwright e2e `fui:__tests__/e2e/auto-complete.spec.ts` (4 specs, green):
  async commit + dismiss, client diacritic surfacing `Pärnu`, native-strategy viewport flip (#161),
  zero console errors.

**Verification (2026-06-08):** Frontier UI `vitest run blocks/droplist/` 26/26; `playwright test
fui:auto-complete.spec.ts` 4/4; Frontier UI `check:standards` 0 errors; webeverything `check:standards`
0 errors.

**Leftover → new item:** [#198](/backlog/198-autocomplete-spec-built-status-stale/) — the webeverything
autocomplete spec text still calls `clearable`/`filter`/`live-status` "spec-proposed (only … built
today)" and references plateau; stale now that all six traits ship in Frontier UI.

## Progress (plateau — historical, void)

- **Status:** resolved
- **Branch:** plateau (impl); webeverything `docs/standard-authoring-workflow` (backlog file)
- **Decision (with user):** impl lands in **plateau** (where the behaviors + trace test live; matches
  #122/#136 `graduatedTo`). Browser demo is **Option A** — a plateau dev-server demo page driven by a
  live async source, verified in-browser via Playwright (not a webeverything conformance-badge
  playground — webeverything has no dependency path to plateau impl, by design).

**Done:**
- `we:plateau/src/blocks/elements/AutoComplete.ts` — registered `<auto-complete>`, a form-associated
  (`ElementInternals`) autonomous custom element composing the six trait behaviors
  (filter, clearable, focus-delegation, selection, anchor, anchored) over a private
  input+listbox+status substrate. Owns the glue the trace test used to fake: source wiring
  (`.source` fn or `src` fetch, abort-aware, routed through filter's `respond`/`reject` channel),
  commit write-back, and form value/reset/restore. Encapsulates the inner input's native
  `change`/`input` at the element boundary. `client` mode seeds an inline option set (`.items` or
  light-DOM `<option>`s). `openOn` excludes `click` (focus already opens an editable combobox).
- Diacritic-insensitive client match — `fui:Filter.ts#filterClient` now folds both query and option text
  (NFD + strip combining marks), so `par` matches `Pärnu` / `aero` matches `Aéroport`. Async stays
  the source's job.
- `plateau/src/auto-complete-demo.{html,ts}` — browser demo, served by plateau's Vite: async live
  source (debounced/cancellable "par → arrow → enter"), client diacritic match, a failing source
  (error channel), and a viewport-edge flip card. (Originally booted natively with an injectors shim;
  once [#160](/backlog/160-plateau-autonomous-custom-elements/) landed autonomous-element support it
  now boots the **real** plateau runtime.)
- Tests: `we:plateau/src/blocks/elements/__tests__/AutoComplete.test.ts` (element-level trace + stale-cancel
  + client diacritic) and diacritic cases in `we:Filter.test.ts`. Full plateau suite **188 green**.
- Verified in a real browser (Playwright, headless Chromium): full async trace commits "Parma",
  surface dismisses, status announces "3 results available", client `par` → `[Pärnu, Paris, Parma]`,
  zero console errors.

**Verification:** plateau `vitest` 188/188; webeverything `check:standards` 0 errors.

**Leftover → new item:** [#160](/backlog/160-plateau-autonomous-custom-elements/) — plateau's runtime
replaces `customElements` with an injector registry whose stand-in never delegates lifecycle to an
**autonomous** custom element's class, so `<auto-complete>`'s `connectedCallback` can't fire under the
full plateau bootstrap (only native hosting works today). That item lands autonomous-element support
so the element can register in `we:bootstrap.tsx` and the demo can boot the real runtime. A
`we:Document.patch.ts` guard (no-throw `createElement` for autonomous tags) already landed as groundwork.

**Graduated to** `fui:frontierui/blocks/droplist/AutoComplete.ts` — registered form-associated <auto-complete> composing all six traits; demos/autocomplete-unplugged.{html,ts}; e2e fui:auto-complete.spec.ts; diacritic fold in fui:Filter.ts.
