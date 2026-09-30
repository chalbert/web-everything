---
kind: story
size: 3
status: open
dateOpened: "2026-09-30"
tags: []
---

# Give builders one admitted test operation instead of rejected shell forms

Seven admission refusals across seven builds wasted generating 8025 output tokens in their assistant messages and replaying commands; four refusals discarded edits bundled with tests. Expose a canonical structured test operation with automatic admission. See we:reports/2026-09-30-builder-postmortem.md.

## Evidence and cost

Seven blocked assistant calls reported **8,025 output tokens**, 13,229 cache-write and 253,146 cache-read tokens, plus 14 uncached input. These are whole-message usage, not command-exclusive token attribution. T4295 115–122, T4331 75–81, T4335 56–66, T4338 55–64, T4457 49–60, T4480 42–47, T4544 51–58 (physical transcript lines; paths in report). Four calls discarded bundled edits. Hook latency was tiny; generation and replay are the loss.

## Root cause and change

Permitted tests are learned from prose and shell refusals. Expose a structured targeted-test operation that owns admission, validates selection and returns a receipt; derive available-operation documentation from declarations. Keep host admission limits. Separate mutations from test requests and remove contradictory prototype text from the dispatched brief. This is an interface change, not a guard bypass.

## Done when

Contract-test the declaration against the same admission policy as the hook. Replay the seven selections through it without a refusal and without exceeding the host limit. A rejected selection cannot discard a previously applied edit. Live two-worker contention proves admission still caps concurrency and records waiting. Measure eliminated refusal/replay turns on the next cohort.
