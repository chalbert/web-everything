---
bornAs: xgzjypy
kind: story
size: 8
parent: "3621"
status: open
scope: ["we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/pr-watch.mjs", "we:scripts/wait-green.mjs", "we:scripts/lib/pr-merge-gate.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/lib/gh-throttle.mjs", "we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-13"
tags: []
---

# Re-open the gh-throttle migration -- ~78 of ~84 gh call sites remain unthrottled despite #3631 resolved

#3631 (we:backlog/3631-migrate-remaining-gh-cli-call-sites-to-the-gh-throttle-wrapp.md) is marked status: resolved (dateResolved 2026-09-12), but its own Progress note says only 5 of roughly 84 gh-calling sites route through we:scripts/lib/gh-throttle.mjs -- we:scripts/lib/review-label-provider.mjs, we:scripts/conveyor/ci-queue-watch.mjs, we:skills-src/conveyor/runner.mjs, and one execFileSync site in we:scripts/review-set-label.mjs. Roughly 78 sites remain unthrottled and still exposed to GitHub secondary rate limits (100 concurrent / 900 REST points-min / 2000 GraphQL points-min). This reads as an incorrect auto-resolve on a partial slice, not a genuine completion, confirmed by reading the card verbatim on origin/main. we:scripts/backlog.mjs has no reopen verb (resolve only goes active to resolved), so this files the real remaining scope as a fresh item rather than hand-editing #3631 frontmatter. Migrate the highest-risk sites first, in order: we:scripts/conveyor/tick-core.mjs (around line 1379, fires every tick), we:scripts/conveyor/pr-watch.mjs (around line 398, polls every 20 seconds), we:scripts/wait-green.mjs (around line 106, polls every 15 seconds), we:scripts/lib/pr-merge-gate.mjs, and we:scripts/operations/dispatch-lane-io.mjs -- then the rest of the roughly 84-site grep. Each site migrates to we:scripts/lib/gh-throttle.mjs runGhSync/execFileSyncThrottled or the CLI passthrough, with a side-by-side output comparison against raw gh proving byte-for-byte fidelity, the same proof the already-landed #3631 slice used.

## Added by the #3699 ruling (2026-09-21)

The decision on how PR and CI state is read (#3699, Fork 1) ruled that a shared state feed is built, and that this item is its prerequisite under any answer. It now also carries three things the wrapper lacks today:

- **The `we:scripts/merge-ai-prs.mjs` call sites.** It holds about 25 of the unthrottled calls and was not on this item's list. It is now in scope.
- **A per-minute points budget in `we:scripts/lib/gh-throttle.mjs`.** The wrapper today is a cap-6 concurrency semaphore that fails open after 2 minutes. It bounds how many calls run at once, not how many points are spent per minute. Measured costs on 2026-09-21: a single-PR view is 1 point, and a 100-PR open list is 4 points.
- **Call-volume and exhausted-retry recording.** The wrapper retries silently up to 5 times and keeps no count. Have it append a call count and any exhausted retry to a sidecar log, so the load estimates in #3699 become data.

Size raised from 5 to 8 for this. If a builder finds it larger than one lane, split it (the budget and the recording are a natural second slice).

## Done when

1. **Executable** — `npx vitest run` on the wrapper's tests in we:scripts/lib/__tests__/ passes with new cases that fail before this item lands: calls beyond the per-minute points budget wait instead of firing; each call and each exhausted retry is appended to the sidecar log.
2. **Observable** — a grep for raw `gh` spawns outside the wrapper, over the files in this item's scope, returns none.
