---
kind: task
parent: "3383"
status: resolved
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
dateResolved: "2026-09-23"
tags: []
---

# lane-pool: recycle squash-merged-ahead and litter-only-dirty lanes at acquire/list time

The plateau-app lane pool reads 0 acquirable lanes even with several clean lanes sitting idle, because
`aheadIsProvablyPushed` only proves an "ahead" lane safe via ANCESTRY (`rev-list --not <remoteShas>`), which
never recognizes a squash/rebase-merged commit (a same-patch, different-SHA commit on `origin/main`) —
`git cherry origin/main HEAD` shows `-` (already applied) for these, but ancestry can't see it. Separately,
several lanes are misread as dirty solely because of untracked agent-scratch litter
(`we:.pr-body-*.md`, `we:.open-pr*.json`, `we:.pr-land-result.json`, `we:.converge-*`) that delivery/converge
briefs write into the lane root — real dirt (tracked edits, non-allowlisted untracked files) must stay fully
protected. This item extends `aheadIsProvablyPushed` with a patch-equivalence fallback, extends the shared
`we:scripts/lib/lane-litter.mjs` allowlist with the newly-observed scratch patterns, and applies both relaxations
consistently at every acquire-time decision point (`acquire`'s auto-pick, its pre-reset re-verify, and the
read-only `list --acquirable` / `provision --acquirable` picker), so a lane the picker reports acquirable is
exactly one `acquire` will actually take.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/lane-pool*.test.mjs we:scripts/lib/__tests__/lane-litter.test.mjs`
   passes, covering: an ahead lane whose commit is patch-equivalent (not ancestor) to a live remote head is
   treated as provably-pushed; an ahead lane with a real `+` (unpushed) commit stays protected; a lane whose
   only dirt is allowlisted litter is treated as clean at acquire/list time; a lane with litter PLUS a real
   tracked/untracked change stays dirty; `list --acquirable` and `acquire`'s auto-pick agree on the same
   lanes (no divergence between the picker and the actor).
2. Read-only, against the live plateau-app pool (`list --acquirable --repo=<plateau-app checkout>`): lanes
   6/10/12/14 (squash-merged-ahead, otherwise clean) and the litter-only-dirty lanes (2/4/9, and 7 once its
   converge litter matches the extended allowlist) read acquirable; lanes 3/8 (real uncommitted source edits)
   still do not.
