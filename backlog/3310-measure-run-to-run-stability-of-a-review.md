---
bornAs: x9nkmoz
kind: story
size: 3
parent: "3318"
status: open
dateOpened: "2026-08-26"
tags: []
---

# Measure run-to-run stability of a review

No layer of the design addresses determinism. Coverity caps run-to-run churn under 5% per release and bans randomisation outright, because developers model warnings on compiler warnings; measured LLM-judge test-retest consistency runs 50 to 91%. Review the same PR twice and report finding-set overlap. Cheap, and currently nobody knows the number.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
