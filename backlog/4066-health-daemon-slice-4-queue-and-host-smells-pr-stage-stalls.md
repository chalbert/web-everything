---
bornAs: x1k0zfj
kind: story
size: 5
parent: "4075"
status: resolved
blockedBy: ["4065"]
scope: ["we:scripts/conveyor/health-smells/"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# Health daemon slice 4: queue and host smells — PR stage stalls, open unaccepted PRs over limit, stray labels, stood-down PRs, lane pool growth, machine load, App token and rate limit

Fourth slice of 4065: the remaining seed smells. PRs stuck per stage aggregates the stuck-PR watch's own markers (we:scripts/conveyor/stuck-pr-dispatch-marker.mjs) and never double-dispatches; open unaccepted PRs above the backpressure limit reads the limit from the open-PR backpressure work (x55tmjy); contradictory or stray review labels; stood-down PRs; lane pool growth and dirty-lane accumulation; host load average; GitHub App token trouble and rate-limit headroom. Most are alert-only per the ruling.

## Done when

1. **Executable** — each new smell has a fixture-driven unit test through the slice-1 core; the systemic
   stuck-PR smell is proven alert-only (it never plans a dispatch); App-token and high-load episodes are
   proven to inhibit agent dispatch.
2. **Live proof** — each probe runs against the live fleet in `shadow` with its reading shown.

## Progress

Seed smells 8–14 of the design table, one file each under `we:scripts/conveyor/health-smells/`:

| # | Smell id | Action | Notes |
| --- | --- | --- | --- |
| 8 | `pr-stage-stall` | alert only | ≥ 3 PRs of one repo stuck in one stage. Stage, exclusions and thresholds come from the stuck-PR watch's own core; the activity clock is `updatedAt` (never older than the watch's clock, so no false clusters). Recommendation aggregates the watch's markers and inspector findings off each PR thread. Never an investigate candidate. |
| 9 | `open-prs-over-limit` | alert | Limit and global-off read through `we:scripts/lib/pr-limit.mjs`. Count is a cheap upper bound (open, not `review:accepted`); the exact agent-authored count is the deterministic diagnosis (`we:scripts/operations/pr-limit.mjs` `status`). Breaches only ABOVE the limit (at the limit it is working), never while globally off. |
| 10 | `review-label-conflict` | file (known-fix, held until `fileDispatch`) | Two verdicts at once, `awaiting-advisory` without `human`, two `review-status:*`, stood-down while live-work status, unknown `review:*`. Opens after 2 samples. |
| 11 | `stood-down-prs` | alert | ≥ 5 open per repo, using the operator queue's own `standDownComments` rule (or the label). |
| 12 | `lane-pool-growth` | alert | > 90% of the acquire hard ceiling (mirrors `we:scripts/lane-pool.mjs` `ACQUIRE_HARD_MAX`, overridable via `config.laneHardCap`), or > 20% dirty unleased. "File when litter-only" is not built: the health line carries no per-lane litter split. |
| 13 | `machine-overload` (existing) | alert, inhibits | Already on main (3 × cores, 2 samples, names the culprit tree); unchanged. |
| 14 | `github-app-token` | alert (high), inhibits | `app-token`: cache past expiry or last refresh > 30 min old (probe reads `expiresAt` only, never the token). `rest-core`: REST core < 10%. `applied:false` stays with `bad-credentials`, GraphQL stays with `gh-graphql-budget`. |

Wiring: `we:scripts/conveyor/health-watch.mjs#probePrs` now also carries `mergeable` + trimmed `comments` (both already in the shared snapshot's field set, so no extra gh cost); new probes `prLimit`, `appToken`, `restBudget` (fixture flags `--app-token-cache`, `--rest-budget-fixture`; a `--lock-root` fixture tick never reads the host token cache). `github-app-token` added to `we:scripts/conveyor/health-investigate-plan.mjs#INHIBITING_SMELLS`. No smell was added to the shadow notify list (that is the operator's call).

Tests (`health-smells/__tests__/`): `pr-stage-stall`, `queue-smells`, `host-smells`, `slice-4-probes`. Each smell runs through `runHealthTick`; the stuck-PR cluster is shown never to be planned or picked for investigation with dispatch ON; App-token (expired cache, drained REST) and high-load episodes, each opened by its real smell, hold a real `lane-starvation` investigation as `inhibited`.

Live proof (2026-09-29 ~11:47Z, shadow, throwaway state root, `--no-diagnose --no-investigate --no-file --no-notify`): full tick in 39.5 s, no probe errors. Readings: `lane-pool-growth` BREACH on `we` (90/90 lanes, 37 dirty unleased; frontierui 13/30, plateau-app 16/30 clean); `github-app-token` clean (token expires in 17m, refreshed 0m ago; REST 6100/6100); `open-prs-over-limit` clean (4 unaccepted vs 15); `pr-stage-stall`, `review-label-conflict`, `stood-down-prs` no subjects: 5 open PRs, all idle ≤ 3m, no label conflicts, none stood down (per-PR stage/labels/markers read from live `probePrs`).
