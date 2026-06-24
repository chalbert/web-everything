---
kind: task
parent: "1684"
status: resolved
blockedBy: []
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1684
tags: []
---

# webrouting slice B — route-format semantic profile + terms

webrouting epic #1684 slice B: author the presentation-free route-format semantic profile in the spec page (a highlight-typescript block, mirroring webgraph slice #1373) + the route-format terms under we:src/_data/semantics/, in the canonical declarative-template form ratified by #1685. Rides resolved #1685. Blocked by slice A (#1725).

## Progress (batch-2026-06-23-1725-1665) — DONE

Slice B landed — the route-format semantic profile + terms (mirrors webgraph slice #1373):
- `we:src/_includes/project-webrouting.njk` — added a **Route-format profile** section: a highlight-typescript block presenting the route table's semantic core (`RouteFormatEntry` — path/guard/guardLeave/loader/outlet/isErrorBoundary), presentation-free, in the #1685 declarative-template form, with URLPattern as the path grammar. Distinguishes the semantic profile (meaning) from the navigation runtime (how it commits) and from the #1721 derived route-map projection (the non-DOM read).
- `we:src/_data/semantics/` — 5 route-format terms: `route-table`, `route-outlet`, `route-guard`, `route-loader`, `route-error-boundary` (we:src/_data/semantics/route.json + we:src/_data/semantics/urlpattern.json already existed). Each grounds a `route:*` attribute in `we:blocks/router/types.ts`.

Presentation-free, in the canonical declarative form ratified by #1685. Cleared the stale `blockedBy: 1725`. Gate 0 errors (335 terms).
