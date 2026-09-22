# Grounding the supervision-prior decision — what a borrowed trial would buy, and what the store says

**Date:** 2026-09-21 · **For:** decision [#3734](/backlog/3734-may-agent-family-and-benchmark-data-act-as-a-capped-prior-to/)
(`/prepare` pass) · **Extends:** the graduation grounding in
`we:reports/2026-09-20-delegation-graduation-model-grounding.md` (§6.1 arithmetic, §6.4 non-transitive trust, §6.5
Beta reputation) — not repeated here.

Everything marked **verified** was run against `origin/main` at `ad60a9153` on 2026-09-21. The two in-flight
items (risk-tiered thresholds, the after-the-fact sampler) were read on the declared POC branch
`lane/mechanical-dispatcher` at `5ab89f87b`; they are **not on main**.

---

## 1. What the card leaves open

The card rules nothing on four things it names as "for preparation": the cap, the family definition, the
permitted inputs and the audit contract. This pass resolves each against the ratified text:

| Left open | Answer | Where it comes from |
|---|---|---|
| The audit contract: rows or output? | **Output only** — never a row in the store | §2 below |
| The cap | **A shape, initial value 1**, strictly below the tier threshold | §3 below |
| Permitted inputs | Family: a genuine fork (Fork 2). Benchmark: excluded (Fork 3) | §4, §5 |
| The family definition | A genuine fork (Fork 2) | §4 |

## 2. A virtual trial must not be a row — verified

`we:scripts/lib/provider-routing.mjs` reads the scorecard store through two predicates and **two** consumers:

- `isCleanRecord` (`:250`) is `outcome === 'landed'` — nothing else. It is read by `selectSupervisionLevel`
  (`:709`, `:720`) **and** by `evaluateProviderFitness` (`:341–343`), where **one** clean verified row makes a
  provider *fit to be handed the work*.
- `isInformativeRecord` (`:256`) is read by `selectSupervisionLevel` (`:729`) and by `selectProvider`
  (`:510`, `:516`) for the dual-dispatch branch.
- `we:scripts/conveyor/run-scorecard-store.mjs` averages rows (`meanScore`) and its header states the store must
  "never let a future model quietly inherit an older model's accumulated data".

So a `virtual: true` row in `we:scripts/conveyor/run-scorecards.json` would be read as a real clean trial by
`evaluateProviderFitness` unless every reader is taught to skip it — an identity that never ran would become
*eligible for dispatch* on a borrowed row. The ratified rule
([#delegation-trial-record-graduation](/backlog/3690-track-and-consider-graduating-session-initiated-codex-delega/)
rule 1) already says a change to what counts as clean "is a governed change wherever the record is read". The
only shape that touches one consumer is an **argument** to `selectSupervisionLevel` that comes back in its
`auditTrail`. The card's "rows or the returned audit output" is therefore not a choice.

## 3. The arithmetic: a prior is capped below the bar, and the bar is small

`selectSupervisionLevel` (`:670–783`) returns `spot-check` iff the trailing clean streak reaches
`minCleanStreak` and (if required) an informative trial exists. Two ratified rules bound what any borrowed
credit can be:

- Rule 3: the bar needs "a trailing clean streak, plus a positive control, plus a **clean most recent verified
  trial**". The last leg can only be met by a real row, so **at least one real clean verified trial is always
  required**.
- Rule 4: the positive control is "its own recorded field", never inferred — a borrowed credit cannot be one.

At the in-flight low-risk placeholder (`minCleanStreak: 2`, no informative trial — POC branch, not main), the
credit is therefore **at most 1 virtual trial**. What one trial is worth, computed (exact one-sided 95%
Clopper–Pearson upper bound on the failure rate with zero failures in `N` trials, `1 − 0.05^(1/N)`, the same
formula as the 2026-09-20 report §6.1):

| N clean trials | 95% upper bound on failure rate |
|---|---|
| 1 | **95.00 %** |
| 2 | **77.64 %** |
| 3 | 63.16 % |
| 5 | 45.07 % |

Going from one real trial to "one real plus one borrowed" moves the bound from 95 % to 77.6 % — and the
borrowed half has never been measured against this identity. The evidence value of the exception at the safe
end is close to nil. Its value grows with the tier threshold (medium: 5, high: 8), which is the same place
the exposure grows.

## 4. Replay on the live store — verified

`we:scripts/conveyor/run-scorecards.json` holds 26 rows over 10 triples. Running the real
`selectSupervisionLevel` over it with the low-risk placeholder (`{minCleanStreak: 2}`) and with one virtual
trial (`{minCleanStreak: 1}`):

| Triple | Real rows | Low bar (2) today | With 1 virtual trial |
|---|---|---|---|
| `codex / gpt-6-astra / bugfix` | 7 | spot-check | spot-check |
| `codex / gpt-6-astra / doc-fix` | 2 | spot-check | spot-check |
| `codex / gpt-6-astra / other` | 6 | spot-check | spot-check |
| `antigravity / gemini-3.8-flash-low / conflict-resolution` | 5 | spot-check | spot-check |
| `codex / gpt-6-astra / conflict-resolution` | 1 | full | **spot-check** |
| `codex / gpt-6-astra / self-fix` | 1 | full | **spot-check** |
| `claude-native / claude-sonnet-5 / other` | 1 | full | **spot-check** |
| `antigravity / gemini-3.8 / other` | 1 | full | **spot-check** |
| `antigravity / gemini-3.1-pro / other` | 1 (`other`-verified) | full | full |
| `antigravity / claude-sonnet-4-6 / other` | 1 (rejected) | full | full |

A **label-constant** prior (one virtual trial for anyone with a family label) flips four triples. Read what
each flip would rest on:

- `claude-native / claude-sonnet-5 / other`: the only in-system record of its family sibling,
  `antigravity / claude-sonnet-4-6 / other`, is a **rejected** trial. The label would credit an identity from a
  family whose one recorded outcome is a miss.
- `antigravity / gemini-3.8 / other`: its Gemini siblings have no graduated triple at `other`
  (`gemini-3.1-pro/other` is `other`-verified and counts for nothing; `gemini-3.8-flash-low` has only
  `conflict-resolution`).
- Two flips are `gpt-6-astra` cells whose "sibling" is **the same model** on another task type — no family
  relation is involved at all.

A **sibling-derived, same-task-type** prior (credit only from a different identity of the same family that has
itself cleared the bar at the same task type) flips **zero** triples today. A **same-model, other-task-type**
relation flips exactly the two `gpt-6-astra` cells. So at today's data volume a family prior is either
unsafe (label-constant) or inert (derived across identities). There is no transfer data in the store to
validate any of it: ten triples, one vendor line with three releases (`gemini-3.1-pro`, `gemini-3.8`,
`gemini-3.8-flash-low`), none with a graduated predecessor and a measured successor.

## 5. The benchmark input does not exist and cannot be tied to a triple — verified

`we:scripts/lib/model-capability-ratings.json` has `"entries": []` on main; the module header says the array
is "deliberately EMPTY: no unconfirmed leaderboard numbers become facts by being checked in". Its five
categories (`contextIngestion`, `autonomousAgenticWork`, `algorithmicSpeedIdeSync`, `cliToolUse`,
`overallCodingIndex`) are keyed by `{provider, model}` only — no task-type axis and no risk axis — and the
header states "External leaderboards describe a different population of work from our dispatch trials".
`explorationHint` reads it only inside `selectProvider` (`we:scripts/lib/provider-routing.mjs:21–23`).

## 6. Prior art

Surveyed 2026-09-21; published as `/research/supervision-graduation-borrowed-evidence/`. Four findings
changed a fork's shape; two confirmed one.

1. **Borrowing from a predecessor is a regulated, named practice — and it is never label-only.** FDA's
   *Guidance for the Use of Bayesian Statistics in Medical Device Clinical Trials* accepts informative priors
   from predecessor-device trials, registries or literature only if the sponsor demonstrates
   **exchangeability** between the historical and current populations, and prefers **dynamic borrowing**
   (hierarchical models, power priors) that discounts the history automatically if current results drift
   ([guidance PDF](https://www.fda.gov/media/71512/download)). The borrowed amount is reported as an
   **effective sample size** — "the number of patients borrowed". That is the audit contract: name the
   borrowed count separately from the real count. *Changed Fork 1's audit clause and Fork 2:* credit needs a
   demonstrated relation, not a label.
2. **A robust mixture prior discards the borrowed information when it conflicts with the new data.**
   Schmidli et al., *Robust meta-analytic-predictive priors in clinical trials with historical control
   information*, Biometrics 70(4), 2014
   ([abstract](https://pubmed.ncbi.nlm.nih.gov/25355546/)): the informative prior is mixed with a dispersed
   component so large prior–data conflict lets the prior be dropped. The card's "a real miss zeroes the prior"
   is the binary limit of this — and it must also **stay** zero, or the borrowed credit returns after the miss
   the way decay would (#3673 clause 3). *Confirmed the zero-on-miss invariant.*
3. **A bridging study is the required real trial.** ICH E5(R1) lets a new region accept foreign clinical data,
   but the region may require a **bridging study** — a local study that shows the foreign data apply
   ([EMA](https://www.ema.europa.eu/en/ich-e5-r1-ethnic-factors-acceptability-foreign-clinical-data-scientific-guideline)).
   Borrowed evidence never replaces the local trial; it shortens it. *Confirmed "at least one real clean
   verified trial".*
4. **Derivative aircraft credit depends on whether the change is significant.** FAA 14 CFR 21.19 requires a
   new type certificate where a change is "so extensive that a substantially complete investigation of
   compliance" is needed; otherwise an amended certificate reuses the earlier basis under §21.101
   ([eCFR](https://www.ecfr.gov/current/title-14/chapter-I/subchapter-C/part-21/subpart-B/section-21.19)). The
   credit is keyed to a *judged relation between products*, in context with the previous changes — not to the
   manufacturer's name. *Changed Fork 2: the relation must be declared and bounded, and the vendor line by
   name is the manufacturer's-reputation branch.*
5. **Benchmark scores overstate real-repo performance, measurably.** SWE-Bench+
   ([arXiv 2410.06992](https://arxiv.org/abs/2410.06992)) found 32.67 % of the passing patches on the original
   SWE-bench involved solution leakage and 31.08 % were suspicious because the tests were weak; excluding them
   dropped one agent's resolution rate from 12.47 % to 3.97 %. METR's randomised trial on 246 real tasks in
   the developers' own repositories found a 19 % *slowdown* against a self-estimated 20 % speedup
   ([METR](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)) — evidence that an
   external measure and an in-context outcome can point in opposite directions. *Changed Fork 3: the
   benchmark leg is an excluded branch on validity grounds, not only on the ratified text.*
6. **Trust is non-transitive in the closest published graduated-autonomy scheme.** AWS's graduated-autonomy
   design (2026-09-20 report §6.4) keeps trust per identity and takes the minimum along a delegation chain.
   *Confirmed the default.*

## 7. What the pass changed in the card

- The card's option 3 bundled two independent axes (a benchmark source and a wider risk range). They are now
  Fork 3 and a named rejected medium-risk ceiling inside Fork 1 (b).
- The card's family definition and cap are not forks of their own: the cap is a `backdownThresholds`-style
  number the ratified rules already send to a batched finding; the family relation is Fork 2.
- The filing recommendation (option 2) is **reversed** to option 1 on §3 and §4: the safe-end credit is at most
  one trial worth ~nothing, and at today's volume the prior is either unsafe or inert. The card's option 2 is
  kept as a fully specified alternative (Fork 1 (b) with Forks 2–3 and the forced invariants) so a ratification
  in that direction is a nod, not a research turn.

## 8. Method — reproducible

`selectSupervisionLevel(provider, model, taskType, records, {minCleanStreak, requireInformativeTrial})` from
`we:scripts/lib/provider-routing.mjs` at `ad60a9153`, over every distinct `{provider, model, taskType}` in
`we:scripts/conveyor/run-scorecards.json`; the "one virtual trial" column is the same call with
`minCleanStreak` reduced by one, which is exactly what a credit of one virtual clean trial does to the
streak leg.
