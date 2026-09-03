---
bornAs: xsuoup2
kind: task
parent: "3383"
status: active
scaffoldedBy: "file-3383-runner-restart-gap"
dateScaffolded: "2026-09-03"
dateOpened: "2026-09-03"
relatedTo: ["3397", "3443", "3435", "3464", "2501", "2468"]
tags: [conveyor, runner, restart, reload, operability]
---

# The conveyor's own long-running runner process runs bare and unwrapped on main -- nothing detects its own code changed, signals a restart, waits for a safe point, or restarts it

Tonight `we:skills-src/conveyor/runner.mjs`, run long-lived and bare on `main` (no supervisor wraps it there),
had to be killed and relaunched by hand three times because its own code changed underneath it -- nothing
detected the change, signalled it, waited for a safe point, restarted it, or verified the restart. `#3397`
already asks this design question for `we:skills-src/conveyor/supervisor.mjs`, but that file doesn't exist on
`main` and `#3397` is `blockedBy: ["3443"]` (full branch graduation) -- this item is the interim gap that
leaves open in the meantime. Checked every candidate fork named in this item's own brief against this repo's
fork-existence test; none survive, so this is filed as a task, not a decision.

The operator, 2026-09-03: "when running in dev, we will have to have a way to mechanically restart long
running process when their code change, and try not to interrupt any work, like an update notification that
waits for a pause so all can be restarted." `node we:skills-src/conveyor/runner.mjs --json` picked up real
fixes to `we:scripts/conveyor/tick-core.mjs` and to itself three separate times tonight, each restart done
entirely by hand: find the pid (`ps aux | grep we:runner.mjs`), `kill <pid>`, relaunch with the exact original
invocation, then manually log-watch to confirm the new process picked up the fix. A human had to reason
carefully about in-flight leases/guards each time to avoid corrupting live work.

## What tonight's restarts actually looked like, and why nothing caught them

One restart followed the `fixAttempts`-miscounting fix to `we:scripts/conveyor/tick-core.mjs`; another
followed the session-reaper wiring gap in `we:skills-src/conveyor/runner.mjs` that `#3435` tracks (resolved
2026-09-03 — the most recent concrete example of code landing that the live process could not pick up
without a manual restart). None of this is hypothetical or a one-off: it is the same manual cycle every time
this epic's own machinery has needed a code fix while live-firing (see this card's own session-update
history throughout `#3383`).

## Corrected premise: `we:skills-src/conveyor/supervisor.mjs` was never removed from `main` — it was never merged in the first place

The brief motivating this item assumed `main` had deliberately deleted `we:skills-src/conveyor/supervisor.mjs`.
That is not what happened. `git log --diff-filter=D -- we:skills-src/conveyor/supervisor.mjs` on `main` returns
nothing, and `git log --all --oneline -- '**/supervisor.mjs'` shows the file's only commits are on
`origin/lane/mechanical-dispatcher` (`4d5d98365`/`bdab1233f` recovering it, `09ce669b9` for `#3398`,
`df4bbd0a2` for `#3406`) — it has simply never existed on `main`. `#3443`'s own progress note (2026-09-03,
`we:backlog/3443-graduate-origin-lane-mechanical-dispatcher-to-main-in-small.md`) confirms this directly:
"`we:skills-src/conveyor/supervisor.mjs` (doesn't exist on `main` yet — a bigger follow-on piece, not this
PR's target)." So there is no "killed for a documented reason" to avoid repeating — the file is simply
not-yet-graduated, deliberately, per this epic's own "How to build it" section (build fast on the branch,
graduate once proven).

## `#3397` already asks the design question for `we:skills-src/conveyor/supervisor.mjs` — this item is the interim gap it does not cover

`we:backlog/3397-conveyor-supervisor-has-no-reload-lifecycle-only-crash-resta.md` (open, `blockedBy: ["3443"]`)
already asks almost exactly tonight's question for `we:skills-src/conveyor/supervisor.mjs` itself: "how a running
`we:skills-src/conveyor/supervisor.mjs` picks up new code on a lane that lands a change to itself, without a
human finding and killing the process by hand," and already names the right precedent to evaluate — the
ratified drain-daemon pattern (`#2501`, "clean-exit + `KeepAlive` relaunch," ratified 2026-07-27; its parent
`#2468` is the more general "crash recovery, persisted state, self-update-then-reload" story). That precedent
check tonight's brief asked for is already done, correctly, inside `#3397` — nothing new to discover there.

But `#3397` cannot close tonight's actual gap: it is scoped to a file that doesn't exist on `main`, and it is
`blockedBy: ["3443"]` (full branch graduation) by design. Tonight's incident happened on `main`, running
`we:skills-src/conveyor/runner.mjs` completely bare — no supervisor of any kind, so not even `#3397`'s
crash-restart baseline exists yet in the place this epic actually runs from today. This item is that interim
gap: what `we:skills-src/conveyor/runner.mjs` needs, independent of `we:skills-src/conveyor/supervisor.mjs`'s
own future graduation timeline, so a code change to itself or to `we:scripts/conveyor/tick-core.mjs` stops
requiring a human to notice, kill, and relaunch it by hand.

## Candidate forks checked against the repo's own fork-existence test — none survive; this is a task, not a decision

`we:docs/agent/backlog-workflow.md`'s "Standing test before any of the above" asks whether each candidate
fork is a genuine, mutually-exclusive either/or, or whether the branches compose (in which case: support
both, it isn't a decision). Checked each candidate named in this item's own brief:

- **Hard-kill-and-restart vs. graceful old-drains-while-new-starts (two processes briefly overlap).** Not a
  real fork — it's forced. `we:skills-src/conveyor/runner.mjs` holds a singleton lease
  (`~/.claude/conveyor-runner-locks/`) specifically to prevent two live runners at once; the double-dispatch
  bug `#3416` found and fixed live this same epic is exactly the failure mode two overlapping runners would
  reproduce. Hard-stop-then-restart is the only safe option given the already-existing singleton-lease
  invariant; graceful overlap is the ruled-out branch.
- **In-flight state handoff vs. accept a clean-slate restart.** Not a real fork. The singleton-lease design
  above rules out any live channel between the old and new process for handing off in-memory state, so a
  literal handoff isn't a coherent alternative at all — the real question is only how much of the wiped
  in-session bookkeeping needs a durable floor, covered below. Clean-slate-plus-durable-floor is the only
  buildable option.
- **Self-watching (file-hash/mtime poll inside the runner) vs. an external supervisor process signalling
  it.** These compose rather than conflict — a self-watch inside `we:skills-src/conveyor/runner.mjs` needs no
  dependency on `#3443`'s graduation and can close today's gap now; `#3397`'s future external-supervisor
  watch (once `we:skills-src/conveyor/supervisor.mjs` graduates) can coexist on top of it later, redundant at
  worst. Recommended default: build the self-watch now (Done-when #1 below); let `#3397` supersede or
  duplicate it once `we:skills-src/conveyor/supervisor.mjs` lands — that is `#3397`'s own concern, not a
  fork to rule here.

No named candidate survives as a genuine either/or. Per this item's own brief: when research finds this
collapses to one clearly-correct approach, file a `task`, not a `decision` — this is that case.

## The deeper point folded in per the operator's own follow-up (2026-09-03): restart timing matters less if the tick loop's own state is externalized like the rest of this system already is

The operator's own words: "could eventually have all session operation run separately and resumable because
otherwise might be very hard to upgrade a working system." Real, already-proven prior art for exactly this
exists in this same codebase — it just hasn't been extended to the tick loop yet:

- `we:scripts/operations/run.mjs` and its run-store (`we:scripts/operations/run-store.mjs`) already give every
  declared operation (`dispatch-lane`, `review-pr`, etc.) a persisted, resumable step-machine: a run record
  under `we:.operations/runs/` (one file per run, named `<op>-<run-id>.json`) with a `cursor`, a `pending`
  marker naming the step waiting to apply, and per-effect idempotency keys — resumable via `node
  we:scripts/operations/run.mjs review-pr --resume=<run-id> --answer=accept` (`we:scripts/lib/review-loop-policy.mjs`,
  line 132). A real run record on disk right now, for the `dispatch-lane` operation, shows exactly this
  shape: cursor at step 2, pending on the "dispatch" effect, one count.
- `we:scripts/operations/run-store.mjs`'s own header cites the already-ratified doctrine this rests on —
  "state lives where its nature dictates" (`#2615`/`#2617`, ratified 2026-07-22, codified in
  `we:docs/agent/platform-decisions.md`) — transient operator/session intent belongs in a **gitignored
  session-local sidecar**, not purely in-process memory and not committed frontmatter.
- By contrast, `we:scripts/conveyor/tick-core.mjs`'s own header states its design is the opposite,
  deliberately: the tick loop's own bookkeeping carries forward to the next tick IN-SESSION only — no
  parallel on-disk state store is ever created. Its `fixAttempts` map is documented as NOT surviving a
  restart, with a bespoke durable floor (`prRearmCounts`, `#2643`/`#2666`) added after that mattered live.
  `#3403` (resolved 2026-09-02) added a second, similarly bespoke durable floor (a live-session-listing
  cross-check) for the build in-flight guard, after THAT gap reopened the exact double-dispatch race `#3177`
  tracks.

Checked whether "keep patching per-field durable floors as each one bites" (the proven pattern used twice
already) and "generalize to the operations-engine's resumable run-record shape" are a genuine fork needing a
decision. They are not, by the same composability test: the general shape is a strict superset of the
incremental one — building it would subsume, not compete with, the two durable floors already shipped. This
is a sequencing/investment call (do the systematic version now vs. keep patching reactively and revisit),
consistent with `#3383`'s own "How to build it" doctrine of not over-investing in architecture before the
system is proven. So it is folded in below as a design consideration for whoever builds this, not framed as
an open decision.

## Explicitly distinct from `#3464`

`#3464` (open) is about `origin/lane/mechanical-dispatcher`'s own BRANCH/CODE content drifting behind `main` —
a long-lived checkout falling behind the integration branch it tracks. This item is about something different:
the RUNNING PROCESS's own code drifting behind what is already on disk in ITS OWN checkout (`main`) — no
branch divergence involved, just a live process that outlives the files it was started from.

## Done when

1. **Executable — detect + signal.** `we:skills-src/conveyor/runner.mjs`'s tick loop can detect, on its own,
   that its own source (at minimum itself and `we:scripts/conveyor/tick-core.mjs`) has changed on disk since
   the process started (a content-hash or mtime check, run once per tick or on an interval) and emits an
   explicit, checkable signal that a restart is needed — never silently ignored, never requiring a human to
   notice via `ps`/log-watching the way tonight required three times.
2. **A safe point is honored, not just detected.** The restart does not fire mid-tick or while the tick's
   in-flight build/prepare/fix guards show real live work — it waits for (or is offered at) a tick boundary
   where those are empty or below a stated risk threshold, matching the operator's own "waits for a pause so
   all can be restarted" framing.
3. **The restart itself is mechanized and self-verifying.** No `kill <pid>` + manual relaunch + manual
   log-watch — the mechanism restarts the process and confirms the new process is actually live and ticking
   (mirroring what a human currently does by eye).
4. **Bookkeeping loss across a restart is handled the proven way, not reinvented.** Any tick-loop state that
   turns out to matter across a restart gets a durable floor in the same shape already proven twice
   (`#2643`/`#2666`, `#3403`) — read a ground-truth fact each tick rather than trusting only in-process
   memory. The design explicitly records whether it stops there or takes a first step toward the more general
   resumable-run-record shape `we:scripts/operations/run-store.mjs` already proves out elsewhere in this repo
   (see above) — either answer is acceptable, but it must be a stated choice, not an unconsidered gap.
5. **A regression test proves it**: a fixture where the runner's own source hash changes mid-run, with a
   simulated in-flight guard present, asserts the restart signal fires but is HELD until the guard clears —
   and a second fixture with no in-flight guards asserts the restart proceeds immediately. Mirrors `#3403`'s
   own "reproduce the race, then prove the fix" shape.
6. **Explicitly out of scope here**: `#3397`'s own design for `we:skills-src/conveyor/supervisor.mjs`'s reload
   lifecycle once it graduates via `#3443` — this item does not block on or duplicate that; it closes the gap
   that exists today, independent of that graduation timeline.
