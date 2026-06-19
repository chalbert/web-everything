---
type: decision
workItem: task
status: resolved
dateOpened: "2026-06-03"
dateResolved: "2026-06-06"
tags: [pagination, windowed-collection, loader, infinite-scroll, collection-ops, seam]
relatedReport: reports/2026-06-03-pagination-standard-research.md
relatedProject: webintents
crossRef: { url: /intents/collection-operations/, label: collection-operations intent }
graduatedTo: intent:collection-operations
codifiedIn: "docs/agent/platform-decisions.md#intents-ux-only"
---

# Draw the explicit seam between pagination and the existing infinite-scroll / virtualization research

The Collection Operations Intent already drew the seam in principle — Windowed Collection "renders the visible window; this selects/orders the set. Compose, never merge" — but `pageMode` still carried `infinite` as a peer affordance value, leaving it ambiguous whether `infinite` was a distinct mode or just load-more with an auto-trigger.

**Resolved (2026-06-03): `infinite` is not a peer mode.** `pageMode` was decomposed into two orthogonal axes on the intent: a navigation model (`paged` | `append`) and an advance trigger (`manual` | `auto`, default `manual`). Infinite scroll is the derived combination **`append` + `advance:auto`** — its *rendering* delegates to Windowed Collection and its *lifecycle* to Loader's `loadingMore`. `virtualized` is therefore never pagination vocabulary at all (it is pure Windowed Collection). Defaulting `advance:manual` makes load-more the path of least resistance and infinite an explicit opt-in, encoding the research's recommendation as the native default. The `auto` trigger is native-grounded on IntersectionObserver. The empty quadrant (`paged` + `auto`) is documented as undefined.
