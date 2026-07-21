---
bornAs: xxw8ri1
kind: story
size: 5
parent: "2527"
status: resolved
dateOpened: "2026-07-15"
dateResolved: "2026-07-21"
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: launch work on an item from the UI

Launch work on an item from the UI, on the write seam. Kick off building an agent-ready item — acquire a lane and start the build — from the console rather than invoking the loop by hand. It is the heaviest write action, so it lands last on a proven seam.

**Acceptance:** a Launch control on an agent-ready item starts work through the sanctioned lane / build entry point; the row reflects launching → in-flight; launching an ineligible (blocked / claimed) item is refused with the reason.

> **Resolved into the build-queue program.** #2525 ratified the **build** semantics (a real headless build), so this is now the console's **build-now / add-to-queue control** under the [autonomous AI build queue](/backlog/2527-plateau-loop-autonomous-ai-build-queue/) program — no longer a standalone "launch" fork. It rides on the build endpoint + supervised builder (`we:backlog/2530-build-endpoint-supervised-builder-post-api-backlog-build-dra.md`, this item's `blockedBy`), which in turn needs the runner (#2444). The row reflects the real in-flight → PR the endpoint drives, and eligibility uses the queue's hard readiness gate.

## Delivered (plateau-app PR #96)
The control itself shipped under the blocker #2530 in `plateau-app:src/backlog-view/queue-view.ts` — **Build now**
on the top cleared/ready row (the `.bq-row--next`), which POSTs `/api/backlog/build` (the sanctioned lane→build→PR
endpoint, never a bare CLI/main write), reflects launching → in-flight via a poll (pending → building → opening →
PR opened), refuses an ineligible launch with the reason (WIP=1 / stale-queue / not-cleared 409s), holds a WIP=1
in-flight lock, offers a Stop kill-switch, and restores a mid-build on reload. The "Queue for build" toggle on a
non-cleared row is the add-to-queue (clear-for-build) gate.

This slice closed the honest remaining gap — the whole build-now client flow was **untested** (a heavy write path
that triggers real headless builds). Added 13 mount tests over an injected `fetchImpl` (never a real build): the
render gate, the launch happy path (POST body + poll walk + PR link + refresh), confirm-cancel, refusal-with-reason,
WIP=1 lock, poll-terminal (failed/stopped/404), reload-restore, and the add-to-queue toggle. The tests surfaced a
real bug — a refused build left the Build-now button **permanently disabled with no retry** (`onBuildNow` never
re-enabled it on the failure branches) — now fixed (re-enable on refusal + network-error; the 202 success path
still swaps to Stop, so no double-launch). Sighted the delivered control + the refusal re-enabling in both themes.
