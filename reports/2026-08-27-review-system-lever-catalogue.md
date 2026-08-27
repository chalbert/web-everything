# The review system as an axis space — every lever, its range, and where it is pinned

**Date:** 2026-08-27
**For:** the decision *Catalogue the review system levers — which are platform invariants and which are per-consumer settings* (under the Review-efficacy watch #3318)
**Method:** direct enumeration of the review pipeline's own constants and contract data, plus the ratified anchors that constrain them, plus three levers imported from the primary review literature.

---

## What this report covers, and what it does not (#3362)

**Predicate.** A *lever* is a named identifier or contract field that the review pipeline reads, whose value
would change one of: what gets looked at, by whom, what a finding must carry, how findings reduce to a
verdict, or what the verdict does.

**Candidate set actually read.** `we:scripts/lib/jury-core.mjs`, `we:scripts/lib/review-escalation.mjs`,
`we:scripts/lib/review-policy.contract.json`, `we:scripts/lib/gate-config.mjs`,
`we:scripts/review-core-cli.mjs`, `we:scripts/operations/review-pr.mjs`,
`we:scripts/workflows/review-parked-prs.mjs`, `we:scripts/converge-cli.mjs`; the review anchors in
`we:docs/agent/platform-decisions.md`; the open cards under #3318; and three externally-evidenced levers
named in the survey brief.

**Not covered — stated so nobody reads this as complete.**

- Merge mechanics in `we:scripts/merge-ai-prs.mjs` and the drain's scheduling.
- CI configuration and anything outside this repo (Frontier UI, plateau-app).
- **Prompt wording.** Every juror mandate is a lever — the lens expectations, the charter text, the refusal
  strings — and this catalogue counts "the mandate" as one row rather than enumerating its sentences. That is
  the largest single gap and it is deliberate: the mandate's axes have not been modelled by anyone.
- Levers of surfaces that consume review output rather than produce it (the backlog render, the conveyor).
- Any lever whose only home is a lane clone or a machine-local ledger.

**A count, not a claim of completeness.** 65 rows below, grouped from a full read of the pipeline that
enumerated **222** individually-tunable constants and parameters. The catalogue rolls those up: a row is an
*axis*, and one axis may have several constants realizing it (the round cap has four). The predicate above is
what produced the rows; a reader who applies the same predicate to a file this report did not read will find
more. **Where the roll-up hides something, that is a defect of this report, not of the pipeline** — the
divergences it hides are called out individually in Part 3 rather than smoothed away.

---

## Part 1 — the test, and why it did not survive

> **Read this section as a failed proposal, not as a rule.** A four-question scope test was drafted here and
> **refuted by its own validation**: run on the ratified case one card away it returns the opposite answer.
> It is kept in full, with the refutation, because a discarded classifier is worth more on the record than a
> silent deletion — and because the reason it failed names a third exclusion ground the repo already uses and
> had never written down. Nothing downstream depends on it.

The brief asked for a test a future author can apply to a *new* lever. The candidate offered was: *a lever is
a setting when two consumers choosing differently both produce coherent systems; it is an invariant when one
choice makes the system contradict itself.*

That is close but it fails on the case that actually arose. #3338 found that per-**surface** variation in
*seating* is legitimate and already ruled, while per-surface variation in *blocking power* is "incoherence
rather than configurability". Under the candidate test, blocking power comes out an **invariant** — and that
is wrong. A different repository, whose pull requests never touch this one's land path, may set its own
blocking set to whatever it likes and be entirely coherent. The candidate test has no way to say that,
because it never asks *over what scope* the two consumers differ.

So the answer is not binary. **Every lever is a setting at some scope. The question is which scope it is
pinned at**, and "platform invariant" is the special case where the pin sits above every scope any consumer
controls.

### The test — four questions, in order

**Q1 — Is it a lever at all?** Can you name one consumer who could coherently set it to a value other than
ours? If yes, it belongs in the catalogue.

> **Cost and local fit are not answers to this question.** "We would not use it" and "it is too expensive
> here" are *setting values*, not membership tests. The only admissible exclusion is **incoherence** — a
> value no consumer could hold without the system contradicting itself. Keep the two rejections visibly
> apart, because collapsing them is how a cost argument returns wearing a merit costume. (This is the repo's
> own *not-a-prioritization* rule, and #3338's prep skeptic struck a whole bolded paragraph for choosing a
> binding unit on cost.)

**Q2 — Name the two scopes.** The *decision scope* is the object whose fate the lever decides (this finding,
this pull request, this repo's policy). The *setting scope* is where a consumer would turn the knob (per
juror, per run, per surface, per repo).

**Q3 — Push the pin up until the conflict clears.** If varying the lever across the setting scope could give
**one object two conflicting fates**, the lever is pinned one scope up. Repeat.

**Q4 — Is the pin above every consumer scope?** It is a **platform invariant** if and only if varying it
anywhere would make the system's own output vocabulary **mean different things in two places that share it**.
Not "would be a worse policy" — *would make the word unreadable*. Otherwise it is a **consumer setting**,
pinned at whatever scope Q3 stopped at.

### Two riders the evidence forces

**Rider A — an axis is ordered by value, never by goodness.** Recording a lever's range must not imply that
turning it up is better. The only controlled experiment on change decomposition (di Biase et al., PeerJ CS
2019, n=28) found **no** effect on defects found (p=0.6), **no** effect on review time (p=0.66), and **no**
effect on rationale understanding; the single significant result was false positives falling 6 → 1 (p=0.03,
Cliff's δ=0.36). Ribeiro measured a plain union of three analyzers dropping precision from **0.57 to 0.39**
against the best single member. So *more reviewers* is not itself a quality lever. Each row therefore carries
what it is **evidenced to buy**, or an honest blank.

**Rider B — a null result travels with its lever.** Where a lever's obvious implementation has been tested and
failed to show an effect, the null is recorded in the same row, so a consumer setting it sees both.

> **Provenance of the external figures, and a limit on what they support.** The Baum, Fregnan, di Biase,
> Ribeiro and Meta numbers reached this survey **secondhand**, from the commissioning brief, not from a
> literature search run here; no primary paper was read in this session and no repo artifact holds them.
> They are recorded as *reported* figures with their study designs, and rows built on them should be treated
> as leads to verify rather than as grounded findings.
>
> **And two of them do not support the rider they were attached to.** di Biase (decomposition has no effect
> on defects found) and Ribeiro (a union of three analyzers drops precision 0.57 → 0.39) are both about
> **ensembling** — how combining reviewers behaves. Neither speaks to "an axis is ordered by value, not by
> goodness", which is a claim about how to *write down* a range. The rider is a reasonable authoring
> convention; it is not evidenced by these two citations, and it is kept on that basis rather than on theirs.
> di Biase in particular is evidence bearing on #3326's fan-out design, and belongs to that card.

### The refutation — the test mis-classifies #3320, ruled in this same cluster one day earlier

Run Q1–Q4 on the diff-size *refuse* threshold:

- **Q1** — a refuse-at-900 threshold is coherent; many repositories ship one. Cost is inadmissible and
  incoherence does not apply, so it is **admitted as a lever**.
- **Q2** — decision scope: the pull request. Setting scope: the repo.
- **Q3** — no single pull request gets two conflicting fates. **Pin stays at repo.**
- **Q4** — varying it makes no shared word unreadable. **Not a platform invariant.**
- **Verdict: a repo-scope consumer setting.**

[#3320](/backlog/3320/) ruled the exact opposite, and not on cost: *"**It is not even a config dimension.**
… a supported-but-unset refuse threshold invites a future reader to switch it on for the wrong reason.
**There is no value of it that is correct, so the knob is not built.**"* The ground it used is
`#size-adds-reviewers-never-refuses`'s finding that *"the proxy stops measuring anything the moment the
reviewer stops being one context"* — the 400-line figure is a **human attention** ceiling, and an agent panel
does not share that property.

**So there is a third exclusion ground, and Q1 as drafted forbids it: domain-misapplication of the underlying
proxy.** A lever may be excluded not because it is expensive (inadmissible), and not because no consumer could
hold any value coherently (incoherence), but because **the quantity it measures does not exist in this
domain**. That ground is not a cost argument in disguise — it survives with cost set to zero — and the repo
was already using it before this survey named it.

**A classifier that mis-classifies the ratified case sitting one card away is not fit to classify anything
else**, so the test is withdrawn rather than patched-and-shipped. Patching Q1 with the third ground makes it
return #3320's answer, but a heuristic that needed the counterexample to find its own missing clause has not
earned reuse on a case nobody has already decided. What survives is the *observation* — that the membership
question and the scope question are different questions — and the third exclusion ground, which is worth
recording on its own.

### Why an axis-space shape suits Web Everything — tested, and it half-fails

The brief asked whether "WE holds zero implementation" makes an axis space the natural shape of a standard,
and told me to test the reading rather than assume it. **It half-holds, and the half that fails matters.**

It holds in that `#config-extends-platform-default` is exactly this shape already — enum and contract to WE,
value to project config, core stays default-less — and the review pipeline's own policy contract is a working
instance of it (`careJury.bands`, the `disposition` block, `thresholds.diffLines`).

It fails in that **the review system is not one of WE's published standards.** It is WE's *own* internal
machinery for reviewing its own pull requests, and it lives under `we:scripts/`, which is tooling, not a
standard plane. There is exactly one consumer today. So the honest claim is *not* "WE must publish this as a
standard" — it is the weaker and still useful one: **the catalogue's test is reusable; the catalogue's
contents are this repo's.** Anyone who says otherwise is smuggling a standards-authoring obligation into a
tooling classification.

---

## Part 2 — the catalogue

`Pin` column: **WE** = above every consumer scope (platform invariant) · **repo** = a consumer repository sets
it · **surface** = a call site inside one repo may set it · **run** = per invocation.

### Stage 1 — Admission: is this change looked at, and how hard?

| # | Lever | Range | Set today by | Pin | Evidenced to buy |
| --- | --- | --- | --- | --- | --- |
| L1 | Whether a no-signal PR is looked at | none · advisory pass · sampled *n*% · full | **Ruled** — always, advisory-only (#3313) | repo | #3313: coverage beats sampling because a sampler starves the measurement that justifies it |
| L2 | Escalation reason vocabulary | 9 tokens today | policy contract `reasons[]` — **data, human-gated** | repo | — |
| L3 | Per-signal care weights | 5 integers (`dismissedBase` 3, `dismissedExtra` 2, `blastRadius` 3, `size` 2, `crossRepo` 2) | `we:scripts/lib/review-escalation.mjs:363` — **code, agent-clearable** | repo | — (self-described "loose to start") |
| L4 | Care band edges | `{low:1, elevated:3, high:5}` | `we:scripts/lib/review-escalation.mjs:373` — code, agent-clearable | repo | — |
| L5 | Size escalation threshold | any line count (400) | policy contract `thresholds.diffLines` — **data, human-gated** | repo | a *human* attention ceiling; #3320 ruled it does not transfer to a panel |
| L6 | Blast-radius path roster | any path set | `we:scripts/lib/review-escalation.mjs:274` and `:303` | repo | — |
| L7 | Statute path roster | any path set | `we:scripts/lib/review-escalation.mjs:76` | repo | — |
| L8 | Reason → clearance map | `human` or `agent` per reason | policy contract `reasons[].clearance` | repo | — |
| L9 | Reason → disposition table | 3 ordered rules → converge/human × autoLand | policy contract `disposition.precedence` | repo | — |

### Stage 2 — Composition: who looks?

| # | Lever | Range | Set today by | Pin | Evidenced to buy |
| --- | --- | --- | --- | --- | --- |
| L10 | Seated lens roster | any subset of the 5 | **three homes, two values** — `PANEL_LENSES` (5) at `we:scripts/lib/jury-core.mjs:1181`; the policy contract's per-band rosters (5); `LENSES` (4) at `we:scripts/workflows/review-parked-prs.mjs:153` | **surface** — already varies, and legitimately (#3313, #3338) | — |
| L11 | Jurors per lens | 0..N | contract bands (0/1/1/2) · `panelRigorForCareLevel` at `we:scripts/lib/jury-core.mjs:1211` · ceiling 2 mirrored at `we:scripts/workflows/review-parked-prs.mjs:161` | surface | see Rider A — breadth alone is not evidenced to buy quality |
| L12 | Which lenses hold the **any-impact veto** | any non-empty subset | `MANDATORY_LENSES` at `we:scripts/lib/jury-core.mjs:1137` — **but `derivePanelVerdict` takes it as a free parameter (`:1353`) and checks only non-emptiness** | **contested — Fork 2** | — |
| L13 | Roster timing | `up-front` · `incremental` | policy contract `careJury.rosterTimingMode` (alternative explicitly *reserved*) | repo | — |
| L14 | Per-run roster override | `add` · `remove` | `ROSTER_OVERRIDE_OPS` at `we:scripts/lib/jury-core.mjs:1723` | run | — |
| L15 | Lens selection basis | caller-chosen · derived from touch-set | caller-chosen today; #3335 open | repo | — |
| L16 | **Seat accountability** | named individual · pooled | **not modelled** — jurors are anonymous positions; #3363 would record identity per round | repo | Meta (arXiv 2312.17169): individual assignment vs pooled gave **−11.6% time-in-review, no quality-guardrail regression**; pooling causes diffusion of responsibility |
| L17 | Reviewer model | any model id | `DEFAULT_MODEL = 'sonnet'` at `we:scripts/lib/judge-spawn.mjs:333`; `JUDGE_MODEL = 'sonnet'` at `we:scripts/operations/review-pr.mjs:408` | repo | — |
| L17b | Reviewer reasoning effort | `low` · `medium` · `high` · `xhigh` · `max` | **two divergent values** — engine default `medium` (`we:scripts/lib/judge-spawn.mjs:334`), the real review operation pins `high` (`we:scripts/operations/review-pr.mjs:409`) | surface | — |
| L17c | Per-juror spend ceiling | any USD amount, or none | `DEFAULT_BUDGET_USD = 1.5` (`we:scripts/lib/judge-spawn.mjs:411`); `review-pr` and `review-prep` pass **`null`** (no ceiling, operator ruling 2026-08-18) | surface | — |
| L17d | Juror wall-clock timeout | any duration | `JUDGE_TIMEOUT_MS = 20 min` (`we:scripts/lib/judge-spawn.mjs:153`) — **two comments still describe it as 10 minutes**, stale by a factor of two | repo | — |
| L17e | Tool grant per juror | any tool subset, or none | `REVIEW_JUROR_TOOLS = ['Bash','Read','Grep','Glob']` (`we:scripts/operations/review-pr.mjs:406`) — **but `judgePanel` never forwards it**, so a panel seat runs with no tools | surface | #3313: a tool-free pass is the cheap floor, so this is a real axis — currently set by accident |
| L17f | Fan-out concurrency | 1..N, or unbounded | **unbounded** — `Promise.allSettled` over the whole roster (`we:scripts/lib/judge-panel.mjs:416`) | repo | — |
| L18 | Juror independence source | distinct fresh context · same context | statute `#agent-convergence-independent-validation` | **WE** | peer-agreement is not validation |

### Stage 3 — What each juror is handed

| # | Lever | Range | Set today by | Pin | Evidenced to buy |
| --- | --- | --- | --- | --- | --- |
| L19 | Scope breadth per juror | whole diff · disjoint shard | #3326 (open): whole-diff *context*, disjoint *scope* | repo | — |
| L20 | Shard cut basis | file · directory · **dependency-graph** · symbol | #3326 ships coarse; dependency-graph marked *"deliberately out of scope"* — **re-admitted here as a range value** per the membership rule | repo | — |
| L21 | **Change size seen by one reviewer** | lines per juror | **not a lever today** — falls out of shard count as a side effect | repo | **The strongest primary number in the survey.** Baum et al. EMSE 2019 (n=50, professionals): effectiveness **59% small vs 35% large**; efficiency **15.65 vs 9.47** defects/hour; a delocalized defect detected in **76%** of small vs **36%** of large reviews. McNemar p = 0.002 / 0.001 / 0.0117 / 0.0034, all surviving Bonferroni-Holm. Fatigue and position ruled out — the effect is size. **Caveat, and it is the whole question:** this measures *human* reviewers, and `#size-adds-reviewers-never-refuses` ruled that attention is *"the one property an agent panel does not share with a human reviewer"*. So these numbers do **not** transfer to an agent panel without an argument nobody has made, and this row makes no claim about #3326 |
| L22 | **What occupies first position** | highest-risk · most-changed · caller-before-callee · arbitrary | **alphabetical, by accident** | repo | Fregnan et al. ESEC/FSE 2022 (n=106, Distinguished Paper): **64% lower odds** of catching a seeded defect when its file was shown *last*. PACMSE/FSE 2024 (n=29): hot-spot-first ordering **+23% review comments**. **Null, recorded alongside:** Baum EMSE 2019 (n=50) tested general dependency-optimal reordering against deliberately bad orders and found no statistical confirmation (p = 0.2587 / 0.1084 / 0.0537); participants *perceived* bad orders as chaos but did not perform better under good ones. So the evidenced lever is *which subset leads*, **not** how the whole diff is sorted |
| L23 | Tool access | diff-only tool-free · full repo | varies by surface — #3313's floor pass is tool-free, panel jurors are not | surface | #3313: economize on depth, not coverage |

### Stage 4 — What a finding must carry

| # | Lever | Range | Set today by | Pin | Evidenced to buy |
| --- | --- | --- | --- | --- | --- |
| L24 | Evidence ladder | `assertion` < `resolved-citation` < `repro` < `quoted-citation` | `EVIDENCE_KINDS` at `we:scripts/lib/jury-core.mjs:653` | repo | — |
| L25 | **Evidence floor** | any rung | `EVIDENCE_FLOOR = 'assertion'` at `we:scripts/lib/jury-core.mjs:723` — **the dial exists and ships OFF** (#3312) | repo | — (#3312 says raise it on measured per-category precision, not intuition) |
| L26 | Evidence-exemption bar | any impact level | `EVIDENCE_EXEMPT_IMPACT_BAR = 'unrecoverable'` at `we:scripts/lib/jury-core.mjs:734` — **a second, independent bar** nobody has named as one | repo | — |
| L27 | Minimum confirmable quote length | any char count (12) | `MIN_CONFIRMABLE_QUOTE_CHARS` at `we:scripts/lib/jury-core.mjs:739` | repo | — |
| L28 | Citation-scope admission | `in-scope` · `uncited` · `unverifiable` | `CITATION_SCOPE_ADMITS` at `we:scripts/lib/jury-core.mjs:486` | repo | #3351: 25 adversarial fixtures, 6 real defects |
| L29 | Impact vocabulary | 4 levels | `IMPACT_LEVELS` at `we:scripts/lib/jury-core.mjs:197` | **WE** — it is the shared word | — |
| L30 | Disposition vocabulary | `blocker` · `carve-out` · `nit` | `DISPOSITIONS` at `we:scripts/lib/jury-core.mjs:284` | **WE** — same reason | — |
| L31 | Which dispositions earn another round | subset | `DISPOSITION_EARNS_ROUND` at `we:scripts/lib/jury-core.mjs:295` | repo | — |
| L32 | Severity assignment method | juror self-rating · adjudicated · calibrated | **in flight — a sibling severity-calibration preparation, not yet numbered.** Deferred, not classified here | defer | #3312 records the claim that self-rated severity is measured near-random |

### Stage 5 — Reduction: many opinions become one verdict

| # | Lever | Range | Set today by | Pin | Evidenced to buy |
| --- | --- | --- | --- | --- | --- |
| L33 | Aggregation rule | diversity-selection · majority vote · weighted vote | `AGGREGATION` at `we:scripts/lib/jury-core.mjs:1193` — one value; #2567 "never a vote" | **WE** | — |
| L34 | Per-lens weights | number per lens | policy contract `disposition.lensWeights` = `{}` — **declared as data, judge unbuilt (#2652)** | repo | — |
| L35 | Dissent tolerance | 0..1 | policy contract `disposition.dissentThreshold` = 0 | repo | — |
| L36 | Resolution mode | `accept-best` · `present-unless-all-agree` | policy contract = `present-unless-all-agree` | repo | — |
| L37 | Blocking set — advisory lenses that block above the bar | subset of `ADVISORY_LENSES` | **unbuilt** (#3339); #3338 recommends `['claim-accuracy']` | **contested — Fork 2** | #3338's ledger replay: in 6 of 6 four-lens runs no advisory lens ever dissented from the mandatory pair |
| L38 | Impact bar **level** | any impact level | `PREVENTION_IMPACT_BAR = 'broken'` at `we:scripts/lib/jury-core.mjs:264`, already a parameter `bar` at `:895`, `:971`, `:1353` | repo | — |
| L39 | When the adversary runs | on `accept` only · always · never | `redTeamRequired` in `we:scripts/lib/jury-core.mjs` | repo | — |
| L40 | What an **unrun** adversary yields | fail-closed · fail-open | `foldRedTeamVerdict` → `needs-human` | **WE** | — |
| L41 | Round cap | 0..N | **four constants**: `NEGOTIATION_ROUND_CAP = 5` and `DEFAULT_ROUND_CAP = 5` (same file, nothing pins them equal), per-band `roundCap` 0/1/2/3, and `PLAN_ROUND_CAP = 2` at `we:scripts/lib/review-core.mjs:370` | repo | — |
| L41b | Default care band when unstated | any band | **two divergent answers** — `initConvergeState` defaults `low` (`we:scripts/lib/converge-core.mjs:121`), `converge-cli` defaults `elevated` (`we:scripts/converge-cli.mjs:76`) | surface | — |
| L41c | Whether an operator override is auditable | recorded · silent | `we:scripts/converge-cli.mjs:173`-`181` records every `--jurors`/`--round-cap` override and floors it at the band value; **nothing analogous exists on the parked-PR loop** | surface | — |
| L42 | Editor enablement by care band | any subset | `EDITOR_ENABLED_CARE_LEVELS = ['low']` at `we:scripts/lib/jury-core.mjs:1254` | repo | #2908: `elevated` excluded on evidence — the band where the loop's one observed editor failure happened |
| L43 | Editor minimum rounds | N | `EDITOR_MIN_ROUNDS = 2` at `we:scripts/lib/jury-core.mjs:1264` | repo | — |

### Stage 6 — Consequence: what the verdict does

| # | Lever | Range | Set today by | Pin | Evidenced to buy |
| --- | --- | --- | --- | --- | --- |
| L44 | Land mode | `shadow` · `enforce` | policy contract `disposition.landMode` = `shadow`; `#enforce-flip-triple-gated` | repo | — |
| L45 | Whether a scored signal may refuse | escalate-only · refuse | **Ruled** #3320 — size dials capacity, never permission | repo (the *dial*) | — |
| L46 | **Reviewer attachment** | every block carries a reviewer · a block may carry none | #2563: *"`gate` means route-to-a-human, never hard-block-with-no-reviewer"* | **WE** | — |
| L47 | Verification posture required before land | required · declared · optional | #3321, #3357 (both open) | repo | — |
| L48 | Which paths force a human | any path set | `POLICY_SPEC_BASENAMES` at `we:scripts/lib/gate-config.mjs:370` | repo | — |

### Stage 7 — The system measuring itself

| # | Lever | Range | Set today by | Pin | Evidenced to buy |
| --- | --- | --- | --- | --- | --- |
| L49 | **Stability measurement method** | replayed · live-repeated | #3310. Live-repeated was **rejected at ~$0.43 per run** — **re-admitted here as a range value**; this repo sets `replayed` | repo | — |
| L50 | Adjudication sample rate | 0..100% | #3318 front A: ~10% blind expert adjudication | repo | — |
| L51 | Effective-false-positive contract | thresholds | under 10% target, probation at 10%, auto-disable at 25% | repo | provenance stated honestly by #3318: Google's own footnote calls 10% *"somewhat arbitrary"*; Coverity publishes 20% target / 30% failure; measured developer tolerance sits near 15% |
| L52 | Where a card gate runs, and at what severity | write-time hook · standards gate · prepare close-out × warn or error | **#3364 — open, and it owns this. Deferred, not classified here** | defer | #3364's own measurements: #3341 fires on 17/3336 cards (0.5%); #3340 fires on 0 |
| L53 | Adversarial-fixture obligation for model-output consumers | required · not | **Ratified #3354** (2026-08-27) | **WE** | PR #1607: 25 fixtures, 6 real defects, **none a parse failure** |
| L54 | Completeness-claim discipline | may assert complete · must state predicate + candidate set | #3362 (open) | **WE** (epistemic) | PR #1609: five rounds, each shipping a completeness sentence larger than its code |
| L55 | May a policy contract declare unbuilt entries | yes with `todo`+`owedTo` · no | policy contract `todoMarker` | repo | — |
| L56 | Ship bar for a candidate corpus gate | any recall floor × false-fire tolerance | *"at least 80% recall of its class and zero false fires"* at `we:scripts/review-corpus/gates.mjs:13` — **prose only, unenforced** | repo | — |
| L57 | Finding-match tolerance in replay | dice threshold, line proximity | `diceMin = 0.35`, `strictDice = 0.6`, `tol = 3` lines (`we:scripts/review-corpus/stability.mjs:153`, `:166`) | repo | — |
| L58 | Whether a runtime override of a policy value is possible at all | closed · open | **open today** — `scoreEscalation` merges caller `thresholds` over the contract (`we:scripts/lib/review-escalation.mjs:589`); `bar`, `floor`, `mandatoryLenses` and `roundCap` are likewise defaulted parameters | **contested — Fork 3's amendment** | — |

---

## Part 3 — what the catalogue found that nobody had named

**1. The three homes carry three different clearances, and the assignment does not track how load-bearing the
lever is.** Verified by running the repo's own path classifiers:

| home | policy tier | who may change a value |
| --- | --- | --- |
| `we:scripts/lib/review-policy.contract.json` | spec (`gate-self`) | **human** |
| `we:scripts/lib/review-escalation.mjs` | derivation (`gate-derivation`) | **agent** |
| `we:scripts/lib/jury-core.mjs` | **no policy tier at all** | agent (generic blast-radius only) |

So `thresholds.diffLines = 400` — a soft care signal #3320 ruled can never refuse anything — is human-gated,
while `CARE_WEIGHTS`/`CARE_BANDS`, the eight numbers that *consume* it, are agent-clearable.

> **Corrected.** This finding first added *"and every round cap"* to the escaped set, reasoning from the path
> roster alone. The path classification is right; the **effect** claim was wrong. The care→jury conformance
> suite imports `panelRigorForCareLevel` and `PANEL_LENSES` and pins each band's `lenses`, `jurorsPerLens` and
> `roundCap === rounds` (`we:scripts/lib/__tests__/review-policy.conformance.test.mjs:56` and `:628`) — and
> that suite is itself `leash: 'spec'`, so lowering `NEGOTIATION_ROUND_CAP` below a band value reddens it and
> forces a human. The backstop is indirect but real.
>
> **The genuinely escaped set is three**, not "the file": `PREVENTION_IMPACT_BAR` and `EVIDENCE_FLOOR` appear
> in no pin at all, and `MANDATORY_LENSES` **membership** escapes because the suite pins band
> `lenses ⊆ PANEL_LENSES`, and `PANEL_LENSES` is the *union* of the mandatory and advisory lists — so moving
> `security` from one list to the other leaves the union byte-identical and the suite green while removing
> that lens's power to block.
>
> Recorded rather than silently fixed: reasoning from a path roster without checking what the conformance
> suite pins is the overclaim #3362 names, in a report that opens by invoking #3362.

**2. `mandatoryLenses` is a free parameter, not a ruled constant.** `derivePanelVerdict`
(`we:scripts/lib/jury-core.mjs:1353`) defaults it and validates only that it is non-empty. Any caller may
pass `['simplicity']` and obtain a structurally valid panel verdict in which no lens holds the any-impact
veto #2310 ruled. #3344 guards the *seating* floor at one surface; nothing guards the *contents* anywhere.

**3. The brief's premise about a "different roster" is half right, and the correction sharpens the boundary.**
`we:scripts/workflows/review-parked-prs.mjs:154` does declare its own mandatory-lens literal — but its value
is `['correctness','security']`, **identical** to the one in `we:scripts/lib/jury-core.mjs`. What actually
differs across surfaces is the *seated* roster: `LENSES` (4) versus `PANEL_LENSES` (5). So in the live tree,
**seating already varies by surface and blocking power varies nowhere** — which is exactly the #3313/#3338
split, observed rather than asserted.

**4. There are two independent impact bars, not one.** `PREVENTION_IMPACT_BAR = 'broken'` governs which
findings block; `EVIDENCE_EXEMPT_IMPACT_BAR = 'unrecoverable'` governs which findings escape the evidence
floor. They can be set in opposite directions and nothing relates them.

**5. Four round-cap constants, not one.** `NEGOTIATION_ROUND_CAP` (5) and `DEFAULT_ROUND_CAP` (5) are **two
separate constants in the same file** with independently-documented derivations and nothing pinning them
equal — `deriveNegotiationOutcome` reads the first, `deriveLoopOutcome` the second. Add the per-band
`roundCap` (0/1/2/3), `PLAN_ROUND_CAP = 2` at `we:scripts/lib/review-core.mjs:370`, and `EDITOR_MIN_ROUNDS`
(2) as a floor interacting with all of them.

**9. The human gate protects the *default*, not the *value used*.** This is the sharpest finding in the
survey and it changes a recommendation. `thresholds.diffLines` is human-gated because it lives in the policy
contract — but `scoreEscalation` merges a caller-supplied `thresholds` object over it
(`we:scripts/lib/review-escalation.mjs:585` and `:589`), so any caller may pass a different number at runtime
without touching the contract at all. The same shape holds for `bar` (`PREVENTION_IMPACT_BAR`), `floor`
(`EVIDENCE_FLOOR`), `mandatoryLenses` and `roundCap`: each is a module constant *and* a defaulted parameter,
and `we:scripts/review-core-cli.mjs:183` accepts `mandatoryLenses` **straight from caller JSON**. **So
"human-gated" describes where a number is written, not what value the pipeline runs on.** Fork 3's default is
amended accordingly: moving numbers into the contract without closing the override seam is theatre.

**10. `mandatoryLenses` already varies across surfaces — and it is coherent, which confirms the test rather
than breaking it.** Three subject adapters declare different mandatory sets: the PR-diff pair
`[correctness, security]`, `DESIGN_PIXEL_MANDATORY_LENSES = [usability, a11y]`
(`we:scripts/lib/design-pixels-adapter.mjs:77`), and
`DECISION_PROSE_MANDATORY_LENSES = [root-cause, completeness]`
(`we:scripts/lib/decision-prose-adapter.mjs:61`). Run the scope test on it: the *decision scope* is a finding
about **one kind of subject**, and a design-pixel finding and a code-diff finding are never the same object.
No object gets two fates, so no conflict, so **blocking power is a setting at *subject* scope and pinned at
repo scope within a subject.** That is the test predicting an existing, deliberate, working variation it was
not built from — the closest thing to a validation this catalogue has. (It also surfaces a live footgun: a
design or prose caller that forgets to pass `mandatoryLenses` inherits the PR-diff pair and throws "missing
verdict for mandatory lens".)

**11. Three seated-lens rosters, two values, and a charter that only covers four.** `PANEL_LENSES` (5),
`LENSES` (4) in the parked-PR loop, and `REVIEW_PANEL_LENSES` (4) at `we:scripts/lib/jury-ledger.mjs:170`,
whose `REVIEW_LENS_CHARTER` also holds only four entries — so a fifth juror would be seated with no charter.

**12. Levers with no home at all.** The ship bar for a candidate corpus gate — *at least 80% recall of its
class and zero false fires* (`we:scripts/review-corpus/gates.mjs:13`) — exists only as prose and is
unenforced. `MIN_CONFIRMABLE_QUOTE_CHARS` is the inverse: explicitly labelled "a judgement call, not a
measured threshold", yet module-private and un-parameterised, so it is the one evidence knob that *cannot* be
tuned without editing the file.

**6. Per-reviewer change size is the best-evidenced axis in the literature — and the use this report first
made of it was wrong.**

> **Retracted in full.** This finding originally read: *"This is the reconciliation that makes #3320 and
> #3326 fit together… sharding is the only mechanism that lowers per-reviewer size without capping total
> size… **Neither card says this.**"* **Both halves are false.** #3326's opening line already states the
> reconciliation — *"A large diff earns more reviewers, never fewer lines (#3320)"* — so "neither card says
> this" was not checked before it was written. And #3326 explicitly **forbids** the remedy the argument
> implied: *"Each juror receives the whole diff and full repository access… **Truncating a juror's diff to its
> shard would reintroduce exactly the blindness the fan-out exists to remove**."* Every juror in that design
> is deliberately still a whole-diff reviewer; the design holds per-reviewer size constant and varies only
> accountability. The citation argued for the intervention the design rejects.
>
> **And it re-imports what #3320 threw out.** `#size-adds-reviewers-never-refuses` states that the 400-line
> figure is an *attention* ceiling and that *"attention is the one property an agent panel does not share with
> a human reviewer"*. Baum is another human-attention study. Citing it to size an agent panel commits exactly
> the error that anchor was written to prevent.

**What survives:** the Baum numbers are real and are recorded in row L21 as evidence about **human**
reviewers. Whether they transfer to an agent panel is precisely the question #3320 answered *no* to, so the
row carries that caveat and makes no claim about #3326.

**7. Seat accountability is not modelled at all.** Jurors are anonymous positions. The production evidence
(Meta) is that naming an individual is worth −11.6% time-in-review at no quality cost.

**8. First-position ordering is an accident.** Nothing chooses it; alphabetical order falls out.

---

## Part 4 — options re-admitted after being excluded on cost or local fit

Per the operator's binding rule — *a lever stays if any consumer could reasonably want it; cost and local fit
are setting values, not membership tests*:

| Excluded as | Where | Re-admitted as |
| --- | --- | --- |
| "$0.43 per run is too expensive" | live-repeated stability measurement, #3310 | **L49** — range value `live-repeated`; this repo sets `replayed` |
| "needs symbol-level analysis, deliberately out of scope" | dependency-graph shard cutting, #3326 | **L20** — range value. Whether its *merit* argument survives stays #3326's call; the cost half must not remove it from the space |
| "built the dial and shipped it off" | evidence floor, #3312 | **L25** — this is the *correct* shape, and the catalogue's worked example: lever present, setting permissive |
| the cheap/expensive framing was struck | named minimum fixture set vs author judgement, #3354's dissolved fork | **No axis survives underneath it.** Checked: #3354 dissolved that fork because the class is the *trust boundary* and the obligation binds on the consumer *existing* — both structural findings, neither a cost claim. What survives is L53, an invariant. Recorded as a negative result rather than a manufactured row |

**And the exclusion that still stands, kept visibly distinct:** a value **no consumer could coherently hold**
is not a lever. Example: "an unrun red-team ratifies" (L40 fail-open). No repository can hold that value and
still have the word *accept* mean "survived an adversary". That is incoherence, not expense — and keeping
these two rejections apart is the whole point, because collapsing them is how a cost argument comes back
disguised as merit.

---

## Part 5 — is the framing load-bearing, or merely tidy?

Stated honestly, because the brief required it and because the skeptic's strongest attack is exactly this.

**The framing is not load-bearing. The enumeration is.** That is the finding, and it was reached by a skeptic
pass that was instructed to try exactly this attack and whose every load-bearing claim was then verified
against the tree rather than accepted.

**Three claims of leverage were made in an earlier draft. All three failed:**

1. *"It changes what #3339 should build."* **Manufactured.** The instruction to home the blocking set in the
   contract was already written — by #3338, which is the card that gates #3339. The delta flows
   #3338 → #3339 and predates this survey. Claiming it is claiming credit for a change this work did not
   cause.
2. *"It exposes the clearance asymmetry."* **Half-true, and the wrong half was claimed.** The asymmetry is
   real and was found here — but naming it required *reading the files*, not classifying them. Anyone who read
   `we:scripts/lib/gate-config.mjs` against `we:scripts/lib/jury-core.mjs` would have found it whether or not
   they called the values "levers". And the repo's ratified `#contract-split-for-tier-ownership` already
   supplies both the diagnosis and the fix, so the framing added no analysis on top.
3. *"It reconciles #3320 and #3326."* **Retracted** — see Part 3, finding 6. #3326 already stated the
   reconciliation and forbids the remedy the argument implied.

**And the framing's central proposal, the four-question test, mis-classifies the ratified case one card away**
(Part 1). A classifier that gets #3320 wrong cannot be offered as a tool for the next case.

**Run against the four cards it was meant to help, the score is zero of four.** #3338 already performed the
scope analysis in its own words and dated earlier. #3339 changes only through #3338. #3326's blocker is an
unwritten executable criterion, which no classification supplies. #3364 turns entirely on measured
false-positive rates, and the test's first question rules cost inadmissible — so it would return nothing about
the only axis #3364 turns on.

**What the work is actually worth, stated without inflation.** Reading 222 constants end-to-end found two real
defects in a ratified boundary — three gate constants outside the contract, and a runtime seam that lets a
caller outrank the human-gated value. The second is a hole in the **pattern**, not just this instance, and
nobody had named it. It also found a third exclusion ground the repo was already using and had never written
down (Part 1). Those are the deliverables. The vocabulary of "levers and settings" occasioned the read and
contributed nothing to the findings, and roughly forty-five of the sixty-five rows are inventory with no
consequence attached.

**The fair summary:** a survey worth its cost, wrapped in a framing that was not. Reported that way because
the alternative — shipping the framing on the strength of the survey it happens to sit next to — is exactly
the overclaim this cluster exists to catch.

---

## Cross-references

- Parent program: #3318 Review-efficacy watch.
- Constrains, does not rule: #3338 (advisory blocking set — prepared, do not rule), #3339 (the build),
  #3364 (gate deployment — owns L52), #3326 (scoped fan-out — owns L19/L20), #3310 (stability — owns L49),
  #3312 (evidence floor — owns L25), the in-flight severity-calibration preparation (owns L32).
- Worked invariants: #3354 (L53), #3320 and #2563 (L46), #2567 (L33).
- Statute: `#config-extends-platform-default`, `#size-adds-reviewers-never-refuses`,
  `#every-pr-gets-a-look-advisory-floor`, `#claim-accuracy-advisory-blocks-on-impact`,
  `#agent-convergence-independent-validation`, `#enforce-flip-triple-gated`,
  `#blast-radius-advisory-care-not-a-gate`, `#converge-editor-enabled-at-low-only`.
