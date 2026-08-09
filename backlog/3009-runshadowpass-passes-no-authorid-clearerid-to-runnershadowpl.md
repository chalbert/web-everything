---
bornAs: x7snbvd
kind: story
size: 2
parent: "2572"
status: open
blockedBy: ["2844"]
scope:
  - we:scripts/review-runner.mjs
  - we:scripts/lib/review-runner-core.mjs
  - we:scripts/__tests__/review-runner.test.mjs
  - we:scripts/lib/__tests__/review-runner-core.test.mjs
dateOpened: "2026-08-08"
tags: [review, review-runner, converge-daemon, shadow-mode, self-clear, review-independence]
---

# runShadowPass passes no authorId/clearerId to runnerShadowPlan — once #1100 lands every shadow decision silently misreports a self-clear refusal

Found during the independent technical review of PR #1113 (the converge-daemon launchd substrate,
2026-08-08). PR #1100 (open, `review:human`, backlog #2844) threads `authorId`/`clearerId` through
`decideAutoLand`/`runnerShadowPlan` as a new SAFETY RAIL 4 self-clear refusal — but does not touch
`we:scripts/review-runner.mjs`, whose `runShadowPass` calls `runnerShadowPlan` with neither id. Once
#1100 merges, every shadow decision the runner logs silently starts reporting a WOULD-clear that an
enforcing daemon would actually refuse — the exact false confidence #1100's own header says SAFETY
RAIL 4 exists to keep out of the shadow log, arriving through the one caller #1100 did not wire.

## Same call site as #3000, filed separately

This is the same call `runShadowPass` (`we:scripts/review-runner.mjs:181`) makes to `runnerShadowPlan`
that #3000 (`3000`) already covers — #3000 is the missing `signals` (`gateSelf`/`humanRequired`/
`nonConvergence`), this item is the missing `authorId`/`clearerId`. Filed as a **separate** item rather
than folded into #3000, for one concrete reason: readiness. #3000's fix needs nothing that does not
already exist on `main` — `runnerShadowPlan` already accepts `signals` today. This item's fix needs
`authorId`/`clearerId` to exist as parameters on `runnerShadowPlan`/`decideAutoLand` at all, and they
do not — they are added by PR #1100, still open. Folding this into #3000 would either force `blockedBy`
onto #3000's already-actionable signals fix, or leave part of a merged item's acceptance criteria
structurally impossible to close until a prerequisite lands. Splitting keeps #3000 buildable today and
keeps this item's blocker explicit (`blockedBy: ["2844"]`) rather than implicit in prose. Cross-linked
both directions (see #3000's Cross-references).

**Timing — fix this before #1100 lands, not after.** The two fixes are small and land in the same two
files #1100 partially retouches. The cleanest sequencing is to close this gap in the same PR that lands
#1100 (or immediately after, before PR #1113's daemon is installed) — never let the daemon start a soak
in the window where #1100 has landed but this call site has not been updated, since that window is
exactly where the false confidence lives.

## The gap, precisely

`runShadowPass` (`we:scripts/review-runner.mjs:181`):

```js
const { intent, plan } = runnerShadowPlan({ ledger, config, currentLabels: item.labels });
```

passes neither `authorId` nor `clearerId`. Post-#1100, `runnerShadowPlan` forwards both straight to
`decideAutoLand`, which (per #1100's diff to `we:scripts/lib/auto-land-seam.mjs`) runs SAFETY RAIL 4
**before** the shadow/enforce branch:

```js
const independence = decideClearerIndependence({ authorId, clearerId });
if (!independence.independent) {
  return observeOnly({ mode: effectiveMode, action: intent.action,
    reason: `self-clear-refused: ${independence.status}`, … });
}
```

`decideClearerIndependence` (`we:scripts/lib/review-independence.mjs`, added by #1100) checks
`clearerId` **before** `authorId`:

```js
if (!clearer) return { independent: false, status: INDEPENDENCE.UNKNOWN_CLEARER, … };
if (!author) return { independent: false, status: INDEPENDENCE.UNKNOWN_AUTHOR, … };
```

**Correction to the PR #1113 review comment's stated mechanism:** the review says the status becomes
`unknown-author`. It does not, and this is worth stating precisely because filing the wrong status
token would send the fix hunting the wrong branch. `runnerShadowPlan` has no fallback to
`currentActorId()` (that fallback exists only in `applyAutoLand`, which the shadow path never calls),
so `clearerId` is `undefined` on every call today — the `!clearer` check fires first, every time, and
the status is **`unknown-clearer`**, not `unknown-author`. The net effect (every shadow decision
refused) is what the review said; the specific status token is not.

## Why `buildShadowRecord`'s `wouldClear` does not move — and why "read it from the plan" is not
## sufficient on its own

The review comment's proposed direction — "derive `wouldClear` from the plan, not the intent" — is
necessary but, read literally against #1100's actual diff, **not sufficient**. `buildShadowRecord`
(`we:scripts/lib/review-runner-core.mjs:151`):

```js
const wouldClear = intent.action === LAND_ACTIONS.CLEAR;
```

reads `intent.action`, which SAFETY RAIL 4 never touches (`decideDispositionLabel` runs before
`decideAutoLand` even sees signals/ids), so `wouldClear` stays `true` regardless of the refusal — this
part of the review's diagnosis holds. But `plan.action` does not fix it either: in #1100's rail-4
branch, `observeOnly` is called with `action: intent.action` verbatim — the same `LAND_ACTIONS.CLEAR`
value, unchanged. So swapping `intent.action` for `plan.action` in `buildShadowRecord` would still read
`'clear'` for a self-clear-refused PR. The only field in the returned `AutoLandPlan` that actually
distinguishes the two cases is `plan.reason` (`'self-clear-refused: …'` vs. the disposition's own
reason token) — `buildShadowRecord`'s `reason` field already reads `plan.reason || intent.reason || ''`
and so is **already correct** once ids are threaded through (verified: it takes `plan.reason` first).
`wouldClear` and the per-PR `action` field are the two fields that need a real fix, and neither can
just switch from `intent.*` to `plan.*` unchanged — the fix has to recognize the `self-clear-refused`
reason token specifically (or, cleaner, have `we:scripts/lib/auto-land-seam.mjs`'s rail-4 branch set
`action: LAND_ACTIONS.KEEP_PARKED` instead of echoing `intent.action`, matching rail 1's existing
pattern — worth raising with whoever authors this fix, since that repair may belong upstream in #1100's
own file rather than downstream here).

## What this is NOT

Not a live merge hole today: `runnerShadowPlan` hard-codes `LAND_MODES.SHADOW` and the CLI refuses
`--enforce`, so nothing merges as a result of this gap, in shadow or otherwise. **This is latent, not
live** — it does nothing today because `authorId`/`clearerId` do not yet exist as parameters anywhere
in this call chain (PR #1100 has not merged). It becomes a live *log-accuracy* defect (never a
merge-safety one — SAFETY RAIL 4 still correctly keeps the seam from acting) the moment #1100 merges:
from that point on, the shadow log's `wouldClear` counts silently stop being trustworthy for every
`review:pending` PR, because every one of them reads as `self-clear-refused: unknown-clearer` under the
hood while `wouldClear` keeps saying `true`.

## Acceptance criteria

- `runShadowPass` passes a real `clearerId` to `runnerShadowPlan` — trivial once #1100 lands:
  `currentActorId()` (`we:scripts/lib/review-independence.mjs`) is a pure env read, no new I/O.
- `runShadowPass` passes a real `authorId` — this needs a new fetch the runner does not do today (the
  runner currently reads only `--json number,labels`, per #3000's own verification note): read the PR
  body (e.g. `gh pr view --json body`) and resolve it via `parseAuthorActorId`
  (`we:scripts/lib/review-independence.mjs`). Reuse it; do not re-derive the marker regex.
- `buildShadowRecord`'s `wouldClear` (and its `action` field) correctly read `false` /
  `keep-parked`-equivalent for a PR where `decideClearerIndependence` would refuse — proven with a
  synthetic ledger (clean unanimous-accept, otherwise CLEAR-eligible) run once with a real
  `authorId !== clearerId` (expect `wouldClear: true`) and once with `authorId === clearerId` or either
  id absent (expect `wouldClear: false`, `reason` starting `self-clear-refused:`).
- A shadow-log record for a synthetic self-clear (`authorId === clearerId`) and for each unknown-id case
  (`unknown-author`, `unknown-clearer`) shows the correct `reason` token and `wouldClear: false`.
- `summary.wouldClear` / `summary.wouldKeepParked` (the aggregate counts in `we:scripts/review-runner.mjs`)
  move accordingly — pin with a test asserting the count crosses over between a passing and a
  self-clear-refused synthetic PR.
- No change to `runnerShadowPlan`'s forced-`LAND_MODES.SHADOW` or the CLI's `--enforce` refusal — scoped
  to shadow-log accuracy, same floor #3000 already states.

## Verification (re-derived from source, not taken on trust)

- Confirmed `we:scripts/review-runner.mjs` is **absent** from PR #1100's changed-file list
  (`gh pr diff 1100 --name-only`) and its `runShadowPass` call passes neither id — read directly, not
  inferred.
- Confirmed `we:scripts/lib/review-runner-core.mjs` **is** in #1100's diff: `runnerShadowPlan` gains
  `authorId`/`clearerId` params and forwards them unchanged to `decideAutoLand`.
- Confirmed `we:scripts/lib/auto-land-seam.mjs`'s new SAFETY RAIL 4 block runs `decideClearerIndependence`
  and, on refusal, calls `observeOnly({ …, action: intent.action, reason: 'self-clear-refused: …' })` —
  read the literal diff hunk, not summarized from the PR body.
- Confirmed `we:scripts/lib/review-independence.mjs`'s `decideClearerIndependence` checks `!clearer`
  strictly before `!author` — the `unknown-clearer` vs `unknown-author` correction above is read
  directly off this order, not assumed.
- Confirmed `buildShadowRecord` (`we:scripts/lib/review-runner-core.mjs:148-179`, current `main`) computes
  `wouldClear` from `intent.action` and `reason` from `plan.reason || intent.reason || ''` — read the
  current function body, not paraphrased.
- Confirmed `we:backlog/2844-…md` is `status: open` on `main` as of filing (2026-08-08) — PR #1100 has
  not merged; this item's `blockedBy: ["2844"]` reflects that directly rather than assuming it.

## Cross-references

- Same call site, sibling gap: #3000 (`3000`) — missing `signals`, not missing ids. Filed separately;
  see "Same call site as #3000, filed separately" above for why.
- Related, different file: a sibling finding from the same PR #1113 review about
  `we:scripts/converge-daemon-pass.mjs` discarding per-PR records and the persisted shadow log's shape
  not fitting the ratified agreement metric — filed separately as it targets code that does not exist on
  `main` yet (PR #1113 is open). See that item's own filing.
- Parent epic: #2572 (schedule the converge-and-label runner).
- Blocker: #2844 (PR #1100) — the self-clear-refusal rail this item threads ids into.
- `we:docs/agent/backlog-workflow.md` — the #2838 enforce-flip precondition this indirectly protects
  (a soak that spans the #1100 merge boundary must not silently invert its own meaning).

## Note added 2026-08-09 — re-derived independently, and what it costs #2675

This gap was re-found from scratch during a residual-filing pass and was about to be filed as a new card
before this one was located. Recording the second derivation here so it is not filed a third time, plus the
one framing it adds:

- The observation period this silently empties belongs to
  [#2675](/backlog/2675-auto-land-seam-for-clean-auto-dispositions-defaulting-to-sha/) (resolved), which
  ratified SHADOW as the auto-land seam's default precisely so the judge could log what it *would* dispose
  "for a confidence-building period". Once PR #1100 lands, every shadow line reads `self-clear-refused:
  unknown-clearer`, so that period accumulates no evidence about the rail it exists to observe. Fail-closed
  and therefore safe; useless as a soak.
- The module header's wording — "the common case today" (verified present at line 1874 of
  `gh pr diff 1100`) — reads as temporary. Nothing in the code makes it temporary: the runner reads only
  `--json number,labels` (verified at `we:scripts/review-runner.mjs` lines 102 and 123), so `authorId` is
  structurally unobtainable there until the `body` field is added, exactly as this item's acceptance
  criteria already require.
- Also re-confirmed on `main` at `a68b4902`: `clearerId`, `authorId`, `currentActorId` and
  `decideClearerIndependence` appear nowhere under `we:scripts/` — so nothing is refused today, and this
  item is correctly described above as latent rather than live.
