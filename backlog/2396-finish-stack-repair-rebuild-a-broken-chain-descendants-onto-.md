---
kind: story
size: 3
parent: "2387"
status: resolved
blockedBy: ["2393", "2394"]
dateOpened: "2026-07-10"
dateStarted: "2026-07-11"
dateResolved: "2026-07-11"
graduatedTo: none
tags: []
---

# finish stack-repair: rebuild a broken chain descendants onto the repaired tip

we:scripts/lane-resume.mjs discover reads stackParents/base; a broken link (red CI or review:changes) buckets its overlap-descendants as blocked-on-it; after the link is repaired, rebuild each descendant onto the repaired tip — fast-forward when the fix touched no shared file, exactly one guided conflict per directly-overlapping descendant (resolved WITH the manifest topology) when it did — updating base and resolving each stackParent landed status via bornAs-on-main. NEVER lands a descendant past an unlanded parent. Tests: a mid-chain review:changes repair re-lands the salvageable tail without a blind rebase of the whole batch.

## Progress

- **Status:** done (pending land)
- **Done** (all in `we:scripts/lane-resume.mjs`, unit-tested in `we:scripts/__tests__/lane-resume.test.mjs`):
  - `readManifest` now also surfaces `stackParents` (the #2387 F3 frontier-tip ids) and keeps `repos[].base`, so `/finish discover` sees a lane's stacked-chain topology. `classifyLane` carries `stackParents` + a `reviewChanges` flag through into each classified lane; `discover` reads PR `labels` and derives `reviewChanges` via the ratified `REVIEW_LABELS.changes` + `hasReviewLabel` (no name re-parsing).
  - `markStackDescendantsBlocked(lanes)` (pure, exported) — a broken link = a red required `test` (`test-red`) OR a `review:changes` bounce; BFS over `stackParents` edges re-buckets every reachable overlap-descendant (transitively) to `blocked`, naming the broken ancestor in the reason. The broken link keeps its OWN disposition (the finisher repairs it in place); an ancestor and a disjoint sibling are never poisoned. Applied in `discover` before `orderByBlockedBy`.
  - `planStackRebuild({repaired, descendants, fixTouched, landed})` (pure, exported) — after the link is repaired, plans re-stacking ONLY the salvageable tail in `stackParents` topological order: `ff` when the repair touched no file the descendant touches, `guided-conflict` (exactly one, resolved with the manifest topology) when it did. NEVER places a descendant past an unlanded parent — a parent that is neither in the repaired chain (`placed`) nor proven `landed` (landedThisPass ∪ `bornAs`-on-main) DEFERS the descendant (absence is never read as landed; positive proof-of-land).
  - `rebuildDescendant({laneRef, ontoSha})` (exported IO) — reuses the proven #2198 `rebaseDropManifest` plumbing UNCHANGED but with `base` = the repaired parent tip, so a clean/manifest-only merge is the fast-forward rebuild and a real conflict surfaces as `guided-conflict` (never force-resolved). `discover --json` now emits `stackParents` + `reviewChanges` per lane.
  - Tests: 13 new (`markStackDescendantsBlocked` poison/ancestor/sibling/red-CI/reason, `planStackRebuild` ff-vs-guided-conflict + never-past-unlanded + landed-parent + topo-across-sweeps, `rebuildDescendant` ff/guided-conflict/error) incl. the required "mid-chain `review:changes` repair re-lands the salvageable tail, not a blind whole-batch rebase". Full gate green: `check:standards` 0 errors; full vitest 215 files / 3117 tests.
- **Review round 1 (PR #427 panel) — fixes:**
  - `classifyLane` carries the RAW `testRed` flag (a blockedBy-masked red-test link is still broken to `markStackDescendantsBlocked`) and gives a `review:changes` bounce its own `review-changes` disposition — a bounced diff can never bucket `ready`/auto-land; `land` also refuses a `review:changes`-labelled PR outright.
  - `markStackDescendantsBlocked` poison reasons name the broken ROOT ancestor (not the BFS predecessor) at every depth.
  - `rebuildDescendant` guards `ontoSha` with `/^[0-9a-f]{7,40}$/i` — branch-controlled manifest content can never inject git options.
  - CLI wiring: `rebuild-plan --spec=<file>|-` (plans via `planStackRebuild`; `landed` omitted → DERIVED from bornAs-on-main via the new `deriveLandedFromMain`; numeric NNN = post-land by JIT numbering #2288) and `rebuild <laneRef> --onto=<sha>` (executes `rebuildDescendant`); both documented in the `/finish` skill — the rebuild half is reachable and the bornAs-on-main landed resolution is implemented, not just documented.
- **Review round 2 (PR #427 panel) — fixes:**
  - `resolvedOnMain` verifies `status: resolved` INSIDE the frontmatter block (`readField` on the located file), never anywhere in the file — an open item whose body carries a fenced `status: resolved` example can no longer spoof proof-of-land (regression test added).
  - `graduatedTo: none` stamped here (resolved story, produced no entity).
  - `remoteManifestApiArgs` hoisted to the shared `we:scripts/lib/remote-manifest.mjs` (one argv for the drain and `/finish`; both former homes re-export it, tests' import sites unchanged).
- **Next:** land via the drain.
