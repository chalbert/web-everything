---
kind: story
size: 3
parent: "137"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: frontierui/blocks/droplist/AutoComplete.ts
tags: [droplist, autocomplete, windowed, virtualization, custom-element, behavior]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Wire `windowed` into `<auto-complete>` as an opt-in

#137 built `fui:Windowed.ts` (frontierui `blocks/droplist/`) as a standalone, test-proven behavior:
it virtualizes a long option set, mounts only a window slice as `[composite-descendant]`, and keeps
the active option always mounted while coordinating with `filter`'s inject path on `filter-resolved`.
#138 wired the other seven droplist traits into the shipping `<auto-complete>` element but **not**
`windowed` — virtualization is opt-in (it only pays off for long lists), so it was left for here.

The wiring is small but has two real constraints, both already established by #137:

- **Attach order:** `windowed` must be attached **before** `focus-delegation`, so the collection is
  already collapsed to its window when focus initialises on the slice (otherwise focus initialises on
  the full set and its active reference is stale after the collapse). In `fui:AutoComplete.ts` the current
  order is selection → focus → filter → …; `windowed` goes ahead of focus.
- **Enable gate (the open call):** how does an author turn it on? Realistic options — a `windowed`
  attribute (explicit), a `windowed="<size>"` that also sets the window size, or auto-enable above an
  item-count threshold. Lean explicit (`windowed` / `windowed=<size>`); auto-thresholds surprise.

Acceptance: `<auto-complete windowed>` (or chosen syntax) mounts `Windowed` before `FocusDelegation`,
a long result set renders only a window, arrowing through the full list keeps the active option
mounted (the #023 invariant) end-to-end in the real element, and an e2e proves it in a browser (where
real layout exists — coordinate with the scroll/height-driven path in #145).

## Notes

- Window strategy here is count/active-driven (happy-dom has no layout). The pointer/scroll/height-driven
  path is [#145](/backlog/145-windowed-scroll-height-driven-path/) — the browser e2e for this wiring is
  the natural place the two meet.

## Progress

- **Status:** Resolved (2026-06-08)
- **Branch:** docs/standard-authoring-workflow (impl in `frontierui`)
- **Done:**
  - `fui:AutoComplete.ts`: `Windowed` attached **before** `FocusDelegation` when enabled, so focus
    initialises on the collapsed window slice (the #137 attach-order constraint).
  - **Enable gate:** explicit `windowed` boolean attribute (chose explicit over auto-threshold —
    auto surprises authors); `windowed="<n>"` also sets the window size. Helpers `#isWindowed()` /
    `#windowSize()`; `#windowed` field + disconnect cleanup.
  - **Scoped to async mode.** Client mode hides options in place, so `windowed`'s `filter-resolved`
    harvest would swallow hidden nodes and `filterClient` would only see the window — needs
    model-level filtering. Deferred as **#209**; `windowed` is inert in client mode (gate returns
    false), pinned by a unit test.
  - Demo Card 5 (`fui:autocomplete-unplugged.ts`): async source returning 60 rows + `windowed`.
  - Tests: 4 unit tests in `fui:AutoComplete.test.ts` (async collapse to a window, active-always-mounted
    while arrowing deep = #023, explicit `windowed="5"` size, client-mode inert) + an e2e in
    `fui:auto-complete.spec.ts` (60-result set renders ≤10, active stays mounted/connected arrowing,
    absolute aria-setsize=60, head unmounted deep, commit). All unit (32) + e2e (5) green;
    `check:standards` clean in both repos.
- **Leftover captured:** [#209](/backlog/209-windowed-client-mode-model-filtering/) — windowing in
  `filter="client"` mode (model-level filtering).

**Graduated to** `fui:frontierui/blocks/droplist/AutoComplete.ts` — windowed opt-in wired into <auto-complete> (attached before FocusDelegation) + e2e.
