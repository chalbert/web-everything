---
bornAs: xadzx6f
kind: decision
status: open
dateOpened: "2026-08-16"
preparedDate: "2026-08-17"
relatedReport: reports/2026-08-17-power-estimator-validity-floor.md
relatedTo: ["3090", "3083"]
tags: [measurement, statistics, gate]
---

# Should requiredNPerGroup fold in this module's own 5-and-5 validity floor?

## Digest

`requiredNPerGroup` answers a pure power question; `compareProportions` separately refuses below 5
successes-and-5 failures per group. Above `baseRate ≈ 0.93` the two diverge, so the estimator can say
"collect N" and the same module still refuses at N. **No design existed for closing that gap** — the
originating card ([#3090](/backlog/3090-the-sample-size-estimator-says-one-observation-is-enough-whe/))
named it "a modelling call, not a bug fix" and left it as a box.

The two forks below are grounded in a prior-art survey published as the `/research/` topic
[power-estimator-validity-floor](/research/power-estimator-validity-floor/) (session artifact:
`we:reports/2026-08-17-power-estimator-validity-floor.md`), which surveyed R, statsmodels, SAS, Stata, PASS
and G*Power, and in a **measured** patch-and-revert run of the proposed fold against
`we:scripts/operations/__tests__/gate-health.test.mjs`. Each fork carries a recommended default in **bold**.

**The survey reshaped the call.** The original card framed this as a straight A/B whose cost was
"re-derive some pinned constants." It is not: the fold is **positively disproven**, on three independent
grounds (no toolkit does it; it does not deliver its own guarantee; it breaks the module's live verdict
path) — so Fork 1 is a *forced invariant to ratify*, not a weigh. What survives as a genuine choice is a
question the card never asked: **if the estimator stays pure, where does the validity constraint live for a
caller who needs both?** That is Fork 2, and the status quo's answer (a docstring) turns out to be defective
in its own right.

## The axis

Three things are in play, and only two of them are choices.

- **The power criterion.** `requiredNPerGroup(baseRate, mdd)` —
  `we:scripts/lib/gate-health.mjs:245-260` — is the textbook two-proportion sample-size formula and nothing
  else: `n = ceil((1.96 + 0.84)² · 2 · p̄ · (1 - p̄) / d²)` with `p̄ = p + d/2`, at 80% power, α = 0.05,
  two-sided. Its docstring already documents the divergence at length
  (`we:scripts/lib/gate-health.mjs:232-241`).
- **The validity criterion.** `compareProportions` — `we:scripts/lib/gate-health.mjs:153` — computes
  `usable = Math.min(kA, nA - kA, kB, nB - kB) >= 5` from **observed** counts, and forces `separated` false
  below it (`:167`). `assessCriteria` mirrors the same rule in counts as `testable` / `shortBy` /
  `shortCells` (`we:scripts/lib/gate-health.mjs:355,365-369`).
- **The seam between them.** `assessCriteria` is the only consumer. It calls the estimator in exactly three
  places: the corpus-wide headline (`:296`), the per-band display field (`:364`), and — critically — as its
  own **`sizeableMdd` probe** (`:329`, `requiredNPerGroup(0, mdd) !== null`). Nothing gates a verdict on the
  estimator's number: the verdict hangs on `testable`/`shortBy`, computed from the four raw cell counts
  (`:367-369`, blocker at `:373-389`).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| Fork 1 — what `requiredNPerGroup` returns | **(b) the pure textbook power formula, unchanged** | (a) fold the floor in — `max(powerN, floorN)` | **High** — (a) is positively disproven, not merely costlier |
| Fork 2 — where the validity constraint lives for a caller | **(b) correct the docstring's over-promise AND publish the floor as a named sibling export + a `requiredNForExpectedValidity` field** | (a) docstring only (status quo); (c) corrected docstring, no new export | Med-high |
| Fork 2 sub-fork — what the published floor is sized to | **expected-cell-5 (`5 / min(p, 1-p, p+d, 1-(p+d))`)** | a coverage-quantile floor (smallest n with P(observed min cell ≥ 5) ≥ 0.95) | Medium |

## Forced invariant — ratify, don't weigh

**Any floor expression this module adopts must refuse at `p = 0`, not return `Infinity`.**
`5 / min(p, 1-p, p+d, 1-(p+d))` is `5/0 = Infinity` at `p = 0`, and `p = 0` is not a corner case here: it is
the literal input of the module's own `sizeableMdd` probe (`we:scripts/lib/gate-health.mjs:329`) and the
ordinary per-band clean-arm rate whenever a band has recorded no defects (`:356,364`) — the common case on a
corpus with a ~3% defect rate. This binds both forks: it is why Fork 1 (a) breaks the module, and it is a
required guard on whatever Fork 2 publishes.

## Supported by default (not decisions)

- **A caller computing the floor itself.** Already supported and already documented; nothing below removes
  it. Fork 2 only changes whether the module also publishes the number.
- **`compareProportions` keeping its 5-and-5 refusal.** Not on the table here. Whether it should instead
  offer a small-sample-valid method is a real and newly-surfaced question — see *Context → the adjacent
  question*.
- **Both numbers existing.** The power n and the validity floor are different quantities answering different
  questions; nothing in this decision proposes suppressing either. The forks are about which *name* carries
  which number, and whether the second one is published.

## Fork 1 — what does `requiredNPerGroup` return?

**Why this is a fork:** one exported name returns exactly one number, and every pinned expectation and every
call site reads that one number — `requiredNPerGroup(0.044, 0.2)` cannot be both 49 and 114. The
composability probe fails at the name: a shared kernel can produce both quantities (that is Fork 2), but it
cannot make this identifier resolve to two values at one call site. This is fork-existence **case (a)** — a
forced invariant, because branch (a) is *broken*, disproven below rather than asserted.

### Options

**(a) Fold the floor in** — return `Math.max(powerN, Math.ceil(5 / Math.min(p, 1-p, p+d, 1-(p+d))))`, so
"how many do I need" and "will the module accept that many" become the same question.

*Rejected — flawed, on three independent grounds:*

1. **No prior art, anywhere.** R `stats::power.prop.test`, R `pwr::pwr.2p.test` 1.3-0, statsmodels 0.14.6
   (`samplesize_proportions_2indep_onetail`, `NormalIndPower`), SAS `PROC POWER TWOSAMPLEFREQ`, Stata
   `power twoproportions`, PASS "Tests for Two Proportions" and G*Power 3.1 all return a pure inversion of
   the power equation. **None** floors the n; **none** warns when the returned n leaves an expected cell
   under 5. The only documented upward adjustment on offer anywhere is the opt-in continuity correction,
   which PASS explicitly does not recommend. NumPy's NEP 23 says the same thing on the API side — *"the
   possibility of an incorrect result is worse than an error or even crash"*, and a behaviour change needs
   deprecation, never a silent value swap. **NEP 23 is cited as supporting precedent, not as authority:** it
   governs NumPy's own public-API release process, not a repo-internal helper with one live consumer. It
   shows that "silently redefining a named formula" is a recognised anti-pattern in numerical libraries; the
   rejection of (a) rests on the toolkit survey and on grounds 2 and 3, and stands without it.
2. **It does not deliver its own guarantee.** `5 / min(...)` is an **expected**-count floor, so at exactly
   that n the binding cell is a count whose *mean* is 5 — and `compareProportions` gates on the **observed**
   count (`we:scripts/lib/gate-health.mjs:153`). A count with mean 5 reaches 5 only about **56%** of the time
   (Poisson(5): `P(X ≥ 5) ≈ 0.56`; the `ceil` adds a small further margin), so the floor is missed on roughly
   two runs in five — and that is the *binding* cell alone, before requiring all four cells to clear. The
   entire argument for folding is "collect the number it names and the module will accept it." The arithmetic
   says it would still be refused a large fraction of the time it fired.
3. **It breaks the module's live verdict path — measured, not predicted.** Patched in at
   `we:scripts/lib/gate-health.mjs:252`, suite re-run, patch reverted: **8 of 53 tests fail**. Only three are
   re-derivable constants (49→114, 212→500, 153→null). The other five all cascade from one live defect: the
   `sizeableMdd` probe (`:329`) passes `p = 0`, the floor is `Infinity` there, the probe returns null, a
   spurious `unsizeable effect` blocker fires on **every** assessment, and `verdict.conclusive` can never be
   true again.

   Ground 3 is repairable (special-case the probe); grounds 1 and 2 are not, and ground 2 removes the
   branch's only benefit.

**(b) Keep the pure textbook formula** *(unchanged from what ships)* — a direct implementation of the named
formula, so any caller who knows that formula gets exactly what they expect and no more.

*Cost, stated plainly:* a caller who reads only the number can still be told "collect 212" and then be
refused at 212. Fork 2 is where that cost is paid down. It is bounded today by the fact that the **one live
caller** (`assessCriteria`) never gates anything on this number: `power.perBand[].requiredNPerGroup` is
display text sitting beside `power.perBand[].testable`, and the verdict hangs on `testable`/`shortBy`
computed from raw counts (`we:scripts/lib/gate-health.mjs:367-369`). A reader who looks at the number and
ignores the neighbouring field can be misled; the *system* cannot.

**(c) Fold in with a margin large enough to actually guarantee acceptance** — e.g. size to a coverage
quantile rather than to an expected 5.

*Rejected:* it inherits ground 1 whole (still a silent redefinition of a named formula, still unlike every
reference implementation) and adds a distributional assumption no cited authority makes. The coverage
question is real, but it belongs to what gets *published* (Fork 2 sub-fork), not to what this name
*returns*.

### Recommended default — Fork 1 (b)

```js
// we:scripts/lib/gate-health.mjs — Fork 1 (b): unchanged, and now deliberately so.
export function requiredNPerGroup(baseRate, mdd = 0.05) {
  const p = typeof baseRate === 'number' ? baseRate : NaN;
  const d = typeof mdd === 'number' ? mdd : NaN;
  if (!Number.isFinite(p) || !Number.isFinite(d)) return null;
  if (d <= 0 || p < 0 || p > 1) return null;
  if (p + d >= 1) return null;
  const pbar = p + d / 2;
  const n = Math.ceil(((1.96 + 0.84) ** 2 * 2 * pbar * (1 - pbar)) / (d * d));
  return Number.isFinite(n) ? n : null;   // POWER only. The validity floor is a separate number — Fork 2.
}

// Fork 1 (a), REJECTED — for the record, this is the exact edit that fails 8 of 53 tests:
//   const n = Math.max(
//     Math.ceil(((1.96 + 0.84) ** 2 * 2 * pbar * (1 - pbar)) / (d * d)),
//     Math.ceil(5 / Math.min(p, 1 - p, p + d, 1 - (p + d))),   // → Infinity at p = 0
//   );
```

Skeptic: SURVIVES-WITH-AMENDMENT — an independent juror (headless spawn, its own session id, not a subagent
of the authoring session) tried to re-route this as support-both via an optional `requiredNPerGroup(p, d,
{withFloor: true})` flag; the attack collapsed into exactly the two-export answer Fork 2 already builds, so
it did not land. It hand-verified the divergence table and the `p = 0` invariant and found no arithmetic
error. It did catch false precision: "roughly half the time" is really ~56% for a count with mean 5.
Amendment folded in — ground 2 now states the 56% figure and its source, and the NEP 23 citation is
downgraded from authority to supporting precedent (its authoring scope is NumPy's public-API release
process, which does not reach a repo-internal helper).

Screen: clear — run by a second, separately-spawned juror whose input had every `Skeptic:` block removed
before the call, so it saw the fork text and nothing else. Q1: not an impl detail — the return value is read
by `assessCriteria` and published in `power.perBand[]`, and the two branches give a consumer a different
number. Q2: merit, not prioritization — at zero cost (a) would still be incorrect and would still break the
`sizeableMdd` probe.

## Fork 2 — where does the validity constraint live for a caller who needs both?

**Why this is a fork:** the module's public payload either carries a validity-floor number or it does not —
`power.perBand[]` has one shape, and a consumer reads whichever ships. The branches are not composable: "a
formula in a comment" and "a named export plus a labelled field" are two different contracts for the same
obligation, and shipping both means shipping the field. The merit difference is **not** build cost: the
status-quo mitigation is itself defective (below), so the branches disagree about whether the module is
currently telling callers something untrue.

### The status quo is not neutral

`we:scripts/lib/gate-health.mjs:236` currently tells callers: *"A caller that needs both must apply
`n >= 5 / min(p, 1 - p, p + d, 1 - (p + d))` itself."* Read as a guarantee, that is **wrong** — it is an
expected-count floor with roughly 50% observed attainment at exactly that n. Whatever branch wins, that
sentence has to be corrected. The fork is only about what replaces it.

### Options

**(a) Docstring only, status quo.** *Rejected:* leaves the defective promise in place, and leaves every
caller re-deriving an expression the module already knows how to compute. Rejecting (a) is not a cost
argument — it is that (a) is currently inaccurate.

**(b) Correct the docstring AND publish the floor** — a sibling export
`expectedValidityFloorNPerGroup(baseRate, mdd)` built on the same inputs, plus a
`requiredNForExpectedValidity` field beside `requiredNPerGroup` in `power.perBand[]`, each documented for the
question it answers.

*The name carries the caveat, deliberately.* A shorter `requiredNForValidity` would re-create, one field
over, the exact misreading that disqualifies Fork 1 (a): a consumer reading the JSON payload sees field
names, not JSDoc, and "required N for validity" reads as a guarantee when it is an expected-count estimate
that is met roughly 56% of the time. Putting **expected** in the identifier is the structural fix, and it is
cheaper than the alternative considered (a sibling `validityBasis: 'expected-cells'` marker), which would
add the fifth-number payload weight this fork's named cost is already about.

*Named cost, so it is weighed rather than waved past:* it adds a fifth number to a payload that already
carries `requiredNPerGroup`, `testable`, `shortBy` and `shortCells`, and this module spent three review
rounds killing exactly one failure mode — **fusion**, one output carrying several criteria
(`we:scripts/lib/gate-health.mjs:298-318`). The reason the cost is outweighed: the hazard those rounds
fought was fusion *inside* one string or number, and the fix each time was to *split* the criteria into
separately-labelled fields. A second labelled number, named for its own question, is the same remedy applied
once more — not a relapse. It also matches the standing separation bias: split a reusable axis into its own
home rather than absorbing it (see *Context → statute*).

**(c) Correct the docstring, add no export.** *Rejected:* strictly weaker than (b) on the same merit axis —
the payload's consumer is machine-readable JSON, so a formula in a comment is a number the caller must
re-derive by hand and can re-derive wrong. (c) differs from (b) only in whether the module does arithmetic
it already knows how to do.

### Fork 2 sub-fork — what is the published floor sized to?

- **Expected-cell-5** — `5 / min(p, 1-p, p+d, 1-(p+d))`, refusing (null) at `p = 0` per the forced
  invariant. This is the shape every cited authority states the rule in: Cochran/Fisher and R's
  `chisq.test` both express it on **expected** counts, and it is the only shape a *planning* function can
  compute, since it has no observations yet.
- **A coverage-quantile floor** — the smallest n at which P(observed min cell ≥ 5) ≥ 0.95. Actually delivers
  "collect this and it will be readable."

**Default: expected-cell-5**, with the ~50% observed-attainment caveat stated in the field's own
documentation rather than implied away. The coverage floor is an invention: the survey found **no** toolkit
that floors *and* none that even warns, so a quantile-sized planning number would have no prior art and
would add a distributional assumption to a field labelled "planning estimate." *Revisit trigger, concrete:*
the first caller that **gates collection** on this number — rather than displaying it — is the forcing
function to re-rule the sub-fork, because that caller needs a guarantee, not an estimate.

### Recommended default — Fork 2 (b), expected-cell-5

```js
// we:scripts/lib/gate-health.mjs — Fork 2 (b). Same inputs as requiredNPerGroup, different question.
/**
 * Observations per group at which EVERY cell is EXPECTED to reach 5 — the normal-approximation validity
 * floor `compareProportions` gates on, sized forward.
 *
 * IT IS A PLANNING ESTIMATE, NOT A GUARANTEE, and `expected` is in the NAME rather than only in this
 * comment because a JSON consumer reads field names, not JSDoc. `compareProportions` gates on OBSERVED
 * counts; at exactly this n the binding cell is a count with mean 5, which reaches 5 only about 56% of the
 * time (Poisson(5): P(X >= 5) ~ 0.56). Sized to an expected 5 because that is the shape the rule is stated
 * in (Cochran/Fisher; R's `chisq.test` warns on expected cells) and the only shape a function with no
 * observations can compute.
 *
 * REFUSES AT `p = 0` rather than returning Infinity: `min(...)` is 0 there, and `p = 0` is both this
 * module's own `sizeableMdd` probe input and the ordinary rate of a band with no recorded defects.
 */
export function expectedValidityFloorNPerGroup(baseRate, mdd = 0.05) {
  const p = typeof baseRate === 'number' ? baseRate : NaN;
  const d = typeof mdd === 'number' ? mdd : NaN;
  if (!Number.isFinite(p) || !Number.isFinite(d)) return null;
  if (d <= 0 || p < 0 || p > 1) return null;
  if (p + d >= 1) return null;
  const smallestCell = Math.min(p, 1 - p, p + d, 1 - (p + d));
  if (!(smallestCell > 0)) return null;          // the forced invariant, in one line
  const n = Math.ceil(5 / smallestCell);
  return Number.isFinite(n) ? n : null;
}

// …and in assessCriteria's per-band entry (we:scripts/lib/gate-health.mjs:357-370), two labelled numbers
// answering two questions, beside the observed-count pair that already answers the third:
return {
  band: label,
  baseRate: rate,
  requiredNPerGroup: rate === null ? null : requiredNPerGroup(rate, mdd),  // POWER, planned
  requiredNForExpectedValidity:                                            // VALIDITY, planned (expected)
    rate === null ? null : expectedValidityFloorNPerGroup(rate, mdd),
  testable: short.length === 0,                                            // VALIDITY, observed
  shortBy: short.reduce((n, c) => n + (5 - c.have), 0),
  shortCells: /* … */,
};
```

Skeptic: SURVIVES-WITH-AMENDMENT — the classification attack (options (a)/(b)/(c) are nested, `(b) ⊇ (a)`,
so this is scope not exclusion) did not land: the item already weighs them on merit and marks (c) as
strictly weaker rather than as a rival branch. The **merit** attack landed and is the sharpest finding of
the pass: the originally-proposed `requiredNForValidity` would republish Fork 1 ground 2's misreading one
field over, because a JSON consumer reads field names, not JSDoc — "required N for validity" reads as a
guarantee. Amendment folded in: the export and the field now carry `expected` in the identifier, and the
rejected alternative (a separate `validityBasis: 'expected-cells'` marker) is recorded with its reason.

Skeptic (sub-fork): SURVIVES — the juror probed whether expected-cell-5 vs coverage-quantile is a config
dimension (offer both, caller picks) and found the item already rejects that on merit rather than by fiat,
with a concrete revisit trigger; and found no falsifiable defect in expected-cell-5, since a planning
function has no observations and the quantile shape would import a distributional assumption the module
makes nowhere else.

Screen: clear — same second juror, same stripped input. Q1: not an impl detail — whether the floor ships as
a named export plus a labelled payload field is the module's public contract, observable by every consumer
of `power.perBand[]`. Q2: merit, not prioritization — at zero cost, (a) and (c) still leave callers
hand-deriving a formula the module already knows, and still leave the current docstring promise inaccurate.

Screen (sub-fork): clear — Q1: the two options publish different numbers in the same field, so the choice is
contract-level, not hidden. Q2: the grounds are precedent-consistency and not importing an unstated
distributional assumption — both survive the zero-cost thought experiment.

---

## Context

### The divergence, measured

| p | mdd | power n | expected-cell floor n | `max` (Fork 1 (a)) |
| --- | --- | --- | --- | --- |
| 0.94 | 0.05 | 212 | 500 | 500 |
| 0.93 | 0.05 | 270 | 251 | 270 |
| 0.90 | 0.05 | 436 | 101 | 436 |
| 0.044 | 0.20 | 49 | 114 | 114 |
| 0.021 | 0.10 | 104 | 239 | 239 |
| 0.021 | 0.20 | 42 | 239 | 239 |
| 0.50 | 0.05 | 1565 | 12 | 1565 |
| 0 | 0.05 | 153 | ∞ | **null** |

Which criterion binds depends on `mdd`, not on the base rate alone — the floor is keyed on `p + d`, so it
bites at low base rates too once the requested effect is large. The originating card recorded one crossing
(49 → 114); the reachable range holds several, and one that returns `null`.

### The adjacent question — filed, not decided here

The survey's strongest reframe is that "collect more" is not the documented remedy at all: when the normal
approximation fails, the literature switches the **test** (Fisher exact, N−1 chi-squared per Campbell 2007,
mid-*p* per Agresti 2001, Agresti–Caffo as statsmodels' own `test_proportions_2indep` default), and exact
methods generally need **fewer** observations, not more (PASS: 521 vs 524). That question — *should
`compareProportions` offer a small-sample-valid method instead of refusing?* — is filed as its own
un-prepared `kind: decision` in this same PR ("Should compareProportions offer a small-sample-valid method
instead of refusing below 5-and-5?"). It is **not** part of this ruling and neither default depends on it:
both hold under the method that ships today. It does bound this answer's lifetime — if the approximation
goes, the floor Fork 2 publishes retires with it — which is why it is filed rather than dropped.

### Statute

The nearest anchor is `we:docs/agent/platform-decisions.md#bias-toward-separation` — *on any
combine-vs-split fork, default to two composable homes; the burden of proof is on combining*. Both defaults
run with it. **Cited as supporting context, not as controlling authority:** that rule is authored for
splitting a reusable axis into its own intent/protocol/plug at the standard layer, and its stated hazard is
schema/ownership coupling; this is a repo-internal measurement helper under `we:scripts/lib/`, outside the
turf the anchor governs. The defaults are derived on their merits above and would stand without it. Neither
fork sets `codifiedIn`, and neither writes a rule that collides with an existing anchor.

### Lineage

Spun out of [#3090](/backlog/3090-the-sample-size-estimator-says-one-observation-is-enough-whe/)
(`we:scripts/lib/gate-health.mjs`), whose Done-when named this a "modelling call, not a bug fix" and left it
as a box rather than a change made inside a review round. The prospective second consumer named there,
`retry-health` ([#3083](/backlog/3083-choose-the-retry-policy-for-a-dispatch-that-did-not-take/)), was
deleted in PR #1195's split and re-filed; #3083's own ruling records that its numbers stay unset until the
estimator can size them. If that caller lands and trusts `requiredNPerGroup` alone to decide whether to keep
collecting, it is the concrete forcing function to re-read Fork 2 — with a real second consumer to weigh
instead of a hypothetical one.

### Predicted touch-set (#2619)

`we:scripts/lib/gate-health.mjs` · `we:scripts/operations/__tests__/gate-health.test.mjs` — Fork 1 (b) is a
docstring correction, Fork 2 (b) adds one export plus one payload field and its tests. No child item is
carved: both forks are shaped, so ratification produces the build directly.

_No review jury pre-registered — care level `low` is below the `elevated` floor (#2638)._
