---
type: idea
workItem: story
size: 3
parent: "137"
status: resolved
blockedBy: ["122", "137"]
dateOpened: "2026-06-07"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: frontierui/blocks/droplist/Filter.ts
tags: [droplist, autocomplete, filter, live-status, loader, error, behavior, a11y]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Give `filter` an error channel so `live-status` can announce fetch failures

`live-status` (#137) already understands an `error` state — its generic `live-status` event and
`announce({ state: 'error' })` route a failure into the shared region. But `filter`'s async lifecycle
has **no error channel**: its `respond(items)` callback only carries a success set, so a rejected
fetch never reaches the announcer and the listbox stays silently `aria-busy`.

Close the loop: `filter` should surface a failure (e.g. a `reject(message)` companion to `respond`,
or a `filter-error` CustomEvent) when the consumer's source rejects or the request errors out. Then
`live-status` maps it to an `error` announcement out of the box (the way it already maps
`filter-request` → loading and `filter-resolved` → count), and `filter` clears `aria-busy`.

- Extend the `filter` request detail with an error path symmetric to `respond` (honor the abort
  signal — a stale rejection must not announce, same as a stale `respond`).
- Have `live-status` consume it (`filter-error` → `announce({ state: 'error', message })`).
- Test: a rejecting source announces the error once through the one shared region and drops busy.

Acceptance: a failed async filter request announces an error through the shared `live-status` region
(not a silent busy listbox), and a stale rejection is dropped like a stale settle.

## Correction (reopened 2026-06-07)

> **Was resolved in error.** The only implementation of this surface was built in the **legacy `plateau` repo**, since confirmed **abandoned** — the initial single-repo prototype, superseded by Web Everything + Frontier UI + plateau-app. It is **not in the live project**: the WE *spec* exists, but there is **no reference implementation** in Frontier UI or the WE `plugs/`, and the (now-removed) `graduatedTo` pointed into dead code. Reopened as a **fresh build** against the live reference implementation (Frontier UI / WE `plugs/`, per AGENTS.md) — **do not migrate or consult plateau** (explicitly not a model). The original `## Progress` below describes the void plateau build and is retained only as history.

## Progress
- **Status:** resolved — error channel built end-to-end, contract proven by happy-dom tests.
- **Branch:** changes in the `plateau` repo (`src/blocks/attributes/`) + spec page in `webeverything`.
- **Done:**
  - `Filter.ts` — `reject(message?)` companion to `respond` in the `filter` request detail (exported
    `FilterRequestDetail`), with the SAME stale guard (`signal.aborted || #inFlight !== controller`).
    On reject: clears `aria-busy`, leaves prior options in place, emits `filter-error`, and announces
    inline (`#announceError`) only when no `live-status` owns the region.
  - `LiveStatus.ts` — consumes `filter-error` → `announce({ state: 'error', message })` (no message →
    default "Something went wrong").
  - `AutoComplete.ts` — already routed source `.catch` → `reject` (was falling back to `respond([])`
    before the channel existed); now the real channel fires.
  - Tests: `Filter.test.ts` (+6 reject cases: inline announce, default text, event payload,
    options-preserved, stale-drop) and `LiveStatus.test.ts` (+filter-error consume, default text, and
    the #023-style one-region/no-double-announce integration on a rejecting async request). 39 related
    tests green; plateau `tsc` clean for touched files.
  - Spec: `autocomplete.njk` documents the symmetric failure channel; demo card 3 (failing source)
    added to `plateau/src/auto-complete-demo.ts`. `check:standards` green (0 errors).
- **Next:** none — closed. Demo *playground* can't be eyeballed yet due to a pre-existing crash →
  filed as **#156** (autocomplete conformance demo substrate crash); not caused by this item.
- **Notes:** the error path deliberately does NOT clear the listbox (a transient failure shouldn't
  wipe still-actionable results); only `aria-busy` drops and the announcer carries the error.

## Resolution (fresh build — 2026-06-10)

The reopened "fresh build against the live reference implementation" (Frontier UI, per AGENTS.md) is
**complete**. On review the error channel itself was already present in the live reference impl; the gap
was acceptance-test coverage of `filter`'s async `reject()` path, which this close-out fills.

- **Filter — `frontierui/blocks/droplist/Filter.ts`:** carries the symmetric error channel —
  `FilterRequestDetail.reject(message?)` alongside `respond`, a `reject` handler honoring the abort/stale
  guard (`signal.aborted || #inFlight !== controller` → drop, symmetric to `respond`), drops `aria-busy`,
  **leaves prior options in place**, calls `#announceError` (defers to a `live-status` owner via the
  shared region's `data-live-status` flag), and dispatches `filter-error`.
- **LiveStatus — `frontierui/blocks/droplist/LiveStatus.ts`:** consumes `filter-error` →
  `announce({ state: 'error', message })`, mapping to the message or the default `Something went wrong`.
- **Tests added — `frontierui/blocks/droplist/__tests__/behaviors.test.ts`:** new
  `Filter — async error channel (#148)` block (3) — a rejecting source announces **once** through the
  shared region + drops `aria-busy` + keeps prior options; a message-less rejection → default text; a
  **stale rejection from a superseded request is dropped** (newer request still loading/busy). Frontier
  UI full unit suite green (1345 passed).
- **Acceptance met:** a failed async filter request announces an error through the one shared
  `live-status` region (not a silent busy listbox), and a stale rejection is dropped like a stale settle.

**Graduated to** `frontierui/blocks/droplist/Filter.ts` — filter error channel + live-status consumption (frontierui/blocks/droplist/LiveStatus.ts).
