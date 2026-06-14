---
type: idea
workItem: story
size: 3
parent: "315"
status: parked
blockedBy: ["192", "366"]
dateOpened: "2026-06-12"
tags: []
---

# Scheduled / automated gap-sweep refresh

Graduate the manual gap-sweep re-run skill (#366) to a scheduled agent sweep that periodically re-runs the pipeline, reports the delta, and surfaces new candidate gaps — once the cadence has proven stable manually. Decided in #349: the automated half is a client of #192's freshness/automation mechanism, so it is gated on #192 (the general refresh engine) and #366 (the manual skill it automates). Until both land, refresh stays manual.

## Precondition (not yet met) — surfaced at a 2026-06-13 batch claim

This item's graduation is gated on a **soft precondition the readiness loader can't see**: "*once the
cadence has proven stable manually*" (its own body), reaffirmed by [#349](349-repeatability-define-how-the-gap-sweep-re-runs-over-time-and-produces-a-comparable-diffable-result.md)'s
ruling — "*a manual skill first … graduate to scheduled only if it proves stable.*" Both hard blockers
(#192 freshness engine, #366 manual skill) are resolved, so the DAG shows it ready — but #366 **resolved
on 2026-06-13** (graduated to the `gap-sweep-rerun` skill + `/gap-sweep` + `scripts/gap-sweep-status.mjs`),
so there is **no manual-cadence track record yet** to prove stability. Automating now would contradict the
#349 ruling.

**What unblocks it:** a demonstrated stable manual cadence — e.g. a few `/gap-sweep` re-runs that each
produce a clean, diffable delta (the #349 idempotency contract: a re-run over an unchanged landscape →
no-op diff, zero new items). Once that history exists, the build is: a non-interactive refresh entrypoint
(wrapping the manual pipeline) + the #349 staleness signal (`lastSwept` + overdue warning, reusing #192's
freshness mechanism) that a scheduled agent invokes on a cadence. Released back to `open` unworked.
