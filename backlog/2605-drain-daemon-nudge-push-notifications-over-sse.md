---
bornAs: x0sx61e
kind: story
size: 5
parent: "2606"
status: open
dateOpened: "2026-07-22"
tags: [plateau-loop, drain-daemon, drain, notifications, push]
---

# Drain-daemon nudge + push notifications over SSE

The resident drain daemon (plateau:tools/drain-daemon/) currently reacts only on its 60s interval, and lane owners must poll GitHub to learn their PR merged. Add a **push seam, all in the daemon** — this is scheduling/signaling, so it belongs in the daemon per its charter, while the drain LOGIC stays single-sourced in [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs). Wanted in time, not deferred: this is the notification backbone the conveyor delivery agents build on.

## The seam

- **localhost HTTP:**
  - `POST /nudge` — trigger an immediate pass. A nudge that arrives during a running pass **coalesces into exactly one follow-up pass** (the lease already serializes passes, so coalescing is bookkeeping, not new locking).
  - `GET /events` — an SSE stream of the pass lifecycle: `pass-started`, `pr-merged #N`, `pr-parked #N` + reason, `pass-done`.
- **CLI verbs mirroring it** (on plateau:tools/drain-daemon/cli.mjs):
  - `nudge` — fire the HTTP nudge from the terminal;
  - `watch --pr N` — block until that PR merges or parks; the exit code signals which.

  This keeps the "browser and terminal can never disagree" rule: both surfaces speak to the same daemon seam, and the dev-panel page can consume the same SSE stream.

## The interval floor STAYS

Push is an **accelerator**, not a replacement: the interval pass keeps catching ready-to-merge PRs from any source (a producer that never nudged, a label applied by hand, a recovered outage). Ratified 2026-07-22, Nicolas.

## Consumer

The conveyor delivery agents replace their gh-poll background watchers with the blocking `watch` verb; the SSE stream feeds progress/success notifications so lane owners aren't polling GitHub for their own merges.
