---
bornAs: xd5fws3
kind: story
size: 3
parent: "2445"
status: open
blockedBy: ["3568", "3576"]
dateOpened: "2026-09-07"
tags: [plateau-loop, lane-pool, capacity, constellation-placement]
---

# Plateau Loop: generalize WE's lane-pool hygiene and hardware-aware admission control into the coordinator's own lane/capacity substrate

WE's own lane-pool machinery (we:backlog/3568's litter-reaping + we:scripts/conveyor/lane-pool-health-watch.mjs pass, we:backlog/3576's leverage-ranked auto-prepare-docket generalization, and the staged hardware-usage-aware admission-control epic 3611/3608/3610, PR #1998) is exactly the 'lane-pool + leases' and 'item selection/authoring' substrate we:backlog/2445's own Extraction seams section names as what the coordinator pulls in. Tracks generalizing those mechanics into the Loop's own in-process lane/admission substrate once it exists to consume them; does not rebuild the WE-side work.

## Grounding — checked against we:backlog/2445's actual text, not assumed

- **we:backlog/2445's own "Extraction seams" section** names the deterministic substrate the coordinator inherits verbatim: "lane-pool + leases, pr-land, merge-ai-prs (drain), the three guards, review-escalation/review-core contracts, lane-partition, backlog CLI." Lane-pool hygiene and admission control are literally named, not inferred.
- **we:backlog/2445's own red-team risk list** already flags "subscription quota is a hard wall for a resident spawner" as a risk to the Loop's own runner (captured on we:backlog/2444, ratified). A resident coordinator spawning many concurrent agent workers across a multi-project registry (we:backlog/2472) will hit the identical host-capacity problem WE's own dispatcher hit live tonight (46/50 lanes dirty, 0 free, per we:backlog/3568) — at a larger scale, not a smaller one.
- **we:backlog/2445's own three named AI seams** are "lane workers, diff judging, item selection/authoring." we:backlog/3576 (formerly `3576`) generalizes WE's leverage-ranked auto-prepare-docket pattern from decisions to unscoped build items — this is squarely "item selection," reusing the same `leverageScore` metric the Loop's own item-selection seam would need.

## What's actually being generalized

- **we:backlog/3568** — `cmdRelease` git-cleans a named litter allowlist before dropping a lease, plus a new standing `we:scripts/conveyor/lane-pool-health-watch.mjs` pass that reaps the same allowlist from any unleased lane every tick and reports pool health. This is exactly the "in-process lane ownership" behavior we:backlog/2445's own closed-world model describes ("The Loop is a resident process that OWNS the lanes it launches").
- **we:backlog/3576** — a build-item-scoped sibling of we:backlog/3562's decision-docket-watch, ranking open unscoped items by `leverageScore` and auto-dispatching `prepare-scope`. Reuses the exact machinery we:backlog/3165 already proved generic.
- **3611 / 3608 / 3610 (PR #1998, not yet merged/numbered)** — a staged, hardware-usage-aware admission-control project (Stage 1 real CPU/memory sampling, Stage 2 EWMA-adaptive cap, Stage 3 a genuinely learned policy), filed as the deferred future work we:backlog/3456 named explicitly. Cross-referenced here by hash id rather than `blockedBy` — not yet a resolvable item id, per this repo's own `check:standards` `blockedBy`-graph-check constraint (the same reasoning we:backlog/3595 applied to its own then-unlanded `x7wehz2` sibling). Once #1998 lands and these are JIT-numbered, add them to this item's `blockedBy` array as a follow-up.

## Not in scope

- Rebuilding, rescoping, or second-guessing any of the WE-side items above — they stand on their own merit for WE's own dispatcher regardless of this item.
- Deciding whether 3611's Stage 2/3 (EWMA / self-learning) ships at all — that is `3610`'s own open decision, orthogonal to placement.
- Any plateau-app-side filing or `locus:` field — per we:docs/agent/platform-decisions.md#backlog-tracking-locus-now-distributed-next, one record of truth stays in WE's own `backlog/*.md` now, matching every one of we:backlog/2445's ~40 existing children (none carry a `locus:` field).

## Cross-references added

- we:backlog/3568, we:backlog/3576 — each now carries a short pointer to this item.
- PR #1998 (`3611`/`3608`/`3610`) — not editable from this lane (unmerged, on another branch); flagged via a PR comment instead.

## Done when

1. **Executable** — TODO: once the WE-side lane-pool-health-watch pass and the auto-prepare-docket generalization have landed and run for real, and 3611's Stage 1 has produced real usage data, this item is `/prepare`d into a concrete plateau-app build scope (which parts of the substrate the Loop's own lane/capacity manager actually reuses vs. re-derives) rather than left as a placeholder.
