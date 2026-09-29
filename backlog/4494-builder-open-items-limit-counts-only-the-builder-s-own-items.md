---
bornAs: xovjhwh
kind: story
size: 3
tier: pinned
status: resolved
scope: ["we:scripts/conveyor/build-dispatch-policy.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
tags: []
---

# Builder open-items limit counts only the builder's own items

Operator decision 2026-09-29 ~1:40 PM ET: the builder's open-items cap (wip-cap, #4353, maxOpenItems=7) must count only the builder's own items, not items built by hand-dispatched workers. Live 2026-09-29T17:26:28Z, we:scripts/conveyor/build-dispatch-policy.mjs's planBuildDispatch (~lines 241-283) built the WIP set as {inFlight} union {delivered-by-open-PR}, where the PR side is every open PR whose branch names a card (prDeliveredNum); openItems read 7/7 filled by 4293, 4304, 4312, 4314, 4318, 4321, x4mfp16 -- six worker PRs [seven listed; a miscount in the original operator note, left uncorrected in their own words above, flagged by /converge round 2's claim-accuracy lens] -- so wip-cap held 4382, 4131, 4319 and the builder built nothing. Same shape as the #4464 cap fix (PR #2924), which made maxConcurrentBuilds count only the builder's own builds.

## Prepare verification (2026-09-29, re-checked against fresh `main`)

Premise still holds: `planBuildDispatch` (`we:scripts/conveyor/build-dispatch-policy.mjs`, now ~lines
201-300 — the file has grown since this card was opened, but the described shape is unchanged)
still builds `openItemsInitial` as `{inFlight} ∪ {delivered-by-open-PR}` with no builder-attribution
filter, exactly as described above. `scope:` is correct (the two files this card actually touches;
the corresponding `__tests__`/soak-break files live under those same modules' own test
directories, not separately scoped). One correction to the Design paragraph below: the durable
run-record path it names (`~/workspace/.operations/coordination/build-dispatch-runs/`) does not
exist on disk — the real mechanism is the EXISTING `we:scripts/operations/run-store.mjs` (its
per-checkout `.operations/runs/` sidecar), already read by this daemon's own
`cliListRunStoreInFlight`/`cliListSettledBuilds` (`we:skills-src/conveyor/build-dispatch-daemon.mjs`).
Those two reads are already, by construction, "this builder's own dispatch-lane run records" — only
this daemon's own `dispatch-lane` calls ever write a `dispatch-lane*` run (verified by a full-repo
grep sweep during `/converge`, not just reasoned from this file's own code) — so the fix needs NO
new IO: it derives `dispatchedByBuilder` from the union of nums those two reads already surface,
via the shared `deriveDispatchedByBuilder(runStoreInFlight, settledRows)` helper (extracted during
`/converge` round 1 so `runBuildDispatchTick` and `dryRun` share ONE derivation instead of two
independently-drifting copies), and threads the result into `planBuildDispatch` as a new, optional
parameter.

This card was JIT-numbered #4494 (`bornAs: xovjhwh`) by the drain while this lane was already
mid-build against the hash-named file; this numbered file supersedes and replaces
`we:backlog/xovjhwh-builder-open-items-limit-counts-only-the-builder-s-own-items.md` (removed in the
same commit) — same content, same claim, one canonical file.

## Design

Attribute an open PR to the builder through its own durable run records (see the correction above:
the concrete mechanism is `we:scripts/operations/run-store.mjs`'s `dispatch-lane*` records, not a
separate `build-dispatch-runs/` path) — the item nums the builder itself dispatched a build for —
rather than the current branch-name heuristic (`prDeliveredNum`, any open PR whose branch names a
card). Concretely, `planBuildDispatch` in `we:scripts/conveyor/build-dispatch-policy.mjs` builds its
WIP set today as `{inFlight} ∪ {delivered-by-open-PR}` where the PR side counts every open PR whose
branch names a card. The fix narrows the PR side to `{delivered-by-open-PR} ∩ {items the builder's
own run records show it dispatched}` — a worker-authored PR (fix worker, hand-dispatched worker,
stranded claim) for an item the builder never dispatched drops out of `maxOpenItems` entirely.

Those same worker PRs still count toward `maxOpenPrs` (unchanged — a separate cap, machine-wide PR
volume, not builder attribution) and still participate in scope-overlap holds (`hot-file`,
unchanged — a worker's in-flight scope must still block a conflicting builder dispatch). Only the
`wip-cap` (`maxOpenItems`) arithmetic changes. This mirrors the shape of the `maxConcurrentBuilds`
fix (x3vs6tu/#4464, PR #2924): that fix made the *build-slot* cap count only the builder's own
in-flight builds instead of every machine-wide "building" signal; this fix makes the *open-items*
cap count only the builder's own open-PR deliveries instead of every open PR that merely names a
card.

## MVP

- `planBuildDispatch` (or a small pure helper it calls) reads the builder's own dispatched-item
  set from `~/workspace/.operations/coordination/build-dispatch-runs/` (injected, not a direct
  `fs` read inside the pure policy module — same io-injection shape the module already uses for
  its other inputs) and intersects it against the open-PR-delivered set before folding that count
  into `maxOpenItems`.
- `maxOpenPrs` and the `hot-file` scope-overlap hold both keep reading the full open-PR set,
  unfiltered — no change to either.
- Kept out of scope: any change to how PRs are opened, labelled, or delivered; any change to the
  worker/fix-dispatch paths themselves.

## Test plan (each fails before the fix)

1. Pure planner test: a worker-dispatched item with an open PR (not in the builder's own run
   records) is NOT counted toward `maxOpenItems`, at any occupancy.
2. Pure planner test: a builder-dispatched item with an open PR (present in the builder's own run
   records) IS counted toward `maxOpenItems`, unchanged from today.
3. Pure planner test: dedupe against `inFlight` — an item that is both currently building
   (`inFlight`) and has an open PR from a prior build is counted once, not twice.
4. Pure planner test: `maxOpenPrs` and the `hot-file` scope-overlap hold are unaffected by any of
   the above — a worker PR still counts toward `maxOpenPrs` and still blocks a scope-overlapping
   builder dispatch.

## Proof plan (live, before/after)

- **Soak break** (`we:scripts/conveyor/soak/breaks/wip-cap-counts-worker-prs.mjs`, discovered by
  `we:scripts/conveyor/soak/breaks/index.mjs`): reproduces the live incident's own numbers directly
  against `planBuildDispatch` — cap 7, the same 7 worker-delivered nums
  (4293/4304/4312/4314/4318/4321/x4mfp16), zero of them the builder's own dispatch, and the 3 held
  candidates (4382/4131/4319). `node we:scripts/conveyor/soak/red-green.mjs
  --break=wip-cap-counts-worker-prs --revert=HEAD` proved RED before the fix (all 3 candidates held
  `wip-cap`) and GREEN with it (all 3 dispatch) — run live in this lane, verbatim output on the PR.
- **Live dry-run before/after**, `node we:skills-src/conveyor/build-dispatch-daemon.mjs --dry-run
  --json`, run from this lane (final, post-rebase) against the SAME live open-PR set both times (7
  open PRs, unchanged between the two calls: we#2978/2977/2976/2975/2974/2972/2967 —
  `lane/xvprtq3-prevention-card` / `xupbp7k-prevention-card` / `agy-cards-xao7080-xpse6qy` /
  `xcm15dy-agy-claude-effort-argv-fix` / `4108-dedupe-listing` / `xt3rawp-prevention-card` /
  `4465-hold-router`). **Before** (fix reverted, `git checkout <pre-fix commit> --` the two touched
  files): `openItems` read `{"count":7,"cap":7,"filling":["4108","4382","4465","xcm15dy","xt3rawp","xupbp7k","xvprtq3"]}`
  — AT THE CAP, matching the live incident's own shape: `4382` is this builder's own durable
  in-flight build (unconditionally counted either way), and the other SIX (`4108`, `4465`,
  `xcm15dy`, `xt3rawp`, `xupbp7k`, `xvprtq3`) are every one of the worker-authored PRs above whose
  branch matches the delivery-ref shape — none of them this builder's own dispatch, all counted
  anyway. **After** (fix restored): the SAME 7 open PRs produced
  `{"count":1,"cap":7,"filling":["4382"]}` — only the builder's own in-flight item counts; all six
  worker PRs dropped out. (`we#2976`'s `agy-cards-xao7080-xpse6qy` branch never matched the
  delivery-ref shape at all, so it correctly appears in neither list, before or after — it already
  only counted toward `maxOpenPrs`, unchanged.) This is a clean, same-inputs before/after: the ONLY
  thing that changed between the two calls is the code, and the wip-cap went from AT CAPACITY
  (7/7, mostly worker PRs) to 1/7 (only the builder's own item) — the soak break above is the
  scripted RED/GREEN proof of the capping behavior; this is the live confirmation on today's actual
  queue.

## Follow-ups (out of scope — listed so they are not lost)

- Same own-vs-worker attribution question for `maxOpenPrs` itself, if a future incident shows the
  machine-wide PR volume cap also needs builder-only scoping — deliberately NOT bundled here since
  the operator's 2026-09-29 decision scopes this card to `maxOpenItems` only.
- ~~A shared helper... not extracted preemptively here~~ — done during `/converge` round 1 (a
  simplicity/standards-conformance finding on the duplicate inline derivation in `runBuildDispatchTick`
  and `dryRun`): extracted to `we:skills-src/conveyor/build-dispatch-daemon.mjs`'s exported
  `deriveDispatchedByBuilder`, unit-tested directly, and now the SAME call both sites use.
- **Fail-closed on a run-store read error** (converge round 1, correctness/security findings): today
  `dispatchedByBuilder` fails OPEN — an errored or aged-out `listSettledBuilds`/`listRunStoreInFlight`
  read shrinks the set, so a builder-own open PR can silently stop counting toward `maxOpenItems`.
  `maxConcurrentBuilds`/`maxOpenPrs` still bound the damage independently, and this mirrors the
  in-flight side's own pre-existing fail-open behaviour, so it is accepted rather than fixed here —
  but a future card could make either read fail CLOSED (fall back to the old unfiltered union on a
  read error) if that bound proves insufficient live.
- **A check:standards rule for two backlog files sharing one `bornAs`** (converge round 1,
  claim-accuracy finding): this card itself hit a JIT-numbering collision mid-build (`xovjhwh` →
  `#4494`, reconciled by hand in this same PR) — a mechanical guard that flags two files with the
  same `bornAs` would catch a future case where the hash-named file was NOT correctly removed.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs`
   fails on `main` today (new worker-PR-not-counted / builder-PR-counted / dedupe cases) and
   passes after this lands.
