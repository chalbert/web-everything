---
bornAs: xjbdhzb
kind: epic
status: open
ongoing: true
dateOpened: "2026-08-26"
tags: [review, jury, program, delivery, operations]
relatedTo: ["3323"]
---

# Review-efficacy watch

Keep the review system catching what matters at a cost worth paying, as the models, the authoring agents and the published evidence keep moving. Front A is a named metric set (adjudicated precision, seeded-defect recall, novel-finding rate, action rate) plus a per-category effective-false-positive contract; front B is a five-track evidence sweep re-run against later data. Filed off that sweep plus a 92-case replay of our own recorded verdicts.

## Why this is a program

**1 — Standing goal, no Definition of Done.** Resolve every child and it does not end. A new model family shifts measured juror independence; our own authoring agents' failure signatures change as they change; the evidence moves fast enough that **two recommendations were reversed inside the sweep that produced this card**.

**2 — Conformance front (internal).** Four numbers, always together, always with intervals: adjudicated precision (blind expert adjudication of a ~10% sample) · seeded-defect recall · novel-finding rate (`|F \ P| / |F|`) · action rate. Plus the standing contract: **effective-FP per finding category under 10%, probation at 10%, auto-disable at 25%**. *Note the provenance honestly:* 10% is a product decision Google's own footnote calls *"somewhat arbitrary"*; Coverity publishes 20% target / 30% failure; measured developer tolerance sits near 15%.

**3 — Currency front (external).** Signals: a new model family in the panel · new LLM-judge reliability research · new AI-review tooling practice and published precision figures · a change in what our authoring agents get wrong. Discovery, hand-runnable: re-run the five-track sweep (human-review evidence · LLM-judge science · certification practice · tooling landscape · measurement method) and re-measure panel independence.

**4 — Cadence.** Internal: a category crossing 10% not-useful; a check whose yield reaches zero; an escaped defect. External: a periodic sweep, and on any panel model change.

**Maturity: L0.** Manual discovery, hand-run metric. L1 is a `/review-efficacy` skill; L2 is scheduled. Neither assumed.

## The measured baseline this must beat

From `we:scripts/review-corpus/` — 92 replayable cases over 87 distinct revision ranges, 59 PRs, 39 confirmed findings, every range reachable:

> **The corpus records what was SAID, not what was true.** A peer session that authored most of the PRs behind these cases reports finding real errors in several of the reviews after they were recorded. So the 39 "confirmed findings" are confirmed *by a reviewer*, not adjudicated — some are themselves wrong. Every figure below inherits that: they are sound as a *relative* comparison between reviewers scored on the same pool, and unsound as absolute rates. This is the pooling problem twice over — incomplete labels, and labels that are individually fallible.

| | |
|---|---|
| Verdicts that recorded a lens row | 87 of 92 — **every one of them a single row**; 5 recorded none |
| …and that single lens was `correctness` | 86 of 87 (the exception is #1457 r2, `security`) |
| Correctness juror accepted | 79 of 86 lens rows (91.9%) |
| Verdicts recorded `changes` | 37 of 92 (40%) |
| Juror accepted `correctness`, operator bounced anyway | **27** — the direct cross-tab, no subtraction |
| Bounces recorded over **zero** juror findings | 13 in the corpus; 17 across 8 PRs (#1556–#1567) on a live sweep of every structured verdict comment in #1428–#1567 |
| Findings caught at review whose input existed at WRITE time | 21 of 39 |
| …and at COMMIT time, where a suite run could have caught them | 18 of 39 |
| Merged with no recorded verdict | 29 of 129 (22.5%) |
| Planning PRs | 3.20 rounds and 20.6 KB review text each, vs code at 1.19 / 4.3 KB |

> **Retracted — three more rows of this table were wrong, re-counted 2026-08-26 over `we:scripts/review-corpus/cases`.**
> On top of r1's correction of the accept count (80 → 79) it still read *"Verdicts that ran a single lens | 84 of 84
> (100%), always `correctness`"*, *"Verdicts recorded `changes` | 30 of 84 (36%) — ~24 not traceable to a juror
> finding"* and *"Bounces carrying no reason at all | 11"*. There is no population of 84 anywhere in the corpus — it
> holds 92 cases, 87 of which record a lens row. "Always `correctness`" was false (#1457 r2 is `security`). The
> `changes` count is 37, not 30. The "~24" was a subtraction of two wrong numbers; the measured cross-tab is 27 and
> needs no subtraction. And "11" is the count of PRs in the widest reasonless set, not a count of bounces — narrow
> set 17 bounces across 8 PRs, wide set 33 across 11 PRs.

Cost today ≈ **$0.43/PR** (four recorded juror runs: $0.6152–$0.9042, 167–312s). The panel already declared at care `high` is 5 lenses × 2 jurors × 3 rounds ≈ **$21/PR** — so *fewer* jurors is a cost cut, not an add.

## The goal-set

Front-A completeness maps each element to a child **and** to live code. Buildability is stated because **four** elements are currently blocked on other work (#6, #7, #8, #9 in the table below) — 5 buildable + 4 blocked + 1 unaddressed = 10.

> **Retracted — this line said "three", and the table directly under it lists four.**
> It read *"Buildability is stated because three elements are currently blocked on other work."* The blocked rows
> are #6 (#3158), #7 (suite runtime), #8 (no ledger) and #9 (the same ledger) — four, not three. 5+3+1=9 does not
> account for the ten elements the table enumerates; 5+4+1=10 does. The review log at the foot of this card and
> this PR's description already said **4**; this sentence was the site left behind when those two were corrected.

| # | Element | State |
|---|---|---|
| 1 | Verification is mandatory before land (`requireVerified` default true) | **buildable now** |
| 2 | Every skipped/degraded review is announced on the PR | **buildable now** |
| 3 | Non-code PRs routed off the code reviewer | **buildable now** |
| 4 | Escalation basis recomputed cumulatively from `merge-base` for every signal | **buildable now** |
| 5 | Security lens runs once per code PR | **buildable now** (+~$0.29/PR) |
| 6 | Panel seats carry tools | blocked — #3158 |
| 7 | Findings admitted by evidence kind, assertion-only advises | blocked — suite runtime (`test:unit` 693s vs a 20-min juror kill) |
| 8 | The meter: per-category effective-FP contract with auto-disable | blocked — no ledger (#3007 / #3255) |
| 9 | The four numbers, instrumented | blocked — same ledger |
| 10 | Determinism: run-to-run stability of the same review | **unaddressed by any layer** — named here so it is not lost |

## What the red teams killed

Recorded so the next reader does not re-derive it:

- **Cross-family jurors — cut.** Every juror is `claude -p`; `--model` takes Claude aliases and the answer shape is a forced tool call with no cross-vendor equivalent. A second transport, not a layer.
- **"Never review inside the authoring conversation" — already shipped** (`--no-session-persistence` + derived `--session-id`).
- **`judgePanel` seats are tool-free.** Wiring it as-is replaces one tool-bearing juror with three blind ones.
- **Three self-reported figures were retracted** from the design: an inflated unanimity count (ten agents, not eighty), a vendor before/after that measures deploy-vs-no-deploy rather than a proof requirement, and a "precision" figure that is most likely an action rate.
- **The strongest evidence found runs *against* author certification** — mandated double-checks became primed ones 92.5% of the time, and primed checking conferred no benefit over single checking.

## Done when *(a program has none — this is the conformance read)*

**Green** in a given review when: every goal-set element maps to live code; every finding category is inside its effective-FP budget; the four numbers are current with intervals; and the last external sweep found no unadopted delta. Returns to **active** the moment any breaks.

## Review log

- **2026-08-26** — **the split result, re-counted.** Every figure below re-derived in this lane at `2026-08-26T17:39Z` by counting the structured verdict comments (`🔁 review — changes requested` / `✅ review — accepted`) with `gh pr view <n> --json comments`, and the file counts with `git diff --name-only <basis> | wc -l` over the exact revisions each verdict recorded as its net basis.

  > **Retracted — this entry's first version claimed the split cleared in one round each. Zero of four did, and it left the fourth PR out.** It read: *"PR #1569 carried the corpus, an engine change, a lens-vocabulary change and this filing in **100 files**: **five review rounds**, no path to convergence. Split into four PRs by file set, it cleared in **one round each** — #1570 merged, #1569 and #1571 accepted."* Three figures in that sentence are wrong.
  > **"100 files"** — the pre-split diff was **120** net changed files at the first verdict (`435f3519..1f76a651`) and **123** at the second (`435f3519..c63f7293`); it *grew* between rounds.
  > **"five review rounds"** — #1569 carries **two** recorded verdicts before the split (13:15:50Z, 14:12:07Z), not five.
  > **"one round each"** — none of the four cleared in one round, and **#1572** (the `--reason` guard, *"Slice 3 of 4, carved out of PR #1569"*) was omitted from the list of outcomes entirely.

  Counting recorded verdicts from the moment the split existed — the first carve-out PR, #1570, was opened `14:41:34Z`:

  | PR | recorded verdicts after the split | rounds | outcome |
  |---|---|---|---|
  | #1569 — the `claim-accuracy` lens (8 → 13 net files) | changes 16:40 → accepted 17:15 | **2** | merged 17:36 |
  | #1570 — this programme and its cards | changes 15:25 → accepted 15:44 | **2** | merged 16:46 |
  | #1571 — replay corpus + candidate gates | changes 15:23 → changes 16:38 → accepted 17:06 | **3** | accepted, still open |
  | #1572 — the `--reason` guard | changes 15:29, 15:30, 15:32, 17:01 → accepted 17:33 | **5** | merged 17:36 |

  **Zero of four cleared in one round; the count runs 2 / 2 / 3 / 5.** All four reached `review:accepted` the same day and three are merged, so the split did resolve — but not in one round, and not uniformly: the widest spread is 2 against 5.

  **What the data supports, stated at that strength.** #1569 took two verdicts at 120 then 123 net files with the diff still growing and no path to convergence; after the carve it took two verdicts at 8 then 13 files and merged, and the three carved slices all reached accepted the same day. *Bundle size, not reviewer speed* is a real lever on a PR that is not converging, and it remains the cheapest one this programme has found — no tokens, no new machinery, no model change. It is **not** evidence that a split clears review in one round. Do not cite this entry for that.

  **What bounced the small version is still the sharper finding.** Both post-split findings on #1569 were about tests, not prose: the headline addition (`LENS_HUNT_BRIEF` / `huntBriefForLens`) had zero test coverage, and a new guard test at `we:scripts/lib/__tests__/review-core.test.mjs:707` could not fail under the mutation it claimed to probe. The 16:40 verdict on #1569 records how the first was proved — deleting the two-line wiring from `buildPanelMandate` and re-running the four affected suites (592 tests), all of which stayed green. That figure is quoted from that verdict comment; it was not re-run here. The two pre-split rounds recorded **four** `claim-accuracy` findings between them (one categorised under a `correctness`-lens run at 13:15, three under the `claim-accuracy`-lens run at 14:12) and **no test finding at all**. Prose accuracy is cheap to find and rarely what matters; that asymmetry belongs in every reviewer brief this programme writes.

  > **Retracted — this paragraph first said *"Two rounds of the `claim-accuracy` lens … found nine wrong figures."*** Two figures there are wrong. Only **one** of the two pre-split rounds ran the `claim-accuracy` lens (14:12; the 13:15 round ran `correctness` and merely categorised one finding under `claim-accuracy`). And the recorded finding count across both rounds is **four**, not nine — nine is not a count anything in the verdict record produces.
- **2026-08-26** — filed. Front-B run 1 (the five-track sweep) is the origin, not a review. Goal-set enumerated; 5 of 10 elements buildable now, 4 blocked on named items, 1 unaddressed.
