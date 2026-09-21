---
bornAs: x9i9eqp
kind: decision
parent: "3383"
status: open
scope: ["we:scripts/lib/provider-routing.mjs", "we:scripts/lib/model-capability-ratings.mjs", "we:scripts/conveyor/run-scorecards.json"]
dateOpened: "2026-09-20"
tags: []
---

# May agent-family and benchmark data act as a capped prior toward supervision graduation?

Ratify whether agent-family and benchmark data may count as a small, capped, audited prior toward supervision graduation (low risk only, by the agent's recommendation), given we:scripts/lib/provider-routing.mjs (unit of trust is strictly {provider, model, taskType}) and we:scripts/lib/model-capability-ratings.mjs (its data must never influence selectSupervisionLevel). Options 2 and 3 would amend the ratified #3654 Fork 4. Operator direction 2026-09-20: graduation depends on risk and may reach after-the-fact spot-check faster when risk is limited.

## The question

May agent-family and benchmark data act as a capped prior toward supervision graduation?
A prior would count as limited virtual trials before this exact identity has earned equivalent real evidence.
The operator's direction on 2026-09-20 is to base graduation on risk, with faster after-the-fact spot-checks when risk is limited, informed by benchmarks and agent family.
Whether to permit that prior, and under which guardrails, remains open.

## Standing rules this touches

- `we:scripts/lib/provider-routing.mjs` names the unit of trust as strictly `{provider, model, taskType}`, "never broader", with no inherited trust.
  Its header limits capability data to advisory provider exploration, NEVER `selectSupervisionLevel`.
  The function's own block describes an exact-triple clean streak, an informative-trial requirement, and a hard veto for the most recent unclean verified trial.
- `we:scripts/lib/model-capability-ratings.mjs` says its data must NEVER influence `selectSupervisionLevel`.
  Its header reserves supervision and graduation for probation records and real scorecard evidence.
- `we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md` records that a new model release starts its own probation record.
  A shared provider or family label does not pass on trust or gating status.
- `we:backlog/3690-track-and-consider-graduating-session-initiated-codex-delega.md`, under "Progressive backdown plan", requires five consecutive clean verified trials for the exact triple.
  It also requires an informative trial and resets the streak on a confirmed finding.
  Its uniform floor cannot be loosened by provider reputation.
- `we:docs/agent/platform-decisions.md#model-probation-graduation-criteria` codifies one uniform floor for every `{provider, model}`.
  The historical ruling is Fork 4 of `we:backlog/3654-define-graduation-criteria-for-a-model-provider-to-exit-prob.md`, approved on 2026-09-13.
  It forbids an easier bar by vendor reputation "or by benchmark claims made outside this system".
- `we:scripts/conveyor/run-scorecards.json` stores trial rows in a `records` array.
  The rows carry identity, task type, outcome, verifier, findings, and scoring time.

## Already adopted (not part of this fork)

The operator reports the following as adopted and in flight in slice `graduation-1` on branch `lane/mechanical-dispatcher`.
They are not yet on main and are not presented here as existing code.
That slice does not introduce family or benchmark priors.

- In flight: risk-tiered thresholds, with placeholder counts of two clean trials for low risk, five for medium risk, and eight for high risk.
  Low risk needs no informative trial; medium and high risk require one.
- In flight: statute-tier, gate-self, irreversible, or main-affecting work is never eligible for spot-check.
- In flight: a deterministic after-the-fact sampler hashes story, round, and task, with a sampling rate per risk tier.
- In flight: supervisor trials use ground truth from CI, independent PR review, rework rounds, and later reverts.
  The supervisor's own verdict never supplies that ground truth.

## The fork

1. No priors.
   The strict unit of trust stays unchanged.
   Pro: graduation rests entirely on evidence from the exact triple.
   Con: even limited-risk work must gather all its own trials before supervision can ease.

2. **Capped family prior for LOW risk only — agent recommendation and default.**
   A small, capped number of virtual trials would be labelled separately in the audit trail.
   Statute-tier, gate-self, irreversible, and main-affecting work would receive no prior.
   Any real calibration miss by the exact `{provider, model, taskType}` would zero its prior.
   Benchmarks would remain an advisory tiebreak, never graduation evidence.
   Pro: limited-risk work could reach spot-check sooner while the borrowed credit stays visible and bounded.
   Con: family membership would still substitute for some evidence from the exact identity.

3. Family plus benchmark prior for low and medium risk.
   Both sources would contribute capped, audited virtual trials within those risk tiers.
   The exclusions and exact-triple calibration-miss reset from option 2 would still apply.
   Pro: more eligible work could reach spot-check sooner using both sources of prior information.
   Con: benchmark relevance and family similarity would need calibration across a wider risk range.

Option 2 is recommended because it limits the exception to low risk and keeps benchmark scores out of graduation evidence.
The cap, family definition, permitted inputs, and audit contract remain for preparation and ratification.

Options 2 and 3 would amend #3654 Fork 4 through a small, capped, in-system, audited exception.
Ratifying either must also amend that ruling and the wording in both `we:scripts/lib/provider-routing.mjs` and `we:scripts/lib/model-capability-ratings.mjs` headers.
Option 1 leaves the ruling untouched.

## Done when

The following are acceptance checks for the eventual result, not claims of completed work.
Test names below are proposed checks to add if their branch is ratified.

**If option 1 is ratified:**

- A text check of this card finds an explicit ruling choosing option 1 and rejecting virtual graduation trials.
- A header comparison against the pre-decision copies finds no changes in either `we:scripts/lib/provider-routing.mjs` or `we:scripts/lib/model-capability-ratings.mjs`.
- A grep check still finds "never broader" and "NEVER inside" in `we:scripts/lib/provider-routing.mjs`, and "THIS DATA MUST NEVER INFLUENCE" in `we:scripts/lib/model-capability-ratings.mjs`.

**If option 2 or 3 is ratified:**

- A text check of this card finds the chosen option, numeric cap, family definition, allowed risk tiers, and permitted input fields.
- Test `supervision-prior-is-capped-and-labelled-virtual` proves `selectSupervisionLevel` in `we:scripts/lib/provider-routing.mjs` accepts a capped prior and returns its credit labelled as a virtual trial.
- A header check of `we:scripts/lib/provider-routing.mjs` finds the bounded exception in both the module header and the `selectSupervisionLevel` block.
- A header check of `we:scripts/lib/model-capability-ratings.mjs` finds the exact field allowed to feed the prior and excludes every other field.
  For option 2, that check also requires an explicit statement that no benchmark field supplies graduation evidence.
- Test `prior-audit-distinguishes-virtual-from-real` proves prior-derived trials are marked `virtual` in `we:scripts/conveyor/run-scorecards.json` rows or the returned audit output.
- Test `real-calibration-miss-zeroes-exact-triple-prior` proves a real calibration miss zeroes the prior for that exact triple.
- Test `excluded-work-gets-zero-prior` covers statute-tier, gate-self, irreversible, and main-affecting work.
- Test `prior-respects-ratified-risk-tiers` rejects medium and high risk under option 2, and high risk under option 3.
- Test `prior-uses-only-ratified-inputs` proves benchmarks cannot change graduation under option 2 and only the named benchmark fields can contribute under option 3.
- A text check finds an amendment note in Fork 4 of `we:backlog/3654-define-graduation-criteria-for-a-model-provider-to-exit-prob.md` and the matching exception in `we:docs/agent/platform-decisions.md#model-probation-graduation-criteria`.
