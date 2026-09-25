# Daemon blocking antipatterns — audit of every conveyor daemon (2026-09-24)

Epic 4075 (tracking), under 3383. Operator, 2026-09-24 ~8:45 PM ET: *"review all deamon for similar
antipattern"*. Scope addition ~8:55 PM ET: *"maybe each action sdhould be a fork that can be reattached on
restart so we dont need a window too"*.

Read-only audit of the code on `main` at `dfee628b7`, plus live read-only measurements. No daemon clone,
launchd job, or real PR was touched. Decision card for the target architecture:
[x6sslco](/backlog/x6sslco-daemon-job-model-slow-daemon-actions-run-as-detached-reattac/).

## Headline

1. **Most of the drain's 9–18 minute passes is one CPU-bound loop, not GitHub or git.** The JIT numbering
   step rewrites ledgered hashes across the whole corpus by building new regular expressions for every
   ledger entry — one per line and one more per file for paths. Measured in memory: **441 s of CPU** per
   numbering pass (4,386 files, 299,386 lines, 1,394 ledger entries); about three quarters of it is the
   per-file path regex. It grows with the corpus and with the append-only ledger, so it gets worse every
   day. On the five passes today that numbered a hash, the numbering commit landed **7.2–16.8 min after the
   merges**. So about 7 min is this loop and up to about 9 min more is not yet explained (host load is the
   leading suspect; finding G1 is why nobody can tell). A pass that merged a PR with nothing to number took
   **34 s**. The loop runs inside a lock with a 5-minute lease, and that lock lets a waiting writer in
   **with no lock at all** after 5 minutes (finding A3).
2. **Most daemons run slower than their own interval**, and none of their logs carry a timestamp, so this
   was invisible. Review daemon: 341 s between heartbeats, against a 120 s interval. Fix-dispatch: mean tick
   about 232 s, against 120 s.
3. **Two lease-safety holes.** The verify daemon awaits gate runs of up to 30 min inside one tick but only
   heartbeats its 15-min lease after the tick. The drain daemon runs `npm ci` and git through synchronous
   calls on its main thread, which freezes its own lease heartbeat (about 110 s measured today; no bound on
   a stalled fetch).

## Measured tick durations (read-only)

| Daemon | Source | Result |
|---|---|---|
| Drain pass (all) | `plateau-app:.drain-daemon/history.jsonl`, 654 passes since 2026-09-24 04:00Z | p50 18.8 s · p90 41.6 s · max 45.0 min (2,699,928 ms) · 370 busy min in the last 12 h |
| Drain pass, nothing merged | same | 611 passes · p50 17.7 s · p90 39.3 s |
| Drain pass, 1 merged | same | 36 passes · p50 77 s · p90 13.0 min |
| Drain pass, 2–3 merged | same | 7 passes · 9.5–18.2 min |
| Drain, merge → numbering commit | `gh pr view --json mergedAt` vs `git log origin/main` | 12.0, 16.8, 8.6, 10.2, 7.2 min on the five numbering passes 23:39Z–00:47Z; 3 s on the one pass with nothing to number |
| Drain, pass start → first merge | same | 27–67 s (pre-merge sweep + stamps) |
| Drain, between merges in one pass | same | 6–7 s per PR (serial gh stamps + merge) |
| Drain daemon `npm ci` | `plateau-app:.drain-daemon/daemon.log` | 00:12:11Z start → next pass 00:14:02Z, about 110 s with the event loop blocked |
| Review daemon | lease `heartbeatAt`, two samples | 341 s between heartbeats (interval 120 s) |
| Fix-dispatch daemon | log tick count ÷ log span (46.7 h, 478 ticks) | mean cycle 352 s ⇒ mean tick about 232 s (interval 120 s); a live sample saw more than 6 min without a heartbeat |
| Lane-pool health watch | same method | WE about 65 s; frontierui and plateau-app about 15 s |
| Parked-PR conflict watch | same method | 3–4 s |
| Lease reaper | same method | about 2 s |
| Pass-daemon heartbeats | lease files sampled every 30 s for 10 min | steady 30 s — the independent heartbeat works |

Method note: none of the conveyor daemon logs (the review-daemon clone's `.conveyor/*.log`) has a timestamp
on any line, so their numbers are means from log span and tick counts, or from lease heartbeats. That gap is
itself finding G1.

The numbering benchmark ran `applyLedger` from `we:scripts/backlog/id.mjs` in memory over this lane's corpus
with the drain clone's live ledger. It wrote nothing. The run's other suspects were ruled out by
measurement: the per-ref `git ls-tree` loop is gone since PR #2610 (the replacement `rev-list` takes 5 s on
the drain clone's 2,225 refs), and a `bornAs` lookup takes 0.13 s.

## Findings

Tags: **job** = becomes a detached, reattachable job (decision x6sslco) · **batch** = do it once per tick
or pass, or in parallel · **speed** = just make it faster or bounded.

| # | Daemon | Finding (evidence) | Cost per tick, scaling | Fix | Invariant | Tag | Pri | Card |
|---|---|---|---|---|---|---|---|---|
| D1 | Drain | `applyLedger` builds one lookbehind path regex per ledger entry per file (about 76% of the cost, `we:scripts/backlog/id.mjs` 193–202) and runs `swapHashes`, one RegExp per ledger entry, on every line (107–111, 171–216). Called from `numberPendingHashes` (`we:scripts/lane-drain.mjs`) | **441 s CPU** per numbering pass; O((lines + files) × ledger), both grow forever | One token regex plus a Map lookup; skip files with no hash token | Output must be byte-identical; runs under the numbering lock | speed | **P0** | xn6n5gp |
| A2 | Drain, pr-land, pre-push, backlog CLI | The same numbering runs from `we:scripts/pr-land.mjs` (about 1146), `we:scripts/lib/number-pending-hashes-before-push.mjs` 66 (before every push to main while a hash file is tracked) and `we:scripts/backlog.mjs` (about 1191) | Each can hold the numbering lock about 7 min | Fixed by D1 | Same lock | speed | **P0** | xn6n5gp |
| A3 | Drain lock | `withNumberingLock` defaults to `runUnlockedOnContention: true` and reclaims on TTL alone (`we:scripts/readiness/drain-lock.mjs` 153–175). While a 7-min numbering holds it, a second lander waits 5 min, then writes to main **with no lock** | Correctness: duplicate-number race; up to 5 min of synchronous spin for the waiter | Heartbeat the lock; reclaim only a dead holder; writers to main get `ran:false`, never an unlocked run | Sole writer to main | speed | **P0** | xuqk1vp |
| D2 | Drain | Post-merge follow-up (pull, primary sync, numbering, resolve, push, regen) runs inline after the merges (`we:scripts/merge-ai-prs.mjs` 4683–4880). A kill mid-way loses the local numbering commit (the next clone refresh does `reset --hard`) | Blocks the next pass for the whole follow-up: 7–17 min today, about 30 s once D1 is fixed (A5) | Record one follow-up job per pass; one serial job in its own working tree | Single writer to main; resolve only after the whole couple landed | job | P1 | xf4av69 |
| A4 | Drain | Numbering runs only on a pass that merged a WE PR (`landedLocal`, `we:scripts/merge-ai-prs.mjs` around 4747), so a killed or failed follow-up leaves hashes un-numbered until the next WE merge; the clone's `reset --hard` also breaks #resident-daemon-reload-lifecycle clause 4 | Latency until the next WE merge; correctness | Number on any pass that finds tracked hash files | — | batch | P1 | xb94mt5 |
| D3 | Drain daemon | `refreshClone` (git fetch/reset/clean, `npm ci`) and `selfSyncCheckout` use `execFileSync` with no timeout on the daemon's main thread (`plateau-app:tools/drain-daemon/daemon.mjs` 239, 248–281). The heartbeat `setInterval` (343) and push server cannot run meanwhile | about 110 s measured for `npm ci`; unbounded for a stalled fetch, against a 15-min lease | Async spawn with kill timer now; a rebuild job later | Lease must keep heartbeating | speed → job | **P0** | xnjiuar, xkiob80 |
| V1 | Verify daemon | Each lane's gate is awaited to completion, lanes one after another (`we:scripts/conveyor/verify-dispatch.mjs` 318–392; 30-min gate ceiling at 104, plus up to about 125 min queue phase). Heartbeat only after the tick (`we:skills-src/conveyor/verify-daemon.mjs` 96–101); lease TTL 15 min; header records a 19–20 min gate | 150–350 s per lane normally, up to 30+ min; linear in lanes | Heartbeat during the run now; each gate a job later | At most one gate per lane — the lease is what guarantees it | speed → job | **P0** | xpe1s8f, xxkqmjj |
| R1 | Review + fix daemons | Self-sync plus live smoke run before the tick, checks serial (`we:scripts/lib/daemon-live-smoke.mjs` 198–219; per-repo loop 161–174, 30–60 s budget each); heartbeat only after the tick | Review daemon 341 s per loop against 120 s | Heartbeat first; parallel checks; smoke as a job | Rebuild worker owns these files | batch → job | P1 | xz0a64g, xkiob80 |
| F1 | Fix-dispatch | Same clone fetched up to 4 times per tick: self-sync, then `assertMainNotStale` per repo with **no timeout** (`we:scripts/lib/main-staleness.mjs` 160) | Mean tick about 232 s; a stalled fetch freezes every later tick | One fetch per tick, reused; timeouts | — | batch | P1 | xz0a64g, xe3plfl |
| P1 | Lane-pool health watch | 4 full-pool commands per tick; `laneStatus` spawns 4 git calls per lane with no lease-first skip (`we:scripts/lane-pool.mjs` 994–1018), porcelain read twice (`we:scripts/conveyor/lane-pool-health-watch.mjs` 190–241); one log line per lane per tick | 300–500 git spawns per tick at 70–115 lanes; WE tick about 65 s; 15 MB log | Lease-first skip, one snapshot, log only changes | — | batch | P1 | xdtot9p |
| N1 | Runner | 15 mechanical passes × 3 repos, serial awaited children with no timeout (`we:skills-src/conveyor/runner.mjs` 302–430), nested serial per-PR review dispatch (380–393) | Sum of all passes; one hung child blocks everything, past the 15-min lease | Timeouts now; parallel reads; each pass a job | Writes stay serial per repo | speed → job | P1 | xe3plfl, x08au3e, xtl54o5 |
| R5 | Review + fix daemons | `forEachRepo` is a serial loop: it isolates a throw, not a hang (`we:scripts/lib/for-each-repo.mjs` 28–38) | One slow repo delays the others for the whole tick | Parallel reads with a per-repo budget | Writes stay serial | batch | P1 | x08au3e |
| D4 | Drain + merge-orphan-sweep | Head-SHA read caches are per process (`we:scripts/merge-ai-prs.mjs` 3352–3356) but every pass is a fresh child, so they never hit | 2 gh calls per open PR per listing per pass; linear in open PRs (4 open today) | Persist the cache under the pinned state root | Never cache a degraded read | batch | P1 | xo3l1l1 |
| D5 | Drain | Empty label-scoped pass sleeps 4 s then sweeps again (`we:scripts/merge-ai-prs.mjs` 4954–4957, delay flag at 3173), although the daemon runs again in 60 s and has nudges | Adds 4 s plus a full sweep to 611 of 654 passes today (p50 17.7 s) | Skip the repoll under `--under-lease` | — | speed | P1 | xo3l1l1 |
| D8 | Drain | `withNumberingLock` spins with a synchronous sleep for up to 5 min (`we:scripts/readiness/drain-lock.mjs` 153–171) | Up to 5 min per contended pass | Follow-up job waits without blocking merges | Same lock key serializes merges and numbering | job | P2 | xf4av69 |
| D9 | Drain | No gh/git call in `we:scripts/merge-ai-prs.mjs` or `we:scripts/lib/pr-merge-gate.mjs` has a timeout; only the 45-min pass kill bounds them | Unbounded per call | Timeouts | — | speed | P2 | xe3plfl |
| D6 | Drain | 5–8 serial gh calls per landing PR: comments read, head SHA, up to 3 stamps, already-merged probe, stacked-PR retarget, merge (4551–4615) | 6–7 s per merged PR, measured | Leave the merge serial; fold reads into the pass listing | Merge order and the merge mutex | speed | P3 | — (for the timing worker) |
| R2 | Review daemon | Session reaper lists every agent session every tick (`we:scripts/conveyor/session-reaper.mjs` 668) | 1,222–1,601 sessions scanned per tick, growing | Change detection, periodic full sweep | — | batch | P2 | xujt3ts |
| R3 | Review daemon | Round/status tag helpers re-read labels and `claude agents --json` per PR (`we:scripts/conveyor/review-round-tag.mjs` 52–61, `we:scripts/conveyor/review-status-tag.mjs` 94–110), already read once by the reconcile pass | Up to 6 child processes per PR, serial | Pass the tick snapshot in | — | batch | P2 | xujt3ts |
| R4 | Review + conflict watch | `we:scripts/lib/review-label-provider.mjs` 116–138: every gh call untimed; shared write path | Unbounded per call | Timeouts | — | speed | P1 | xe3plfl |
| P2 | stuck-pr-watch | gh calls untimed (`we:scripts/conveyor/stuck-pr-watch.mjs` 77, 100, 125); `pass-daemon` only logs a lost lease, never kills the child (`we:skills-src/conveyor/pass-daemon.mjs` 127–143) | Unbounded | Timeouts; stop on lease loss | Lease | speed | P1 | xe3plfl |
| P3 | parked-pr-progress-watch | One `gh api --paginate` per parked PR, serial (`we:scripts/conveyor/parked-pr-progress-watch.mjs` 263–273, 347–357) | Linear in parked PRs | Parallel under gh-throttle | — | batch | P2 | x08au3e |
| P4 | parked-pr-conflict-watch | Label written (1094) before the one-time comment (1154); a crash between loses the comment for good | Correctness, not time | Comment first, or record both as effects | — | job (effect) | P2 | x3zr5tu |
| F2 | Fix-dispatch | `infra-blocked` resumes block up to 20 min each, serially | N × 20 min worst case | Each resume a job | — | job | P2 | xtl54o5 |
| G1 | All | No timestamp on any daemon log line and no per-step timing | Slowness undiagnosable | Shared tick timer, one JSON line per tick | — | speed | P1 | xowehck |

Not findings (some confirmed by the adversarial round): the rest of the drain's post-merge section is
cheap — a pass that merged a WE PR and ran pull, primary sync, derived regen and the duplicate-id check
took 34 s in total (A5), and the `bornAs` plus `rev-list` fallback costs about 5 s per numbering call;
`we:scripts/lib/gh-throttle.mjs` is not used by the drain at all and elsewhere allows 6 calls at once with
a bounded 2-min wait (A6; one small risk: its concurrency slot has a 60-min lease, so a SIGKILLed holder
keeps its slot until the dead-pid check notices); the lane-pool list-lock poll, the fix-dispatch resume
confirm (3 × 300 ms) and the CI-queue history lock are bounded sync waits, not hot paths;
`parked-pr-conflict-watch` reads mergeability from one list call (no local merges);
`lease-reaper` batches to one list per repo; the supervisor layer uses async spawn; review and fix dispatch
already launch bots detached (`claude --bg`). Pass-daemon heartbeats run on their own timer and held a
steady 30 s in the live sample.

## Top 10 by cost

1. D1 + A2 numbering regex loops — 441 s CPU per numbering pass, in four callers, growing daily.
2. D2 drain post-merge follow-up inline — blocks the next pass 7–17 min today (about 30 s after D1).
3. V1 verify gate awaited inside a 15-min lease — up to 30+ min per lane, lease can lapse.
4. A3 numbering lock falls back to no lock after 5 min — up to 5 min spin, then a race on main.
5. R1 review/fix self-sync + smoke serial before the tick — review loop 341 s against 120 s.
6. F1 fix-dispatch repeated, untimed fetches — mean tick about 232 s against 120 s.
7. D3 drain daemon synchronous `npm ci`/git on its main thread — about 110 s frozen heartbeat, unbounded fetch.
8. P1 lane-pool health watch — 300–500 git spawns per tick, WE tick about 65 s, 15 MB log.
9. N1 runner mechanical passes — 45 serial untimed children per tick.
10. D5 + D4 drain empty passes — doubled sweep and no cross-pass cache on 611 passes a day.

## Target architecture: detached, reattachable jobs

The shape the operator asked for, and the one the decision card x6sslco rules on:

- A slow action becomes a **job**: a detached child process plus a durable record under the daemon's pinned
  state root: `{id, kind, input, pid, host, startedAt, heartbeatAt, checkpoint, status, codeSha, attempts}`.
- The daemon loop **only starts jobs and reads records**. It never waits on one.
- **Reattach on boot and every tick.** A live pid with a fresh heartbeat is left alone. A dead job resumes
  from its checkpoint, retries within a cap, or fails visibly.
- **Running jobs keep their code version**; new jobs use the new code. After the adversarial round this is
  per kind: a job that only reads runs from a pinned code snapshot; a job that changes a git tree (the drain
  follow-up) runs in its own working tree and holds the clone's shared hold only while it runs. So a
  self-update or restart needs no quiet window. This composes with
  [#resident-daemon-reload-lifecycle](../docs/agent/platform-decisions.md#resident-daemon-reload-lifecycle):
  the daemon still exits only between ticks, and its ticks are now short.
- **Every job is idempotent.** Single-writer kinds (the drain's merge and follow-up) run one at a time under
  the drain's lock; other daemons may run jobs in parallel up to a cap.

Prior art in the tree to build on, not beside: the operations run store
(`we:scripts/operations/run-store.mjs`, `we:scripts/operations/run-record.mjs`) with effect statuses
`declared/pending/in-flight/applied/failed` and in-flight handles (`we:scripts/operations/effect-executor.mjs`);
the supervisor launcher's per-entry JSONL run history and named leases
(`we:skills-src/conveyor/supervisor-launcher.mjs`); the drain daemon's atomic state file plus append-only
pass history and incident journal under `plateau-app:.drain-daemon/`. Outside prior art: systemd transient
units (a process outlives the manager and is re-adopted on restart), Kubernetes Jobs (desired state plus a
controller that reconciles live pods), Sidekiq and BullMQ (durable queue, visibility timeout, retry with
backoff), Temporal (durable execution with checkpoints and heartbeat timeouts).

### Tag summary

- **Becomes a job:** D2, D3 (later), D8, V1 (later), R1 smoke (later), N1 (later), F2, P4 (as an effect).
- **Batch it:** R1 checks, F1, P1, R2, R3, R5, P3, D4, A4.
- **Just speed it up:** D1, A2, A3, D5, D6, D9, R4, P2, G1, and the immediate halves of D3 and V1.

### Slices (all filed uncleared, blocked by x6sslco), in adoption order

1. xjz3gof — job model core (record, handle, detached launch, snapshot or working tree per kind, reattach,
   caps) on the run store.
2. xqw7hb2 — **first adopter:** the health daemon (4065 / 4077 / 4078) runs probes and investigations as
   jobs and reads every daemon's job records as a smell source. It goes first alone.
3. xxkqmjj — verify gate runs as jobs.
4. xkiob80 — clone rebuild, `npm ci` and the live smoke gate as jobs.
5. xf4av69 — **the drain's post-merge follow-up** as a durable, serial job. The operator named it a first
   adopter; the adversarial round moved it after the health daemon because it is the riskiest single-writer
   path, and after xn6n5gp, xuqk1vp and xb94mt5, which remove most of its cost and its durability gap
   without jobs.
6. xtl54o5 — remaining adopters: runner mechanical passes, infra-blocked resumes, dispatch launch.

## Coordination with in-flight work

- **Drain timing worker** (per-step timing and quick wins in `we:scripts/merge-ai-prs.mjs`): D1 is almost
  certainly the biggest item its timing will surface, but it lives in `we:scripts/backlog/id.mjs`, outside
  that worker's file. Card xn6n5gp says to coordinate. D4, D5 and D6 are in its file; xo3l1l1 says so.
- **Drain step timing** landed as PR #2627 (`we:scripts/lib/pass-timings.mjs`, card x2e120n; open at
  writing) and filed xulvi8k (context-vs-candidate listing double read, overlaps D4). Card xowehck should
  reuse `we:scripts/lib/pass-timings.mjs` for the other daemons; its first real drain numbers are the live
  check on D1's 7-min estimate.
- **Automatic-rebuild worker** (self-sync, live smoke; clone rebuild plus per-clone lock, PR #2625): xz0a64g
  is filed uncleared as a hand-off; xkiob80 says to coordinate.
- **Scenario simulator (x95yxvd):** job reattach (kill mid-job, restart, check it ran once) is a natural
  scenario for it.
- **Health daemon (4065):** observes jobs through their records; slice xqw7hb2.

## Adversarial round

One Opus skeptic ran after the first draft, in the foreground, read-only. It attacked the findings (missed
hot paths, wrong costs, 21 citations checked) and the decision card (merit, classification, statute
overlap, citation scope, the two-confusion screen). Folded in:

- **New findings:** A1 (most of D1's cost is the per-file path regex, measured 8.7 s of 11.4 s on a
  150-file sample), A2 (three more callers of the same numbering), A3 (the numbering lock runs a waiting
  writer unlocked after 5 min), A4 (numbering only on a WE-merge pass), A5 and A6 (ruled-out suspects,
  listed under "Not findings"). New cards xuqk1vp and xb94mt5.
- **Corrections:** the merge-to-numbering lag is 7.2–16.8 min, so D1 explains about 7 min and the rest is
  unmeasured; D5's citation was wrong (the repoll is at 4954–4957, not the red-main freeze code); D2's range
  is 4683–4880. Card texts xn6n5gp, xo3l1l1 and xf4av69 were corrected to match.
- **Citation check:** 20 of 21 sampled citations correct; the one wrong one (D5) is fixed.
- **Decision card:** Fork 2 refuted and flipped (a code snapshot breaks the drain follow-up four ways);
  Forks 1 and 3 amended (a real job handle, and kill-before-relaunch for a stalled job); Forks 3, 4, 5
  reclassified as settled by precedent; the drafted statute amended for collisions with
  #drain-daemon-self-hosting-boundary, #resident-daemon-reload-lifecycle, #conveyor-session-lifecycle-policy
  and #automated-health-daemon; adoption order changed so the health daemon goes first alone.
