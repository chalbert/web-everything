---
kind: decision
parent: "xjbdhzb"
status: open
dateOpened: "2026-08-26"
tags: []
---

# Should claim-accuracy be a mandatory lens

#2310 ratified the mandatory/advisory split, with mandatory meaning a genuine invariant with no other backstop. claim-accuracy arguably meets that better than standards-conformance, which check:standards backstops, and the deterministic attempt at the class caught only 5 of 39 confirmed labels (12.8%), of which 3 survived hand-inspection — re-run it with `node we:scripts/review-corpus/replay-gates.mjs`. It landed advisory pending this call. Nothing needs it promoted until the panel is wired.

> **Retracted.** This card used to say *"the deterministic attempt at the class caught 3 of 13."* The replay reports 5 of 39; there is no population of 13 in its output.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
