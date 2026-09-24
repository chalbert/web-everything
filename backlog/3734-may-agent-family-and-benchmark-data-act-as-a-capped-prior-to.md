---
bornAs: x9i9eqp
kind: decision
parent: "3383"
status: resolved
scope: ["we:scripts/lib/provider-routing.mjs", "we:scripts/lib/model-capability-ratings.mjs", "we:scripts/conveyor/run-scorecards.json"]
dateOpened: "2026-09-20"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
codifiedIn: "docs/agent/platform-decisions.md#supervision-no-borrowed-evidence"
preparedDate: "2026-09-21"
preparedAgainstSha: "10aafdb030ce0eb124af23142add3b3b96844bec"
relatedTo: ["3654", "3673", "3690"]
relatedReport: reports/2026-09-21-supervision-prior-grounding.md
tags: []
---

# May agent-family and benchmark data act as a capped prior toward supervision graduation?

No design for a borrowed-evidence prior exists yet. The three forks below are grounded in a prior-art survey published as [/research/supervision-graduation-borrowed-evidence/](/research/supervision-graduation-borrowed-evidence/) (report linked via `relatedReport`) and a replay over the live scorecard store; each carries a **bold** default. **Prep recommends no prior**, reversing the filing's lean toward a low-risk family prior: the safe credit is at most one trial worth almost nothing, and on today's store a cross-identity family prior is unsafe or inert. The filing's option 2 stays fully specified, so ratifying it is a nod.

## Ruling (ratified 2026-09-24)

**Fork 1 (a) ratified by the operator as prepared: no credit from outside the exact trust tuple.** Forks 2
and 3 are **moot** (they applied only under Fork 1 (b)); Fork 3's default (a) holds regardless, because the
ratings header already forbids benchmark influence. The reopen trigger under Fork 1 is recorded as the only
route back. No code changes; no build child is carved. Codified in
`we:docs/agent/platform-decisions.md#supervision-no-borrowed-evidence`.

**Ratification skeptic** (independent `judgePanel` seat, run `ratify-3734`, ok): named no violated
principle; four evidentiary findings, dispositioned:
1. *Overrides the operator's 2026-09-20 direction on Medium confidence* — dissolved: the operator ratified
   (a) knowing it reverses that lean.
2. *Finding 1 uses a placeholder threshold with no runtime caller* — accepted as a caveat already on the
   card: a higher calibrated bar raises the possible credit but never removes the one-real-trial floor.
3. *Finding 2 rests on 26 rows* — accepted: the numeric findings are supporting context. The load-bearing
   ground is the operational-design-domain scoping and the ratified "never across triples".
4. *A reopen trigger implies the default is provisional* — accepted: the ruling stands as the default until
   the trigger's back-test is met, then reopens through a batched finding, not a new decision card.

## Where the call sits

A "prior" would count a few virtual clean trials toward a supervision bar before this exact `{provider, model, taskType}` triple has earned the same evidence itself. Operator direction 2026-09-20: base graduation on risk, so limited-risk work may reach after-the-fact spot-check faster, informed by benchmarks and agent family. Ratified text says no today: the unit of trust is "strictly `{provider, model, subjectClass, taskType}`, never broader" (`we:scripts/lib/provider-routing.mjs:26`); no identity buys an easier bar "by vendor reputation, or by benchmark claims made outside this system" (`we:docs/agent/platform-decisions.md:4856-4865`); and a newer release "must never automatically inherit an older model's accumulated trust just because it shares a provider name or a family label" (`we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md:2457-2459`).

The concern splits on four orthogonal axes, each pinned to the real tree. **Who may lend evidence** (which relation counts: Fork 2). **What may be lent** (family record only, or also benchmark ratings: Fork 3; `we:scripts/lib/model-capability-ratings.mjs:12-15` forbids it and `we:scripts/lib/model-capability-ratings.json` ships `"entries": []`). **How far it reaches** (risk tiers: a per-tier cap value, settled inside Fork 1). **Where it lives** (an argument to `selectSupervisionLevel`, `we:scripts/lib/provider-routing.mjs:732`, or a row in `we:scripts/conveyor/run-scorecards.json`). The last axis is not a choice: `evaluateProviderFitness` reads the same rows (`we:scripts/lib/provider-routing.mjs:403-423`) and treats one clean verified row as fitness to be handed the work, so a borrowed row would make an identity that never ran *eligible for dispatch*. That is a forced invariant, listed below, not a fork.

**Recommended path at a glance**

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — may outside evidence count at all? | **(a) No credit from outside the exact triple** | (b) capped low-risk credit (the filing's option 2) | Medium — the operator's own direction points the other way; the evidence does not |
| Fork 2 — which relation may lend? *(only if Fork 1 is (b))* | **(a) Same model, other task type — not cross-model family** | (c) adjacent releases of one vendor line (the only branch that serves the operator's "agent family" wording) | Medium-high |
| Fork 3 — may a benchmark count? *(only if Fork 1 is (b))* | **(a) Never; advisory tiebreak only** | (b) named fields add capped credit | High |

## Fork 1 — May evidence from outside the exact triple count toward a supervision bar?

**Why this is a fork.** Case (b), a real either/or: the ratified rule "trust never carries across triples" and a credit cannot both stand, because a credit is by definition a different amount of real evidence for different triples. **Composability probe, failed:** expose the cap as project config (0 by default) so both coexist. The statute admits config only as an "optional per-project tightening" over "one uniform FLOOR" (`we:docs/agent/platform-decisions.md:4856-4865`); a loosening knob is an easier bar for some identity, which that clause forecloses. So this is a statute amendment, not a config dimension: `#config-extends-platform-default` covers multi-legitimate-end-state concerns, not trust loosening.

- **(a) No credit from outside the exact triple. ← RECOMMENDED.** The record stays the single source of evidence for both consumers; the risk tier (in flight, below) and role authority (#3654 clause 3) vary the bar, uniformly for every identity, never by identity. Merit: `taskType` is this context's *operational design domain* (`we:backlog/3690-track-and-consider-graduating-session-initiated-codex-delega.md:141-146`), and a safety case is scoped to its domain — evidence in one domain does not carry into another by definition. Downside on merit: a new identity's low-risk cell needs its own two clean full-supervision trials before the check lightens.
- **(b) A capped, audited credit — low-risk ceiling only** (the filing's option 2, with Forks 2–3 and the forced invariants below fixed). Merit: for a cell whose lending relation has a cleared record, the check lightens one trial sooner. Downsides on merit: the credit crosses an operational design domain on an unmeasured claim, and nothing in the store can measure it; ratifying it amends #3690's "never across triples" and, for any wider relation, #3654 clause 4. **The ceiling is low risk.** Widening it to medium (the filing's option 3, minus its benchmark half, which is Fork 3) is *Rejected as a co-equal branch*: the credit's value scales with the tier threshold and its exposure with risk, so the benefit and the risk of the exception both grow only there, with no data to size either; a later widening is a new ratification, never a batched-finding value change.

**The two computed findings behind the default** (full working in the session report §3–§4, verified against `origin/main`):

1. *The safe-end credit is at most one trial, worth almost nothing.* Rule 3 of `#delegation-trial-record-graduation` requires a clean most-recent **verified** trial, which only a real row supplies, so at least one real clean trial is always required; at the low-risk bar of two (`GRADUATION_THRESHOLDS_BY_RISK.low` in `we:scripts/lib/dispatch-thresholds.mjs`, on main since #3897 but still a placeholder with no runtime caller — a higher calibrated bar would raise the credit, never the one-real-trial floor) the credit is one. With zero failures, the exact one-sided 95% upper bound on the failure rate is 95.00% at N=1 and 77.64% at N=2, and the borrowed half was never measured against this identity.
2. *Across identities a family credit is unsafe or inert on today's store.* Replaying the real `selectSupervisionLevel` over the 26 rows, a label-constant one-trial credit flips four triples. Two are `gpt-6-astra` cells whose lender is the same model on another task type (the relation Fork 2 (a) endorses); one is `gemini-3.8/other`, whose Gemini siblings have no cleared record at that task type; one is `claude-sonnet-5/other`, whose only recorded family-sibling outcome is a **rejected** trial. A credit derived from a *different identity* of the same family that has cleared the bar at the same task type flips **none**. The same-model relation moves two cells, but only one model (`gpt-6-astra`) qualifies, so it is unvalidated too.

**Known occurrences.** Borrowing from a predecessor is a named practice, and it is never label-only: FDA's Bayesian guidance for medical devices accepts priors from predecessor-device trials only with demonstrated exchangeability and prefers borrowing that discounts itself when new data drift; ICH E5 bridging studies accept foreign data but a region may still require a local study; FAA 14 CFR 21.19/21.101 reuses an earlier certification basis only where a change is not significant. AWS's graduated-autonomy scheme keeps trust non-transitive. Each carries the three guards the forced invariants below copy.

**Code shape (illustrative — the API below does not exist).** The only form that touches one consumer, keyed to the real signature at `we:scripts/lib/provider-routing.mjs:732` (`provider, model, taskType, scorecards, backdownThresholds, subjectClass`):

```js
// Fork 1 (b) — the credit is an ARGUMENT, and comes back in the audit trail
selectSupervisionLevel('codex', 'gpt-6-astra', 'self-fix', records,
  { minCleanStreak: 2, requireInformativeTrial: false }, 'work-agent',
  { prior: { virtualClean: 1, relation: 'same-model-other-taskType',
             from: [{ triple: ['codex', 'gpt-6-astra', 'bugfix'], rows: ['pr:2301@2026-09-19', 'pr:2299@2026-09-19'] }] } });
// → auditTrail gains { criterion: 'virtual-prior', result: 'credited:1',
//     dataConsulted: 'real=1, virtual=1, from=[…]', reasoning: '…' }
```

```js
// Fork 1 (b), REJECTED form — a row in run-scorecards.json
{ provider: 'codex', model: 'gpt-6-astra', taskType: 'self-fix',
  outcome: 'landed', verifiedBy: 'independent-claude', virtual: true }
// isCleanRecord (provider-routing.mjs:316) reads outcome only → evaluateProviderFitness (:371) counts it
```

**Trigger to reopen (a).** Through an ordinary batched finding, once the store can back-test a declared relation: at least five triples, across at least two models, that graduated on their own data after a same-relation lender had already graduated, and a replay shows lender-derived credit would never have advanced a triple that later recorded a miss. The counts are placeholders for that finding to set, like every other number in the graduation rulings.

**Skeptic:** SURVIVES-WITH-AMENDMENT — the default held against the classification, merit, statute-overlap and citation-scope attacks; amendments folded in: the (b)/(c) tier split collapsed (a tier ceiling is a per-tier cap value, so medium became a named rejected extension, not a rival branch); finding 2 restated to separate the same-model relation from cross-identity credit; the "needs a taxonomy" downside moved to Fork 2, where it applies; "only lever" reworded to "not by identity"; the placeholder-bar caveat added; the merit basis moved to the operational-design-domain statement.
**Screen:** clear — a legitimate governance ruling on repo-internal tooling (not an impl detail); with both branches free to build, a merit difference remains (evidence crossing a domain on an unmeasured claim, and precedent-consistency, against one trial of lighter checking).

## Fork 2 — If a credit is admitted, which relation may lend? *(applies only if Fork 1 is (b))*

**Why this is a fork.** Case (a), an excluded branch: crediting by **vendor-line name** is the flawed one, because a label with no in-system record behind it is exactly the reputation `#model-probation-graduation-criteria` clause 4 forecloses, and the store shows it: a name-based credit would lend `claude-sonnet-5/other` a family whose one recorded outcome is a miss. The remaining relations form a nested ladder, and the statute must fix one ceiling because config may only tighten; they differ in *which ratified rule each overturns*.

- **(a) Same `{provider, model, subjectClass}`, other task type, where that triple has itself cleared the bar. ← RECOMMENDED.** *This is not cross-model family* — it is the same model's own record on neighbouring work, the narrowest relation. It overturns only #3690's "never across triples", leaves #3654's identity rule and #3383's release rule intact, and needs no family taxonomy. It applies to two cells today. The credit needs the lender's *record*, not a label, and drops when that record does (a forced invariant below).
- **(b) (a) plus the same model weights served by another host** (agy-hosted Claude ↔ native Claude, `AGY_CLAUDE_MODEL_BY_TIER` at `we:scripts/lib/provider-routing.mjs:136`), declared in a hand-edited table. Downside on merit: the provider is part of the unit and the execution context differs (the header at `:48` says Antigravity's sandbox is not a native session), so the lender's record describes a different harness; the relation also needs a declared table, the "ungrounded category" the #3654 skeptic flagged for risk classes.
- **(c) (b) plus adjacent releases of one vendor line**, declared in the same table — the only branch that serves the operator's "agent family" wording. **Rejected as the default:** it overturns #3383's identity rule and the ratified "never inherited by a model upgrade" (`we:docs/agent/platform-decisions.md:4832`) — and the store's one such pair (`claude-sonnet-5` clean, `claude-sonnet-4-6` rejected; one row each, cross-release) is an anecdote that points the wrong way, not evidence. Supporting context, not the ground: no vendor line in the store has a cleared predecessor whose successor has been measured.
- **(d) Vendor line by name. Rejected** — reputation, per above.

**Skeptic:** SURVIVES-WITH-AMENDMENT — default held; folded in: the fork retitled from "family" to "which relation may lend" and (a) labelled as not cross-model family; the rationale re-cited from the ratified operational-design-domain statement instead of superseded backdown-plan prose; the cross-release pair moved to (c); (c)'s rejection re-grounded on the ratified "never inherited by a model upgrade" text rather than #3383's word "automatically", since the credit here is not automatic.
**Screen:** flagged(prio) → rewritten: the rejection of (b) and (c) now rests on merit (a different execution context; the identity rule and the no-inheritance statute), and "no validating data" is demoted to supporting context; the ceiling is stated as a statute-level choice because config may only tighten.

## Fork 3 — If a credit is admitted, may a benchmark rating count toward it? *(applies only if Fork 1 is (b))*

**Why this is a fork.** Case (a), an excluded branch: benchmark credit is the flawed one. **Load-bearing on merit:** (1) it measures a different population — the header at `we:scripts/lib/model-capability-ratings.mjs:3-4` says a rating "cannot establish trust", and external measures overstate: SWE-Bench+ found 32.67% of passing patches on the original SWE-bench involved solution leakage and 31.08% were weak-test passes, and METR's randomised trial on real tasks found a 19% slowdown while the developers believed they were 20% faster — measures of AI coding ability and in-context outcomes can diverge; (2) its five categories are keyed by `{provider, model}` only, with no task-type or risk axis to match a triple. **Already ratified, so precedent rather than new merit:** #3654 clause 4 forecloses "benchmark claims made outside this system". **Contingent, not load-bearing:** the registry ships `"entries": []` today. **Composability probe, failed:** a benchmark would have to be converted into virtual trials by a transfer function, and no in-system data can calibrate one. Tightening is unaffected: clause 4 lets a project use any signal to make a bar stricter.

- **(a) Never — a benchmark stays an advisory tiebreak inside `selectProvider`'s `explorationHint` (`we:scripts/lib/provider-routing.mjs:21-23`). ← RECOMMENDED.** The ratings module header at `:12-15` is unchanged.
- **(b) Named benchmark fields add capped credit** (the filing's option 3, benchmark half). Rejected for the reasons above; ratifying it would also amend the ratings header.

**Skeptic:** SURVIVES — the attacks (a benchmark as a tighten-only input; the empty registry being contingent) did not reach the credit question; folded in: the METR claim scoped to "measures diverge" (its 20% was a post-task belief, its pre-task forecast 24%), the ratified-text and empty-registry grounds relabelled as precedent and contingent, and a Done-when branch for 3 (b) added.
**Screen:** clear — a trust-input policy with a real merit difference (validity and domain match), not an impl detail; ground (3) marked non-load-bearing.

## Already forced by ratified rules — adopted with Fork 1 (b), not decisions

Each holds whichever Fork 2–3 answer is ratified.

1. **An argument, never a row** — see the axis paragraph; `#delegation-trial-record-graduation` rule 1 makes a change to what counts as clean "a governed change wherever the record is read".
2. **At least one real clean verified trial, and a clean most-recent real trial, always required; the positive control is always real.** Rules 3 and 4 (informative is "its own recorded field").
3. **Strictly below the tier threshold.** The number is a `backdownThresholds`-style config default set by a batched finding (rule 3; no graduation ruling fixes a numeric threshold); the **initial value 1** is this card's default, not a ruling.
4. **A real miss by the exact triple zeroes the credit, and it stays zero.** Rule 5 of `#delegation-trial-record-graduation`: post-miss trials count only after a root-cause note, at a bar *strictly higher* than cold-start — a credit that came back would lower it; `#calibration-veto-clearing` clause 3 (decay never restores) is the same principle for a reviewer's veto. This is the binary limit of a robust mixture prior, which drops borrowed information on prior–data conflict.
5. **A lender's miss drops the credit at once.** The credit is computed from the lender's *current* record at read time, never stored (invariant 1), so rule 6's "demotion is computed" covers it.
6. **The credit changes eligibility, not the level.** Rule 6: promotion is a ratified batch act naming triples; the batch listing shows real and virtual counts apart, the way FDA reports a prior's effective sample size apart from the trial's own.
7. **The audit records each use:** the relation, the lender triple and rows, the virtual count and the real count. A sunset check compares the later miss rate of triples that graduated with a credit against those that graduated on data alone.

**Scope conditions adopted with the ceiling (not forced by ratified rules).** No credit for statute-tier work — `isStatuteTierPath` already routes it to Claude and it never reaches an external model on main — nor for gate-self, irreversible or high-risk work, which `we:scripts/lib/dispatch-thresholds.mjs` keeps out of spot-check. That module landed on main with #3897 (2026-09-24) as a contract with no runtime caller yet (its G2 dispatcher wiring is still to come), so the second half is adopted here by ratifying (b), not inherited.

## Supported by default (not decisions)

- Risk-tiered thresholds and the after-the-fact sampler: adopted, in flight, and independent of this call.
- Project tightening of any bar: already ratified (#3654 clause 4).
- Benchmark ratings as an advisory exploration hint: unchanged.

## Context

**Already adopted (not part of this fork).** Slice `graduation-1` landed on main with #3897 (2026-09-24) as `we:scripts/lib/dispatch-thresholds.mjs`, marked a contract for G2 dispatcher wiring with no runtime caller yet. The same landing widened the unit of trust to `{provider, model, subjectClass, taskType}`, which narrows the unit further and so strengthens Fork 1 (a). It ships: placeholder thresholds low `{minCleanStreak: 2, requireInformativeTrial: false}`, medium equal to `DEFAULT_BACKDOWN_THRESHOLDS` (5, informative required, `we:scripts/lib/provider-routing.mjs:148`), high `{8, true}`; statute-tier, gate-self, irreversible and main-affecting work never eligible for spot-check; a deterministic sampler over story, round and task. Its own comment says independent PR review "still gates EVERY PR landing", so in-story supervision may be cheaper than the PR-level gate. Supervisor trials take ground truth from CI, independent PR review, rework rounds and later reverts, never the supervisor's own verdict. That slice introduces no family or benchmark prior. *(Re-validated 2026-09-24 against main `6b53b0a84`: citations re-pointed after #3897; the 26-row store is unchanged, so both computed findings stand.)*

**Classification (per-fork pass).** Layer: statute-layer governance over in-repo tooling in `we:scripts/lib/`, not a Block, Intent, Protocol or Capability; no vendor-interop story, so not a protocol. Q3–Q5 and Q7 do not apply. Q6 (most-permissive default) governs config dimensions and does not extend to loosening a trust bar, per `#model-probation-graduation-criteria` clause 4. Standard-layer grounding: no UI vocabulary is mapped here, so no intent owns the terms.

**Statute overlap (checked in prep).** Same-turf anchors in `we:docs/agent/platform-decisions.md`: `#model-probation-graduation-criteria` (:4826), `#calibration-veto-clearing` (:4878), `#delegation-trial-record-graduation` (:4930), `#agent-vendor-registry` (a descriptor "never declares its own … trust", so a relation table must not be a descriptor field), `#every-pr-gets-a-look-advisory-floor` (:4319; the after-the-fact spot-check sampler covers in-story supervision only, the every-PR look is a separate floor). Ratifying (b) with Fork 2 (a) amends #3690's "trust never carries across triples" alone; any wider relation or a benchmark also amends #3654 clause 4 and #3383. Ratifying (a) reaffirms all three and amends nothing.

**Citation scope.** The default (a) rests on the ratified operational-design-domain statement (`we:backlog/3690-track-and-consider-graduating-session-initiated-codex-delega.md:141-146`) and on #3690's "trust never carries across triples", which govern this exact turf. It does *not* lean on #3654 clause 4 as authority against a same-model credit: that clause governs identity reputation and benchmark claims, which is why Fork 2 (a) is a distinct, narrower branch rather than ruled out by it.

## Done when

The following are acceptance checks for the eventual result, not claims of completed work. Test names are proposed checks to add if their branch is ratified.

**If Fork 1 (a) is ratified:**

- A text check of this card finds an explicit ruling choosing Fork 1 (a), Fork 2 and Fork 3 closed as moot, and the reopen trigger recorded.
- A header comparison finds no change in `we:scripts/lib/provider-routing.mjs` or `we:scripts/lib/model-capability-ratings.mjs`.
- A grep still finds "never broader" and "NEVER inside" in `we:scripts/lib/provider-routing.mjs`, and "THIS DATA MUST NEVER INFLUENCE" in `we:scripts/lib/model-capability-ratings.mjs`.

**If Fork 1 (b) is ratified:**

- A text check of this card finds the chosen relation (Fork 2), the benchmark answer (Fork 3), the low-risk ceiling and the initial cap.
- Test `supervision-prior-is-capped-and-labelled-virtual`: `selectSupervisionLevel` accepts a prior argument and returns its credit labelled virtual in `auditTrail`.
- Test `virtual-credit-is-never-a-scorecard-row`: no code path writes a virtual row to `we:scripts/conveyor/run-scorecards.json`, and `evaluateProviderFitness` output is unchanged by a prior.
- Test `prior-cannot-supply-the-positive-control-or-the-last-trial`: a triple with zero real clean verified trials stays at `full` under any prior.
- Test `real-calibration-miss-zeroes-exact-triple-prior`: a real miss zeroes the credit and it stays zero.
- Test `lender-miss-drops-borrowed-credit-at-once`: a later miss in the lending triple removes the borrower's credit on the next read.
- Test `excluded-work-gets-zero-prior`: statute-tier, gate-self, irreversible and main-affecting work.
- Test `prior-respects-ratified-risk-tiers`: medium and high risk rejected.
- Test `prior-uses-only-ratified-inputs`: with Fork 3 (a), no benchmark field changes any result; with Fork 3 (b), only the named fields do.
- A header check of `we:scripts/lib/provider-routing.mjs` finds the bounded exception in the module header and the `selectSupervisionLevel` block. A header check of `we:scripts/lib/model-capability-ratings.mjs` finds the "NEVER influence" sentence unchanged under Fork 3 (a), and amended to name the exact permitted fields under Fork 3 (b).
- A text check finds an amendment note in Fork 4 of `we:backlog/3654-define-graduation-criteria-for-a-model-provider-to-exit-prob.md`, and the matching exception in `we:docs/agent/platform-decisions.md#model-probation-graduation-criteria` and `#delegation-trial-record-graduation`.

**Predicted touch-set (only if Fork 1 (b) is ratified).** The build child this call would carve is scoped to `we:scripts/lib/provider-routing.mjs` and its tests; the amendment notes are a separate docs child scoped to `we:docs/agent/platform-decisions.md` and `we:backlog/3654-define-graduation-criteria-for-a-model-provider-to-exit-prob.md`. Fork 3 (b) alone would add `we:scripts/lib/model-capability-ratings.mjs`. Fork 1 (a) carves no child.

### Review jury (provisional — pre-registered #2638)

Care level: `high`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open. Five lenses, two jurors each, all `static-review`; each holds the bar below.

| lens | pre-registered expectation |
| --- | --- |
| correctness (×2) | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security (×2) | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity (×2) | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance (×2) | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy (×2) | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
