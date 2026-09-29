---
bornAs: xx3wmcg
kind: task
parent: "4075"
status: resolved
scope: ["we:scripts/lib/lane-salvage.mjs", "we:scripts/lib/salvage-index.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "bc6f437771ce61f9eec92149f36211cec7531cc1"
tags: []
---

# HIGH: unregistered files under lane .claude/worktrees are excluded from salvage but deleted by reclaim

HIGH — can lose data (the reviewer's own impact rating is "unrecoverable"). Still-open Codex advisory finding from chalbert/web-everything#2788 (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-27). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — code is UNCHANGED, finding still applies.

FINDING: we:scripts/lib/lane-salvage.mjs's listLitterWorktrees enumerates only REGISTERED git worktrees physically under a lane's .claude/worktrees/ (via git worktree list --porcelain), and its dirtyPaths/newestContentMtimeMs/salvage snapshot logic only walks the lane's own working tree plus those registered worktrees. An ordinary, non-ignored, non-git file or directory that ends up directly under .claude/worktrees/ WITHOUT being a registered worktree (stray leftover litter) is invisible to all of that — it is never snapshotted, never bundled, never counted toward salvage. we:scripts/lane-pool.mjs's lane reset/reclaim path runs git clean -fd on the lane, which (a single -f, unlike -ffd) skips directories that are themselves nested git repos (a real registered worktree has its own .git file and is protected this way) but does NOT skip an ordinary non-git directory or file sitting in the same .claude/worktrees/ location — git clean -fd deletes it outright, with no salvage bundle ever having captured it.

EVIDENCE: read we:scripts/lib/lane-salvage.mjs's listLitterWorktrees/dirtyPaths/snapshotWorkTree directly off origin/main — worktree discovery is still scoped to git worktree list --porcelain output only; grepped we:scripts/lane-pool.mjs for its git clean -fd call sites on lane reset/reclaim — none passes an exclude pathspec or otherwise special-cases .claude/worktrees/ for a non-git leftover.

PREVENTION (from the reviewer, still owed): add a deterministic reclaim integration test that places an unregistered ordinary file/directory beneath .claude/worktrees/ and requires its recovery from the bundle after cleanup — i.e. either snapshot unregistered content under that prefix too, or refuse to git clean it until it is accounted for.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
