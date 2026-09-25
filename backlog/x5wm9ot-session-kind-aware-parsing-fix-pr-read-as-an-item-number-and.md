---
kind: story
size: 3
parent: "4075"
status: resolved
relatedTo: ["3669", "3721"]
scope: ["we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/session-slug.mjs", "we:scripts/lane-drain.mjs", "we:scripts/lane-pool.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
graduatedTo: "we:scripts/conveyor/lease-reaper.mjs"
tags: []
---

# Session-kind-aware parsing: fix-<PR> read as an item number, and the reaper is blind to review/ci-heal/inspect lanes

we:scripts/conveyor/lease-reaper.mjs's matchSessionSlug conflates a fix-<PR> session's PR number with a backlog item number (mintSessionSlug mints fix-<PR> off a PR number, but prStatesFromList's Map is keyed by the item number embedded in each PR's head ref lane/<num>-*, a different namespace), so a fix session's PR-state lookup can miss or hit the wrong entry; we:scripts/lane-drain.mjs and we:scripts/lane-pool.mjs's cmdReleaseAllPools --item=N inherit the same confusion via itemNumFromSession. Separately, matchSessionSlug only returns non-null for itemKind sessions or kind==='fix' (line ~139), excluding review-*/ci-heal-*/inspect-* (all PR_KINDS per we:scripts/conveyor/session-slug.mjs), so dead review/ci-heal/inspect lanes are only ever freed by the 4h TTL, never the PR-terminal axis. Fix: a single session-kind-aware helper (we:scripts/conveyor/session-slug.mjs already has parseSessionSlug/PR_KINDS/ITEM_KINDS) that widens the PR-terminal axis to every PR_KIND, scoped by the correct repo, and never conflates a PR-number lookup key with an item-number lookup key.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/lease-reaper.test.mjs` carries cases that fail
   before and pass after: `itemNumFromSession('fix-N')` is null (was `N`); `prNumFromSession` resolves the PR
   number for every PR_KIND (review/fix/ci-heal/inspect) including multi-repo tags; `fetchPrStatesForRepo`
   returns `{byItem, byPr}` from one fetch; `sessionGoneForLease` now recognizes review-/ci-heal-/inspect-
   sessions; the collision-hazard tests prove a fix-<PR> lookup never hits the item-keyed Map. Also
   `we:scripts/__tests__/lane-pool-cross-pool.test.mjs`'s `--item=N` sweep no longer matches a same-numbered
   `fix-<PR>` session.
2. **Probed live** — `node we:scripts/conveyor/lease-reaper.mjs --dry-run --json` against the real pools: before
   this fix, `wouldReap: []` (a dead `ci-heal-2630` lease on web-everything lane-28, PR closed, invisible);
   after, it appears as `{"pool":"web-everything","lane":28,"reason":"pr-closed","session":"ci-heal-2630"}`.
