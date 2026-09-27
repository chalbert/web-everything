---
bornAs: xjall5v
kind: task
parent: "4075"
status: open
scope: ["we:scripts/lib/soak-replay-gate.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# soak-replay-gate accepts any breaks/ directory change, even index/README-only, with no real replay

Still-open Codex advisory finding from chalbert/web-everything#2775 (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-26). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — code is UNCHANGED, finding still applies.

FINDING: we:scripts/lib/soak-replay-gate.mjs's addsOrChangesSoakBreak (and the evaluateSoakReplayGate verdict built on it) treats ANY added/modified/renamed file under we:scripts/conveyor/soak/breaks/ as satisfying the "adds a soak break scenario" requirement — it only checks the path prefix, never that the change is an actual scenario module (with a matching *.soak.test.mjs) registered in that directory's we:scripts/conveyor/soak/breaks/index.mjs the way the module's own docblock says a real scenario must be. A daemon fix that only edits we:scripts/conveyor/soak/breaks/index.mjs (e.g. a trivial reorder) or only adds a we:scripts/conveyor/soak/breaks/README.md passes the gate with no executable, registered replay behind it at all.

EVIDENCE: read addsOrChangesSoakBreak directly off origin/main in we:scripts/lib/soak-replay-gate.mjs — it still only checks path.startsWith(SOAK_BREAKS_DIR_PREFIX) and the change type (not DELETED), with no check that the changed file is a scenario module, that it has a companion soak test file, or that it is registered in the breaks directory's own registration file.

PREVENTION (from the reviewer, still owed): add a deterministic structural check requiring a changed scenario module WITH its companion soak test and its registration in we:scripts/conveyor/soak/breaks/index.mjs, with negative tests for README-only and index-only changes that must still fail the gate.

Priority: not HIGH (a gate the gate exists to enforce can still be satisfied without a real replay, but this does not itself close/resolve the wrong PR, lose data, or suppress healing forever — it degrades one prevention mechanism's own reliability).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
