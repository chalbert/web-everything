---
kind: story
size: 3
parent: "800"
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal:visual-baselines-bloat-git"
dateOpened: "2026-06-29"
tags: [visual-regression, baselines, git-weight, storage, deferred]
relatedProject: webdocs
---

# graduate visual baselines off committed-PNG when churn weight warrants (LFS to keep-current-plus-N GC to tiered retention)

The #1966 visual-regression guard commits PNG baselines straight to git — deliberately the cheapest bootstrap
(#799 option-C). That's fine at small scale, but **PNGs don't delta**, so every re-baseline stores a full
fresh copy in history forever (linear growth in churn × size). **Parked until that weight is a real pain**
(slow clone, LFS-quota, heavy history) — don't pre-build. When it triggers, move baselines off committed-PNG
along this ladder (cheapest first; each rung is independently sufficient — stop at the first that holds):

1. **Shrink + slow churn first (free, no migration):** make `home` viewport-only (not `fullPage`) and run
   baselines through `oxipng`; mask more dynamic content so re-bakes happen only on real look changes. Often
   defers the problem indefinitely.
2. **Git LFS:** `git lfs migrate import --include="*.png"` — pointers in git (repo stays small), blobs in the
   LFS store, clone pulls only checked-out versions. Append-only though: total LFS storage still grows one
   full copy per re-bake.
3. **Bound the count (the 90% fix):** keep only the *current approved* baseline + last N, GC superseded ones
   — what a baseline service does by default. Needs a side store (separate repo shallow-cloned by the test
   harness, or object store) since git/LFS won't GC old versions without a history rewrite.
4. **Tiered retention (only if visual-DRIFT auditing ever matters):** GFS/backup-style — all recent, then
   1/month, then 1/year — turns linear growth into ~log. Cheap on an object store + a restic-style prune;
   clunky on raw git history (each prune is a rewrite). Overkill for a pure regression guard.
5. **Hosted service (the #799 endgame):** the plateau-app visual-regression service owns baseline storage +
   diff-review UI + auto-GC; binaries leave the WE repo entirely. Build when page coverage / churn justifies it.

Only the **current** baseline is load-bearing (tests compare against it); all older versions are purely
forensic (drift history, bisecting a slow visual change) — which is why aggressive trimming/GC is safe.

## Done when
Visual baselines no longer grow WE's git weight unboundedly — landed at whichever rung the trigger justified
(most likely 1+3), with the heavier rungs (4/5) still deferred to their own trigger.
