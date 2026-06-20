---
kind: epic
status: resolved
dateOpened: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
childlessReason: program
tags: [backlog, decisions, prepared-fork, definition-of-ready, readiness, research-graduation, meta]
relatedReport: reports/2026-06-11-decision-readiness-review.md
---

# Prepare the open decisions to the prepared-fork shape (rollout)

Roll the prepared-fork Definition-of-Ready out across all open `type: decision`
items so decision-mode selection draws from prepared forks. Driven by the
[2026-06-11 decision-readiness audit](../reports/2026-06-11-decision-readiness-review.md)
(`relatedReport`). **Complete (2026-06-11): all 24 decisions are prepared or
reclassified.** 19 were prepped to the prepared-fork shape (#063 got a bold default in
lieu of a survey), 4 were reclassified out, and the prepared forks were then ratified —
**9 resolved + 8 partial-ratified** (one human pin each), spinning out **19 agent-ready
builds (#320–#339)**.

## Why this is a program, not a touch-up

The audit graded all 24 open decisions against the prepared-fork shape
(`we:docs/agent/backlog-workflow.md` → *The prepared-fork shape*) and found **0/24
ready at the time**. This is a roll-out gap, not a quality gap: the shape is
brand-new (proven on #064 + #173, both prepared and resolved 2026-06-11) and the 24
open decisions simply predate it. The bottleneck is near-universal: the research
*report* usually exists, but it hasn't been **graduated to a browsable `/research/`
topic + linked via `relatedReport` + stamped with `preparedDate`**, and the body
lacks the "at a glance" table and per-fork `## Fork N` structure.

Prep is heavy (≈ a real prior-art survey + restructure per item), so realistically
**1–3 items per session**, not a single sweep — which is why this is tracked as a
standing epic rather than a story.

## Prep order (by downstream leverage, from the audit)

1. **#009 webpermissions** — 6 dependents, highest-leverage. ✅ prepared
2. **#012 / #014 / #011** — the other `web*` gap-projects (clean greenfield surveys). ✅ prepared
3. **Configurator cluster** — #104 first (least prepared), then #105 / #107 / #096 / #101. ✅ prepared
4. **Remaining 15** — ✅ done: #018 #051 #059 #124 #109 #141 #091 #083 #166 #178 prepared;
   #063 given a bold default (trivial rename, no survey); #276 #170 #090 #142 reclassified out (below).

## Reclassify out of `decision` (not prep — reshape) — ✅ done 2026-06-11

- **#142** → `idea` — an AI-generated brainstorm inventory (task under #140), not a fork.
- **#090** → `idea` — a service-catalog enumeration with no actual decision.
- **#276 / #170** → `issue` — core fork already resolved inline; now *builds*, not decisions.
- **#063** — kept `decision` but given a bold default (binary/trivial rename pick; no survey).

## Acceptance

- Every open `type: decision` either reaches the prepared-fork shape (`preparedDate`
  + `/research/` topic + glance table + `## Fork` per fork) **or** is reclassified
  out of `decision` per the list above.
- The audit report stays attached here as a dated snapshot (not maintained — see its
  own refresh note); progress is tracked by the `preparedDate` stamp count.

## Progress

- **2026-06-11** — opened. 9/24 prepped (#009 #011 #012 #014 #096 #101 #104 #105
  #107); 15 unprepped; 0 reclassified yet. (Spun out of the orphaned audit report so
  it has a tracked home; surfaced during batch `batch-2026-06-11-217-053-…`.)
- **2026-06-11** — ✅ **resolved (program complete).** **19 prepared** (added #018 #051
  #059 #083 #091 #109 #124 #141 #166 #178), **4 reclassified** (#090 #142→idea,
  #170 #276→builds), **#063** given a bold default. Acceptance met: every open
  `decision` is prepared or reclassified. The prepared forks were then ratified —
  **9 resolved** (#014 #018 #051 #059 #096 #107 #109 #124 #178) + **8 partial-ratified**
  (#009 #011 #012 #083 #101 #104 #105 #166, each with one open human pin) — spinning out
  **19 agent-ready builds #320–#339** (blockedBy wired). Residual = ~10 human calls in 3
  clusters (new-project charter + naming · money/legal #166/#091/#141 · the #063 rename),
  each tracked on its own item and surfaced via `/next decision`. No umbrella needed.
