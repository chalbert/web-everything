---
kind: decision
size: 5
parent: "2527"
status: open
dateOpened: "2026-07-18"
tags: [plateau-loop, console, substrate, spec, constitution, design-forks]
---

# Console substrate & contract forks (F1–F4)

The substrate decisions the console design surfaced (design doc §3f "open forks — push these") that gate the
real build — distinct from the visual grammar ([#x9vc5xq]). Each changes the runner, the spec data model, or the
launch gate, so they must be ruled before the board and proof surfaces are built. Serves G1 (supervise the
right unit) and G2 (delivered = spec-proven, from a trustworthy source). NOT prepared — these need shaping.

## Forks
- **F1 — review-unit vs build-unit.** Is the thing a human launches/reviews the same granularity the agent
  builds? Cluster-of-items vs single item changes the runner contract and what a "lane" holds.
- **F2 — where `confidence` comes from.** The launch gate scores confidence (green auto-proceeds, yellow/red
  hold), but there is no trustworthy source defined. Without F2 the gate is decoration.
- **F3 — structured spec fields vs prose.** The proof rows (spec-proven R1..Rn) need a data model. Decide
  whether requirements are structured (machine-checkable fields) or prose the agent interprets — this is the
  schema the proof backend ([#x66ywyw]) and the review modal consume.
- **F4 — constitution: artifact vs index, and how it's injected.** The build-time constitution the agent must
  honor — a single artifact, or an index into cluster rules — and the injection mechanism into the agent
  context.

## Acceptance
Each fork ruled with its downstream implication named (F1→runner contract, F2→launch gate, F3→proof schema,
F4→agent-context injection); [#x66ywyw] (proof backend) and [#xaz4dcn] (board) can then build against settled
contracts.
