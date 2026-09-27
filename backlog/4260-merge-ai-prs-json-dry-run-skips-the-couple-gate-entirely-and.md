---
bornAs: x95f2x1
kind: task
parent: "4075"
status: open
scope: ["we:scripts/merge-ai-prs.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# merge-ai-prs JSON dry-run skips the couple gate entirely and omits coupleHeld

Still-open Codex advisory finding from chalbert/web-everything#2763 (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-26). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — code is UNCHANGED, finding still applies.

FINDING: in we:scripts/merge-ai-prs.mjs's DRY_RUN branch, the whole couple-cascade preview (planCoupleCascadeStep call plus coupleHeld.push of its held list) is wrapped inside an if block that only runs when NOT in JSON output mode — so a dry-run invocation that ALSO requests JSON output (the resident drain daemon's own normal automated invocation shape) never computes the couple-cascade step at all: coupleHeld stays empty and the JSON output omits the hold information the equivalent text dry-run would report for the same group.

EVIDENCE: read the DRY_RUN block in we:scripts/merge-ai-prs.mjs directly off origin/main — the couple-cascade preview and its coupleHeld push are still nested under the not-JSON-mode guard, with no equivalent computation outside it.

PREVENTION (from the reviewer, still owed): add a JSON-mode dry-run output-parity test asserting identical coupleHeld results with and without JSON mode, and compute the couple-cascade preview outside the text-formatting branch.

Priority: not HIGH (a reporting/preview gap for automated JSON consumers of the dry-run mode, not a live merge decision).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
