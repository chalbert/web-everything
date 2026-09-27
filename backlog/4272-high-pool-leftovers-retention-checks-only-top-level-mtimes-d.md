---
bornAs: xw3a9nd
kind: task
parent: "4075"
status: open
scope: ["we:scripts/lib/pool-leftovers.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# HIGH: pool-leftovers retention checks only top-level mtimes, deleting directories with fresh nested files

HIGH — can lose data (the reviewer's own impact rating is "unrecoverable"). Still-open Codex advisory finding from chalbert/web-everything#2788 (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-27). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — code is UNCHANGED, finding still applies.

FINDING: we:scripts/lib/pool-leftovers.mjs's newestMtime(path, isDir, isGit) only inspects the directory's OWN immediate children (a single readdirSync(path) pass, bumping each child's own stat mtime) — it never recurses into grandchildren or deeper descendants. A scratch/leftover directory whose top-level entries (and the directory's own lstat) have gone stale, but which contains a nested subdirectory holding a file that was genuinely edited recently, is still classified as older than the retention window (LEFTOVER_MAX_AGE_DAYS) by sweepPoolLeftovers, because the recent activity never bubbles up past the first level. The sweep then recursively rmSyncs the whole directory tree, including that recently-edited nested file, with no salvage step for pool-leftovers content at all.

EVIDENCE: read newestMtime directly off origin/main in we:scripts/lib/pool-leftovers.mjs — the isDir branch still only does `for (const c of readdirSync(path)) if (c !== '.git') bump(join(path, c))`, one level deep, with no recursive descent into subdirectories.

PREVENTION (from the reviewer, still owed): add a filesystem integration test with old ancestor/top-level mtimes and a genuinely fresh nested file several levels down, requiring the directory to be classified as recently active (either by recursively inspecting descendant activity, or by conservatively refusing to age out a directory whose full depth was not inspected).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
