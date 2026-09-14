---
kind: decision
parent: "3621"
status: open
scope: ["we:scripts/readiness/heavy-admission.mjs", "we:scripts/lib/isolation-provider.mjs", "we:scripts/conveyor/"]
dateOpened: "2026-09-14"
tags: [container, capacity, isolation, conveyor]
---

# Auto-detect and act on heavy commands that overrun their container's resource budget

Once heavy-command containers exist for real (building on tonight's PR #2206/#2211 proof-of-concept work under #3621), auto-detect when a command inside its container crossed a resource-usage threshold, then either cancel it or let it run to completion depending on assessed impact -- feeding every detection into a tracking mechanism (a logged note, or an auto-filed fix-needed item, per tonight's "OWED -- file it" pattern: PR #2206's 6 findings -> PR #2210). Motivated by a live incident: a runaway `git grep` (PID 307) ran at 620%+ CPU for 20+ minutes, caught only by a human noticing Activity Monitor.

## Motivating incident (2026-09-14)

Tonight a runaway `git grep` process (PID 307) consumed 620%+ CPU for 20+ minutes before anyone
noticed — caught only because a human spotted it in an Activity Monitor screenshot and killed it by
hand. No automated detection caught it. This is exactly the class of incident this idea would
auto-catch once heavy-command containers (we:backlog/3621) exist and an anomaly-detection layer sits
on top of them.

## Design note — detection is mechanical, response is judgment-bounded

Per the operator's own framing, added after initial filing: the DETECTION half should be purely
mechanical/deterministic — a hook-style check that a resource-usage threshold was crossed, following
this repo's own Hookable-vs-Judgment rule (script-decidable things become hooks, not left to
judgment). The RESPONSE half should involve judgment, but constrained to a closed, fixed menu of
allowed actions rather than open-ended free-form judgment — e.g. something like {kill immediately,
warn-and-let-continue, throttle/deprioritize, file-a-note, file-a-fix-item}, a bounded set a judgment
layer picks from, not an unconstrained decision. A future `/prepare` pass should treat this split
(mechanical detection, bounded-menu judgment response) as its starting frame, not re-derive it.

## Open forks for a future `/prepare` pass

1. **Cancel vs. let-run threshold.** What resource-usage pattern counts as "excessive," and where the
   assessed-impact line sits between kill-immediately and let-it-finish. Not decided here.
2. **Enforcement mechanism.** (a) a hard resource block enforced at the container level
   (cgroup/`--cpus`/`--memory` caps, already proven live against this exact PID-307-shaped incident in
   we:backlog/3621's 2026-09-11 amendment), or (b) softer instruction-level guidance to the agent
   running inside the container (told to self-monitor and stop), if that turns out more effective than
   a hard kill. The operator explicitly left this open ("or maybe instruction if better") — both
   options are recorded, neither is picked.
3. **Tracking mechanism for a detected event.** Either logged as a note for later investigation, or
   auto-filed as a fix-needed backlog item — matching the "OWED — file it" pattern already used
   tonight for review findings (PR #2206's 6 findings -> PR #2210).
4. **What "excessive" is measured against.** CPU%, wall-clock duration, memory, some combination — and
   whether the bounded response menu (kill / warn-and-continue / throttle-deprioritize / file-a-note /
   file-a-fix-item) needs different thresholds per action.

## Parent and relation

Parented under we:backlog/3621 (the heavy-command / per-lane container decision this idea builds on).
Also relates to the mechanical-dispatcher epic we:backlog/3383 — this is a natural extension of the
container work already landing there tonight, not a standalone idea.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
