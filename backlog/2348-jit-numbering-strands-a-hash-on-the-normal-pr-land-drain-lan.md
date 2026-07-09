---
kind: story
size: 3
parent: "2289"
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: none
tags: []
---

# JIT numbering strands a hash on the normal pr-land drain land route (not just --fallback-git)

A second JIT-numbering bypass route, distinct from the --fallback-git one #2322 closed. This session scaffolded a fresh hash-id item mid-decision-session and landed it via the NORMAL we:scripts/pr-land.mjs enqueue then drain path (PR #262); it landed on main STILL hashed (2347), tripping the #2319 hash-on-main invariant gate and forcing a manual we:scripts/backlog.mjs number-stranded (→ #2347, PR #264). So the drain's numberPendingHashes did not number a hash born outside the batch/manifest flow. Fix: number at land on EVERY route (scan the landing diff for non-numeric leading ids, not just a pending registry), or assert pre-merge in pr-land so a hash never reaches main. Repro: this session. relatedTo #2288, #2319, #2322.

## Progress
- **Status:** resolved — landed via lane → PR.
- **Root cause:** /pr's single-couple fast drain (we:scripts/merge-ai-prs.mjs, shelled by we:scripts/pr-land.mjs) runs FROM the lane clone, which sits on a DETACHED HEAD (the #2183 clone model never checks out a local `main` branch there). The existing post-merge sync (`git pull --ff-only --autostash`) needs an ATTACHED branch with an upstream, so on a lane clone it always errored and silently left `localSynced` false — yet the JIT-numbering (`numberPendingHashes`) and derived-regen steps ran anyway, against cwd's STALE tree (the lane's own pre-merge tip, lineage-disconnected from the just-created `origin/main` merge commit). Their `git push origin HEAD:main` was then a non-fast-forward (HEAD is an ANCESTOR of the real tip, never a descendant) the remote silently rejected — the numbering commit was made locally but never reached main, stranding the hash exactly as #2347 showed.
- **Fix:** new `resyncDetachedCwdForLand` (we:scripts/merge-ai-prs.mjs) — when cwd is genuinely DETACHED (never an attached branch, so the primary's own dirty/diverged warn-only path is untouched), carries no TRACKED local edits (never resets a dirty tree), AND HEAD is already an ancestor of `origin/main` (a #2170 self-review catch — a lane clone can carry MORE local commits than the couple this pass just landed; without this check `checkout --detach` would silently orphan an unpushed commit, verified live against this very lane during review), it fetches + `checkout --detach origin/main` before JIT numbering/regen run, so they operate on — and can fast-forward-push from — the true just-merged tip. Shares `isPostLandTreeDirty`, relocated to we:scripts/lane-drain.mjs as the single source (we:scripts/pr-land.mjs now re-exports it; both we:scripts/pr-land.mjs and we:scripts/merge-ai-prs.mjs import it from there — no cross-import cycle).
- **Tests:** 9 new cases for `resyncDetachedCwdForLand` in we:scripts/__tests__/merge-ai-prs.test.mjs (not-applicable/already-synced no-ops, attached-branch left untouched, detached+clean resyncs, untracked-only cruft doesn't block, tracked-dirty skips never fetch, unpublished-commits guard never checks out, fetch/checkout failure reported not thrown). Full suite green (check:standards 0 errors, npm test -- run 2635 passed).
- **Next:** none — resolved.
