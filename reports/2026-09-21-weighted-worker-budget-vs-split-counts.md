# One weighted worker budget plus the heavy pool, or separate heavy and light counts — prior-art survey for #3806

**Date**: 2026-09-21
**Point**: prepare pass for backlog #3806 — every scheduler surveyed that mixes cheap and expensive jobs on one host uses one shared weighted (or slot) budget plus a hard cap on the one scarce resource, and the one documented two-static-counts design (Hadoop MRv1 map/reduce slots) was replaced; the survey also surfaced a second call the item had left implicit — what happens at the head of the queue when an item does not fit.
**Plan file**: none — direct prepare pass, not a `plans/` inbox item.
**Research page**: `/research/weighted-worker-budget-vs-split-counts/`

---

## Question

Backlog #3806 asks whether dispatch of worker agents (review, light task, prepare, build/fix, calibration) is limited by ONE weighted budget on top of the structural heavy-command pool (`we:scripts/readiness/heavy-admission.mjs`, cap 2), or by two separate counts (heavy workers, light workers). The operator's words (2026-09-21): "Do we need heavy worker and light worker count?"

## Recommendation

- **Fork 1 → (a) one weighted budget plus the structural heavy pool.** This is the Ninja shape (global `-j` plus a `pool` with `depth`), the Gradle shape (`--max-workers` plus a service `maxParallelUsages`), and the Bazel/Airflow/Jenkins-Heavy-Job shape (declared per-job cost against one shared budget). The one documented static two-class split, Hadoop MRv1's fixed map and reduce slots, idled one class while the other was saturated and was replaced by fungible containers.
- **Fork 2 → (a) an exclusive kind drains the budget; every other kind is admitted by per-item fit, with a per-kind `drain` flag (default false).** The Go weighted semaphore documents strict FIFO to avoid starving large requests; Airflow issue 29474 is the mirror complaint (a large task overtaken by small ones). Here only the exclusive weight cannot work under skip-ahead admission; strict order for any other kind is the flag set true. The budget needs one tick-wide ledger shared by every planner, because the build planner and the prepare/fix planner are separate steps.
- **Supported by default, not a fork:** optional per-kind ceilings inside the same budget (Jenkins Throttle categories over Heavy Job weights; Slurm `TRESBillingWeights` plus `GrpTRES`/`MaxJobs`), added only when a per-kind RAM limit shows in calibration data.

## Key Findings

1. **Ninja** — one global ceiling plus named pools. Verified quote (https://ninja-build.org/manual.html): "No matter what pools you specify, ninja will never run more concurrent jobs than the default parallelism, or the number of jobs specified on the command line (with `-j`)." Example pool: `pool link_pool` / `depth = 4`. The scarce step gets its own structural cap; everything else shares the global number.
2. **Gradle** — `--max-workers` is the global count; `BuildServiceSpec.maxParallelUsages` caps concurrent users of one shared service (https://docs.gradle.org/current/userguide/command_line_interface.html, https://docs.gradle.org/current/userguide/build_services.html). A global count plus a structural pool; no per-kind weights.
3. **Bazel** — one job cap plus a scheduler that reserves declared CPU/RAM per action (https://bazel.build/docs/user-manual); a test tagged `cpu:n` reserves n cores, and Bazel still runs it on a smaller machine (https://bazel.build/reference/test-encyclopedia). Declared weights can be wrong: "Resource modeling for actions is… inaccurate" (https://jmmv.dev/2019/12/bazel-local-resources.html). This is why the structural pool is kept (settled by precedent, noted under Fork 1 (a)). `resource_set` was not verified.
4. **Airflow** — a pool has slots, and a task occupies one by default or more via `pool_slots` (https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/pools.html): weights inside one shared budget, with separate named pools available for structural limits. Two failure modes are documented as issues: heavy tasks overtaken by small ones (https://github.com/apache/airflow/issues/29474) and free slots wasted across separate pools (https://github.com/apache/airflow/discussions/25139).
5. **Jenkins** — the Heavy Job plugin makes a job consume N executors (one weighted budget: https://plugins.jenkins.io/heavy-job); Throttle Concurrent Builds adds per-category caps on top, and "each requirement needs to be satisfied" (https://plugins.jenkins.io/throttle-concurrents/). That is a weighted budget with per-category ceilings — the shape of the supported-by-default extension.
6. **Slurm** — `TRESBillingWeights` price a job as a weighted sum (https://slurm.schedmd.com/tres.html); `GrpTRES`, `MaxJobs` and QOS limits cap classes on top (https://slurm.schedmd.com/sacctmgr.html). Weights and per-class limits are used together. (The resource-limits page summary was loose; treated as approximate.)
7. **Kubernetes** — ResourceQuota charges declared `requests`, not measured use (https://kubernetes.io/docs/concepts/policy/resource-quotas/). Paraphrase from the fetch, not a verbatim quote.
8. **Go `x/sync/semaphore.Weighted`** — `Acquire(n)` against one weighted budget (https://pkg.go.dev/golang.org/x/sync/semaphore). Its source comments document strict FIFO: skipping ahead "could cause starvation for large requests; instead, we leave all remaining waiters blocked" (https://raw.githubusercontent.com/golang/sync/master/semaphore/semaphore.go). The cost of FIFO is that free capacity can sit idle behind a large head.
9. **Hadoop MRv1 → YARN** — MRv1 gave each TaskTracker fixed map slots and reduce slots, which "might cause low cluster utilization since map slots might be fully utilized while reduce slots are empty (and vice-versa)"; MRv2 replaced them with fungible containers ("the cluster is not artificially segregated into map and reduce slots"). Read from search excerpts of the MRv2 architecture note (https://issues.apache.org/jira/secure/attachment/12486023/MapReduce_NextGen_Architecture.pdf) and the Cloudera MRv1→MRv2 migration page; the PDF itself was not opened. The Apache YARN overview page was checked and does not say this.
10. **DRF** (Mesos/YARN) — search excerpt only: slot-based fair sharing gives worse throughput and fairness than dominant-resource allocation. Unverified; not relied on.

## What this changes in #3806

- Fork 1 keeps its default and gains named occurrences and one documented failure mode of the rejected branch (MRv1 static slots).
- The pool's own header shows it **fails open** after 20 minutes of waiting (`we:scripts/readiness/heavy-admission.mjs:114-117`) and is bypassed under `CI`, `WE_HEAVY_ADMISSION=off` or a missing pool root (`:449-455`). The item's "bounds heavy work whatever anyone declares" is therefore a bounded-wait guarantee, not a hard cap, which makes an upstream budget that keeps the waiting count low more necessary, not less.
- New Fork 2 (head-of-line): the item and card 3807 never say what happens when the next queued item does not fit the remaining budget. Card 3807's test (b) assumes per-item fit (a review is admitted while a build is refused), which is skip-ahead; its test (c) assumes an exclusive kind is admitted only when live weight is 0, which skip-ahead can never reach.

## Files Created/Modified

| File | Action |
| --- | --- |
| `we:backlog/3806-one-weighted-worker-budget-plus-the-heavy-pool-or-separate-h.md` | rewritten to prepared-fork shape |
| `we:src/_data/researchTopics/weighted-worker-budget-vs-split-counts.json` | new registry entry |
| `we:src/_includes/research-descriptions/weighted-worker-budget-vs-split-counts.njk` | new write-up |
| `we:reports/2026-09-21-weighted-worker-budget-vs-split-counts.md` | this report |
