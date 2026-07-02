---
kind: epic
ongoing: true
relatedReport: reports/2026-07-01-program-external-consultant-review.md
status: open
dateOpened: "2026-07-01"
tags: [program, review, governance]
---

# External consultant review

A standing independence program: a periodic fresh-context review of the whole constellation by a model outside the day-to-day batch rotation, run at phase boundaries or quarterly. In-lane agents cite the statute; this program audits it — cross-cutting synthesis across architecture, engineering, process, and strategy, with findings filed as backlog items and each run appended to the living report. The independence is the asset: the reviewer must not be in the batch rotation, must start with fresh context, and must ground every finding in file evidence or a live command run.

## The two fronts

- **Front A — findings closure (internal):** each run re-audits the prior run's filed findings against the *code*, not their backlog status — a resolved finding whose fix isn't observable is a reopened gap. Metric: count of prior-run findings not verifiably closed.
- **Front B — fresh review (external):** a full multi-lens re-review (architecture · engineering · process · strategy) with uninvolved parallel agents, surfacing what the in-lane process cannot see about itself. Each run files only newly-appeared findings (gap-sweep idempotency — an unchanged landscape files 0 items).

## Cadence & trigger

Quarterly, plus phase boundaries. The next natural trigger is **pre-public-launch** (before #1137's gate opens). Run via `/review-program 2090`, executed by a model outside the current batch rotation.

## Review log

- **2026-07-01 — run 1 (Claude Fable 5).** Four parallel lenses; verdict "internally exceptional, externally untested". Filed #2080, #2082–#2087 (stories/task) and #2088/#2089 (decisions); leaned on pre-existing #1294, #777, #1137/#1136, #1231, #2073 without duplicating. Detail in the living report.
