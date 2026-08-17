# Should a sample-size estimator fold a normal-approximation validity floor into its answer?

**Date**: 2026-08-17
**Point**: No established power/sample-size toolkit folds a minimum-cell validity floor into the n it returns — and folding it into `requiredNPerGroup` would not even deliver the guarantee it promises, because at the floored n the *expected* min cell is exactly 5 and the *observed* count lands below 5 about half the time.
**Decision prepared**: [#3143](/backlog/3143-should-requirednpergroup-fold-in-this-module-s-own-5-and-5-v/)
**Research page**: `/research/power-estimator-validity-floor/`

---

## Question

`we:scripts/lib/gate-health.mjs` carries two independent criteria:

- `requiredNPerGroup(baseRate, mdd)` — the textbook two-proportion sample-size formula
  (`n = ceil((1.96 + 0.84)^2 · 2 · pbar · (1 - pbar) / d^2)`, `pbar = p + d/2`; 80% power, α = 0.05, two-sided).
  Pure power, no validity term.
- `compareProportions(a, b)` — refuses to report `separated` unless **both** groups clear ≥5 successes AND
  ≥5 failures, because the normal approximation the module rests on is invalid below that.

The two are computed from different inputs (a requested effect size vs. two observed counts) and can
disagree. Should the estimator fold the floor in — return
`max(powerN, ceil(5 / min(p, 1-p, p+d, 1-(p+d))))` — so "how many do I need" and "will the module accept
that many" become one question?

## Recommendation

**No.** Keep `requiredNPerGroup` the pure textbook formula. Three independent findings converge:

1. **No toolkit does it.** R, statsmodels, SAS, Stata, PASS and G*Power all return a pure inversion of the
   power equation. None floors. None warns.
2. **It does not work.** The proposed floor is an *expected-count* floor. At exactly `n = ceil(5/min(...))`
   the expected minimum cell is exactly 5, so the *observed* count — which is what `compareProportions`
   gates on — falls below 5 roughly half the time. The fold buys a promise it cannot keep.
3. **It breaks the module.** Measured, not predicted: patching the fold in and running
   `we:scripts/operations/__tests__/gate-health.test.mjs` fails **8 of 53** tests, and only three of those
   are re-derivable constants. The other five all trace to one live defect — `requiredNPerGroup(0, mdd)` is
   the module's own `sizeableMdd` probe (`we:scripts/lib/gate-health.mjs:329`), and the floor is `5/0 = ∞`
   at `p = 0`, so the probe returns null, a spurious *"unsizeable effect"* blocker fires on every
   assessment, and `verdict.conclusive` can never be true again.

## Key findings

### A — does any toolkit fold a validity floor into the returned n?

| Toolkit | Floors n? | Warns at an invalid n? | Source |
| --- | --- | --- | --- |
| R `stats::power.prop.test` | no | no (warns only when no `p2` exists at all) | [stat.ethz.ch](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/power.prop.test.html) |
| R `pwr::pwr.2p.test` / `pwr.2p2n.test` (1.3-0) | no | no (only a `uniroot` bracketing note) | [CRAN `pwr` manual](https://cran.r-project.org/web/packages/pwr/pwr.pdf) |
| statsmodels `samplesize_proportions_2indep_onetail` (0.14.6) | no — returns `nobs` straight from `normal_sample_size_one_tail` | no | [statsmodels source](https://www.statsmodels.org/stable/_modules/statsmodels/stats/proportion.html) |
| statsmodels `NormalIndPower` (0.14.6) | no | no | [statsmodels docs](https://www.statsmodels.org/stable/generated/statsmodels.stats.power.NormalIndPower.html) |
| SAS `PROC POWER TWOSAMPLEFREQ` | no — inverts Fleiss–Tytun–Ury eq. (4) | no | [SAS/STAT UG](http://support.sas.com/documentation/cdl/en/statug/63347/HTML/default/statug_power_a0000000997.htm) |
| Stata `power twoproportions` | no (optional `continuity` inflates n, a different adjustment) | no | [Stata PSS-2 manual](https://www.stata.com/manuals/pss-2powertwoproportions.pdf) |
| PASS "Tests for Two Proportions" | no — offers binomial enumeration instead | no | [NCSS PASS ch. 200](https://www.ncss.com/wp-content/themes/ncss/pdf/Procedures/PASS/Tests_for_Two_Proportions.pdf) |
| G*Power 3.1 | n/a — its documented proportions procedure is exact Fisher | no | [G*Power manual (2023-06-01)](https://www.psychologie.hhu.de/fileadmin/redaktion/Fakultaeten/Mathematisch-Naturwissenschaftliche_Fakultaet/Psychologie/AAP/gpower/GPowerManual.pdf) |

The one documented upward adjustment on offer anywhere is the **continuity correction**
(Fleiss / Casagrande–Pike–Smith). It is opt-in, it is not a validity floor, and PASS says of it: *"in
practice, this adjustment is not recommended because it reduces the power and the actual alpha of the test
procedure."*

### B — what *is* the standard remedy when the approximation fails?

**Switch the test, do not collect more data.**

- Stata's small-sample answer is `test(fisher)`, and it states outright that sample size for Fisher's exact
  test is "difficult to compute directly because of the discrete nature of the sampling distribution" — the
  exact route does not even produce an n.
  ([Stata PSS-2](https://www.stata.com/manuals/pss-2powertwoproportions.pdf))
- Exact treatment generally *lowers* n. PASS example 2: the normal approximation asks 524/group; binomial
  enumeration asks **521**, at an actual α of 0.0493.
  ([NCSS PASS ch. 200](https://www.ncss.com/wp-content/themes/ncss/pdf/Procedures/PASS/Tests_for_Two_Proportions.pdf))
- statsmodels puts the remedy in the *test* API, not the planning API: `test_proportions_2indep` defaults to
  `method='agresti-caffo'` for the risk difference — an adjusted estimator, not a data-collection demand
  ([docs](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.test_proportions_2indep.html));
  origin Agresti & Caffo 2000, *Amer. Statistician* 54:280–288
  ([T&F](https://www.tandfonline.com/doi/abs/10.1080/00031305.2000.10474560)).
- The ≥5 threshold is itself acknowledged as arbitrary. Campbell 2007 (*Stat. Med.* 26:3661–3675,
  [doi:10.1002/sim.2832](https://onlinelibrary.wiley.com/doi/10.1002/sim.2832)) recommends the N−1
  chi-squared when the minimum **expected** count is at least 1, Fisher–Irwin below that, and records that
  Cochran's 5 "was chosen arbitrarily." Agresti 2001 (*Stat. Med.* 20:2709–2722,
  [doi:10.1002/sim.738](https://onlinelibrary.wiley.com/doi/abs/10.1002/sim.738)) argues for mid-*p*
  adjustments over more data. *(Both read via abstract/PubMed record, not full text — flagged as a limit of
  this survey.)*

### C — where the ≥5 rule is enforced, and on which counts

R places the rule on the **comparison**, never on the planner, and on **expected** counts:

```r
# R sources, stats package, chisq.test
if (any(E < 5) && is.finite(PARAMETER)) warning("Chi-squared approximation may be incorrect")
```

That is exactly this module's rule — threshold 5, expected cells — sitting on the test side.
([R source](https://raw.githubusercontent.com/wch/r-source/trunk/src/library/stats/R/chisq.test.R))

The literature is genuinely split on expected-vs-observed: Cochran/Fisher and R say expected; the
two-proportion z-test literature commonly states it on observed counts and adds *"when one or more cell
counts are small (e.g. below 5), prefer exact tests"*
([Wikipedia](https://en.wikipedia.org/wiki/Two-proportion_Z-test)). The `5 / min(p, 1-p, p+d, 1-(p+d))`
expression is the **expected-count** shape, which is the only shape a *planning* function can compute —
that much is defensible. What is not defensible is calling it a guarantee: this module's
`compareProportions` gates on **observed** counts (`we:scripts/lib/gate-health.mjs:153`), and at a floor
sized to an expected 5 the observed count is under 5 about half the time.

### D — API-design prior art on changing a named formula's output

NumPy's NEP 23 states the governing principle for exactly this class of change: *"The possibility of an
incorrect result is worse than an error or even crash."* It also requires a `DeprecationWarning` over at
least two releases for any behaviour change, and never in a bugfix release.
([NEP 23](https://numpy.org/neps/nep-0023-backwards-compatibility.html)) A function named after a formula
that silently returns a different number ranks as the most harmful category in that scheme.

### E — measured blast radius of the fold (this repo, not the literature)

Patch applied to `we:scripts/lib/gate-health.mjs:252`, suite re-run, patch reverted:

```
Tests  8 failed | 45 passed (53)
```

| Failure | Kind |
| --- | --- |
| `requiredNPerGroup(0.044, 0.2)` 49 → 114 | re-derivable constant |
| `requiredNPerGroup(0.94, 0.05)` 212 → 500 | re-derivable constant |
| `requiredNPerGroup(0, 0.05)` 153 → null | **live defect** — `p = 0` makes the floor `∞` |
| "an unsizeable `mdd` is its OWN blocker" | cascade of the above |
| "a band with one arm reports a null rate…" | cascade |
| "concludes only when a band separates AND nothing is blocking" | cascade — `conclusive` can never be true |
| "reports WHICH group is worse" | cascade |
| declaration: "an ABSENT field still gets the schema default" | cascade |

`p = 0` is not a corner case here: it is the module's own `sizeableMdd` probe input
(`we:scripts/lib/gate-health.mjs:329`, `requiredNPerGroup(0, mdd) !== null`) and it is the ordinary
per-band clean-arm rate whenever a band has recorded no defects
(`we:scripts/lib/gate-health.mjs:356,364`) — the common case on a corpus with a ~3% defect rate.

The divergence is also wider than the originating card recorded. Measured across the reachable range:

| p | mdd | power n | floor n | fold returns |
| --- | --- | --- | --- | --- |
| 0.94 | 0.05 | 212 | 500 | 500 |
| 0.93 | 0.05 | 270 | 251 | 270 |
| 0.044 | 0.20 | 49 | 114 | 114 |
| 0.021 | 0.10 | 104 | 239 | 239 |
| 0.021 | 0.20 | 42 | 239 | 239 |
| 0.50 | 0.05 | 1565 | 12 | 1565 |
| 0 | 0.05 | 153 | ∞ | **null** |

## What the survey did not settle

- No toolkit *warns* on the planning side either, so "return the textbook n and attach a caveat" has no
  direct prior art. It is a defensible invention, not a documented convention.
- G*Power's z-test proportions procedure could not be verified — the current manual documents only the
  exact Fisher variant and is explicitly incomplete.
- Campbell 2007 and Agresti 2001 were read via abstract, not full text.
- The literature does not speak to the actual product question: whether a tool should refuse to *plan* a
  measurement it knows it will refuse to *read out*. That remains a design call, which is what #3143 rules.

## Files created/modified

| File | Action |
| --- | --- |
| `we:reports/2026-08-17-power-estimator-validity-floor.md` | created (this report) |
| `we:src/_data/researchTopics/power-estimator-validity-floor.json` | created |
| `we:src/_includes/research-descriptions/power-estimator-validity-floor.njk` | created |
| `we:backlog/3143-should-requirednpergroup-fold-in-this-module-s-own-5-and-5-v.md` | rewritten to the prepared-fork shape, `preparedDate` stamped |
