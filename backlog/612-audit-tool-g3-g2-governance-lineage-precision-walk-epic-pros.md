---
type: issue
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# Audit tool: G3/G2 governance-lineage precision — walk epic+prose decision refs, trust git dates

Harden scripts/audit-backlog-health.mjs governance checks, per the #607 audit. G3 (ungoverned-arch) only walks blockedBy/parent frontmatter, so it false-positives when a governing type:decision lives one epic-hop up or is named in prose: adversarial verification refuted 2 of 3 G3 'confirmed slips' (#355 by #409, #357 by the #314 charter). Fix: walk parent->epic->decision transitively and extract prose #NNN refs, clearing any resolving to a resolved decision. G2 compares two backfilled frontmatter dates (7 artifacts, 0 real); derive resolved-at from the commit flipping status:resolved, exclude repo-first-commit imports, and require the lineage edge to exist. Consumed by #608.

## Progress

- **Status:** resolved — both checks hardened in `scripts/audit-backlog-health.mjs`; gate green (0 errors), audit regenerated.
- **Branch:** docs/standard-authoring-workflow
- **G3 — transitive + prose:** added `transitiveLineage(it)` (BFS over the full parent+blockedBy closure, not just the item's own two fields) and `citesResolvedDecision(it)` (any body `#N`/`/backlog/N` resolving to a *resolved* `type:decision`). An item clears if a decision is reachable transitively (epic-hop up) **or** cited in its prose. Effect: **G3 219 → 91**; the named examples **#355 and #357 now clear** (each cites a resolved decision in-body — #093 / #009).
- **G2 — git dates, gating-edges-only, import exclusion:** build order now comes from `gitResolvedAt(file)` (the commit flipping `status: resolved` via `git log -G`), never the backfillable `dateResolved`. Endpoints **born resolved at their add commit** (or added in the repo's first commit) are *undatable* → skipped. Governance is read from **`blockedBy` only** — `parent` (epic membership) is not a build-ahead gate, which is why the six `parent:"023"`-only hits (#21/#26/#27/#29/#35/#54) drop. Effect: **G2 7 → 1**; the survivor **#135** is a genuine candidate (shipped while `blockedBy:[129]` was still open — judgment confirms/forward-ref-clears, the tool no longer manufactures it from dates).
- **Scope note:** the prose-clear is deliberately broad (any resolved-decision ref), matching the #607 improvement-log spec; it also clears **#353** (cites #009), which the #607 ledger already adjudicated as *drift, not slip* (filed #616), so the over-clear lands on a non-fault. The irreducible cases (a decision that names the item but is never cited back, e.g. #409→#357; the #135 forward-ref) remain judgment calls — exactly the "verify layer is load-bearing" note the audit-improvement log records.
- **Removed:** dead `resolvedBefore` frontmatter-date helper.
- **Done:** code change, audit re-run (602 items, G1=104/0-HIGH, **G2=1, G3=91**, D1=8, D2=0, D3=18), `npm run check:standards` → 0 errors.
