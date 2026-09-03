---
kind: task
parent: "3383"
status: open
scope: ["we:scripts/conveyor/", "we:skills-src/conveyor/"]
relatedTo: ["3464", "3466"]
dateOpened: "2026-09-03"
tags: [conveyor, mechanical-dispatcher, sync, reconciliation]
---

# wev-scratch-dispatcher-4's sync loop fetches origin/main fine but silently aborts on every real merge conflict, leaving the checkout stuck arbitrarily far behind

`~/workspace/wev-scratch-dispatcher-4`'s ad hoc auto-sync loop (a raw `bash -c 'while true; do sleep
180; ...; done'`, pid `24624`, live and running right now) fetches into its own hand-rolled
`origin/main-fresh` ref rather than the checkout's normal `origin/main` tracking ref, then tries
`git merge origin/main-fresh --no-edit --quiet`, and on ANY conflict just logs one line to `sync.log`
and `git merge --abort`s — no retry strategy beyond "try the identical merge again in 180s," no
escalation, no signal to anyone outside that one log file. This is a separate mechanism from, and NOT
fixed by, the earlier `.git/config` fetch-refspec fix landed elsewhere tonight: that fix restored plain
`git fetch origin main` for the checkout, and this loop's own fetch of `origin/main-fresh` does now
reach current `main` (confirmed below) — but the loop still silently gives up the moment a real
conflict appears, so the checkout's actual `HEAD` drifts arbitrarily far behind anyway.

## The evidence — live process, live symptom, not hypothesized

- **The process, verified live via `ps`:** pid `24624`, started `Wed Sep 2 17:52:31 2026`, full command
  (via `ps -o command=`):
  ```
  while true; do
    sleep 180
    git fetch origin main:refs/remotes/origin/main-fresh --quiet 2>/dev/null
    if ! git merge origin/main-fresh --no-edit --quiet 2>/tmp/sync-merge-err.log; then
      echo "$(date): merge conflict, aborting to keep tree clean" >> .../sync.log
      cat /tmp/sync-merge-err.log >> .../sync.log
      git merge --abort 2>/dev/null
    fi
  done
  ```
- **The fetch side works**: `origin/main-fresh` and `origin/main` both point at the same commit
  (`e24f87cd5`, `Thu Sep 3 16:28:37 2026`) inside that checkout — the loop's `git fetch` is current.
- **The merge side does not**: `sync.log`'s own tail shows a real conflict on the very next attempt —
  `CONFLICT (content)` in `we:skills-src/conveyor/runner.mjs`, `we:scripts/conveyor/tick-core.mjs`,
  `we:scripts/operations/dispatch-lane.mjs`, `we:scripts/verify-lane.mjs`, and others — ending
  `Thu Sep 3 19:24:35 EDT 2026: merge conflict, aborting to keep tree clean`. Nothing after that
  timestamp shows a successful merge.
- **The live symptom this causes**: that checkout's own `we:backlog/3436-*.md` reads `status: open`
  right now, even though the real item resolved on `main` itself (`PR #1883`, `mergedAt:
  2026-09-03T19:39:51Z`, confirmed against the primary checkout's copy of the same file, which reads
  `status: resolved`). The checkout's local `HEAD` (`91e360ab5`, last advanced `Thu Sep 3 13:39:40`) is
  `git rev-list --left-right --count origin/main...HEAD` = **53 commits behind / 42 ahead** of
  `origin/main` as of this filing — the loop has been fetching successfully but landing nothing for
  hours.

## Related but distinct

- **`#3464`** (no reconciliation cadence for a long-lived diverged branch) names the general structural
  gap: nothing mechanized ever reconciles a standalone checkout's drift. This item is a concrete,
  currently-live instance of exactly that gap, in the one ad hoc mechanism that was supposed to be doing
  reconciliation and isn't — worth fixing (or replacing) as part of whatever `#3464` builds, not a
  duplicate of it.
- **`#3466`** (lane-ports registry staleness) is the same "silent drift, no reap" shape applied to a
  different piece of state.

## Done when

1. **Executable** — the sync loop (or its replacement) either resolves a real conflict automatically
   within its own declared retry policy, or surfaces the stuck state somewhere durable and checkable
   (not just one local `sync.log` no one is tailing) — a scripted repro that stages the same kind of
   colliding-but-in-scope commits this incident hit, run against the fixed mechanism, must not silently
   abort-and-repeat forever.
2. Out of scope here: actually resolving `wev-scratch-dispatcher-4`'s own current live drift (a
   one-off manual reconciliation, not this item's concern) and the general no-cadence-at-all gap, which
   is `#3464`'s.
