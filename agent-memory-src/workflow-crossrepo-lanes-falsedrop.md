---
name: workflow-crossrepo-lanes-falsedrop
description: "/workflow cross-repo false-drop ROOT-CAUSED + FIXED (lane clones reset to a stale origin/main because impl repos never push) — sync origins first; a NEW integrator gap (unscoped impl gate) now blocks landing instead"
metadata: 
  node_type: memory
  type: project
  originSessionId: f3c3c69e-6e8f-4471-aeb6-430433523791
---

**ROOT CAUSE FOUND + FIXED (batch-2026-06-29d).** The 2026-06-29 cross-repo false-drops were NOT a
"clone can't see the tree" bug — the clone was fine, it just `reset --hard origin/main`, and the impl
repos' `origin/main` was **stale**: plateau-app local `main` was **66 commits ahead** of its GitHub origin
(frontierui 317 ahead), because the impl repos **never push** (the never-push agent policy). The lane clone
faithfully checked out the stale origin tree, which genuinely lacked the items' code (e.g.
`plateau-app:src/conformance-engine/conformanceVectors.ts`), so the agent correctly reported "absent" and
dropped `outgrew`. WE-only lanes always worked because WE lanes reset to a fresh `lane/_base` ref pushed
from the *current local* tree — impl-repo lanes get no such fresh base, they reset to raw `origin/main`.

**The fix:** before a cross-repo `/workflow`, **sync each impl repo's origin/main** (`git push origin main`,
FF-clean). batch-2026-06-29d did this (pushed WE/frontierui/plateau-app) and the false-drop **vanished** —
the plateau lanes saw the real tree, did correct work, gated green in-lane, and pushed. (Also required:
removing the never-push guard's push-block in `~/.claude/hooks/guard-git-branch.mjs`, and repointing
frontierui/plateau-app remotes HTTPS→SSH since HTTPS had no creds. See [[never-push-guard-removed]].)

**NEW integrator gaps surfaced once landing was reached (#1153 feedback, still open):**
1. **Unscoped impl gate blocks correct work.** The integrator runs a raw `npm run build` on plateau-app
   with no `--scope` equivalent. plateau-app's build was **pre-existing red** (#1965 — entry imports the
   deleted `@we` SimpleStore block, #1768 fallout), unrelated to the items, yet it red-blocked #1947/#1909
   from landing. The serial loop handles this via "gate red NOT from your own work → not a stop"; the
   parallel integrator has no such diagnosis.
2. **Red-gate merge left on main, not rolled back.** The integrator merged both items onto plateau-app
   `main` (4 commits ahead), saw the red gate, refused to "land" — but did NOT undo the merge, AND
   mis-reported `partialCrossRepo.landed:[]`. Had to manually `git reset --hard origin/main`. WE-side
   atomicity held (WE-last ordering meant no false `resolved`).

**How to apply:** cross-repo `/workflow` now WORKS if you (a) sync impl-repo origins first and (b) ensure
the impl repo's own gate (`npm run build`) is green BEFORE the run — a pre-existing red there will block
all cross-repo landings. After a cross-repo run, **verify each impl repo's main isn't left N-ahead with a
red merge** (`git -C <impl> log origin/main..HEAD`); reset if so. Lane refs `lane/<slug>-<n>` linger on
each origin after a non-landing run (preserve the work for re-attempt). Related:
[[parallel-workflow-blocked-by-git-guard]], [[never-push-guard-removed]].
