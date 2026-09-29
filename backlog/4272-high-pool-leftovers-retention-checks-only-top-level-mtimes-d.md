---
bornAs: xw3a9nd
kind: task
parent: "4075"
status: resolved
scope: ["we:scripts/lib/pool-leftovers.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
tags: []
---

# HIGH: pool-leftovers retention checks only top-level mtimes, deleting directories with fresh nested files

HIGH — can lose data (the reviewer's own impact rating is "unrecoverable"). Still-open Codex advisory finding from chalbert/web-everything#2788 (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-27). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — code is UNCHANGED, finding still applies.

FINDING: we:scripts/lib/pool-leftovers.mjs's newestMtime(path, isDir, isGit) only inspects the directory's OWN immediate children (a single readdirSync(path) pass, bumping each child's own stat mtime) — it never recurses into grandchildren or deeper descendants. A scratch/leftover directory whose top-level entries (and the directory's own lstat) have gone stale, but which contains a nested subdirectory holding a file that was genuinely edited recently, is still classified as older than the retention window (LEFTOVER_MAX_AGE_DAYS) by sweepPoolLeftovers, because the recent activity never bubbles up past the first level. The sweep then recursively rmSyncs the whole directory tree, including that recently-edited nested file, with no salvage step for pool-leftovers content at all.

EVIDENCE: read newestMtime directly off origin/main in we:scripts/lib/pool-leftovers.mjs — the isDir branch still only does `for (const c of readdirSync(path)) if (c !== '.git') bump(join(path, c))`, one level deep, with no recursive descent into subdirectories.

PREVENTION (from the reviewer, still owed): add a filesystem integration test with old ancestor/top-level mtimes and a genuinely fresh nested file several levels down, requiring the directory to be classified as recently active (either by recursively inspecting descendant activity, or by conservatively refusing to age out a directory whose full depth was not inspected).

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/pool-leftovers.test.mjs` fails on unfixed
   `newestMtime` (a scratch dir with stale top-level entries but a fresh file several levels down is
   wrongly classified `delete`) and passes after `newestMtime` recurses into every descendant instead of
   only the directory's own top-level children.

## Progress

- `newestMtime` in `we:scripts/lib/pool-leftovers.mjs` now recurses into every descendant directory
  (skipping `.git`) instead of inspecting only the top-level children, so a genuinely fresh file several
  levels down bubbles up and keeps the whole tree from being aged out.
- Added `we:scripts/lib/__tests__/pool-leftovers.test.mjs`: a real-filesystem integration test through
  `sweepPoolLeftovers` proving (a) a dir with stale top-level entries but a fresh deeply-nested file is
  kept (reproduced red pre-fix, green post-fix), and (b) a dir stale all the way down is still deleted as
  before.
