---
kind: task
parent: "1684"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 1684
tags: []
---

# webrouting slice E — route-format + URL-as-state conformance vectors

webrouting epic #1684 slice E: author the presentation-free WE-owned conformance vectors under we:src/cases/webrouting/ for the route-format profile (slice B) and the URL-as-state seam (slice D) — mirroring webgraph slice #1376. Rides resolved #1685+#1686. Blocked by slice B (#1726) and slice D (#1728).

## Progress

Done (resolved 2026-06-26). Authored 3 presentation-free conformance cases under `we:src/cases/webrouting/`, mirroring webgraph slice #1376 (`we:src/cases/webgraph/`) — each a static declaration + an `EXPECTED` comment per axis; no runtime is executed, so they stand as conformance declarations against the not-yet-built FUI router runtime. Use the constellation site's own routing as a dogfood.

- `we:src/cases/webrouting/01-route-format-fidelity.html` — declarative `<we-route-view>` route table → 5 route entries in source order (first-match-wins), the slice-B semantic fields (path/guard/guardLeave/loader/outlet/isErrorBoundary, #1726 roles) mapped 1:1; URLPattern path grammar.
- `we:src/cases/webrouting/02-route-format-derived-projection.html` — the same table read through its #1721 serializable route-map projection: base-prefixed post-normalization paths, no leaked non-serializable field, JSON round-trip (the `validateRouteMap` read-side contract, declared).
- `we:src/cases/webrouting/03-url-as-state-seam.html` — a `UrlStateSlice` declaration (page/sort/filter/draft) → per-slice url/session/memory persistence (never forced), shared-codec round-trip, popstate-is-truth, coordinator batches concurrent writes into one history entry (slice D #1728/#1686).

All three render 200 at `/cases/webrouting/0*/` (verified :8080). Gate 0 errors. **Completes the #1684 webrouting scaffold's conformance-vector slice** (slices B #1726 + D #1728 the upstream profiles).
