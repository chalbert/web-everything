---
kind: epic
ongoing: true
status: open
dateOpened: "2026-06-22"
tags: []
---

# Design-knowledge intake program

A standing watch (review-program pattern) that distills best-practice/usability research into the codified design-critique rubric — supplying the TOP-DOWN priors the trainable judge (#1553) and the design-review loop (#1033) both consume. Standalone, not under #1552, because the codified base serves more than the judge. Feeds we:docs/agent/platform-decisions.md#trainable-judge and #1033.

A never-finished watch with TWO ongoing tracks: (1) **source discovery & curation** — WHERE authoritative design knowledge comes from is itself open research; standardize the admission + credibility-weight criteria, not a frozen source list (open-design posture), so durable peer-reviewed usability research outranks a trend blog; (2) **content distillation** — distill curated, weighted sources into the #1034 design-critique rubric (AI over a contract: codified heuristics carrying provenance, never raw text into weights — #490 distillation pipeline).

## L0→L1 carve (sliced 2026-06-22 — see we:reports/2026-06-22-backlog-split-analysis.md Run 9)

Bootstrap slices, mirroring the keystone program #1257's L0→L1 spin-off of #1267:

- **#1586** (`task`) — corpus ledger `we:src/_data/designKnowledgeWatch.json` + front-A conformance metric wired as a gate nudge. Root, build-ready.
- **#1587** (`task`) — extend the #1034 rubric to carry source provenance (version-bump). Root, build-ready.
- **#1588** (`decision`) — source admission + credibility-weight criteria (the open fork, de-buried). Root.
- **#1589** (`story`/5) — distillation pipeline. `blockedBy: #1588, #490`.

## Review log

- **2026-06-22 — first run (L0→L1, front-A bootstrap).** Built the front-A conformance arm (#1586): the corpus ledger `we:src/_data/designKnowledgeWatch.json` seeded with the obvious authoritative set at provisional equal weight — `nielsen-heuristics` (guideline) · `apple-hig` (guideline) · `w3c-apg` (standard) · `uicrit-uist24` (peer-reviewed) — and `computeDesignKnowledgeConformance()` wired into `check:standards` as a NUDGE counting admitted sources not yet distilled into the #1034 rubric (4/4 pending at seed, same posture as #1267's `registered:false` rows). Distillation is tracked by #1589 (blockedBy the #1588 admission/credibility-weight decision). Front-B source-discovery sweep not yet built (later L1 slice). **Next run:** ratify #1588 (admission + credibility-weight criteria), then run #1589 to distill the seed set and flip its `distilledInto` rows; re-sweep for newly-admitted authoritative sources (idempotent).
