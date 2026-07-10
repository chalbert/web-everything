---
kind: story
size: 3
status: open
dateOpened: "2026-07-10"
tags: [drain, numbering, lane-pool, bug]
---

# JIT numbering strands a hash when the drain lands from an ATTACHED lane-pool branch (not just a detached HEAD)

#2348 closed the JIT-numbering strand for a **detached** cwd (`resyncDetachedCwdForLand` in `we:scripts/merge-ai-prs.mjs` `checkout --detach origin/main` before `numberPendingHashes`, so its `push origin HEAD:main` fast-forwards). But it fires **only when cwd is detached** — an attached branch is left on the warn-only path. A **lane-pool lease (`we:scripts/lane-pool.mjs`) comes up ATTACHED** (its `reset --hard` keeps HEAD on `main`, or on a leftover `lane/*` branch from a prior rebase-drop), so the resync never fires and the hash strands again — on a route #2348 doesn't cover.

**Repro (this session, 2026-07-10):** a hash-born epic (`xq5aks4`) landed via `/pr` → single-couple drain (`merge-ai-prs --only=388`) from a leased pool lane sitting on a stale attached `lane/file-2417` branch. It merged as PR #388 but landed on `origin/main` **still hash-keyed**; `numberPendingHashes` committed `xq5aks4→#2418` locally on the pre-merge tip and its `git push origin HEAD:main` was a silent non-ff — the same strand. Recovery was manual: reset the lane to `origin/main`, re-run `numberPendingHashes`, and `MAIN_PUSH_OK=1 git push origin HEAD:main` by hand (→ #2418). The manual override push is the exact "not through the drain" bypass we want to eliminate.

**Two coupled causes:**
1. **`resyncDetachedCwdForLand` is detached-only.** It should also resync an **attached-but-not-`main`** lane branch (a `lane/*` clone tip) — and, for a pool lane attached to `main`, fast-forward local `main` to the merged tip — whenever cwd is clean and HEAD is an ancestor of `origin/main`, before numbering. The land route, not the HEAD-attachment shape, should decide whether to resync.
2. **The lane pool leaves a lane on a stale branch.** `acquire` reset the working tree to `origin/main` content but left HEAD attached to a leftover `lane/file-2417` branch from a prior rebase-drop. This is the same root that produced every "local main NOT fast-forwarded (diverged)" warning this session. `acquire`/`release` should return a lane to a clean, well-known state (detached at `origin/main`, or a fast-forwarded `main`), never a stray `lane/*` tip.

## Definition of done
- A hash-born item landed via `/pr`'s single-couple drain **from a pool lane** (attached, incl. a leftover `lane/*` branch) is numbered on `main` with **no manual `MAIN_PUSH_OK` push** — the numbering fast-forwards through the drain's own `publishMain`.
- `acquire` leaves the lane in a clean, documented HEAD state; a stray `lane/*` tip from a prior rebase-drop is recovered (`git branch -f main <tip>`), never left attached.
- Regression test: numbering from an attached-branch cwd resyncs and ff-pushes (mirror the 9 detached-cwd cases #2348 added).

relatedTo #2348 (detached-route fix this extends), #2318 (duplicate-NNN tripwire), #2290 (drain = sole serial writer), #2391 (numbering mutex), #2418 (main-loop-as-coordinator — surfaced by the same drain-session introspection).

## Next
- none — ready to slice/build.
