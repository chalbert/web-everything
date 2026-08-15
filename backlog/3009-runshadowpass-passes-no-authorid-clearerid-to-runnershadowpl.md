---
bornAs: x7snbvd
kind: story
size: 3
parent: "2572"
status: open
scope:
  - we:scripts/review-runner.mjs
  - we:scripts/lib/review-runner-core.mjs
  - we:scripts/lib/auto-land-seam.mjs
  - we:scripts/__tests__/review-runner.test.mjs
  - we:scripts/lib/__tests__/review-runner-core.test.mjs
  - we:scripts/lib/__tests__/auto-land-seam.test.mjs
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
  "for a confidence-building period". Every shadow line now reads `self-clear-refused: unknown-clearer`, so
  that period accumulates no evidence about the rail it exists to observe. Fail-closed and therefore safe;
  useless as a soak.
- The wording in [we:scripts/lib/review-runner-core.mjs](scripts/lib/review-runner-core.mjs)'s
  `runnerShadowPlan` docblock — "the common case today", line 95 on `main` — reads as temporary. Nothing in
  the code makes it temporary: the runner reads only `--json number,labels` (verified at
  [we:scripts/review-runner.mjs](scripts/review-runner.mjs) lines 102 and 123), so `authorId` is
  structurally unobtainable there until the `body` field is added, exactly as this item's acceptance
  criteria already require.

**Correction, same day — this is LIVE now, not latent.** The first cut of this note said the gap was latent
because `clearerId` / `authorId` / `decideClearerIndependence` appeared nowhere under `we:scripts/`. That was
true at `a68b4902` and stopped being true hours later: **PR #1100 merged 2026-08-09T12:40:01Z** and #2844 is
`status: resolved`. Re-verified on `main` at `cf6730a3`:

- `runShadowPass` still calls `runnerShadowPlan({ ledger, config, currentLabels: item.labels })` with neither
  id ([we:scripts/review-runner.mjs](scripts/review-runner.mjs) line 181).
- `decideAutoLand` evaluates `decideClearerIndependence({ authorId, clearerId })` before the shadow branch and,
  when it is not `independent`, returns `reason: 'self-clear-refused: <status>'`
  ([we:scripts/lib/auto-land-seam.mjs](scripts/lib/auto-land-seam.mjs) lines 153–160).
- `decideClearerIndependence` reads no environment of its own — it tests the two arguments, `clearerId` first
  ([we:scripts/lib/review-independence.mjs](scripts/lib/review-independence.mjs) lines 193–205). With neither
  passed, the status is `unknown-clearer`, exactly as this item says above and NOT `unknown-author`.

So the shadow ledger misreports today. Two consequences for whoever picks this up: the "What this is NOT"
section's "**This is latent, not live**" no longer holds and should be restated when the item is next edited,
and `blockedBy: ["2844"]` is now a stale edge on a resolved blocker — sweep it under
[#1231](/backlog/1231-sweep-the-stale-blockedby-edges-items-marked-blocked-whose-b/). Neither is changed here:
this pass is capture-only and does not move item state.

## Preparation — re-verified against LIVE code, per `we:agent-memory-src/story-preparation-checklist.md` (2026-08-15)

Re-ran every load-bearing claim in this card against `main` at the lane's current base, rather than trusting
the 2026-08-09 note. All prior claims still hold, re-read directly:

- `we:scripts/review-runner.mjs:182`'s `runShadowPass` call still passes neither `authorId` nor `clearerId`
  (the card's own line citation drifted by one line since filing; re-confirmed against current `main`).
- `we:scripts/lib/review-runner-core.mjs`'s `runnerShadowPlan` (lines 108–114) already accepts and forwards
  both — PR #1100 wired this half; nothing left to do there.
- `we:scripts/lib/auto-land-seam.mjs`'s SAFETY RAIL 4 (lines 147–162) still evaluates
  `decideClearerIndependence` before the shadow branch and, on refusal, still returns
  `observeOnly({ ..., action: intent.action, reason: 'self-clear-refused: …' })` verbatim — `action` echoes
  the CLEAR intent even though the seam is refusing to clear it (line 157).
- `we:scripts/lib/review-independence.mjs`'s `decideClearerIndependence` (lines 193–205) still checks
  `!clearer` before `!author` — with no ids supplied the status is `unknown-clearer`, confirmed again.
- `we:scripts/lib/review-runner-core.mjs`'s `buildShadowRecord` (line 158) still computes
  `wouldClear = intent.action === LAND_ACTIONS.CLEAR` — reads the raw disposition intent, never the seam's
  plan.
- **#1100 is merged** (`gh pr view 1100`: `state: MERGED`, `mergedAt: 2026-08-09T12:40:01Z`) and
  `we:backlog/2844-*.md` is `status: resolved` — this pass confirms the 2026-08-09 note's finding still
  holds; `blockedBy: ["2844"]` is cleared in this card's frontmatter below.

**New finding this pass, correcting how the card's own "why `wouldClear` does not move" section reads
`we:scripts/lib/review-runner-core.mjs`**: `buildShadowRecord`'s `action` field
(`we:scripts/lib/review-runner-core.mjs:177`, `action: plan.action`) is **already** plan-sourced, not
intent-sourced. The residual bug is entirely inside `we:scripts/lib/auto-land-seam.mjs`'s rail 4, which puts
the wrong value INTO `plan.action` in the first place (see Decided design). Fixing `plan.action` upstream
fixes `buildShadowRecord`'s `action` field for free — only `wouldClear` needs its own one-line fix.

### Decided design

The card names one real fork and does not decide it: "the fix has to recognize the `self-clear-refused`
reason token specifically (or, cleaner, have `we:scripts/lib/auto-land-seam.mjs`'s rail-4 branch set
`action: LAND_ACTIONS.KEEP_PARKED` instead of echoing `intent.action` … worth raising with whoever authors
this fix, since that repair may belong upstream in #1100's own file rather than downstream here." Deciding it
now:

**Fix upstream, in `we:scripts/lib/auto-land-seam.mjs`'s SAFETY RAIL 4** — change the `observeOnly(...)`
call's `action: intent.action` (line 157) to `action: LAND_ACTIONS.KEEP_PARKED`. Reasoning:

- It fixes the bug at its source. `AutoLandPlan.action` (`we:scripts/lib/auto-land-seam.mjs:81`) is documented
  `'clear'|'keep-parked'` — the land-path action the plan represents — and a refused clear IS a keep-parked
  outcome, the same way rail 1's `observeOnly` already reports `keep-parked` there (`action: intent.action` is
  correct in rail 1 only because the guarding `if` already proved `intent.action !== CLEAR`, and `LAND_ACTIONS`
  has exactly two values, so the two statements are equivalent). Rail 4 setting the literal
  `LAND_ACTIONS.KEEP_PARKED` makes that parity explicit rather than accidental.
- **Checked for other consumers before deciding this was safe.** `plan.action` from `decideAutoLand` /
  `runAutoLandSeam` has exactly one production reader anywhere in the repo —
  `we:scripts/lib/review-runner-core.mjs:177`'s `buildShadowRecord` (grepped `\.action\b` across
  `we:scripts/lib/auto-land-seam.mjs` and every importer). `we:scripts/lib/auto-land-seam.mjs`'s own
  `applyAutoLand` gates on `plan.apply`, never `plan.action`. `runAutoLandSeam` has zero production callers
  today (grepped `scripts/**/*.mjs` excluding `__tests__`) — only its own test file calls it. This is a
  genuinely contained, no-other-blast-radius fix.
- **Checked it doesn't silently break existing tests.** Read every assertion in
  `we:scripts/lib/__tests__/auto-land-seam.test.mjs`'s SAFETY-RAIL-4 block (lines 182–274) — none assert
  `res.plan.action` or `decideAutoLand(...).action` for the self-clear-refused path today, so the change is
  additive there (new assertions to add per Tasks, not existing ones that would need fixing).

The rejected alternative — pattern-match `plan.reason` for the `self-clear-refused:` prefix inside
`buildShadowRecord` instead — was rejected because it (a) leaves the actual defect (`AutoLandPlan.action`
lying about the effective action) live for any future reader of `decideAutoLand`, and (b) couples
`we:scripts/lib/review-runner-core.mjs` to `we:scripts/lib/auto-land-seam.mjs`'s reason-STRING format instead
of its typed `action` field, exactly the string-sniffing `LAND_ACTIONS` (a frozen enum) exists to avoid.

**Consequence for `we:scripts/lib/review-runner-core.mjs`'s `buildShadowRecord`**: once `plan.action` is
trustworthy, change `wouldClear = intent.action === LAND_ACTIONS.CLEAR` to
`wouldClear = plan.action === LAND_ACTIONS.CLEAR` (line 158) — now consistent with the `action` field on the
same returned object (`action: plan.action`, unchanged), both reading the seam's EFFECTIVE decision rather
than the raw disposition intent.

**Threading the ids into `we:scripts/review-runner.mjs`.** `clearerId` is a pure env read
(`currentActorId()`, `we:scripts/lib/review-independence.mjs:76`) — resolve it ONCE in `main()`, not inside
`runShadowPass`, so `runShadowPass` stays exactly as pure as its own docstring already claims ("PURE-ish: I/O
is confined to the injected `loadLedger` seam") and so a test calling it directly gets deterministic behavior
with no dependence on the harness's own `CLAUDE_CODE_SESSION_ID` — this preparation's own shell already has
one set (`echo $CLAUDE_CODE_SESSION_ID` prints a real value), so a `runShadowPass` that fell back to it
internally would pass or fail depending on WHAT ran the test, exactly the anti-pattern
`we:scripts/lib/__tests__/auto-land-seam.test.mjs:248-250` already documents and avoids by passing
`clearerId: ''` explicitly.

`authorId` is per-PR and needs the PR body, which `we:scripts/review-runner.mjs` does not fetch today
(confirmed: `discoverPending` line 103 and `lookupLabels` line 124 both call `gh` with `--json number,labels`
only). Ride the EXISTING `gh` calls rather than add a new hop — the same "ride the existing read" pattern
`we:scripts/review-set-label.mjs:448-450` already uses for this exact stamp (that call already asks for
`labels,headRefOid,headRefName,state,body`; add `,body` to this file's two calls). Resolve `authorId` per PR
via `parseAuthorActorId` (`we:scripts/lib/review-independence.mjs:143`) — reuse verbatim, per this card's own
acceptance criteria, never re-derive the marker regex.

`partitionRunnerPRs` → `partitionAgentClearable` (`we:scripts/lib/review-escalation.mjs:791-804`) rebuilds
each clearable item as `{ pr, repo, labels: item.labels }` and drops every other field — so `body` does NOT
survive partitioning. (`partitionAgentClearable` has exactly one caller in the repo, `partitionRunnerPRs` —
grepped — so it could safely be widened to preserve extra fields, but doing so touches a third library file
for no benefit here.) Cheaper and just as correct: build a `pr → authorId` `Map` from the PRE-partition
`discovered` array in `main()`, and pass it into `runShadowPass` as a new 4th parameter alongside `clearerId`,
looked up per PR inside the loop by `item.pr` (which DOES survive partitioning unchanged).

### Interfaces and protocol

`we:scripts/review-runner.mjs`:

```js
// discoverPending (line 103) / lookupLabels (line 124) — add `body` to the existing gh --json field list,
// no new gh hop:
//   gh pr list --repo <slug> --label review:pending --state open --json number,labels,body --limit 200
//   gh pr view <n> --repo <slug> --json number,labels,body
// both now map `body: typeof row.body === 'string' ? row.body : ''` into each returned item.

import { currentActorId, parseAuthorActorId } from './lib/review-independence.mjs';

// runShadowPass (line 176) — new 4th, optional, options arg. Backward compatible: existing 3-arg callers keep
// working, with authorId/clearerId undefined on every call (⇒ unknown-clearer, fail-closed — never a silent
// WOULD-clear regression for a caller that hasn't been updated yet).
export function runShadowPass(
  clearable, config, loadLedger = loadLedgerFromDurableLog, { authorIdByPr, clearerId } = {},
) {
  const records = [];
  for (const item of clearable) {
    const subject = `${item.repo}#${item.pr}`;
    let ledger = [];
    try { ledger = loadLedger(subject) || []; } catch { ledger = []; }
    const authorId = authorIdByPr instanceof Map ? authorIdByPr.get(item.pr) : undefined;
    const { intent, plan } = runnerShadowPlan({ ledger, config, currentLabels: item.labels, authorId, clearerId });
    records.push(buildShadowRecord({ item, ledger, intent, plan }));
  }
  return records;
}

// main() (line 192) — after `discovered` is resolved and alongside the existing partitionRunnerPRs(discovered)
// call:
const authorIdByPr = new Map(discovered.map((d) => [d.pr, parseAuthorActorId(d.body || '')]));
const clearerId = currentActorId();
const records = runShadowPass(clearable, config, undefined, { authorIdByPr, clearerId });
```

`we:scripts/lib/auto-land-seam.mjs` — SAFETY RAIL 4, one field changes, no signature change:

```js
// before (line 157):
      action: intent.action,                 // BUG: always LAND_ACTIONS.CLEAR here — the refusal never shows
// after:
      action: LAND_ACTIONS.KEEP_PARKED,       // the effective action IS keep-parked; the intent's CLEAR never happens
```

`we:scripts/lib/review-runner-core.mjs` — `buildShadowRecord`, one field changes, no signature change:

```js
// before (line 158): const wouldClear = intent.action === LAND_ACTIONS.CLEAR;
// after:               const wouldClear = plan.action === LAND_ACTIONS.CLEAR;
```

No new error shapes: every failure path already fails closed today (empty `authorId`/`clearerId` ⇒
`unknown-*` ⇒ `independent: false` ⇒ observe-only, unchanged by this fix). No data migration — nothing
persisted changes shape; this is a pure logic/threading fix over process-local state.

### Tasks

1. `we:scripts/lib/auto-land-seam.mjs` — SAFETY RAIL 4: `action: intent.action` → `action: LAND_ACTIONS.KEEP_PARKED`
   in the `observeOnly(...)` call (line 157). Lightly reword the `AutoLandPlan.action` JSDoc (line 81) to say
   it is the plan's EFFECTIVE action, which can diverge from the intent's on a rail-4 refusal.
2. `we:scripts/lib/__tests__/auto-land-seam.test.mjs` — pin the fix: add
   `expect(res.plan.action).toBe(LAND_ACTIONS.KEEP_PARKED)` (or the `decideAutoLand(...).action` equivalent)
   to the adversarial-enforce self-clear test (lines 183–201), the end-to-end self-clear test (lines 216–223),
   and the unknown-id loop (lines 240–257).
3. `we:scripts/lib/review-runner-core.mjs` — `buildShadowRecord`: `wouldClear = intent.action === LAND_ACTIONS.CLEAR`
   → `wouldClear = plan.action === LAND_ACTIONS.CLEAR` (line 158). Adjust the adjacent doc comment (line 147)
   accordingly.
4. `we:scripts/lib/__tests__/review-runner-core.test.mjs`:
   - Update the existing "records mutated:false / applied:false and wouldClear:true for a clean auto-dispose"
     test (lines 189–201): pass explicit independent `authorId`/`clearerId` into its `runnerShadowPlan` call
     (mirror the pair already used at lines 116–123) — otherwise it starts failing once `wouldClear` reads
     `plan.action` (no ids ⇒ `unknown-clearer` ⇒ keep-parked, contradicting the test's own name).
   - Add a test proving this card's own acceptance criterion literally: a synthetic self-clear
     (`authorId === clearerId`) and each unknown-id case (absent author, absent clearer) each yield, via
     `buildShadowRecord`, `wouldClear: false`, `action: 'keep-parked'`, and `reason` starting with
     `self-clear-refused:`.
5. `we:scripts/review-runner.mjs`:
   - Import `{ currentActorId, parseAuthorActorId }` from `we:scripts/lib/review-independence.mjs`.
   - `discoverPending` (line 99) and `lookupLabels` (line 119): add `,body` to each `gh` `--json` field list;
     map `body` into each returned item.
   - `runShadowPass` (line 176): add the 4th `{ authorIdByPr, clearerId }` options arg per Interfaces above;
     look up `authorId` per PR from `authorIdByPr`.
   - `main()` (line 192): build `authorIdByPr` from `discovered` and resolve `clearerId` via `currentActorId()`;
     pass both into `runShadowPass`.
6. `we:scripts/__tests__/review-runner.test.mjs`:
   - Update the three existing `runShadowPass(...)` calls (lines 50, 61, 72–75) to pass an explicit independent
     `{ authorIdByPr, clearerId }` 4th argument — otherwise they start failing the same way as task 4's first
     bullet.
   - Add a test pinning the `summary.wouldClear`/`summary.wouldKeepParked` crossover this card's acceptance
     criteria name: derive the same counts `we:scripts/review-runner.mjs:256-257` computes
     (`records.filter(r => r.wouldClear).length` / the negation) directly over `runShadowPass`'s returned
     records — once with an independent pair (counted in `wouldClear`), once with `authorId === clearerId`
     (counted in `wouldKeepParked`). (`main()` itself is not unit-testable without shelling `gh`, so the
     honest unit of this claim is `runShadowPass`'s records, which `main()` merely filters.)
7. Run `npm run test:unit -- review-runner review-runner-core auto-land-seam` and `npm run check:standards`
   before opening the PR.

### Delivery shape

One piece, not incremental. All six touched files are small, mechanical, non-overlapping edits inside one
coherent fix (one field flip upstream, one field flip downstream, one signature-compatible parameter thread,
and the tests each of those three changes obligates) — nothing here is safely shippable half-done, since
threading `authorId` without the `we:scripts/lib/auto-land-seam.mjs` action fix (or vice versa) leaves the
shadow log still wrong for the case this item exists to fix. Lands as a single PR.

**Heads-up for the builder, not a blocker:** `we:scripts/lib/auto-land-seam.mjs` is a `tier: 'policy'`
TRUST_CHAIN file (`we:scripts/lib/gate-config.mjs:141-146`, `role: 'auto-land-seam'`) — editing it forces
`review:human` on the resulting PR (an agent may not self-clear an edit to its own auto-land machinery).
Expect a human `/review`, not an agent auto-clear, before this lands.

### Revised size: 3 (was 2)

Basis: the original scope (`we:scripts/review-runner.mjs`, `we:scripts/lib/review-runner-core.mjs`, their two
test files) covered only the id-threading half. Preparation found the `wouldClear`/`action` misreport's root
cause lives in a THIRD production file, `we:scripts/lib/auto-land-seam.mjs` (plus its test file) — six files
total, each a small mechanical edit, still one coherent PR, but past the two-file footprint the original size
assumed.

### Frontmatter update (applied to this card)

`blockedBy: ["2844"]` removed — #2844 (PR #1100) is `status: resolved`, confirmed again this pass; the edge
has been stale since 2026-08-09 per this card's own note above. `scope:` gains
`we:scripts/lib/auto-land-seam.mjs` and `we:scripts/lib/__tests__/auto-land-seam.test.mjs`. `size:` becomes 3.

### Preparation status — PREPARED, not yet BUILD-READY

Items 1–8 of `we:agent-memory-src/story-preparation-checklist.md` are done: scope+consumers checked
(including the partition-drops-`body` interface hazard and the single-consumer check on `plan.action`), size
revised with basis stated, acceptance criteria are testable (Done when, below), the design fork the card
itself named is now decided (not left open, not split away), interfaces are real signatures, tasks are
ordered, delivery shape is stated, and the risky part — would this fix silently break EXISTING tests — was
de-risked during prep by reading every affected assertion rather than assuming (found and named the two test
files whose existing assertions would start failing: `we:scripts/lib/__tests__/review-runner-core.test.mjs`
lines 189–201, and all three `runShadowPass` calls in `we:scripts/__tests__/review-runner.test.mjs`).

**Item 9 — independent review of this preparation — has NOT happened yet.** Per the checklist's own
"prepared" vs "build-ready" distinction, this card is PREPARED but not yet BUILD-READY: it needs an
independently-sessioned review of this preparation (not just the eventual diff) before a builder should
start.

### Done when

- Breaking the `we:scripts/lib/auto-land-seam.mjs` fix (reverting `action: LAND_ACTIONS.KEEP_PARKED` back to
  `action: intent.action` in SAFETY RAIL 4) reddens the new assertions in
  `we:scripts/lib/__tests__/auto-land-seam.test.mjs`'s self-clear-refused tests (Task 2).
- Breaking the `we:scripts/lib/review-runner-core.mjs` fix (reverting `wouldClear` to read `intent.action`)
  reddens the new synthetic self-clear / unknown-id test in
  `we:scripts/lib/__tests__/review-runner-core.test.mjs` (Task 4's second bullet).
- Calling `we:scripts/review-runner.mjs`'s `runShadowPass` (directly, unit-level) with a synthetic clean
  ledger and `authorId === clearerId` produces a record with `wouldClear: false` and `reason` starting
  `self-clear-refused: self-clear`.
- The same call with either id absent produces `wouldClear: false` and `reason` starting
  `self-clear-refused: unknown-author` / `self-clear-refused: unknown-clearer` respectively (matching
  `decideClearerIndependence`'s clearer-checked-first order).
- The same call with a genuinely independent, both-known pair produces `wouldClear: true` (proves the fix
  does not fail-closed EVERYTHING — only the genuinely-unproven/self-clear cases).
- `summary.wouldClear` / `summary.wouldKeepParked` (`we:scripts/review-runner.mjs:256-257`) visibly cross over
  between the independent-pair case and the self-clear case, pinned by the new test in Task 6.
- `npm run test:unit` is green and `npm run check:standards` is 0 errors with all six files' changes in
  place.
