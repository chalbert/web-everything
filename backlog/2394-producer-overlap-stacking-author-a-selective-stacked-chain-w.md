---
kind: story
size: 5
parent: "2387"
status: resolved
blockedBy: ["2389", "2393", "2386"]
dateOpened: "2026-07-10"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
graduatedTo: none
tags: []
---

# Producer overlap-stacking: author a selective stacked chain with a push-time safety re-check

In we:.claude/skills/batch-backlog-items, build per-repo overlap chains via union-find on each item DECLARED locus file-set: an overlapping item bases (via lane-pool --base) on the open chain frontier tip and extends it; a provably-disjoint item stays a sibling off origin/main; a bridging item merges two chains tips in-session and records both stackParents. AT PUSH recompute the actual touched files (git diff --name-only base...head) and assert actual is a subset of declared; on violation rebase onto the overlapping chain frontier IN-SESSION and re-resolve before pushing (never certify a mislabelled sibling to the deferred drain). Cap chain depth (fall back to siblings past the cap). Stack ONLY when the durable capability marker read off origin/main advertises gate support; default hard to siblings on any read failure or version mismatch. Write stackParents+base into the manifest. E2e: a 3-item batch with one shared file lands with zero conflict-rebases; a disjoint item lands independently; an under-declared item is caught at push and rebased in-session, not shipped as a sibling.

## Progress

- **Status:** done (pending resolve)
- **Branch:** `lane/2394-producer-overlap-stacking` (lane-2)
- **Done:**
  - we:scripts/readiness/overlap-chain.mjs — the PURE planner (the we:scripts/readiness/lane-partition.mjs precedent): incremental union-find chaining on declared repo-qualified file-sets (sibling / stack-on-frontier / bridge with both `stackParents`), depth cap (default 4) with sibling fallback + chain re-root, capability gate defaulting hard to siblings, push-time `actual ⊆ declared` re-check (verdicts clean / undeclared-disjoint / rebase-required) + `applyRebase` repair, `recordPushed` frontier/tip tracking, `dropItem`. JSON-serializable plan state.
  - we:scripts/readiness/__tests__/overlap-chain.test.mjs — 14 unit tests, green.
  - we:scripts/lane-stack.mjs — the CLI boundary: `init` (capability read off origin/main via `git show`, #2393 marker), `plan-item`, `recheck` (runs the `git diff --name-only base...HEAD`; exit 4 = rebase-required, the never-push gate), `apply-rebase`, `record`, `drop`; plan persists to a scratch JSON between seams.
  - we:scripts/__tests__/lane-stack-e2e.test.mjs — 4 e2e tests on a real local bare origin, green: (1) 3-item chain sharing one file lands with zero conflict-rebases (each `merge --no-ff` clean; sibling counterfactual conflicts); (2) disjoint item lands independently; (3) under-declared item caught at push (exit 4), rebased in-session onto the frontier, `stackParents` recorded, never shipped as a sibling; (4) marker-less origin → `supported:false`.
  - we:.claude/skills/batch-backlog-items/SKILL.md (source we:skills-src/batch-backlog-items/SKILL.md) — new "Overlap-stacked serial batch (#2394 — serial `/batch` only)" section: seam wiring (init at pack → plan-item before acquire → acquire `--base` → recheck before pr-land → manifest `--stack-parent`/`--base` → record/drop), three invariants, `/workflow` scoping note.
  - Full gate green: `check:standards` 0 errors; full vitest suite 213 files / 3038 tests passed.
- **Next:** resolve.
- **Notes:** stacking is serial-`/batch`-only; `/workflow` untouched. Manifest fields ride the existing #2389 `--stack-parent`/`--base` flags; drain unchanged (#2393 gate already live on main).
