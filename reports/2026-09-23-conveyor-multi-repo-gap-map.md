# Conveyor multi-repo gap map — 2026-09-23

Research-only audit (Opus, read of `main` + the `lane/mechanical-dispatcher` branch + live daemon logs), run after
plateau-app PRs #170/#171 sat at `review:changes` with nothing ever fixing them. Operator directive: "we need real
multi repo support". Tracked as the epic filed alongside this report.

## Stage × repo

Key: ✅ works · ◐ partial · ⛔ refused · ⚠ silently wrong

| Stage | WE | FUI | plateau | Failure mode |
|---|---|---|---|---|
| Build dispatch (tick-core / dispatch-lane) | ✅ | ◐ | ◐ | Items live only in the WE backlog; FUI/plateau work ships as a "couple" (impl-repo PR + WE PR). Free-lane capacity counts only the WE pool (`we:scripts/conveyor/tick-core.mjs:1472`). No `{{LOCUS}}`/`{{GATE}}` in the brief. Locus is guessed from tags (`we:src/_data/backlog.js:91-98`), so plateau items resolve to `locus=webeverything` — the wrong gate. |
| Review (review-daemon → review-dispatch) | ✅ | ✅ | ◐ | Loops all repos; lanes from the right pool. Live: plateau reviews dispatched then went `review-status:review-stalled`. |
| Review, mechanical wrapper (branch only) | ✅ | ⚠ | ⚠ | Session slug without repo, `acquireLane` without `--repo` — a FUI/plateau review would run in a WE lane (#3908). |
| Fix dispatch | ✅ | ⛔/⚠ | ⛔/⚠ | Daemon never looks beyond WE; the pass refuses non-WE as `unsupported-repo` (`we:scripts/conveyor/reconcile-fix-dispatch.mjs:590-598`). Lifting that alone still fails: item-less branches refused, renamed cards orphaned, fallback scope tagged `we:`, WE lanes, WE-shaped brief. |
| CI-heal | ◐ | ⚠ | ⚠ | Reconcile marks `ci-red` "owed elsewhere"; the tick heals only its own WE launches; `we:scripts/operations/ci-heal-pr-dispatch.mjs` has no caller. Red CI on FUI/plateau is never healed, nothing recorded. |
| Verify | ✅ | ✅ | ✅ | Gate picked from the target repo's package manifest — but that is a second gate definition, apart from `LOCI`. Verify daemon not running live. |
| Rearm / stand-down / ci-heal-mark | ✅ | ◐ | ◐ | Accept `--repo`, but the fix briefs run them by relative path after `cd "$LANE"` with no `--repo` — in a plateau lane the scripts don't exist. |
| Drain | ✅ | ✅ | ✅ | All three by default. Repo names hardcoded a second time. Landing a WE half renumbers a card's xid, orphaning the still-open plateau branch that names it. |
| Watchers | ✅ | ◐ | ◐ | Some per-repo, some WE-only by design. With the runner (`we:skills-src/conveyor/runner.mjs`) down, conflict/progress watch + advisory sweep run for no repo. |
| Lane acquisition | ✅ | ◐ | ◐ | Pools exist per repo; fix, CI-heal, the wrapper and tick capacity use only the WE pool; lease-reaper matches only WE session names. |
| PR → backlog item | ✅ | ⚠ | ⚠ | Only `lane/<num|xid>-…` branches parse; `findItem` matches `num` only, never `bornAs`; `lane/wip-*` maps to nothing. There is no plateau backlog — plateau work is WE items with `plateau:` scope. |
| Session naming | ✅ | ◐ | ◐ | The CI-heal PR dispatcher and the review wrapper omit the repo. |
| Staleness | ✅ | ⚠ | ⚠ | `assertMainNotStale` guards the dispatcher's WE code but fix runs it only when `repoKey==='we'` — the wrong condition. |
| Credentials | ✅ | ✅ | ✅ | GitHub App (#3881) must stay installed on all three repos. |

## Root causes

1. **"A PR is a WE backlog item"** — branch-name lookup by `num` only; scope falls back to `we:`; locus guessed.
2. **"The tools' repo is the target repo"** — briefs run WE scripts by relative path inside the lane; lanes from the cwd's pool.
3. **"The gate is WE's"** — fix/CI briefs say `check:standards`; the gate is defined twice (`LOCI` and verify's `composeGate`).
4. **~Five repo vocabularies** (key, slug, `LOCI` key, scope prefix, slug tag), plus private copies of the repo table in several files.
5. **Each caller owns its repo loop** — review daemon loops, fix daemon doesn't; every new daemon must remember.

## Proposed design

- **A. Repo profile** in `we:scripts/lib/constellation-repos.mjs`: `repoProfile(keyOrSlugOrPrefix)` → key, slug, slugTag,
  checkoutPath, lanePoolRepo, scopePrefixes, canonicalPrefix, capabilities `{review, fix, ciHeal, build:'couple'}`;
  `gateFor(repo)` reusing verify's `composeGate` (one gate source). `LOCI` becomes a view over it.
- **B. PR → work-unit resolver** (new `we:scripts/conveyor/pr-work-unit.mjs`): `(repoKey, pr)` →
  `{attribution: item|pr, itemNum?, scope (canonical prefix), gate}`; `findItem` also matches `bornAs`; item-less
  PRs attributed to the PR with diff scope.
- **C. One repo-aware brief contract**: `{{REPO}}`, `{{LANE_REPO}}`, `{{GATE_COMMAND}}`, `{{WE_ROOT}}`,
  `{{ATTRIBUTION}}`; every tool call `node "{{WE_ROOT}}/scripts/…" --repo={{REPO}}`; a lint that fails a relative
  `node scripts/` after `cd "$LANE"`.
- **D. One repo loop** — `forEachRepo(fn)` with per-repo failure isolation, used by every daemon.
- **E. Capability-gated refusal** — `unsupported-repo` only when a profile lacks the capability.

## Decisions (on the decision card)

1. Replace #3803 Fork 5's "not WE" refusal with "profile lacks the fix capability" once B/C/E land — **recommended**.
2. Backlog stays one WE backlog with repo-prefixed scope — **recommended**.
3. Fix PRs with no backlog item: attribute to the PR, scope from the diff — **recommended**.
4. A plateau fix runs the target repo's gate (from the profile), plus WE `check:standards` only when it touches a WE half — **recommended**.
5. CI-heal triggers for every repo's `ci-red`, capped by the durable heal-mark count — **recommended**.
6. Land slices 1–4 before #3908's port; slice 5 after it (or inside it if its HOLD lifts) — **recommended**.

## Also noticed

- Review daemon logged `spawnSync claude ENOENT` for FUI.
- Plateau reviews #174-177/#181 went `review-status:review-stalled` after dispatch.
