---
kind: decision
parent: "3383"
status: open
relatedTo: ["3398", "3421", "3422", "3449", "3457", "xra0mqn"]
dateOpened: "2026-09-03"
tags: [conveyor, alerting, escalation, mechanical-dispatcher]
---

# Notify the prior dispatch when the sync/reconciliation pass hits an unresolvable conflict against files it touched

`wev-scratch-dispatcher-4`'s auto-sync cron failed for hours with genuine merge conflicts and produced zero
signal to anyone — surfaced only because a human happened to check `sync.log`. The operator's own suggested
direction: "ideally the same session that built it would get notified by the tick." Worth building, but not
yet a coherent direct build — checked against what already exists, it runs into real, unresolved design
forks rather than a clean extension of an existing mechanism.

## Grounding — what actually failed, checked directly, not hypothesized

- **The sync mechanism is a raw bash loop, entirely outside this repo's own mechanized tick machinery.**
  `ps aux` shows the live process: `while true; do sleep 180; git fetch origin main:refs/remotes/origin/main-fresh
  --quiet; if ! git merge origin/main-fresh --no-edit --quiet; then echo ... >> sync.log; git merge --abort;
  fi; done`, running as an ad hoc shell script in the scratch checkout — not a call into
  `we:skills-src/conveyor/runner.mjs`, not a `we:scripts/conveyor/tick-core.mjs` pass, not anything the
  dispatcher's own mechanical-pass list runs. It has no code path that identifies *which* commit or item
  caused a given conflict; `sync.log` shows dozens of identical `CONFLICT (content)` lines with no
  attribution beyond the filenames.
- **The closest existing precedent doesn't reach this failure, by construction, not by omission.** `#3421`/`#3422`
  (ratified, resolved, landed on `main`) already auto-files + proposes a fix for a "blocking hiccup," gated
  on human approval — exactly the shape the operator's own framing describes. But its own Done-when #1 states
  the classifier "derives blocking-vs-non-blocking directly off the tick core's own state
  (`we:skills-src/conveyor/runner.mjs` / `we:scripts/conveyor/tick-core.mjs`)." A sync-cron merge conflict
  against a long-diverged branch is not tick-core state today — it is invisible to `#3421`'s classifier not
  because nobody wired it in, but because the event it would classify doesn't exist inside the mechanized
  loop at all yet.
- **`#3398` (supervisor/runner has no out-of-band alerting) is a related but different failure surface.**
  It covers the supervisor/runner process's own crash-loop and idle-with-non-empty-queue states, mirroring
  the drain-daemon's `#2489`/`#2493` precedent — process liveness, not branch-reconciliation health. It is
  also still `status: open`, `blockedBy: ["3443"]` on this repo's own current board, even though its
  branch-side code already exists unlanded (`origin/lane/mechanical-dispatcher` commit `09ce669b9`,
  "conveyor: supervisor out-of-band alerting for crash-loop + idle-with-queue (#3398)") — itself a live
  instance of the same card-status-lags-real-state pattern `#3457` already names.

## Why this needs a ruling, not a direct build

**Fork 1 — WHERE does the notification hook in?** Not a false choice — each option has a real, different
precondition:
- **(a) Extend `#3421`/`#3422`'s existing blocking-hiccup classifier + gated-auto-file sink.** Natural reuse
  of a mechanism that already works and is already landed — but only coherent once the sync/reconciliation
  loop is itself a real tick-core-driven pass (see Fork-existence note below); today there is no such pass to
  hook a classifier onto.
- **(b) Extend `#3398`'s supervisor out-of-band alerting to also cover "reconciliation stalled."** Reuses the
  macOS-notification precedent `#2493` already proved for the drain daemon — but `#3398` is scoped to the
  supervisor/runner *process*, not a not-yet-built sync pass, and is itself gated on `#3443` (branch
  graduation) before it even lands.
- **(c) A freestanding, new alerting concern, independent of both.** Avoids coupling to either precondition,
  at the cost of a third parallel notification mechanism in a codebase `#3383`'s own Fable-review finding
  already flagged for having "liveness tracked via four overlapping heuristics rather than one source of
  truth."

**Fork 2 — WHO/WHAT receives the notification, given the originating session is normally already gone?**
This repo's own dispatched-session model is ephemeral by design (`#3383`'s own doctrine: a delivery/prepare
session finishes and does not stay resident) — "notify the session that built it," read literally, usually
has no live target to notify.
- **(a) Generic operator notification** (a macOS notification, mirroring `#2493`) naming the conflicting
  file(s) and the commit(s)/item(s) attributed via `git log --grep`/`git blame` against the conflicting
  hunks.
- **(b) Literal re-engagement — auto-file + queue a NEW fix item scoped to the conflict**, reusing `#3421`/`#3422`'s
  already-landed gated-auto-file shape, rather than trying to notify a session that has already exited.
- **(c) Both, mirroring `#3421`'s own existing default** (immediate operator visibility + a gated
  auto-filed fix candidate) — this option effectively collapses into Fork 1(a) once chosen, since `#3421`
  already implements exactly this shape for tick-core-visible hiccups.

**The two forks are not independent: Fork 1(a) substantially answers Fork 2 for free** (reusing `#3421`'s
existing gated auto-file-and-notify shape), while Fork 1(b)/(c) leave Fork 2 fully open. Ruling on Fork 1
first is likely to make Fork 2 mostly mechanical rather than a second open design call — but that is exactly
the kind of judgment call ratification should confirm, not something to pre-decide here.

## What this decision does not settle

- The exact commit-to-item attribution algorithm (`git blame` on the conflicting hunk vs. `git log --grep`
  against the conflicting commits vs. something else).
- Whether/how this generalizes to an ordinary PR-vs-`main` merge conflict outside the mechanical-dispatcher
  prototype specifically.
- Mechanizing the sync/reconciliation loop into a real `we:scripts/conveyor/tick-core.mjs` pass at all —
  a precondition for Fork 1(a)/(b), and plausibly its own build item (see `xra0mqn`, filed alongside this
  card, which covers the *cadence* half of that gap) rather than something this decision pre-builds.

## Done when

1. A ruling is recorded on Fork 1 (where the notification hooks in) and Fork 2 (who/what is notified and how
   attribution works).
2. A follow-on build item is scaffolded under this card once ruled, naming the concrete mechanism and its
   dependency on `xra0mqn` / `#3443` as applicable.
3. This card `resolve`s once both forks are ruled — building the follow-on is separate work, not a
   precondition of this card's own resolution (mirroring `#3457`'s own convention).
