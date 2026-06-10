---
type: idea
workItem: story
size: 5
parent: "137"
status: open
blockedBy: ["201"]
dateOpened: "2026-06-08"
tags: [droplist, autocomplete, windowed, virtualization, filter, client-mode]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Make `windowed` work in `<auto-complete filter="client">`

#201 wired `windowed` into `<auto-complete>` but scoped it to **async** mode only. In async mode
`filter` re-injects the full result set as descendants on every settled query, and `windowed`
adopts that as its model on `filter-resolved` — clean. Client mode is different: `filter`'s
`#filterClient` doesn't re-inject, it sets `option.hidden` on non-matching descendants **in place**.

That breaks two ways if `windowed` is naïvely enabled in client mode:

- **Harvest swallows hidden nodes.** `windowed` harvests `descendants(target)` on `filter-resolved`,
  which includes the `hidden` ones — so its model is the *unfiltered* set and the filtering is lost.
- **Filtering only sees the window.** Once `windowed` collapses the DOM to ~10 nodes, `filterClient`
  iterates only those mounted descendants — it can't match anything outside the current window.

So client-mode windowing needs **model-level filtering**: the filter must run against `windowed`'s
full private model (not the mounted DOM), then `windowed` re-windows the *matching* subset. That's a
real feature, not a wiring tweak — hence deferred from #201.

Today the gate in `AutoComplete.#isWindowed()` returns false in client mode, so `windowed` is inert
there (the full seeded set just renders). A unit test pins that inert behaviour
(`AutoComplete.test.ts` → "stays inert in client mode").

Acceptance: `<auto-complete filter="client" windowed>` with a long inline option set renders only a
window, typing filters against the **full** model (not just the mounted window), and the active
option stays mounted while arrowing (the #023 invariant) — proven by a unit test and an e2e. Likely
shape: `filter` filters `windowed`'s model (a new model-aware client path) rather than toggling
`hidden` on descendants, and `windowed` windows the filtered result.
