---
type: idea
workItem: task
status: resolved
blockedBy: ["209"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: []
---

# Client-windowed autocomplete e2e — arrowing + full-model filter in a real browser

The #209 model-level client filter (Windowed.filterModel + Filter modelFilter hook + AutoComplete seedItems→setModel) is unit-proven in frontierui AutoComplete.test.ts. #209's acceptance also asks for a browser e2e: prove in real layout that a long `<auto-complete filter=client windowed>` mounts only a window, a query matching outside the initial window still surfaces it, and arrowing the filtered result keeps the active option mounted (the #023 invariant) end-to-end. Mirror blocks/droplist/__tests__/e2e/auto-complete.spec.ts; reuse the windowed-scroll demo substrate. Layout-free behaviour is already covered — real-browser confidence only, low risk, deferred from #209.

## Progress

- **Status:** resolved — browser e2e added and green.
- **Done (in frontierui):** new card 7 `<auto-complete filter=client windowed>` in `demos/autocomplete-unplugged.ts` (60-item inline model, `"Berlin"` parked at index 40 outside the initial window); new spec `blocks/droplist/__tests__/e2e/auto-complete-windowed-client.spec.ts` mirroring `auto-complete.spec.ts`.
- **Proven e2e (5 tests, all pass):** a 60-item client model mounts ≤10 options with absolute aria-setsize; a query (`"berl"`) matching index 40 — outside the window — still surfaces (model-level filter, not the mounted slice); arrowing 30 steps keeps exactly one `aria-current` option mounted (#023) with the window bounded; clearing restores the full-model window; zero console errors.
- **No conflict:** purely additive (new spec + appended demo card); existing card indices 0–5 unchanged, so `auto-complete.spec.ts` still passes (6/6). Disjoint from frontierui's in-flight droplist edits.
- **Gate:** `npx playwright test` on both specs green (5/5 + 6/6).
