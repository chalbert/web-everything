---
bornAs: xu1jhfi
kind: decision
status: open
dateOpened: "2026-09-18"
preparedDate: "2026-09-18"
tags: [github, rate-limit, polling, architecture, event-driven]
---

# Shift from polling to event-driven GitHub state push — decision point on rate-limit recurrence

GitHub's secondary (burst) throttle has tripped on this account (2026-09-08 per #3621; the original filing reports another on 2026-09-18) and will recur: every watcher and agent draws on one shared budget, and watchers grow with the lane cap. Finishing the throttle (#3670) stops bursts and is not a decision. How PR and CI state reaches local agents is: one merit fork, grounded in a repo audit, GitHub's rate-limit docs and query costs measured on 2026-09-21. The recommended default is in **bold**.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — where PR and CI state is read from | One local poller that fans state out to agents over the drain daemon's push channel, with the throttle work as its prerequisite | Keep per-process polling, with the throttle work and idle backoff | med-low |

Three things sit outside the table, with nothing to weigh: finishing #3670, a per-minute budget and volume recording in the throttle wrapper, and idle backoff on the existing pollers (see *Supported by default*).

## The load, in numbers

Estimates from the code, not measurements of live traffic. Measured 2026-09-21 with `rateLimit { cost }`: a single-PR view costs 1 point, and a 100-PR open list with labels, checks and comments costs 4 points, whatever the real PR count.

- Each watched PR is polled by `we:scripts/conveyor/pr-watch.mjs` every 20s (`:388`; one `gh pr view` at `:396-398`), so 3 points per minute. `we:scripts/wait-green.mjs` polls every 15s (default at `:90`, the call at `:106`), 4 per minute, when an agent runs it. The conveyor arms `pr-watch` for WE only (`we:scripts/conveyor/tick-core.mjs:852`).
- The lane cap is 8 (`we:scripts/lib/lane-concurrency.mjs:38`), so up to 8 watchers: about 24 points per minute, or up to about 56 with `wait-green` on every PR. On top of that, the conveyor tick (every 120s, `:58` of the same runner) and the drain daemon's 60s merge pass (three per-repo lists of 4 points each) add roughly 13 to 20 points per minute; the tick's share is unmeasured.
- That is about 40 points per minute (roughly 2,400 per hour) at the cap, or about 75 (roughly 4,500 per hour) if `wait-green` also runs on every PR. The binding budget is the primary one, 5,000 points per hour per user: as a worst-case ceiling (8 saturated lanes for a full hour, `wait-green` on every PR) that is half to nine-tenths of it, though only 2 to 4 percent of the 2,000 GraphQL points per minute secondary limit. It excludes bursts from `we:scripts/merge-ai-prs.mjs` and agents' own `gh` calls.
- The secondary limits are 100 concurrent requests, 900 REST points per minute and 2,000 GraphQL points per minute (docs.github.com, rate limits for the REST and GraphQL APIs). GitHub's own advice is "make requests serially instead of concurrently".

## Fork 1 — Where should PR and CI state be read from: each process polls for itself, or one shared source reads once and fans out?

**Why this is a fork:** the branches cannot both be the primary path. With per-process polling every watcher owns a GitHub read, so cost and concurrency scale with watchers; with a shared source one reader owns the read, so cost is flat and reads are serial by construction, at the price of a component that can be down or stale. The difference is scaling, consistency and failure behavior, not effort or timing.

- **(a) Keep per-process polling, with #3670, a per-minute budget and idle backoff.** *Rejected as the primary path:* it bounds bursts and trims steady volume, but cost and concurrency still scale with watchers, and N independent pollers stay free to fire together. The wrapper today (`we:scripts/lib/gh-throttle.mjs`) is a cap-6 semaphore that fails open after 2 minutes and has no per-minute budget, so it is not serial and does not bound steady volume. Those pieces are worth doing under any answer, so they are prerequisites below, not the rival.
- **(b) One local poller, fanning out over the drain daemon's existing push channel.** **RECOMMENDED.** The drain daemon (`plateau:tools/drain-daemon/`) is resident under launchd and serves a local SSE stream on `127.0.0.1:4599` (#2605). It would poll open PRs once per repo that has a watched PR (4 points per list), keep a snapshot, diff it and broadcast changes; `pr-watch` and `wait-green` would read that instead of calling GitHub. Watchers are armed for WE only, so that is about 12 points per minute at a 20s interval against about 24 for 8 watchers (2x), or against about 56 with `wait-green` (nearly 5x), and it stays flat as watchers grow. Both can back off when idle, so the comparison holds at any interval: at 60s it is about 4 against 8. GitHub sees one serial reader, and every consumer sees the same snapshot instead of N slightly different ones. It uses no GitHub-side infrastructure. It has to be paired with (a)'s prerequisites, because it does nothing for bursts from agents' own calls. What it has to change in the daemon: poll on its own loop, independent of the drain lease and pause gates (`plateau:tools/drain-daemon/daemon.mjs:312-333`); key events and the replay map by repo as well as PR number (`plateau:tools/drain-daemon/lib.mjs:1219`); serve the snapshot (checks, review decision) and follow up with a per-PR view for merged and closed, which an open-PR list cannot show; filter live events per PR instead of broadcasting to every client (`plateau:tools/drain-daemon/lib.mjs:1265`). Failure behavior: every snapshot carries the time it was fetched, and a watcher whose snapshot is older than two poll intervals (or whose daemon is down) falls back to polling for itself, with random jitter so the fallbacks do not all start at once. The daemon is hosted provisionally in plateau-app (pending #2446), so `pr-watch` gains a cross-repo dependency.
- **(c) A GitHub Actions workflow pushes state to a git ref; agents fetch it.** *Rejected:* it moves the reads onto `GITHUB_TOKEN` (1,000 requests per hour per repository) but does not remove them, and the local side still fetches. GitHub's docs do not say whether `git fetch` counts against the API limits. `workflow_run` fires only for workflow files on the default branch, and Actions minutes are billed on private repos. It adds a second copy of PR state in git, with workflow start-up latency that has not been measured. The existing `we:scripts/operations/stage-pr-view.mjs` flow is request-driven, not event-driven, so it is a weaker precedent than it looks.
- **(d) Swap `pr-watch` onto the daemon's existing merged/parked events, as #2605 planned.** *Rejected as sufficient:* the events cover only `ready-to-merge` PRs and only merged or parked, while `pr-watch` fetches and classifies on checks and review decision (`we:scripts/conveyor/pr-watch.mjs:396-398`) and has a closed exit, none of which those events carry. No in-tree caller uses the stream (its only consumer is the `watch` command at `plateau:tools/drain-daemon/cli.mjs:507`). It is a piece of (b), not an alternative to it.
- **(e) `pr-watch` reads the conveyor's existing per-tick PR snapshot.** *Rejected:* the snapshot is a temp file that lives one 120s tick, so state would be up to six times staler than today's 20s watch, and it serves only runner-launched consumers. It is (b)'s degenerate form with a slower refresh and no push.
- **(f) Forward GitHub webhooks to the daemon** (`gh webhook forward`, or a tunnel). *Rejected:* this is the one route that truly costs no API points, but GitHub documents `gh webhook forward` as testing-only and allows one forwarder per repository at a time, and a tunnel means exposing a public endpoint from the operator's machine. Neither is a sound base for the always-on path.

**Skeptic:** SURVIVES-WITH-AMENDMENT — three fresh-context attacks. The first and the third demanded a flip to (a), because at the 8-lane cap the saving is about 2x and the 2026-09-08 trip was a burst that (b) does not touch; the second found the load arithmetic mixed calls with points and corrected it. Not flipped: the comparison has to hold the interval equal (backoff helps (b) too, about 4 points per minute against 8 at 60s), and (b) is paired with (a)'s burst fixes, never offered instead of them. Amended: a freshness contract and jittered fallback added, webhook forwarding added as (f), the per-tick snapshot added as (e), cited lines and the worst-case wording corrected, and confidence lowered to med-low, because the saving is real but modest at today's cap and the dissent stands.
**Screen:** clear — a fresh-context screen found this is agent-machinery governance, decidable in-repo with no WE standard boundary at stake, and that scaling, consistency, serial reads and failure behavior are real merit differences with no "wait" language in the default. An earlier screen, run on a draft whose default was (a), flagged it as prioritization and said it would choose (b) if the branches were free.

## Supported by default (not decisions)

- **Finish #3670**, the throttle migration for the ~78 remaining unthrottled `gh` call sites, in the order it already names. It stops bursts under any answer to Fork 1. Add `we:scripts/merge-ai-prs.mjs` to its list, since it is not there and holds about 25 of the unthrottled calls.
- **A per-minute points budget in `we:scripts/lib/gh-throttle.mjs`,** which today caps concurrency only. No item covers it yet.
- **Record call volume and exhausted retries.** The wrapper retries silently up to 5 times and keeps no count, and the raw `gh` sites (`pr-watch`, `wait-green`, `tick-core`, `merge-ai-prs`) are invisible to it until migrated. Have it append a count and any exhausted retry to a sidecar log, as part of #3670. That turns the estimates above into data.
- **Idle backoff.** Poll every 20s or 15s while a PR is changing, and back off toward 60s while nothing has changed. It is a tuning inside any answer, at some cost in latency.
- **Conditional requests** are a later optimization. GitHub's docs say a 304 does not count against the primary limit, are silent on the secondary limit, and `gh api` documents only a time-based `--cache`, so the gain is unconfirmed.

## Context

- **The audit (2026-09-18):** ~78 of ~84 `gh`-calling sites remain unthrottled although #3631 was marked resolved. #3670 (opened 2026-09-13) re-opens it.
- **`gh api rate_limit` readings** taken while writing this were inconsistent with GraphQL's own `rateLimit { remaining }`, so no live usage figure is claimed here.
- **Filing history:** first committed in a lane clone (lane-58, commit `aea2e38c0`) whose local `main` was never pushed, so it never reached `origin/main`. Re-filed and landed through the standard lane → PR flow.

## Done when

1. **Observable** — Fork 1 is ruled, and #3670 carries the per-minute budget, the `merge-ai-prs` sites and the call-volume recording.
2. **Follow-on** — on ratifying (b), the daemon-poller story (plateau-app) and the `pr-watch` / `wait-green` adoption story are filed, the latter `blockedBy` #3670 where they share files. Their ordering is a backlog call, not part of this ruling.
