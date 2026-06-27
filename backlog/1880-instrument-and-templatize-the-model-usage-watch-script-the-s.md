---
kind: story
size: 5
parent: "1855"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: scripts/check-memory.mjs (--json front-A metrics + corpus skew) + .claude/skills/review-program/templates.md
tags: [tooling, model-usage-watch, automation, templates, l1-to-l2]
---

# Instrument & templatize the model-usage watch — script the steps + output templates

Cut the manual effort of each [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/) watch run by (a) **scripting the repeatable measurement steps** and (b) **templatizing the human-facing outputs** — the L1→L2 instrumentation the program's original carve named (item 1: "instrument front A"). The judgment stays human; only the mechanical scaffolding is automated.

## Script the steps (front-A measurement)

Extend `we:scripts/check-memory.mjs` (or a sibling `we:scripts/watch-model-usage.mjs`) to emit, in one run, the front-A metrics the watch currently gathers by hand:

- **Orphan / pointer-integrity count** (already partly there — surface it as a metric, not just a gate error).
- **Index size + headroom**, line count, topic-file count.
- **Corpus skew** — `feedback_*` / `project_*` / `user` / `reference_*` counts (redundancy-likelihood signal).
- **Skill-invocation tally** from transcripts for the **unused-skill** metric.
- Emit `--json` so a run is one command feeding the report, not a sequence of greps.

## Templatize the outputs (minimize per-run authoring)

Add fill-in-the-blank templates under `we:.claude/skills/review-program/` (or alongside the living report) so each run is low-effort and consistent:

- **Review-log entry** — the dated `## Review log` line format (front-A measured / front-B swept / children filed / next run).
- **Living-report run section** — the `## Run N` block (front A measured, front B delta, outcome, next run).
- **Candidate-card skeletons** — decision vs story scaffolds pre-filled with the lineage/report back-links the gate expects.

## Boundaries

- Discovery still **proposes, human disposes** — the script measures and pre-fills; it never files cards or stamps logs autonomously.
- Front-B (external sweep) stays human/subagent-driven — only the *internal* measurement and the *formatting* are scripted.
- Pairs with [#1878](/backlog/1878-close-out-as-memory-instruction-self-improvement-loop/) (close-out reflection) and the cadence trigger — together they are the L1→L2 graduation lever, not assumed.

## Delivered (2026-06-27)

- **Instrumented** `we:scripts/check-memory.mjs` — added `--json` emitting one front-A metrics object (index bytes/KB, headroom, line + topic-file counts, orphan list, **corpus skew** by type, violation count) and a one-line corpus summary in the default sweep. One command now feeds the watch instead of a grep sequence.
- **Templatized** the outputs — `we:.claude/skills/review-program/templates.md`: fill-in-the-blank scaffolds for the review-log entry, the living-report run section, and decision/story candidate cards; pointer wired into the skill's step 4.
- **Deferred (residual, not silently dropped):** the transcript-based **skill-invocation tally** (unused-skill metric) — needs session-transcript parsing (a separate substrate from the memory dir); capturable as a later enhancement to the same `--json` emitter when the transcript path is settled.

## Lineage

Surfaced 2026-06-27 in the second [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/) watch run, proposed by the human ("create script for more steps, and have message template to minimize work"). Realizes the watch's original L0→L1 carve item 1 (instrument front A). Report: [we:reports/2026-06-27-program-model-usage-watch.md](../reports/2026-06-27-program-model-usage-watch.md).
