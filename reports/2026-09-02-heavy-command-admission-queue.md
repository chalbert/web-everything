# Heavy-command admission queue — prior-art survey for #3456

**Date**: 2026-09-02
**Point**: prepare pass for backlog #3456 — surveys concurrency-admission-control prior art (job schedulers, resource pools, distributed locks) to ground its four forks; no design exists yet in this repo for a *counting* capacity throttle, only single-holder mutex precedent.
**Plan file**: none — direct prepare pass, not a `plans/` inbox item.
**Research page**: `/research/heavy-command-admission-queue-capacity-throttle/`

---

## Question

Backlog #3456 asks how to cap the number of genuinely CPU/IO-heavy commands (`check:standards`,
`verify-lane`/`test:unit`, `npm ci`, a Playwright visual capture) that may run **at the same instant** across
independently-dispatched lane processes, once lane parallelism scales up. Four forks are open: (1) what counts
as "heavy" and how is that classified, (2) where the admission gate binds (lane-acquire time vs. heavy-command-
invocation time), (3) a fixed cap or one that adapts to real load, and (4) how a throttled-but-waiting dispatch
surfaces that state. This survey grounds each in shipped prior art before the item is stamped prepared.

## Recommendation

- **Fork 1 → (a) an explicit, named, per-command-weighted list.** Bazel's local-resource scheduler
  (`--local_cpu_resources`/`--local_ram_resources`) is the load-bearing precedent: it tracks a pool against a
  *declared cost per action*, not a blanket per-job slot. A fully adaptive classifier (Fork 1(c)) has no
  measurement layer to run on yet, and the closest shipped adaptive tool (GNU Parallel `--load`) shows that
  layer is nontrivial to build correctly (see Finding 3).
- **Fork 2 → (b) gate at heavy-command-invocation time, not lane-acquire time.** GNU Make's jobserver protocol
  is the exact shape: a job acquires a token immediately before it runs and releases it immediately after,
  never at process-startup time, with one implicit slot always reserved so a caller is never fully starved.
- **Fork 3 → (a) a fixed, machine-overridable cap**, not real-time adaptive sampling. Bazel again: its default
  resource pool is a *measured-once* host fact (`HOST_CPUS`-derived), not continuously re-sampled. GNU
  Parallel's `--load` — real, shipped, adaptive throttling — deliberately avoids `os.loadavg()` (too slow) in
  favor of polling `ps` for live thread state with an exponential-backoff busy-wait; that is real, undesigned
  infra this repo doesn't have. Note: "hardcoded constant" vs. "config-overridable constant" is *not* a second
  fork here — it's a config dimension, and the platform-default flavor is trivially "overridable."
- **Fork 4 → (a) a new, distinct status surfaced immediately**, not coupled to #3451's landing. GitHub Actions'
  concurrency groups expose a queued/pending job as a first-class, visible state — never silence — which is the
  shape (a) matches, and it avoids the reconciliation-depends-on-a-live-session risk #3449 already flags for
  #3451's separate, async-read log.

## Key Findings

1. **GNU Make jobserver** — a shared token pipe, propagated to child processes via `MAKEFLAGS`
   (`--jobserver-auth=`); a client acquires a token before starting a job and releases it after; one implicit
   slot is always reserved per invoked `make` so a caller can always make forward progress even under full
   contention. This is the closest real precedent to a **cross-process counting semaphore for job execution**,
   and it binds at job-start time, not process-start time — direct evidence for Fork 2(b).
   ([Job Slots — GNU make manual](https://www.gnu.org/software/make/manual/html_node/Job-Slots.html))

2. **Bazel local-resource scheduling** — `--local_cpu_resources`/`--local_ram_resources` define a fixed local
   pool (defaulting to a host-measured value, e.g. `HOST_CPUS-1`, not continuously re-sampled); each action
   declares its own cost (`cpu=N`, `memory=N`), and Bazel subtracts/returns from the tracker as actions start
   and finish. This is the load-bearing precedent for a **declared-weight list** (Fork 1(a)) over a uniform cap
   (Fork 1(b)), and for a **fixed-but-configurable pool** (Fork 3(a)) over continuous runtime sampling (Fork
   3(b)). ([Bazel user manual](https://bazel.build/docs/user-manual); [How does Bazel track local resource
   usage? — jmmv.dev](https://jmmv.dev/2019/12/bazel-local-resources.html))

3. **GNU Parallel `--load`** — the closest shipped example of adaptive, real-load-based admission. Contrary to
   the obvious naive design, it does **not** sample `os.loadavg()` (documented as rising too slowly to be
   useful); it polls `ps` for the count of running/blocked (`D`/`O`/`R` state) threads for an instantaneous
   read, and busy-waits with an exponential backoff capped at 1s to avoid burning CPU on the poll itself. This
   is real evidence that Fork 3(b) (adaptive) is a genuine, nontrivial measurement-layer build, not a drop-in
   swap for a fixed constant. ([GNU Parallel design docs](https://www.gnu.org/software/parallel/parallel_design.html))

4. **GitHub Actions concurrency groups** — a job queued behind a concurrency-group limit is a first-class,
   visible `queued`/`pending` state (not silence), and as of the 2026-05-07 changelog a group's queue depth is
   itself configurable up to 100 pending jobs. Direct precedent for Fork 4(a)'s "a new, distinct, visible
   status" over Fork 4(c)'s "no new surfaced state." ([Control the concurrency of workflows and jobs — GitHub
   Docs](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs);
   [GitHub Actions concurrency groups now allow larger queues](https://github.blog/changelog/2026-05-07-github-actions-concurrency-groups-now-allow-larger-queues/))

5. **In-repo precedent — this repo already ships two independently-designed cross-process advisory locks, both
   single-holder MUTEXES, not counting semaphores.** `we:scripts/readiness/file-locks.mjs` (#1936, itself
   surveyed in `/research/agent-file-lock-coordination/`): an atomic `mkdir`/`O_EXCL` lock directory per
   reserved path under a per-lane lock dir, a heartbeat-TTL lease, and a same-machine PID-liveness fast-reclaim
   path layered on top (never primary, since PIDs get reused). `we:scripts/conveyor/infra-blocked.mjs:388`
   (`withInfraLock`): an exclusive-create lock file, a `staleMs` steal window for a crashed holder, and — the
   operative design principle — a hard `timeoutMs` fallback that **proceeds anyway** rather than risk
   deadlocking a tick ("a lock must never DEADLOCK a tick"). Both are `N=1` mutexes; the mechanism #3456
   eventually builds (explicitly deferred to a follow-on item, not this decision) is the natural generalization
   of one of these shapes from a single-holder lock to an `N=cap` counting semaphore — a real, concrete starting
   point for that later build, cited here as grounding, not as this decision's own scope.

## Files Created/Modified

| File | Action |
|---|---|
| `we:reports/2026-09-02-heavy-command-admission-queue.md` | created (this report) |
| `we:src/_data/researchTopics/heavy-command-admission-queue-capacity-throttle.json` | created |
| `we:src/_includes/research-descriptions/heavy-command-admission-queue-capacity-throttle.njk` | created |
| `we:backlog/3456-cap-concurrent-heavy-commands-across-dispatched-lanes-a-capa.md` | edited — forks brought to Definition-of-Ready, `preparedDate` stamped |
