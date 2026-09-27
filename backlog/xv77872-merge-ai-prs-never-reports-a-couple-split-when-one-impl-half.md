---
kind: task
parent: "4075"
status: open
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# merge-ai-prs never reports a couple split when one impl half lands and a sibling impl half fails

Still-open Codex advisory finding from chalbert/web-everything#2763 (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-26). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — code is UNCHANGED, finding still applies.

FINDING: in we:scripts/merge-ai-prs.mjs's per-pass cascade, the carrier branch computes missing = myImpls.filter(x => not merged) and, whenever missing.length is nonzero, calls holdCouple(c, carrier, ...) and continue()s BEFORE carrierImplsLanded is ever set. noteSplit(why) (defined further down) only pushes to coupleSplit when carrierImplsLanded is truthy — so for a carrier with two impl halves where ONE already merged and the OTHER fails/is refused this same pass, the held-branch continue skips straight past noteSplit and the split is never recorded: no coupleSplit entry, no stderr COUPLE SPLIT line. The already-landed impl half is stranded with no carrier and nothing surfaces it.

EVIDENCE: read the carrier branch in we:scripts/merge-ai-prs.mjs directly off origin/main — the missing.length check still holdCouple()s + continue()s unconditionally, and carrierImplsLanded is still only assigned in the sibling branch reached when missing.length is zero.

PREVENTION (from the reviewer, still owed): add a deterministic cascade test with two impl halves, one merges and the other fails in the same pass, asserting the held carrier's coupleSplit still records the landed impl.

Priority: not HIGH (a real impl half can strand silently, but does not close/resolve a wrong PR outright, does not itself destroy data, and the couple gate still blocks the NEXT pass rather than suppressing healing forever).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
