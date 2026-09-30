---
bornAs: x3bt7x7
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/build-dispatch-policy.mjs", "we:scripts/conveyor/build-dispatch-claim.mjs", "we:scripts/conveyor/fix-dispatch-claim.mjs", "we:scripts/readiness/overlap-chain.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/conveyor/fix-claim-store.mjs"]
dateOpened: "2026-09-27"
preparedDate: "2026-09-29"
preparedAgainstSha: "f78f36733292bf3b20b80da2c345658d15e497bc"
tags: []
---

# Build daemon stacks or serializes items with overlapping declared scope

we:scripts/conveyor/build-dispatch-policy.mjs already declares a hot-file/scope-vs-open-prs rule (no two in-flight builds share a file), but enforces it ad hoc (firstScopeOverlap/pathsOverlap against open PRs) rather than through the same planner we:scripts/readiness/overlap-chain.mjs already uses for serial-batch lane stacking, and it never reasons jointly with FIX dispatch's own claim store (we:scripts/conveyor/build-dispatch-claim.mjs and we:scripts/conveyor/fix-dispatch-claim.mjs are separate, independently-keyed claim stores), so a build and a fix can be dispatched concurrently against overlapping declared scope with nothing to stop them. Reuse we:scripts/readiness/overlap-chain.mjs's pure chain/overlap planner (createStackPlan/planNextItem/overlappingChains) as the shared overlap check across BOTH build and fix dispatch, so two concurrent items (build+build, fix+fix, or build+fix) with overlapping declared scope stack or serialize instead of racing. Note: an item with no declared scope is already unshaped-no-scope by design (operator has flagged this as known); this card only strengthens the check where scope IS declared, and the operator expects scope handling to keep getting stricter as the build daemon takes on more work.

## Premise check (2026-09-29, against current `main`)

Still true, but narrower than the title. `git log --grep=4295` finds no delivery; a grep of `firstScopeOverlap` shows:
- **build+build is already serialized**: we:scripts/conveyor/build-dispatch-policy.mjs:296-311 holds a candidate as `scope-vs-open-prs` (vs `pr.files`) or `hot-file` (vs `running` + `picked`; running scope comes from build claims' `meta.scope`, we:scripts/conveyor/build-dispatch-claim.mjs:65).
- **The real gap is build↔fix and fix↔fix.** A fix claim's `meta` (we:scripts/conveyor/fix-dispatch-claim.mjs:133) is `{host, sessionId, repo, pr, kind, headSha, claimedAt}` — **no scope**. The policy is pure and takes `inFlight` as input; it never sees fix claims. The fix dispatcher loop (we:scripts/conveyor/reconcile-fix-dispatch.mjs:~1106) never reads build claims' scope.
- **Two overlap notions exist**: we:scripts/readiness/overlap-chain.mjs `intersects` (:64) is exact-string over `"<repo>:<path>"`; the policy's `pathsOverlap` (:106) also treats a directory prefix as overlap. Reusing the chain planner as-is would silently loosen the build check.
- `listFixDispatchClaims` already exists (we:scripts/conveyor/fix-claim-store.mjs:86, re-exported by we:scripts/conveyor/fix-dispatch-claim.mjs:95) but returns every held entry with no expiry filter and no scope typing.

Scope check: the four declared files are not enough. Added: we:scripts/conveyor/reconcile-fix-dispatch.mjs (fix-side wiring), we:scripts/operations/ci-heal-pr-dispatch.mjs (second fix claim acquirer), we:skills-src/conveyor/build-dispatch-daemon.mjs (the policy's real caller, builds `inFlight`), we:scripts/conveyor/fix-claim-store.mjs (expiry-aware list).

## Design

One pure shared predicate `overlapsInFlight(files, inFlight)` → `{hit, with}|null` exported from we:scripts/readiness/overlap-chain.mjs. It takes repo-qualified `"<repo>:<path>"` strings (as `normFiles` does, :60) and applies the **directory-prefix** rule (identical to `pathsOverlap`). The policy's `pathsOverlap`/`firstScopeOverlap` delegate to it so there is ONE definition (a relocation, not a new rule; `overlap-chain` is pure with no imports, so no cycle). `createStackPlan/planNextItem` stay untouched for `/batch`; dispatch **serializes** (holds), it does not stack — stacking needs a pushed predecessor tip, which concurrent dispatch lacks.

1. `acquireFixDispatchClaim` gains optional `scope` stored in `meta.scope` (mirrors build claims). Actual call sites: we:scripts/conveyor/reconcile-fix-dispatch.mjs:720 and :888, we:scripts/operations/ci-heal-pr-dispatch.mjs:107 (the `:649/856/81` lines are default params). `listFixDispatchClaims` gains an optional live-only filter using `isLeaseExpired`.
2. Build policy stays pure: it gains a separate `fixInFlight` input (`[{pr, scope}]`) checked in the same hold loop as `[...running, ...picked]` (:306), reason `hot-file … already being fixed by PR #n`. we:skills-src/conveyor/build-dispatch-daemon.mjs populates it from live fix claims. Fix claims have no `num`, so they are NOT merged into `inFlightByNum`.
3. Fix dispatch: the filter lives in the impure dispatcher loop (where `refusals.push` runs), not in the pure `planFixesFromReconcile`. A planned fix whose scope overlaps a live build claim (excluding the same item's own claim) or an earlier fix picked this pass is refused `scope-overlap` (transient, retried next pass). Refusal-kind consumers (grep `queue-cap`, `no-lane`) get the new kind.
4. Scopes are repo-qualified (`we:` prefix); `scopeSource:'pr-diff'` paths are already `we:`-prefixed and may be broader than a card scope — that only makes the hold stricter, which is intended.
5. No declared scope stays `unshaped-no-scope` (unchanged; the fix side already refuses `no-scope`).

## MVP

Musts: shared predicate + tests; fix claim carries scope + live list; build policy honors live fix claims and the daemon feeds them; fix dispatch honors live build claims and fix-vs-fix.
Out (Follow-ups): actual stacking of dispatched builds; changing the no-scope policy; symbol-level overlap.

## Test plan

- `overlapsInFlight` (we:scripts/readiness/__tests__/overlap-chain.test.mjs): equal path, dir-prefix, cross-repo, empty → null. RED: export absent.
- Policy (we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs): candidate overlapping a `fixInFlight` scope is held `hot-file` naming the fix PR; no `fixInFlight` behaves as today. RED: input ignored.
- Fix claim (we:scripts/conveyor/__tests__/fix-dispatch-claim.test.mjs): `acquireFixDispatchClaim({scope})` stores `meta.scope`; live-only list excludes an expired claim. RED: scope not stored, expired not filtered (the list itself exists).
- Fix dispatcher loop (we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs, an extracted pure `filterFixesByInFlightScope(planned, buildClaims, fixClaims)`): overlap with a live build claim → `scope-overlap`; same-item build claim exempt; two overlapping fixes → second refused; disjoint passes. RED: function absent.
- `ci-heal-pr-dispatch` (we:scripts/operations/ci-heal-pr-dispatch.mjs) passes scope to its claim (its test). RED: meta lacks scope.
- Regression: existing hot-file/prefix cases unchanged.

## Proof plan

Script under a temp `WE_COORDINATION_ROOT`: seed a live build claim `scope:["we:scripts/conveyor/"]`, call `filterFixesByInFlightScope` with a planned fix on `we:scripts/conveyor/x.mjs` — before: passes through, after: refused `scope-overlap`. Then seed a live fix claim and run `planBuildDispatch` with an overlapping candidate — before: dispatched, after: `hot-file` hold. Paste both before/after outputs in the PR body.

## Follow-ups

- Stack (not just serialize) overlapping dispatched builds once concurrent dispatch knows a predecessor's pushed tip.
- Symbol/hunk-level overlap instead of path-prefix.
- Tighten `unshaped-no-scope` further, as the operator expects.
- Consider splitting build-side and fix-side wiring into two stories if the builder finds it heavy (size 3 across ~7 files).

## Done when

1. **Executable** — `npx vitest run` over the four test files named in the Test plan (we:scripts/readiness/__tests__/overlap-chain.test.mjs, we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs, we:scripts/conveyor/__tests__/fix-dispatch-claim.test.mjs, we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs) fails before this lands (missing `overlapsInFlight`, `fixInFlight`, fix-claim scope, `filterFixesByInFlightScope`) and passes after.
