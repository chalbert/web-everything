---
type: idea
status: open
dateOpened: "2026-06-07"
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
