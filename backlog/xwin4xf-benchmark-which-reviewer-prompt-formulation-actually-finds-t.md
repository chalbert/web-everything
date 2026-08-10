---
kind: story
size: 8
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: judgePanel (#3050) has landed, so N prompt variants can be run as controlled, budgeted arms instead of hand-driven one-offs"
priority: low
dateOpened: "2026-08-09"
relatedTo: ["2948", "2636", "3029", "3050", "1582", "1584"]
tags: [review, jury, judge, prompt, benchmark, research, capture-only]
---

# Benchmark which reviewer-prompt formulation actually finds the most defects

Research idea captured for later, unprioritised: run a real experiment over reviewer prompt formulations and measure which one finds the most genuine defects, instead of choosing framings by intuition. Two answer keys are available — replaying past PRs at their pre-fix commit against the defects their clearance comments already enumerate, and a seeded-fault battery of the kind PR #1128 already ran, which is the only way to measure what a reviewer MISSES. Parked: the panel apparatus it would vary is not built yet.

## Where this came from

The operator, session 2026-08-09, verbatim:

> "It calls for eventually doing some scientific research experience with different prompts to test what finds the most issues in code, instructions, etc. But for later."

**This card is capture only.** Nothing here is queued, designed, or agreed. "For later" is the operator's own framing and the card is parked accordingly.

## What the idea is

Today every reviewer prompt in this repo is chosen by intuition. Nobody knows whether an adversarial framing, a named-lens panel, a checklist, or a plain read finds more real defects — the four lens mandates in `we:scripts/lib/jury-core.mjs` were written, not measured. The `panelRigorForCareLevel` JSDoc says so in as many words: *"Tuning knobs — loose to start, tighten from data."* No data has ever been taken.

The idea is to take it: hold the diff fixed, vary the reviewer's prompt, and count what each variant actually finds.

## Why it is tractable here — you need an answer key, and two exist

You cannot score a reviewer without knowing what was there to find. That is the recurring gap: we can count what a reviewer **caught** and never what it **let through**. Two sources of a key are available in this repo.

### 1. The historical corpus — real but NOT scoreable as-is

Recent merged PRs carry review outcomes in their comment threads. Sampled 2026-08-09 over the 30 most recent merged PRs in `chalbert/web-everything` (#1104 – #1133):

| | count |
| --- | ---: |
| merged PRs sampled | 30 |
| carrying a `review — …` clearance comment | 19 |
| whose clearance enumerates numbered, severity-tagged defects | 4 (#1124, #1125, #1126, #1128) |
| whose clearance carries findings in prose but no per-finding shape | 8 read by hand (#1107, #1108, #1110, #1114, #1121, #1123 among them) |
| whose clearance is bare metadata with nothing scoreable | #1127, #1131 |

The four rich ones are genuinely scoreable. PR #1126's clearance lists three numbered `Medium` defects plus a separately escalated material finding; #1128's lists two numbered `Medium` defects plus a named prose residual; #1124's lists four, tagged `HIGH` / `MEDIUM` / `LOW/MED`. Each names the defect, its severity and the SHA it was fixed at — an answer key a replay at the pre-fix commit could be scored against.

**But the corpus is not machine-extractable today, and a naive script would mis-score it.** There is no schema: every clearance invents its own headings. Counting numbered-and-bolded list items over the sample gives 6 PRs, not 4 — because #1110's numbered severity-shaped list is *"What I verified as CORRECT"*, the opposite of a finding. So extraction is per-PR reading, not a parser. Worse for durability: the structured jury event log (`.conveyor/jury/`, #2641) is **gitignored and machine-local**, so the PR comment thread is the only surviving record — which is exactly what #3038 (open) proposes to fix. Anyone building this arm should treat corpus construction as most of the work, and should expect roughly a fifth of merged PRs to yield a usable case.

### 2. Seeded faults — the only route to a false-negative number

Break something on purpose, then check the reviewer catches it. The technique is already proven here twice:

- **PR #1128** shipped a mutation battery against `we:scripts/lib/output-mix-paths.json` — 12 mutations, all red, control green over an 89-test suite (`we:scripts/lib/__tests__/output-mix.test.mjs`) — and its independent review extended it to 20 mutations, 19 red.
- **#1421** (resolved) built the same shape for the explorer: a gallery of deliberately-broken and known-good fixtures, asserting each oracle fires on its defect and stays silent on the clean twin.
- **#2878** (open) proposes Stryker over a named trust-chain file set; its mutants would be a ready-made fault generator.

Pointed at reviewers instead of tests, a seeded set gives what observational scoring structurally cannot: a **false-negative rate**, plus a known-clean control that measures false positives.

## Variables worth testing — candidates, not a design

- adversarial framing vs. neutral;
- one reviewer vs. a panel of distinct lenses (`PANEL_LENSES` is correctness + security mandatory, simplicity + standards advisory);
- checklist vs. open read;
- how much context the reviewer is handed;
- whether telling the reviewer the author's reasoning helps or anchors it — note #2170 already ruled this by assertion (*"reviewer gets the diff and nothing else, no author framing in the prompt"*) with no measurement behind it.

Measure **cost per real defect found**, not defect count alone — every arm's spend is already recorded by `judgeSpawn`'s budget flags.

## Machinery to reuse rather than rebuild

| already exists | what it gives this |
| --- | --- |
| #3028 (resolved) → `we:scripts/lib/judge-spawn.mjs` | a juror is one parameterised call; model, effort and budget are flags, so N variants are cheap and controlled |
| #3050 (open, born `xnc8wyd`, filed by PR #1133) | the panel fan-out — the single-vs-panel arm needs it |
| `we:scripts/lib/jury-core.mjs` | `PANEL_LENSES`, `panelRigorForCareLevel`, and diversity-selection aggregation — a set of existing lens formulations to score, and its own invitation to tune from data |
| #2638 (resolved) → `LENS_EXPECTATIONS`, `buildJuryCharter` in `we:scripts/lib/review-core.mjs` | pre-registration already exists **per item** — write the bar down before looking. Lifting the same discipline to the experiment level (pre-register the metric before running the arms) is the standard guard against fitting the measure to the answer |
| #1582 / #1584 (resolved, plateau-app) | the same harness shape, proven on a different subject: a variant-rich held-out set with deliberate false-positive traps, recall / precision / fpRate reported, and an A/B that requires the treatment arm to beat a frozen control |
| #2942 (resolved) → `impactIfUnfixed` | an existing vocabulary for "real defect" vs. cosmetic |
| `we:reports/2026-07-18-human-vs-ai-review-cognitive-science.md` | why aggregation is diversity-selection rather than a vote — prior art on shared model blind spots |

Two open epics would be the direct consumers. #2948 (*cheap review*) asks whether a high care band should buy a second juror per lens or spend the budget on more lenses and better grounding, and today has no evidence attached. #2636 (*jury-based PR review to convergence*) lists jury size, round-trip cap and lens attachment as "knobs to make configurable" — configurable, never tuned.

## The circularity, named rather than solved

The operator's word is "scientific", so the weakness has to be stated plainly: a benchmark **scored by an agent**, on a corpus **assembled by an agent**, from defects **catalogued by an agent** is circular. A prompt could score well by producing findings that resemble what the cataloguing agent already labelled a finding. Pre-registration and the seeded arm narrow it — a seeded fault is ground truth nobody wrote up after the fact — but neither closes it. Human-labelled cases are the only real exit, and they are expensive. Do not present this as solved.

## Why it is parked

Building now would tune against apparatus that does not exist. The panel arm needs #3050; a durable corpus needs #3038; the seeded arm is cheapest after #2878's mutants exist. Running the experiment before those would mean hand-driving each arm and re-doing it once they land.
