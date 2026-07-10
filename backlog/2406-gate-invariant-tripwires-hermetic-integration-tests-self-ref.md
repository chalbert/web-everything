---
kind: story
size: 5
parent: "2405"
status: open
dateOpened: "2026-07-10"
tags: []
---

# Gate invariant tripwires + hermetic integration tests, self-referenced in GATE_SELF_PATHS

Add deterministic test support for the auto-review/merge gate so a change to the gate LOGIC is CI-verified, not human-eyeballed. Two layers, both under scripts/__tests__ so CI's required test check gates every PR: (a) a tripwire INVARIANT suite pinning safety properties that must never regress — a gate-self path always yields humanRequired, decideReviewGate never returns merge/merge-anyway under a sticky review:human, a red/failed check is never mergeable, assertMayMerge throws for every caller but drain, hasUnclearedReviewLabel refuses every non-accepted label on the bare sweep; (b) hermetic INTEGRATION tests driving the real runCli/planLabelDrain entrypoints with stubbed gh/git over an ephemeral tmp repo — label→park→merge lifecycle and the concurrent-lander race. Then add the invariant test file itself to GATE_SELF_PATHS so editing an invariant forces review:human — shrinking human review of gate changes down to invariant changes only.
