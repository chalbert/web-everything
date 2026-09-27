---
bornAs: xmzknd0
kind: task
parent: "4075"
status: open
scope: ["we:scripts/conveyor/convert-advisory-dispatch.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# convert-advisory-dispatch treats partial (quoted-path-dropped) diff evidence as complete for multi-file escalations

Still-open Codex advisory finding from chalbert/web-everything#2781's FINAL review round (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-27). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — code is UNCHANGED, finding still applies.

FINDING: in we:scripts/conveyor/convert-advisory-dispatch.mjs, filterDiffToPaths splits diff text on diff --git sections and keeps only sections whose header matches the regex diff --git a/(\S+) b/(\S+) against the requested path set. A Git-quoted path (one with a space or non-ASCII byte, which git wraps in double quotes with backslash escapes in a diff header) never matches \S+ cleanly, so that section is silently dropped even though it is a real requested file. resolveTargetedCheckEvidence then only checks whether the OVERALL filtered result is non-empty (true whenever at least one OTHER named path matched), and marks evidence as fetched/complete for the WHOLE multi-file escalation — so the tool-free judge answers based on partial evidence while the caller (and the posted advisory note) treats it as a full, conclusive check, contradicting the module's own fail-closed guarantee for missing evidence.

EVIDENCE: read filterDiffToPaths and resolveTargetedCheckEvidence directly off origin/main in we:scripts/conveyor/convert-advisory-dispatch.mjs — the path-matching regex is unchanged (still requires \S+, no C-style-quote unwrapping) and resolveTargetedCheckEvidence still treats any non-empty filtered text as available evidence with no per-requested-path completeness check.

PREVENTION (from the reviewer, still owed): add a deterministic mixed-path regression test (one plain path, one Git-quoted path) asserting that partial named-file evidence forces an inconclusive verdict rather than a conclusive one, and require evidence collection to account for every requested path before permitting a conclusive judgment.

Priority: not HIGH (degrades one advisory-conversion judge's evidence completeness for an unusual filename shape; review:human still gates the actual merge ceremony, so this does not itself close/resolve the wrong PR, lose data, or suppress healing forever).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
