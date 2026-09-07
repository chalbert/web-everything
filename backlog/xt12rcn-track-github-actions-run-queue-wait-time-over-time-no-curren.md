---
kind: task
parent: "3383"
status: open
scope: ["we:scripts/conveyor/ci-queue-watch.mjs"]
dateOpened: "2026-09-07"
tags: [infra, ci, observability, monitoring]
relatedTo: ["3569"]
---

# Track GitHub Actions run queue/wait time over time — no current signal on CI capacity

Investigated 2026-09-07 whether GitHub Actions runner concurrency is a real or potential delivery constraint. Findings: this repo (chalbert/web-everything) is a public repo on a personal (non-org) GitHub account; `gh api user`/`gh api repos/chalbert/web-everything` do not expose the account's billing plan via API (would need to be checked manually at github.com/settings/billing — genuinely unknown from here). Per GitHub's current published limits, public-repo Actions minutes are free regardless of plan, and GitHub-hosted-runner concurrent-job ceilings are plan-based: 20 (Free), 40 (Pro), 60 (Team), 500 (Enterprise), with a lower macOS sub-ceiling on all but Enterprise. Sampled the 20 most recent `gh run list` runs live: every one shows a zero-second gap between `createdAt` and `startedAt` — no queueing observed in this sample. So there is currently no evidence CI concurrency is a binding constraint, but ALSO nothing tracks this over time — a real future queueing regression (e.g. from a burst of concurrent dispatched lanes each triggering CI) would currently go unnoticed until someone manually samples `gh run list` again. Needs a small periodic sweep (mirroring we:scripts/conveyor/branch-drift.mjs's own pure-classify + thin gh-IO-shell shape) that samples `gh run list --json databaseId,status,createdAt,startedAt` on some cadence and records/logs the started-minus-created wait time, so a genuine queueing trend becomes visible instead of invisible. Related to we:backlog/3569-a-rolling-24h-delivery-capacity-monitor-artifact-lane-utiliz.md (the rolling 24h delivery-capacity monitor) — that item's scope is lane/queue/dispatch capacity, not CI-runner queueing specifically; this item's data could feed into that artifact once built, or ship as its own small standing pass first. Exact cadence/storage mechanism (piggyback the resident headless runner's tick vs its own cron) is an open implementation choice for whoever builds this.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
