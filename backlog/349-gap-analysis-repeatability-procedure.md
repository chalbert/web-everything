---
type: decision
workItem: story
size: 5
status: resolved
parent: "315"
blockedBy: ["346"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: ruling recorded; spawned #366 (manual re-run skill) + scheduled-refresh story
tags: [gap-analysis, competitive-analysis, repeatable, freshness, longitudinal, cadence, research]
relatedProject: webdocs
crossRef: { url: /research/, label: "/research/ topic index" }
---

# Repeatability — define how the gap sweep re-runs over time and produces a comparable, diffable result

Phase 5 of the [gap-analysis program](backlog/315-competitive-coverage-gap-analysis-program.md): make the whole pipeline (corpus → extraction → mapping → gap→backlog) **re-runnable on a cadence so a later pass produces a comparable, diffable result** — the same corpus yields the same matrix shape, surfacing only what *changed*. This is the "run it again from time to time with a similar result" requirement, and it is the **component-coverage instance of [#192](backlog/192-longitudinal-research-freshness-system.md)** (longitudinal research freshness) — so the decision is largely *how to reuse #192's machinery*, not invent a parallel one.

Blocked by #346 — there's no run to repeat until the extraction method + schema exist; the repeatability rules wrap that method.

## The decision

Settle the re-run contract for the program. Most sub-questions defer to #192 if it lands first; this item decides them *for the gap sweep specifically* and feeds anything reusable back to #192.

- **History model** — each run is a **new dated revision** under one stable `/research/` topic id (the #192 dated-chain model), latest canonical + prior runs linked as history. Never overwrite a prior matrix. **Recommendation: adopt #192's chain wholesale.**
- **Diffability** — the matrix data file must splice, not rewrite, so a re-run produces a clean diff (added / removed / changed / newly-filled rows). Decide the stable row key (the capability `id` from #346) and a run-to-run delta view.
- **Cadence + trigger** — manual `/`-skill, scheduled agent sweep, or on-touch. Same open axis as #192's axis-discovery trigger; **decide once, shared with #192**, so there aren't two refresh mechanisms. **Recommendation: a manual skill first (an agent re-runs the pipeline and reports the delta), graduate to scheduled only if it proves stable.**
- **Idempotency contract** — a re-run over an unchanged landscape must produce **zero** new backlog items and a **no-op diff** (the #348 dedup is what enforces this end-to-end). This is the testable definition of "similar result."
- **Drift / staleness signal** — a `lastSwept` date on the topic + a warning when overdue (reuse #192's freshness signal rather than a new one).

## Acceptance

- A written **re-run procedure** (and any supporting skill/tooling) exists: how to re-fetch the corpus, re-extract, re-map, and emit the **delta** against the prior dated run.
- The matrix is a dated `/research/` revision chain (history preserved, latest canonical), diffable by capability `id`.
- The repeatability/freshness mechanism is **shared with #192**, not a duplicate; the cadence/trigger ruling is recorded.
- Demonstrated idempotency: a second run over an unchanged corpus yields a no-op diff and zero new items.
- `npm run check:standards` green.

## Resolution (2026-06-12)

**Decided — shared with #192, manual skill ships now, automation gated on #192.**

- **History model:** dated-revision chain under stable topic ids — *ratified as built* (corpus/capabilities/coverage data files already carry `version` + `lastSwept`; runs never overwrite).
- **Diffability:** key by stable `id` (corpus source id, capability id, coverage row id) — *ratified as built*; a re-run diffs as added/removed/re-classified, not a rewrite.
- **Idempotency:** a re-run over unchanged input opens **0** new backlog items — *adopted as the acceptance criterion*; already enforced by #348's file-time dedup (it caught 4 already-tracked at this run).
- **Drift signal:** reuse #192's `lastSwept` + overdue-warning freshness mechanism — *defer to #192*, no bespoke signal.
- **The fork (mechanism ownership):** **shared with #192, not a parallel freshness engine.** The re-run ships now as a thin **manual `/`-skill** (re-runs corpus→extraction→mapping→gap, reports the delta) designed as a *client* of #192's contract, so it plugs into #192 rather than being replaced. The **automated/scheduled** half waits on #192.

Graduates to two follow-on stories under #315: a manual re-run skill (agent-ready now) and a scheduled
refresh (blocked on #192 + the manual skill). Manual-first because the first few re-runs want a human
reading the delta (did the corpus criteria still hold? did a new axis appear the schema doesn't model?)
before automation is trusted.
