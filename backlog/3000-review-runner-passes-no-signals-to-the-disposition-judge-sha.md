---
bornAs: x9ns6bc
kind: story
size: 3
parent: "2572"
status: open
dateOpened: "2026-08-08"
tags: [review, review-runner, disposition-judge, shadow-mode, gate-self]
scope:
  - we:scripts/review-runner.mjs
  - we:scripts/lib/review-runner-core.mjs
  - we:scripts/__tests__/review-runner.test.mjs
  - we:scripts/lib/__tests__/review-runner-core.test.mjs
---

# review-runner passes no signals to the disposition judge — shadow log never exercises the gate-self/human-required/non-convergence hard invariants

`runShadowPass` (`we:scripts/review-runner.mjs:181`) calls `runnerShadowPlan` with no `signals`, so `proposeDisposition`'s HARD INVARIANT step (gate-self / human-required / non-convergence) never fires — the shadow log records what a clean panel verdict alone would do, not what the real (future-enforcing) gate would do on a gate-self PR.

## The gap

`runShadowPass` (`we:scripts/review-runner.mjs:181`):

```js
const { intent, plan } = runnerShadowPlan({ ledger, config, currentLabels: item.labels });
```

passes no `signals`. `runnerShadowPlan` (`we:scripts/lib/review-runner-core.mjs:101`) defaults it to `{}` and forwards straight through to `decideDispositionLabel` on the next line:

```js
export function runnerShadowPlan({ ledger = [], config, signals = {}, mandatoryLenses, currentLabels = [] } = {}) {
  const intent = decideDispositionLabel({ ledger, config, signals, mandatoryLenses, currentLabels });
```

`decideDispositionLabel` (`we:scripts/lib/disposition-land-seam.mjs`) hands `signals` straight to the judge, `proposeDisposition` (`we:scripts/lib/disposition-judge.mjs:229`), whose own default is again `{}`:

```js
export function proposeDisposition({ ledger = [], config, signals = {}, mandatoryLenses = MANDATORY_LENSES } = {}) {
  ...
  // 1 — HARD INVARIANT + caller-supplied hard escalates (checked BEFORE the ledger; no verdict overrides them).
  if (signals.gateSelf) { return escalate('gate-self', …); }               // we:scripts/lib/disposition-judge.mjs:243
  if (signals.humanRequired) return escalate('human-required', …);         // we:scripts/lib/disposition-judge.mjs:246
  if (signals.nonConvergence) return escalate('non-convergence', …);       // we:scripts/lib/disposition-judge.mjs:247
```

With `signals` absent end-to-end, all three read `undefined` and none fire. **Every shadow disposition the runner logs is computed as if the PR were never gate-self, never a #2285 conflict-of-interest, and never a round-cap deadlock** — the exact three cases `proposeDisposition`'s own header says are "checked BEFORE the ledger; no verdict overrides them."

## Why it matters

The runner is forced-shadow by construction: `runnerShadowPlan` hard-codes `LAND_MODES.SHADOW` (`we:scripts/lib/review-runner-core.mjs:106`) and the CLI refuses `--enforce` (`we:scripts/review-runner.mjs:197-200`), so `plan.apply` is always `false` — **nothing is mis-merged today**. The damage is upstream of merging: the shadow log is the evidence #2572's shadow→enforce flip will be judged against (see the #2754 agreement-streak metric in `we:scripts/lib/decision-routing.mjs`, the sibling mechanism for the decision-flow analog). On a gate-self PR the shadow log will record `auto-dispose` where the real (enforcing) gate is *structurally incapable* of doing anything but escalate. A shadow run that cannot reproduce the one decision it exists to validate cannot support the conclusion it's built to support — and per `we:scripts/lib/gate-config.mjs:221-222`, `we:scripts/lib/review-runner-core.mjs` is *itself* registered `leash: 'spec'` (declarative-leash, policy tier), so this exact defect sits in a file the runner would misjudge about itself.

## Verification (this defect was re-derived from source, not taken on trust)

- All line numbers above were re-read directly and confirmed current as of this filing (2026-08-08).
- **The `clearable` items `runShadowPass` iterates carry only `{pr, repo, labels}`** — `discoverPending`/`lookupLabels` (`we:scripts/review-runner.mjs:94-133`) call `gh pr list`/`gh pr view` with `--json number,labels` only; no changed-files, diff-lines, dismissed-findings, or cross-repo data is ever fetched. So **the signals cannot simply be threaded through from data already in hand — they must be newly derived**, and the two escalate families need different derivations:
  - `gateSelf` / `humanRequired` need the PR's changed-file set, which the runner does not currently fetch at all. The existing `scoreEscalation` (`we:scripts/lib/review-escalation.mjs:300`) already computes exactly this (`leashFiles`/`statuteFiles` → `humanRequired`, via `isDeclarativeLeashPath`/`isStatutePath`) from a `changedFiles` array — it is the reusable seam, but a diff-files fetch (e.g. `gh pr view --json files` or `gh pr diff --name-only`) has to be added to the runner first.
  - `nonConvergence` (a #2311 round-cap deadlock) is in principle derivable from the ledger already being read (`NEGOTIATION_ROUND_CAP = 5` in `we:scripts/lib/jury-core.mjs:538`, compared against the ledger's `maxRound`), but no existing helper exposes that as a boolean — `reduceLedger`/`summarizeLedger` (`we:scripts/lib/disposition-judge.mjs:81`, `we:scripts/lib/review-runner-core.mjs:116`) report `rounds`/`lensVerdicts` but not "hit the cap without an accept." This is new derivation logic, not a wire-through.
- No unit test in `we:scripts/__tests__/review-runner.test.mjs` or `we:scripts/lib/__tests__/review-runner-core.test.mjs` references `signals` at all — the gate-self/human-required/non-convergence branch of the shadow path is not just unfixed, it is also completely unexercised by the existing suite.
- Checked `we:scripts/lib/gate-config.mjs` (lines 197-230): it registers `we:scripts/lib/review-runner-core.mjs` and `we:scripts/review-runner.mjs` as `leash: 'spec'` — declarative-leash, policy tier — with the stated rationale that `runnerShadowPlan`'s forced-shadow constant "decides what clears the gate." A fix here therefore lands inside the leash file set and should be expected to escalate to `review:human` at PR time; this is **noted as an expectation, not treated as a blocker**.
- Searched the backlog for a prior filing of this exact gap (`runnerShadowPlan`, `proposeDisposition`, `gate-self`). Found #2830 (parent epic), #2864 (a *different*, already-resolved #2830-review finding: ledger-freshness binding, M4), and #2867 (the #2830 review's deterministic check:standards guards, none of which cover this). No existing item names the missing-signals gap; this is a fresh finding, not a duplicate.
- **My own read CONFIRMS the diagnosis as given — nothing in it was contradicted.** The one correction worth recording: the task's line citation for `proposeDisposition` was `we:scripts/lib/disposition-judge.mjs:227`, which is the `@returns` JSDoc line immediately above the function; the function's actual code line (and the `signals = {}` default) is `we:scripts/lib/disposition-judge.mjs:229`. Cited as `:229` above.

## What this is NOT

This is **not a live merge hole**. `runnerShadowPlan` is hard-coded to `LAND_MODES.SHADOW` and `plan.apply` is always `false` — no PR is merged, no label is written, nothing mutates as a result of this defect today. The bug is entirely in what the shadow *log* would claim about a gate-self PR while the runner remains observe-only; it becomes load-bearing only once (if) the shadow→enforce flip for this runner is proposed, at which point the current code would let a gate-self PR through auto-dispose in reality, not just on paper.

## Acceptance criteria

- `runShadowPass` (or `runnerShadowPlan`'s caller) derives real `signals.gateSelf` / `signals.humanRequired` from the PR's actual changed-file set (fetched fresh, not inferred from labels), reusing `scoreEscalation` / `isGateSelfPath` rather than re-deriving the leash/statute path rules.
- `signals.nonConvergence` is derived from the ledger already being read (a round-cap deadlock with no accept verdict), not left `undefined`.
- A shadow-log record for a synthetic gate-self PR (leash-file diff, otherwise-clean unanimous-accept ledger) now shows `disposition: escalate`, `reason: 'gate-self'` — proving the hard invariant fires in shadow, not just in the judge's own unit tests.
- Equivalent coverage added for `humanRequired` (statute-path diff) and `nonConvergence` (round-cap-exhausted ledger) shadow records.
- `we:scripts/__tests__/review-runner.test.mjs` and/or `we:scripts/lib/__tests__/review-runner-core.test.mjs` gain tests exercising all three signals end-to-end through `runShadowPass`/`runnerShadowPlan`, not just through `proposeDisposition` directly.
- No change to `runnerShadowPlan`'s forced-`LAND_MODES.SHADOW` or the CLI's `--enforce` refusal — this item is scoped to making the shadow log accurate, not to arming enforcement.

## Cross-references

- Parent epic: #2572 (wire the scheduled converge-and-label runner).
- Sibling #2830-review finding, same shape: #2864 (ledger-freshness binding before the enforce flip) — filed, not fixed, per the same "design gap the shadow's fail-closed behaviour keeps non-blocking" reasoning.
- `we:scripts/lib/gate-config.mjs` — leash-defining policy-tier registration for the files this fix touches.
- **Same call site, filed separately (2026-08-08, PR #1113 review):** #x7snbvd — `runShadowPass` also
  passes no `authorId`/`clearerId` to `runnerShadowPlan`, which matters once PR #1100 (#2844) lands and
  adds a self-clear-refusal rail keyed on those ids. Not folded into this item: that fix needs
  `authorId`/`clearerId` to exist as `runnerShadowPlan` parameters at all, which only PR #1100 adds —
  this item's `signals` fix needs nothing that isn't already on `main` today. Merging them would either
  force an unwanted `blockedBy` onto this item's already-actionable fix, or leave part of a merged item's
  acceptance criteria structurally unclosable until #1100 lands. Same scope files
  (`we:scripts/review-runner.mjs`, `we:scripts/lib/review-runner-core.mjs`), so the two should not be
  worked concurrently — the dispatcher's scope-overlap hold covers that.
- Related, different file, same review pass: #x62n6v6 — the converge daemon's persisted `shadow.jsonl`
  (`we:scripts/converge-daemon-pass.mjs`, shipped by PR #1113, not yet on `main`) drops per-PR detail and
  cannot feed the ratified `computeAgreementMetric` gate (#2838) in its current shape either.
