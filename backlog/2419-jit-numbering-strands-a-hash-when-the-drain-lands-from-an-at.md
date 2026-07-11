---
bornAs: x1m25ov
kind: story
size: 3
status: resolved
dateOpened: "2026-07-10"
dateStarted: "2026-07-11"
dateResolved: "2026-07-11"
graduatedTo: lane-pool.mjs acquire (checkout -B, never leaves HEAD on a stray lane/* branch) + merge-ai-prs.mjs resyncDetachedCwdForLand (widened to rescue an attached stale lane/* branch too)
tags: [drain, numbering, lane-pool, bug]
---

# JIT numbering strands a hash when the drain lands from a lane left on a STALE `lane/*` branch

When `/pr`'s single-couple drain lands a **hash-born** item from a pool lane whose HEAD sits on a **stale `lane/*` branch** (not cleanly on `main`), the post-merge sync can't reach the just-merged tip, so `numberPendingHashes` (`we:scripts/lane-drain.mjs`) commits the hash→NNN on the **wrong parent** and its `git push origin HEAD:main` is a silent non-ff — the item lands on `main` **still hash-keyed**. #2348 fixed this for a **detached** cwd (`resyncDetachedCwdForLand` `checkout --detach origin/main` before numbering); it does **not** rescue a lane attached to a stale `lane/*` branch, so the strand recurs on that route.

**A/B evidence (this session, 2026-07-10) — the disambiguator:**
- **#2418 STRANDED.** Hash-born epic `xq5aks4` landed via `merge-ai-prs --only=388` from lane-3, which was sitting on a leftover `lane/file-2417` branch (from an earlier drain's rebase-drop). Post-merge `pull --ff-only` couldn't advance, numbering committed on the pre-merge tip, push was a silent non-ff → landed hash-keyed. Manual recovery: `git reset --hard origin/main` + re-run `numberPendingHashes` + `MAIN_PUSH_OK=1 git push origin HEAD:main` (→ #2418). That override push is the "not through the drain" bypass to eliminate.
- **#2419 numbered CLEANLY.** Filing *this very item* landed `2419→#2419` from lane-5, which was freshly, cleanly attached to `main` at `origin/main`. Post-merge `pull --ff-only` fast-forwarded, numbering ran on the merged tip, ff-push succeeded — **no manual step**.

So the culprit is specifically the **stale `lane/*` branch**, *not* attachment per se: an attached-but-clean-`main` lane numbers fine (#2419 proves it). This corrects an earlier framing of this bug that blamed attached HEADs in general.

**Causes, in priority order:**
1. **The lane pool leaves a lane on a stray `lane/*` branch (primary).** `acquire` reset the working tree to `origin/main` content but left HEAD attached to a leftover `lane/file-2417` from a prior rebase-drop. Same root as every "local main NOT fast-forwarded (diverged)" warning this session. `acquire`/`release` should always return a lane to a clean, well-known state (on `main` ff'd to `origin/main`, or detached at `origin/main`) — never a stray `lane/*` tip. Recover a stray with `git branch -f main <tip>` (the guard's sanctioned move), never a manual checkout.
2. **`resyncDetachedCwdForLand` is detached-only (secondary backstop).** Even with a clean pool, it should also rescue a lane whose HEAD is on a stale `lane/*` branch that is an ancestor of `origin/main` — ff local `main`/resync to the merged tip before numbering — so the land route, not the HEAD shape, decides whether to resync.

## Definition of done
- A hash-born item landed via `/pr`'s single-couple drain from a pool lane — **including one that started on a stale `lane/*` branch** — is numbered on `main` with **no manual `MAIN_PUSH_OK` push**; numbering ff-pushes through the drain's own `publishMain`.
- `acquire` leaves the lane in a clean, documented HEAD state; a stray `lane/*` tip from a prior rebase-drop is recovered (`git branch -f main <tip>`), never left attached.
- Regression test: numbering from a cwd on a stale `lane/*` branch (ancestor of `origin/main`) resyncs and ff-pushes (mirror the 9 detached-cwd cases #2348 added).

relatedTo #2348 (detached-route fix this extends), #2318 (duplicate-NNN tripwire), #2290 (drain = sole serial writer), #2391 (numbering mutex), #2418 (main-loop-as-coordinator — surfaced by the same drain-session introspection).

## Next
- none — ready to slice/build.
