---
kind: story
size: 3
parent: "2268"
status: resolved
dateOpened: "2026-07-04"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: scripts/lib/invariant-catalogue.json
tags: []
---

# Invariant catalogue for skills and memory operations

Enumerate the must-never-break guarantees per skill/script/memory op — the assertion vocabulary both harness tiers check against. Examples: batch/finish never touch main directly, resolve stamps dateResolved, a kind:decision resolve refuses without codifiedIn, scaffold allocates a free NNN and never renumbers, memory red-teams before landing, we:MEMORY.md carries one index line per memory file. Output is a machine-readable invariant list, not test code.
