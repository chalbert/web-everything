---
bornAs: xntcdet
kind: story
size: 8
parent: "2565"
status: resolved
dateScaffolded: "2026-07-20"
dateOpened: "2026-07-20"
dateResolved: "2026-07-21"
tags: [plateau-loop, console, decision-surface, rule-interface, read-port, slice-2565]
---

# Render the ruling surface from the live backlog read port

Replace the hardcoded ruling-console mock ([#2565]'s seed) with a surface rendered from live prepared
decisions and their forks, pulled through the [#2558] read port; each fork's evidence (prep PR, research
topic, prepared item, skeptic/screen verdicts) is a one-click deep-link. This is the **read-only half** of
turning the mock into a real rule interface — it stands alone (the surface becomes live and honest) even
before the ruling action ([#2581]) lands.

## Scope
- **Data source.** The surface fetches prepared decisions + their forks/defaults/`Skeptic:`/`Screen:` lines
  through the `#2558` read port (`GET /api/backlog/*` returning the interlingua DTO), never hardcoded HTML.
  Filter to `kind: decision` items in a rule-able state (prepared / `preparing` / open-with-`preparedDate`).
- **Project the fork shape onto the read port (in-scope — nobody else builds it).** The `#2558` DTO today
  carries the item's core fields and a rendered `detailHtml` blob, **not** a structured fork shape — and
  `#2561` fixes the *item requirement* spec, a different shape than the decision-fork narrative (`#2558`
  cross-ref lines 301-303). So this slice **extends the read port** to project each prepared decision's
  markdown into a structured **decision-fork DTO**: per fork — question, Option A / Option B, recommended
  default, the surviving `Skeptic:` verdict, the `Screen:` verdict, and the four evidence links (below). The
  projection lives **server-side in the `we-backlog` read-port adapter** (behind `/api/backlog/detail` or a
  fork-scoped read endpoint); the view still consumes only DTOs, so the `#2558` R2 boundary holds. This is a
  read-side addition to the seam, not a parallel read path in the view — do not parse markdown in the view or
  reach a bare CLI/disk/`gh` source from a rendering path.
- **Render.** Keep the seed's strong bones (design-record §6): one fork card per fork — question →
  Option A / Option B panes → recommended badge → surviving counter-argument (skeptic verdict) → downstream
  implication; the summary strip (decisions / forks / prep-PRs / self-ruled); sticky per-decision nav; the
  product color-grammar ([#2554], resolved) and both-theme token shell; no-horizontal-scroll responsive panes.
  Honest provenance framing preserved: skeptic-attacked defaults vs lighter grammar-derived picks stay
  visibly distinct.
- **Evidence deep-links (design-record R5 — cited, not asserted).** Each fork surfaces one-click links to its
  evidence: the prep PR, the `/research/` topic, the prepared item's `/backlog/<id>/`, and the skeptic/screen
  verdicts. Links come from the read-port DTO fields; a missing link renders as absent, never as a dead
  anchor.

## Where the code goes (locus)
- The surface is a plateau-app view, sibling of `#2555`'s Operator-actions decision surface, living beside the
  existing board views: `plateau-app:src/backlog-view/`. The **view** codes **only against the read port** — no
  view reaches a bare CLI / disk / `gh` source (the `#2558` R2 invariant). Reuse the existing client fetch shape
  (`plateau-app:src/backlog-view/backlog-view.ts` already only `fetch()`es `/api/backlog/*`).
- The **fork projection** is server-side read-port work: it lives in the `we-backlog` read-port adapter that
  answers `/api/backlog/detail` (today `plateau-app:src/backlog-view/loader.ts` / the dev-middleware) — the one
  place already allowed to touch disk. It parses the decision markdown into the decision-fork DTO; the R2
  boundary the view holds is unchanged.
- The contract/types it imports are WE-side: [we:src/_data/backlog.js](src/_data/backlog.js) vocabulary,
  promoted to `@webeverything/contracts/backlog` once that mint (the `#2558` spin-off, `#2569`) lands. If the
  package is not yet available, import the existing `plateau-app:src/backlog-view/types.ts` DTO as the interim
  byte-replica — do not fork a new type. The new **`DecisionForkDTO`** (question / options / default /
  skeptic / screen / evidence links) is added the same way: to `@webeverything/contracts/backlog` if minted,
  else alongside the interim `plateau-app:src/backlog-view/types.ts` replica.
- The tracked seed mock [we:docs/design/mocks/console-ruling-surface.html](docs/design/mocks/console-ruling-surface.html)
  is the cited UI-design input (design-record §6c), not code to port verbatim.

## Size note (recorded size-8 exception)
This slice is `size: 8`, above the slice rubric's `size` ≤ 5 bar
([we:docs/agent/backlog-workflow.md:728](docs/agent/backlog-workflow.md) condition 3) but at the `size` ≤ 8
**batchable ceiling** ([we:docs/agent/backlog-workflow.md:148](docs/agent/backlog-workflow.md)), so it stays
agent-ready and batchable — not in the `> 8` should-split band. The 8 is held **deliberately**: the only
natural cut (server-side fork projection vs view render) would leave a value-less backend half and a render
half that can't ship without it — the value-preserving-split failure the rubric guards against. Full rationale
in the slicing report ([we:reports/2026-07-20-slice-2565-console-ruling-surface.md](../reports/2026-07-20-slice-2565-console-ruling-surface.md),
"Explicit size-8 exception on #2580").

## Out of scope (other slices)
- Recording a verdict / writing anything → [#2581] (the write half).
- Governance fencing of *whether* a decision may be ruled here → [#2582].

## Delivered
- **Server projection** — `plateau-app:src/backlog-view/decision-forks.ts` (pure, tolerant) `projectForks` /
  `projectDecision` parse a decision's markdown into a structured `DecisionForkDTO` (question · why-fork ·
  Option (a)/(b) · recommended default · `Skeptic:` / `Screen:` verdicts · item-level evidence links). Every
  field past `question` is OPTIONAL — the fork/Skeptic/Screen convention lives only in the newest decisions, so
  a heading-only fork still projects and nothing hard-fails. `plateau-app:src/backlog-view/parse.ts` carries
  `preparedDate` + `relatedReport`; `plateau-app:src/backlog-view/loader.ts` `loadDecisionForks` filters
  `kind:decision` + `open` + `preparedDate`; `GET /api/backlog/decision-forks` → `DecisionRulingResponse`.
- **View** — `plateau-app:src/backlog-view/ruling-surface.ts` `renderRulingSurface` + `mountRulingSurface` at
  route `/console-ruling`: summary strip, sticky per-decision nav, one fork card per fork (question → Option A/B
  → teal Recommended badge → skeptic/screen rows → why-fork), evidence chips (present-only, scheme-guarded
  hrefs). Consumes ONLY the DTO (the `#2558` R2 boundary holds). Honest empty/error states.
- Sighted both themes on live data (17 rule-able decisions, 25 forks), no horizontal scroll; 64 tests;
  `plateau-app` `backlog-view` suite green (426); render-conformance clean. The ruling ACTION stays in [#2581].

## Acceptance
- The `#2558` read port emits a **structured decision-fork DTO** for each prepared decision — per fork:
  question, Option A / Option B, recommended default, the `Skeptic:` verdict, the `Screen:` verdict, and the
  four evidence links — projected **server-side** from the decision's markdown (no hardcoded fork fixture;
  editing a fork / skeptic / screen line on disk changes the DTO the endpoint returns).
- Opening the ruling surface renders the **currently-prepared** decisions and their forks from that read-port
  DTO (kill the hardcoded fixture; changing a prepared decision on disk changes the surface).
- Each fork card shows the four evidence deep-links, each resolving to the real prep PR / research topic /
  prepared item / verdict when present, and rendering as absent when not.
- The view imports no bare CLI/disk/`gh` source (the `#2558` R2 boundary holds); `plateau-app`'s gate
  (`npm test`) and `we:` `check:standards` pass; the surface is both-theme and has no horizontal scroll on a
  narrow pane.
