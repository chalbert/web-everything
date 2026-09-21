---
bornAs: xu1jhfi
kind: decision
status: resolved
dateOpened: "2026-09-18"
dateStarted: "2026-09-21"
dateResolved: "2026-09-21"
codifiedIn: one-off
preparedDate: "2026-09-18"
tags: [github, rate-limit, polling, architecture, event-driven]
---

# Shift from polling to event-driven GitHub state push — decision point on rate-limit recurrence

GitHub's secondary (burst) throttle has tripped on this account (2026-09-08 per #3621; the original filing reports another on 2026-09-18) and will recur: every watcher and agent draws on one shared budget, and watchers grow with the lane cap. Finishing the throttle (#3670) stops bursts and is not a decision. How PR and CI state reaches local agents is: one merit fork, grounded in a repo audit, GitHub's rate-limit docs and query costs measured on 2026-09-21. The recommended default is in **bold**.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — where PR and CI state is read from | One standalone read-only state feed in WE that polls once and writes a local snapshot file, read by watchers (and later the drain daemon), with the throttle work as its prerequisite | Keep per-process polling, with the throttle work and idle backoff | med-low |

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
- **(b) One standalone read-only state feed in WE, read by watchers and, later, the drain daemon.** **RECOMMENDED.** A small long-lived process under `we:scripts/` (proposed home `we:scripts/conveyor/`; the name is not fixed) polls open PRs once per repo that has a watched PR (4 points per list) on its own loop and writes a snapshot file atomically (temp file, then rename) that carries the time it was fetched. `pr-watch` and `wait-green` read that local file instead of calling GitHub. Watchers are armed for WE only, so that is about 12 points per minute at a 20s interval against about 24 for 8 watchers (2x), or against about 56 with `wait-green` (nearly 5x), and it stays flat as watchers grow. Both can back off when idle, so the comparison holds at any interval: at 60s it is about 4 against 8. GitHub sees one serial reader, and every consumer sees the same snapshot instead of N slightly different ones. It uses no GitHub-side infrastructure. It has to be paired with (a)'s prerequisites, because it does nothing for bursts from agents' own calls. **The feed has one job:** it reads and writes the snapshot, and owns no merge logic, no drain lease and no pause gate. **Consumers read a file, not a stream:** the saving comes from having one reader, not from push. A file read costs GitHub nothing, the file's age is the freshness signal, and there is no per-client event filtering to build. A merged or closed PR drops off an open-PR list, so when a watched PR disappears the feed makes one per-PR view (1 point) to classify it. **Failure behavior:** a consumer whose snapshot is older than two poll intervals (or missing, because the feed is down) falls back to polling for itself, with random jitter so the fallbacks do not all start at once. **Start model (a default the operator may override):** a lazy singleton, started under a lock by the first consumer that finds the snapshot missing or stale and exiting after an idle period, so it needs no install step; the alternative is a launchd LaunchAgent like the drain daemon's, which adds an install step but keeps it always warm. **Drain daemon as a consumer:** its merge pass makes its own per-repo list calls today, and could read the feed instead. That is a later, optional adoption, because the pass needs fields the feed may not carry (PR bodies for manifests) and must confirm live state before it merges, so it is not part of the default's saving above.
- **(c) A GitHub Actions workflow pushes state to a git ref; agents fetch it.** *Rejected:* it moves the reads onto `GITHUB_TOKEN` (1,000 requests per hour per repository) but does not remove them, and the local side still fetches. GitHub's docs do not say whether `git fetch` counts against the API limits. `workflow_run` fires only for workflow files on the default branch, and Actions minutes are billed on private repos. It adds a second copy of PR state in git, with workflow start-up latency that has not been measured. The existing `we:scripts/operations/stage-pr-view.mjs` flow is request-driven, not event-driven, so it is a weaker precedent than it looks.
- **(d) Swap `pr-watch` onto the daemon's existing merged/parked events, as #2605 planned.** *Rejected as sufficient:* the events cover only `ready-to-merge` PRs and only merged or parked, while `pr-watch` fetches and classifies on checks and review decision (`we:scripts/conveyor/pr-watch.mjs:396-398`) and has a closed exit, none of which those events carry. No in-tree caller uses the stream (its only consumer is the `watch` command at `plateau:tools/drain-daemon/cli.mjs:507`). The events stay useful for merge-queue notifications, but they are not a state feed.
- **(e) `pr-watch` reads the conveyor's existing per-tick PR snapshot.** *Rejected:* the snapshot is a temp file that lives one 120s tick, so state would be up to six times staler than today's 20s watch, and it serves only runner-launched consumers. It is (b)'s degenerate form, with a slower refresh and no independent owner.
- **(f) Forward GitHub webhooks to a local process** (`gh webhook forward`, or a tunnel). *Rejected:* this is the one route that truly costs no API points, but GitHub documents `gh webhook forward` as testing-only and allows one forwarder per repository at a time, and a tunnel means exposing a public endpoint from the operator's machine. Neither is a sound base for the always-on path.
- **(g) Host the feed in the drain daemon, fanning out over its SSE stream** (the earlier draft's default). *Rejected:* the daemon's charter (`plateau:tools/drain-daemon/README.md`) is to own the merge queue and only schedule the existing sweep, with no steering and no logic of its own. A general state feed is a second job, and it would need a poll loop independent of the daemon's lease and pause gates (`plateau:tools/drain-daemon/daemon.mjs:312-333`), repo-keyed events (`plateau:tools/drain-daemon/lib.mjs:1219`) and per-client filtering (`plateau:tools/drain-daemon/lib.mjs:1265`). It also couples lifecycles: an operator who stops or restarts the daemon to manage the queue would blind every watcher. And the daemon is hosted provisionally in plateau-app (pending #2446), so `pr-watch` in WE would depend on a location that may move.

**Skeptic:** run on the earlier draft (feed hosted in the drain daemon), not on this revision. Result then: SURVIVES-WITH-AMENDMENT — three fresh-context attacks. The first and the third demanded a flip to (a), because at the 8-lane cap the saving is about 2x and the 2026-09-08 trip was a burst that a shared feed does not touch; the second found the load arithmetic mixed calls with points and corrected it. Not flipped: the comparison has to hold the interval equal (backoff helps the feed too, about 4 points per minute against 8 at 60s), and the feed is paired with (a)'s burst fixes, never offered instead of them. That reasoning carries over. What changed since that pass: the daemon-side work and the plateau-app dependency are gone, the transport is a file, and the start model and the drain-daemon adoption are new. Those were attacked inline at ratification, not by a fresh sub-agent (see *Ruling*). Confidence stays med-low, because the saving is real but modest at today's cap and the dissent stands.
**Screen:** clear on the earlier draft — a fresh-context screen found this is agent-machinery governance, decidable in-repo with no WE standard boundary at stake, and that scaling, consistency, serial reads and failure behavior are real merit differences with no "wait" language in the default. Not re-run on this revision; moving the feed from the daemon into `we:scripts/` keeps it in the same agent-machinery class.

## Ruling — Fork 1 (ratified 2026-09-21, Nicolas)

**Ratified: (b), a standalone read-only PR state feed in WE, read by watchers, with a snapshot file as the transport.** The defaults stated in (b) stand: a lazy-singleton start model, a two-poll-interval freshness rule with a jittered fallback, and the drain daemon as a later optional consumer. The operator asked for the feed to be separate from the drain daemon because hosting it there did not fit the daemon's charter (see (g)).

**Inline attack at ratification (a stamp is not a check), against the branch being ratified:**
- *"A 2x saving does not justify a new process; per-process polling plus #3670 and backoff is enough."* This is the standing dissent from the earlier skeptic pass. It stands, and is why confidence stays med-low. The ruling rests on scaling with the lane cap, one consistent snapshot and serial reads, not on the saving alone.
- *"If the feed dies, every watcher falls back at once and the burst returns."* The fallback is today's behavior, with jitter, so it is no worse than now. The freshness rule keeps a dead feed from hiding stale state.
- *"An open-PR list may not carry what `pr-watch` classifies on."* Checked: `gh pr list --json` offers `state`, `mergedAt`, `labels`, `statusCheckRollup`, `reviewDecision` and `body`, which covers the fields `pr-watch` fetches (`we:scripts/conveyor/pr-watch.mjs:396-398`). A merged or closed PR leaves the open list, which the one per-PR view handles.

The attack fails; the ruling is not amended. A fresh sub-agent skeptic pass on the new default was not run.

**Codified as:** a one-off ruling. The build work carries it: it is not a standing rule for we:docs/agent/platform-decisions.md.

**Spin-offs filed:**
- `xclicg5` — build the read-only PR state feed (size 5).
- `x909kb7` — move `pr-watch` and `wait-green` onto the feed (size 3), `blockedBy` `xclicg5` and #3670.
- `x34tegz` — optional: let the drain daemon's merge pass read the feed (size 5), `blockedBy` `x909kb7`, filed unqueued behind a field-coverage check.
- #3670 amended in place: the `we:scripts/merge-ai-prs.mjs` call sites, the per-minute points budget and the call-volume recording are now in its scope (size 5 to 8).

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
2. **Follow-on** — on ratifying (b), the state-feed story (WE) and the `pr-watch` / `wait-green` adoption story are filed, the latter `blockedBy` #3670 where they share files, plus an optional story for the drain daemon's merge pass to read the feed. Their ordering is a backlog call, not part of this ruling. **Done 2026-09-21:** filed as `xclicg5`, `x909kb7` and `x34tegz`, and #3670 amended (see *Ruling*).
