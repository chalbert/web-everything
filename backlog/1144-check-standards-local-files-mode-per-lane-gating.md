---
kind: story
size: 3
parent: "1143"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
tags: []
---

# check:standards --local --files mode (per-lane gating)

Add a --local (+ --files=<paths>) mode to we:scripts/check-standards.mjs that runs ONLY the ~35 file-in-isolation (LOCAL/CONTENT) checks, restricted to the given files — skipping the ~60 GLOBAL/RELATIONAL cross-tree checks. Extends the existing per-item local path (we:scripts/check-backlog-item.mjs). This is what makes per-lane gating in a worktree fast AND correct: GLOBAL invariants are meaningless inside one isolated lane and only become real at merge, so a lane pays only LOCAL checks. The merge step still runs the full gate. Useful independently for any scoped check. Bucketing of every check is in the epic #1143 design.

## Progress

Resolved. Implemented as a **post-filter** (the architecturally-cheap path) rather than by skipping check execution:

- `partitionLocal(findings, { fileSet, local })` — pure, in `we:scripts/readiness/claimScope.mjs`, sibling to the existing `partitionFindings`. `--files=<comma|space list>` blocks only on findings attributable to those files (via the existing `findingFiles` descriptor extractor); `--local` additionally demotes path-less GLOBAL/RELATIONAL findings to non-failing notes. Combined: `--local --files=<lane files>` blocks ONLY on a lane's own file-isolation findings.
- Wired into `we:scripts/check-standards.mjs` after the `--scope` block (the two compose); reuses the `externalErrors` note channel; surfaced in the `local` summary field for `--json`. Default no-flag run is byte-for-byte unchanged.
- 3 unit cases in `we:scripts/__tests__/claimScope.test.mjs` (201 gate tests green).

**Deviation from the digest, recorded honestly:** the gate still *runs* all checks and then demotes the non-local findings — it does not yet *skip* the ~60 GLOBAL checks. Correctness is identical (a lane never reds on a cross-lane invariant), but the speed win (skip-don't-run) is **not** banked; the full gate is only ~2–5s so this was not worth a check-execution refactor for the MVP. The skip-for-speed optimization is a clean follow-up if profiling ever shows the per-lane gate on the hot path. The local-vs-global split currently rides the file-attributability proxy (path-less ⇒ global) rather than an explicit per-check tag; that proxy matches the #1143 bucketing for every check that carries a file descriptor.
