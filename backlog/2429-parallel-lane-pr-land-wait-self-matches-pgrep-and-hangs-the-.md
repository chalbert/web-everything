---
bornAs: xe6ijdk
kind: story
size: 2
status: open
dateOpened: "2026-07-11"
tags: [workflow, parallel-batch, lane-pool, pr-land, bug]
---

# Parallel lane pr-land wait self-matches pgrep and hangs the lane to timeout after a green PR

In a `/workflow` (parallel) batch, a lane finishes its item by launching `we:scripts/pr-land.mjs` in the background to open the ready-to-merge PR, then **waits for that pr-land process to exit** with a Monitor loop of the form:

```
until ! kill -0 $(pgrep -f "pr-land <ref-string> --ref=lane/<slug>"); do sleep 5; done
```

`pgrep -f` matches the **full command line** of every process — which includes that exact ref string in the Monitor's **own** shell running the `until` loop. So pgrep matches itself, `kill -0 <self>` always succeeds, and the loop can **never** exit on its own. pr-land has already exited and the PR is green + labelled, but the subagent idles to the Monitor timeout (600s) — and was observed **not to resume even past the timeout**, leaving the lane's `agent()` call unresolved, so the workflow's `parallel()` cannot self-finalize.

**Repro (this session, 2026-07-10):** batch `batch-2026-07-10-2419-2421-2407`. All three lanes did their real work — PRs **#410 (#2407)**, **#411 (#2419)**, **#412 (#2421)** all opened green and `ready-to-merge`. But the lanes for **#2407** and **#2421** then hung on this Monitor (transcript frozen, underlying loop process eventually reaped, subagent never resumed). The run had to be `TaskStop`ped and the ledger verified from the PRs directly; deliverables were safe, but the workflow never returned its own ledger.

## Definition of done
- A parallel lane's post-`pr-land` wait exits **the instant pr-land is gone**, never idling to a timeout, and the lane's `agent()` resolves so `parallel()` finalizes.
- The wait is **self-excluding** — one of: rely on the background-task completion notification instead of a poll loop; exclude the current shell pid from the match (e.g. `pgrep -f 'node .*pr-land' | grep -vw "$$"`); or have pr-land write a pidfile the wait polls on. A `pgrep -f` on a pattern that also appears in the waiter's own argv is banned.
- Regression guard: a check that the emitted wait command does not match its own process (or that the lane resolves within N seconds of pr-land exit).

## Locus
The wait template is emitted by the lane-work step in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` (the lane body).

relatedTo #2199 (pr-land label-on-green — the step whose completion the lane waits on), #2189 (the PR-fan-out execute model this lane wait belongs to), #2183 (parallel batch = PR fan-out).

## Next
- none — ready to build.
