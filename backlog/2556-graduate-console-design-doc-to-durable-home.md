---
kind: story
size: 2
parent: "2505"
status: open
tags: [plateau-loop, console, design-doc, hygiene, spec]
dateOpened: "2026-07-18"
---

# Graduate the console design doc to a durable home

`plateau:backlog-console-design.md` — the full design record for the launch-review console (the role×lifecycle
matrix, the scope-lease model, the decisions log with every ratified rule, the north-star) — is currently an
**uncommitted working doc inside a plateau-app lane clone**. One lane-pool cleanup and the entire design +
decision history is gone. This graduates it to a durable, cite-able home. Serves G5 and unblocks [#2544] (the
visual-grammar decision cites the ratified grammar, which lives only in this doc).

## Scope
- Move the design doc into a tracked location (the console's spec home, or alongside the taxonomy spec [#2548]).
- Preserve the decisions log (ratified rules) as the cite-able record the build references.

## Acceptance
The design doc + decisions log live in a durable, tracked location; [#2544]/[#2548]/[#2550] cite it; a lane
cleanup can no longer lose it.
