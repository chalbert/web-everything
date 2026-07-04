---
name: feedback_context_meter_ask_dont_estimate
description: "Agent can't read the context-window meter — ask the user for it; never estimate or present a guess as measured"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b2708473-bb2a-4252-aa10-55732897d070
---

I cannot read the editor's context-window meter from inside the tools (no env var,
file, or tool exposes it). So **never state a context-usage percentage as if I
measured it, and never silently estimate one.** When a value is needed (e.g. the
batch budget calibration's `--context-pct`), **request it in PLAIN PROSE in the
close-out message and use the reading verbatim** — **never via the `AskUserQuestion`
popup** (a reading is a data request, not a decision; the user flagged the popup as
wrong here on 2026-06-15). **The user often can't read the meter either** — if no
reading is given, **just skip calibration and move on; do NOT re-ask or block on it.**

**Why:** I once passed a guessed `--context-pct=40` to `backlog.mjs calibrate` and
reported it as if checked; the real reading was 20%. A fabricated value is
EMA-blended into `capacityPoints`, so it silently skews every future batch's budget.

**How to apply:** Encoded in [[feedback_authoring_standard_workflow]]'s workflow docs
— `docs/agent/backlog-workflow.md` → "Calibrating the budget" and the
`batch-backlog-items` SKILL now say to ask the user for the meter reading, never
estimate. Generally: if I'm tempted to report a context figure, label it an estimate
or ask instead. Relates to [[feedback_plain_language_review_checklists]] (verify
claims, don't assert unverified ones).
