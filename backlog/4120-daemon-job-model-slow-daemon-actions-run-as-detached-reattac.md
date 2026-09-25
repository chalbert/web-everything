---
bornAs: x6sslco
kind: decision
parent: "4075"
status: resolved
dateOpened: "2026-09-24"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
codifiedIn: "docs/agent/platform-decisions.md#daemon-jobs"
preparedDate: "2026-09-24"
preparedAgainstSha: "80cde410fe68cc365f794b0f1f7097ff984d1f76"
relatedReport: reports/2026-09-24-daemon-blocking-antipatterns.md
relatedTo: ["4065", "4077", "3681"]
tags: [conveyor, daemons, jobs, drain, reattach, self-update, decision-prep]
---

# Daemon job model: slow daemon actions run as detached, reattachable jobs with durable records

Operator, 2026-09-24 ~8:55 PM ET, verbatim: *"maybe each action sdhould be a fork that can be reattached on
restart so we dont need a window too"*, then *"go"*.

The daemon audit (`we:reports/2026-09-24-daemon-blocking-antipatterns.md`) found the same shape in every
daemon: a tick awaits slow work (a 30-minute gate, a 7-minute numbering loop, `npm ci`, serial network
checks), so ticks outlive their interval and sometimes their lease, and a self-update has to wait for a
quiet moment. This card rules the target model: **a slow action is a detached job with a durable record;
the daemon loop only starts jobs and reads records; on restart it reattaches.** Two real forks remain, each
with a bold default; three more concerns turned out to be settled by precedent and are stated as ratify
lines. The prior-art survey is in the report (the operations run store in this repo; systemd transient
units, Kubernetes Jobs, Sidekiq/BullMQ, Temporal outside it).

**Prep history.** First drafted 2026-09-24 with five forks. One adversarial Opus skeptic round then ran
(merit, classification, statute overlap, citation scope, and the two-confusion screen). Fork 2 was refuted
and flipped to a per-kind rule. Forks 1 and 3 survived with amendments. Forks 3, 4 and 5 were reclassified as
settled by precedent (the operator's standing rule, the sole-writer rule, and #automated-health-daemon
clause 1) and moved to "Ratify". The drafted statute was amended for three collisions. Each item below
records what changed.

## Axes

- **Record** — where a job's state lives and in what schema. Today's nearest thing is the operations run
  store: `we:scripts/operations/run-store.mjs` (sidecar under `.operations/runs/`, atomic write, a store seam
  #2626 can swap), `we:scripts/operations/run-record.mjs` (effect statuses at line 42:
  `declared/pending/in-flight/applied/failed`), `we:scripts/operations/effect-executor.mjs` (in-flight
  handles: `inFlight` at 114, a bare pid refused as a handle at 101–116, a pollable in-flight entry left
  alone at 233–239).
- **Code version** — what code a running job executes while the daemon rebuilds its clone. Today every tick
  holds a shared hold on the clone and a rebuild takes the exclusive one
  ([#resident-daemon-reload-lifecycle](/docs/agent/platform-decisions/#resident-daemon-reload-lifecycle)
  clause 3 (ii)), which is why a long tick needs a quiet window.
- **Liveness and resume**, **concurrency**, **observation** — settled by precedent; see "Ratify".

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — record | **(a) a job is a run-store record kind, with a job handle and a relaunch rule added** | (b) a new standalone job store | high |
| Fork 2 — code version | **(c) per kind: jobs that only read run from a pinned code snapshot; jobs that change a git tree run in their own working tree and hold the clone's shared hold only while they run** | (a) every job runs from a pinned snapshot | med |

## Fork 1 — Where does a job's record live, and in what schema?

Why this is a fork: there must be one schema for "a side effect in flight"; two (run records and a new job
store) would drift, and the health daemon would have to read both.

- **(a) A job is a kind of run record.** Reuse the run store's file layer (atomic write, directory from env,
  the #2626 swap point) and its "an idempotent effect may be re-applied" rule. Add what the executor lacks
  today: a job handle `host:pid:procStart` (a bare pid is refused because the OS reuses it), and a rule that
  an in-flight job whose handle is dead is relaunched (the executor today leaves every pollable in-flight
  entry alone). One record per job under the owning daemon's pinned state root.
- (b) A new standalone job-store module with its own schema. *Rejected:* duplicates the effect lifecycle and
  splits the reader.
- (c) An external queue (BullMQ needs Redis; SQLite adds a native dependency to every daemon). *Rejected:*
  new infrastructure for a single-host queue of tens of jobs a day.

Skeptic: SURVIVES-WITH-AMENDMENT → the first draft claimed `in-flight` "already means what a checkpoint
needs". It does not: the executor never relaunches an in-flight entry and refuses a bare pid. The default
now adds the `host:pid:procStart` handle and the dead-handle relaunch rule.

## Fork 2 — What code does a running job execute while the daemon self-updates?

Why this is a fork: for a job that changes a git tree, "pin the code" and "work on the live tree" cannot both
hold — a snapshot at an old commit cannot push to `main`, and a live tree moves under a pinned-code job.

- (a) Every job runs from a pinned snapshot of the clone at its `codeSha` (a detached `git worktree` plus a
  `node_modules` store keyed by lockfile hash). *Rejected after the skeptic round:* it breaks the drain
  follow-up four ways — the hash ledger is relative to the working directory (`we:scripts/lane-drain.mjs`
  590), so each snapshot starts with an empty ledger; child scripts are spawned by relative path (the
  backlog resolve call near line 1002); numbering in a snapshot and pushing `HEAD:main` is a non-fast-forward
  push; and a snapshot would move the lane-pool root, splitting the host-wide admission and throttle caps.
  Each lockfile hash would also need its own 463 MB `node_modules`.
- (b) Every job holds the clone's shared hold for its whole life. *Rejected:* a rebuild waits for every job,
  which is the quiet window again.
- **(c) Per kind.** A job kind declares `readonly-tree` or `mutates-tree`. A `readonly-tree` job (a gate, a
  probe, a smoke check, an investigation launch) runs from a pinned code snapshot, with the lane-pool root
  and state root pinned by env, so the clone rebuilds freely. A `mutates-tree` job (the drain follow-up) runs
  in its own dedicated working tree of `main`, never the daemon clone, with its ledger pinned to the state
  root; it holds the clone's shared hold only while it runs, which is seconds once the numbering loop is
  fixed (card 4127).

Skeptic: REFUTED → flipped from (a) to (c) for the four drain-follow-up breakages above.

## Ratify (settled by precedent — not forks)

1. **A dead job resumes automatically.** Liveness is the handle only: the pid exists on this host and its
   start time matches (on macOS, `LC_ALL=C ps -o lstart= -p <pid>`). A live pid with a stale heartbeat is
   *stalled*, not dead: kill it (SIGTERM, then SIGKILL), confirm it is gone, then relaunch. Skip the
   staleness check when the daemon's own clock gap shows the host slept. Relaunch from the last applied
   step, up to 3 attempts with backoff, then fail visibly. A step that cannot re-derive its input from
   `main` (resolve-on-land) keeps that input in the job record. *Precedent:* the operator's standing rule —
   failures improve the product, never a manual fix — excludes "mark failed and wait". *Skeptic amendment:*
   the first draft relaunched on a stale heartbeat without killing, which double-runs a single-writer job
   stuck in a synchronous loop or waking from sleep.
2. **Writers to `main` are serial under the numbering mutex, with no unlocked fallback.** Each job kind
   declares `serial` or a cap (default 2 per daemon), in the daemon manifest; CPU-heavy kinds also pass the
   host-wide heavy-command admission. Kinds that write to `main` hold `NUMBERING_LOCK_PATH`
   (`we:scripts/readiness/drain-lock.mjs` 69) with a heartbeat and `runUnlockedOnContention: false` (card
   4134); they do not hold the whole-process drain lease, and a follow-up job never shares a working tree
   with a pass. *Precedent:* the sole-writer-to-`main` rule. The first draft's "(b) one global cap" was a
   strawman, since (a) already had host-wide admission.
3. **The health daemon pulls job records; daemons never push to it.** It reads each state root's job
   records read-only as a declared read. Smells: a job past its bound, a job that failed its last attempt, a
   kind at its cap for N ticks, a live job process with no record. Investigations it starts still launch
   through the declared `dispatch-lane` operation. *Precedent:*
   [#automated-health-daemon](/docs/agent/platform-decisions/#automated-health-daemon) clauses 1–2.

## Supported by default (not forks)

- **One-step jobs** restart from scratch (a one-step job is Ratify 1 with no checkpoint).
- **Timeouts** follow [#resident-daemon-reload-lifecycle](/docs/agent/platform-decisions/#resident-daemon-reload-lifecycle)
  clause 6 and #automated-health-daemon clause 1; this model adds only that the daemon records a killed job.
- **Bot-session jobs are relaunched, never resumed**, per
  [#conveyor-session-lifecycle-policy](/docs/agent/platform-decisions/#conveyor-session-lifecycle-policy)
  clauses 2–3; Ratify 1's step resume applies to mechanical jobs only.
- **Adoption behind a per-kind switch** that defaults to the inline path until the adopter's live proof
  passes, then flips; rollback is a switch flip.
- **Order of adoption** (sequencing, not a merit call; amended by the skeptic so the riskiest single-writer
  path does not go first): core (4125) → the health daemon (4131) alone → verify gates (4135) and
  clone rebuild / `npm ci` / live smoke (4126) → the drain post-merge follow-up (4124), only after
  4127, 4134 and 4121 have landed → runner passes, infra-blocked resumes, dispatch launch
  (4132).
- **Single host.** A record from another host is never reattached; it is reported.
- **The daemon still restarts only between ticks** (#resident-daemon-reload-lifecycle clause 1); ticks are
  now short, so that rule stops costing a window.

## Proposed codified text (drafted; ratify verbatim or amend)

> ### Slow daemon actions run as detached jobs with durable records; the daemon loop never waits on one {#daemon-jobs}
>
> A daemon action that can outlast a small part of its tick runs as a **job**: a detached child process
> with a run-store record under the daemon's pinned state root, identified by `host:pid:procStart`. The tick
> only starts jobs and reads records. A job's code never changes under it: a job that only reads runs from a
> pinned code snapshot; a job that changes a git tree runs in its own working tree and holds the clone's
> shared hold only while it runs. On boot and every tick the daemon reattaches: a live job is left alone, a
> stalled one is killed and relaunched, a dead one resumes from its last applied step up to a capped number
> of attempts, then fails visibly; every step is idempotent. Writers to `main` are serial under the
> numbering mutex with no unlocked fallback. The health daemon reads job records; it is never told about
> them.
>
> This amends [#drain-daemon-self-hosting-boundary](#drain-daemon-self-hosting-boundary) clause 2: the drain
> daemon's shutdown still stops its pass, but no longer kills a drain follow-up job, which holds the
> numbering mutex itself, so no double drain follows. It narrows
> [#resident-daemon-reload-lifecycle](#resident-daemon-reload-lifecycle) clause 3 (ii): the shared hold
> covers a tick and a tree-changing job, not a read-only job. Timeouts stay as clause 6 of that anchor
> states.

Statute check (skeptic): the first draft collided with #drain-daemon-self-hosting-boundary clause 2 (the
daemon kills its child before releasing the lease), silently relaxed #resident-daemon-reload-lifecycle
clause 3 (ii), repeated its clause 6 and #automated-health-daemon clause 1 on timeouts, missed
#conveyor-session-lifecycle-policy's "relaunched, never resumed", and said "the drain lock" where two locks
exist. All five are addressed in the text above.

Two-confusion screen (fresh-context skeptic): **standard vs implementation** — the first draft's paths,
worktree mechanics and "cap 2" were mechanism; the statute now states only rules, and the mechanics sit in
the forks' options and the slices. **Merit vs prioritization** — no fork is prioritization; the adoption
order was, and it is now a "Supported by default" sequencing line.

## Ruling (2026-09-25)

Operator, in session: *"I ratify"*. **Fork 1 (a)** and **Fork 2 (c)** as prepared; the three ratify lines and
the "supported by default" lines as written; the three red-team amendments below taken. Codified verbatim as
[#daemon-jobs](/docs/agent/platform-decisions/#daemon-jobs), with amendment pointers added to
#drain-daemon-self-hosting-boundary clause 2 and #resident-daemon-reload-lifecycle clause 3 (ii). The
adoption order is now `blockedBy` edges on the slices; findings 2 and 3 and the open record-folder detail
went into 4125.

## Ratification red-team (2026-09-25)

Currency re-check at claim: `check:item` clean; no statute ratified or edited since `preparedAgainstSha`; the
two 2026-09-24 statutes on this turf (#conveyor-session-lifecycle-policy, #automated-health-daemon) are
already cited. An independent tool-free skeptic seat (`judgePanel`, run `ratify-4120`, ok) raised three
findings. None refutes a fork; all three are amended as follows:

1. **The adoption order was prose only.** All six slices are `blockedBy: ["4120"]` alone, so ratifying
   would make every adopter, including the drain follow-up (4124), ready before the core (4125) and before
   the numbering fixes. Fork 2 (c)'s "seconds" claim depends on 4127. *Amendment:* at ratify, the order
   becomes `blockedBy` edges: 4131 ← 4125; 4135, 4126 ← 4131; 4124 ← 4125, 4127, 4134, 4121; 4132 ← 4124.
   The statute stays rule-only; the DAG is the gate.
2. **"The host slept" is not defined.** Ratify 1 skips the staleness check after a sleep but names no
   detection or threshold. *Amendment:* that is mechanism, so it goes in 4125's acceptance: name the
   detection (the tick's wall-clock gap versus its monotonic-clock gap) and its threshold, and prove it on a
   real sleep/wake and on a live-but-stuck job.
3. **Snapshot `node_modules` stores can grow without bound.** The disk-cost objection to Fork 2 (a) still
   applies to the read-only half of (c). *Amendment:* 4125 keys stores by lockfile hash (not `codeSha`)
   and evicts any store no live job references, keeping at most 2.

## Build slices (filed uncleared, each blocked by this card)

1. 4125 — core: record kind, handle, detached launch, snapshot/working-tree per kind, reattach, caps.
2. 4131 — first adopter: the health daemon (4077 / 4078).
3. 4135 — verify gate runs.
4. 4126 — clone rebuild, `npm ci`, live smoke.
5. 4124 — the drain's post-merge follow-up (after 4127, 4134, 4121).
6. 4132 — runner passes, infra-blocked resumes, dispatch launch.

Not blocked by this card (fixes that land now): 4127 (numbering regex, P0), 4134 (numbering lock),
4121 (number on any pass), xnjiuar, 4130, 4128, 4123, 4117, 4133, 4122, 4118,
4129; 4136 is a hand-off to the rebuild worker.

## Done when

1. **Executable** — each fork and ratify line carries a ruling, `codifiedIn:` points at the new
   `#daemon-jobs` anchor in `we:docs/agent/platform-decisions.md`, and the six slice cards are cleared to the
   conveyor with the conveyor queue `add` command.
