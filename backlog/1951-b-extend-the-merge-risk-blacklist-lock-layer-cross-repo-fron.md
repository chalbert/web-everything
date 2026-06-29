---
kind: story
size: 5
parent: "1949"
status: resolved
blockedBy: ["1950"]
dateOpened: "2026-06-28"
dateStarted: "2026-06-29"
dateResolved: "2026-06-29"
tags: []
---

# B: extend the merge-risk blacklist + lock layer cross-repo (frontierui / plateau-app)

The lock blacklist (RESERVED_MERGE_RISK) and the #1945 file-lock layer are WE-only (locks acquired in the WE clone; the denylist lists only WE paths). So cross-repo contention — two items both touching fui:tsconfig.json / fui:package.json / a shared barrel — has NO lock path and falls through to whole-item serial (the dominant cause of batch-2026-06-28-1946-1945's collapse: 7/8 items were cross-repo). Add a per-repo RESERVED_MERGE_RISK set + a per-repo lock root (we:scripts/readiness/file-locks.mjs --root parameterized per affected clone) so a lane briefly reserves a shared impl-repo file instead of being demoted to serial. Pairs with slice A (which routes shared-but-non-monolith files to lock/optimistic instead of serial).

## Progress

- 2026-06-29: Done. Made the blacklist **per-repo** — `RESERVED_MERGE_RISK_BY_REPO = { we, frontierui, 'plateau-app' }` in the canonical module (`we:scripts/readiness/lane-partition.mjs`) and the workflow mirror, with `isMergeRiskFile`/`isReservedMergeRisk` now matching a repo-qualified path against its OWN repo's set. **This closes a correctness gap slice A opened:** A's repo-qualified partition + a WE-only `isMergeRiskFile` meant a cross-repo monolith (e.g. `fui:src/_data/blocks.json`) co-touched by two confident lanes would have optimistic-merged with no clean-but-wrong protection. Investigated the impl repos: frontierui's monolithic single-doc registries are its `fui:src/_data/blocks.json` / `fui:src/_data/plugs.json` / `fui:src/_data/traits.json` arrays plus the `fui:src/_data/adapters.js` and `fui:src/_data/demos.js` maps (its per-entry collections live in dirs); plateau-app has **none** (its shared surfaces are code, where a real conflict surfaces and replays). Tests (`we:scripts/readiness/__tests__/lane-partition.test.mjs`, now 25): cross-repo monolith → serial, same filename in different repos → concurrent, build config still off, per-repo specificity.
- **Scope divergence from the digest (deliberate):** the digest also proposed a *per-repo lock ROOT* so a cross-repo monolith is briefly LOCKED rather than serialized. I kept the #1945 runtime lock backstop **WE-scoped** and handle cross-repo merge-risk at the **partition** level (a shared cross-repo monolith → same lane via `conflicts()`), with `multiLaneFiles` catching any unpredicted spill post-hoc. Rationale: that fully closes the *correctness* gap with no lock-layer change; converting predicted cross-repo-monolith contention from serial→concurrent-with-lock is a pure *capacity* optimization for a rare case. Left unbuilt on purpose — file a follow-up only if a real batch is seen to collide on a cross-repo monolith (the "park behind a real collision" rule).
