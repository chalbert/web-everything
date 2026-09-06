---
bornAs: x2xrboe
kind: decision
status: open
dateOpened: "2026-09-06"
tags: [cost, review, conveyor, dispatch, decision, prompt-caching]
relatedReport: reports/2026-09-06-token-optimisation-research.md
---

# What may economize an agent review — depth only, or also strength?

An agent review can be made cheaper two ways: **look less hard** (fewer rounds, fewer lenses, fewer jurors) or
**use a weaker reviewer** (a smaller model, a lower effort). The first is already ratified and dialled. The
second is not ruled anywhere — and this card exists because a cost analysis nearly recommended it on evidence
that does not apply to this repo.

## Ruled — 2026-09-06, operator

**Fork 1 ratified as (a): depth only.** Care dials `rounds` / `lenses` / `jurorsPerLens`. A care band may not
reach model or effort.

**Amendment raised and accepted at ratification: strength is *operator-settable*, never *care-derived*.**
The ruling forbids automatic strength reduction as an economizing axis; it does **not** freeze strength against
a human who deliberately wants to change it — in either direction. Two things make this the right shape:

- **The knob already exists for `model`, and its safety design is already built.** `--model` is a real control
  flag of the derived command line (#3151), refused twice on a `-`-leading value — once at parse, before a run
  record exists, and again by `assertSafeJudgeRequest`
  ([`we:scripts/operations/cli-adapter.mjs`](../scripts/operations/cli-adapter.mjs) line 381) on the merged
  request, with the override merged **before** the guard runs, never after (line 466). The literals at
  [`we:scripts/operations/review-pr.mjs`](../scripts/operations/review-pr.mjs) lines 427–443 exist to keep a
  run's **INPUT** out of argv — they are a *default*, not a prohibition.
- **`effort` never joined that pattern.** There is no operator `--effort` flag anywhere outside judge-spawn's
  own argv emission, and `we:scripts/operations/cli-adapter.mjs` line 471 merges `model` only. So today nobody
  can dial effort **up** either — `xhigh`/`max` for a gnarly security review is as impossible as dialling down.
  That asymmetry is an oversight, not a ruling.

**The clause, stated so it cannot be read as a back door.** Strength is a configurable dimension whose
**default is `sonnet` / `high`** and whose value is set only by an explicit operator control flag validated
against `EFFORT_LEVELS` ([`we:scripts/lib/judge-spawn.mjs`](../scripts/lib/judge-spawn.mjs) line 330), never
sourced from run input and never derived from a care band. A future change that makes strength a function of
care re-opens this fork and needs its own ruling. This is `#config-extends-platform-default` applied — a
concern with more than one legitimate end-state is a dimension with a safe default, not a baked mechanism.

Build carved: **#3519** — give `effort` the operator control-flag treatment `model` already has.

## How this card got here, recorded because the correction is the point

It was filed as *"effort dial or model cascade"*, framing a choice between economizing inside one model and
routing across models. Prep's skeptic pass **refuted that framing outright**, and every load-bearing finding
verified against the tree. Three premises were wrong:

1. **"`model` and `effort` are already live per-lens knobs."** False on the governed surface. Both are frozen
   module literals — `JUDGE_MODEL = 'sonnet'`, `JUDGE_EFFORT = 'high'` in
   [`we:scripts/operations/review-pr.mjs`](../scripts/operations/review-pr.mjs) lines 446–447 and
   [`we:scripts/operations/review-prep.mjs`](../scripts/operations/review-prep.mjs) lines 114–115.
   `we:scripts/lib/jury-core.mjs` contains **zero** occurrences of `effort`, and
   [`we:scripts/operations/cli-adapter.mjs`](../scripts/operations/cli-adapter.mjs) line 471 overrides `model`
   only. Effort is not a knob anyone turns; it is deliberately pinned *above* the module default.
2. **"The cost argument is about dollars."** This repo's agent spawns are **subscription-funded**, ratified as
   `#agent-runner-cli-backend` — *spawn the `claude` CLI on the user's subscription*. Recorded `costUsd` is
   derived from a rate table, not money billed. The scarce resource is the **usage window**, and the only
   recorded catastrophic dispatch failure here was quota exhaustion (24 lanes lost), not spend.
3. **"Caches are model-scoped, so a cascade forfeits reuse."** True in general, near-empty *here*: the juror
   mandate is carried in `--append-system-prompt` — the earliest invalidating position — and embeds per-PR
   volatile content (lens, changed files, PR title). There is no stable reusable prefix on this path to
   forfeit.

The wider lesson is recorded in the split analysis: reading a producer's signature and inferring the consumer's
behaviour. This is its sixth occurrence in one session.

## Fork 1 — May review *strength* be an economizing axis, or only *depth*?

**Fork-existence justification (forced invariant).** The branches cannot coexist: either a care band is allowed
to reach model/effort, or it is not. And one branch is already **broken** by standing rules — the memory rule
`right-size-the-panel-count-not-model-tier` states *"Count is the lever; tier is not"*, and `#xvkjndx`
(operator, 2026-08-18) **removed** the juror spend ceiling because four unbounded runs found ten defects that a
green suite and `check:standards` both missed. A ruling that dials strength down to save money would reverse a
ruling made on evidence.

- **(a) Depth only — care dials `rounds` / `lenses` / `jurorsPerLens`; strength stays fixed.**
- **(b) Depth and strength — a low-care change also gets a weaker or lower-effort reviewer.**

**Default: (a).** Not on cost, but on merit: a review's failure mode is a **false negative** — a well-formed
shallow verdict that missed a defect — and nothing in the loop detects one. A weaker reviewer therefore trades
a detectable cost for an undetectable quality loss, which is the one trade the review floor exists to refuse.
[`we:scripts/lib/jury-core.mjs`](../scripts/lib/jury-core.mjs) lines 1194–1200 already encode this: care scales
how hard the panel looks *"never the ROUTE … and never a cap on the WORK"*, codified as
`#blast-radius-advisory-care-not-a-gate`.

**Tradeoff of (b), stated on merit only:** it would buy nothing measurable under subscription funding — its
only advantage is spend that is not billed. Its cost is a false-negative rate nobody can observe. (Effort/build
cost is deliberately absent from this comparison per the *not-a-prioritization* rule.)

**Code example — the shape the default preserves:**

```js
// we:scripts/operations/review-pr.mjs — strength is a constant, not a care-derived value
export const JUDGE_MODEL = 'sonnet';
export const JUDGE_EFFORT = 'high';   // deliberately above the module default 'medium'

// we:scripts/lib/jury-core.mjs — care dials depth, and only depth
panelRigorForCareLevel('low') // → { rounds: 1, lenses: PANEL_LENSES, jurorsPerLens: 1 }
// (b) would add `model` / `effort` to that return. (a) rules that it must not.
```

**Skeptic: REFUTED the original framing → fork retained but re-based.** The attack killed the
config-dimension re-classification on verified code, moved the question off dollars onto the usage window, and
flipped the default's *rationale* from cost to false-negative risk. It also found the statute collision below,
which is the finding that would have been unrecoverable after ratification.

**Screen: flagged(prio) on the withdrawn validation-gate shape → dissolved by the re-basing.** The fresh-context
screen correctly judged a "not-yet on cost" verdict to be prioritization in fork costume, since merit was
conceded and only affordability remained (`we:docs/agent/backlog-workflow.md` line 505, the merit-conceded
not-yet rule). Re-basing onto review strength makes the surviving question a merit call about false negatives,
not an affordability one, so no "not-yet" survives.

## Supported by default — not forks

- **Cross-provider routing (#3369) is accepted on merit**, on **capacity, reviewer diversity and
  single-provider de-risking** — never as a cost lever. Under subscription funding a second provider is
  *additional capacity at zero marginal token cost*, which makes its case positive on exactly the axis this
  card removes from the cost argument. #3369's own body already concedes the cheap-tier motive is "partly
  already available WITHIN Claude", so that premise should be struck from it. Ordering is a graduation
  trigger — a second subscription actually held, or a measured usage-window cap — not a decision.
- **Pre-generation model selection for *build* lanes is already shipped and is not in scope** —
  `laneModelFor` in the parallel-execute workflow, governed by `we:agent-memory-src/workflow-lane-model-policy.md`,
  born from the 24-lane quota incident. This ruling scopes to the **review** path only.

## Codification — extend, never mint

`codifiedIn` must be an **extension clause under `#every-pr-gets-a-look-advisory-floor`** (ratified 2026-08-26,
#3313 — *"the economizing axis is depth, never coverage"*), cross-citing
`#blast-radius-advisory-care-not-a-gate` and `#build-lane-self-review-non-zero-floor`. A standalone anchor named
for "how agent work economizes" would duplicate a rule already ratified, which is the one prep error that
cannot be fixed after the call.

## Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

## Done when

Fork 1 is ruled; the ruling is recorded as an extension clause under `#every-pr-gets-a-look-advisory-floor`
rather than a new anchor; #3369's cheap-model-tier motive is struck from its body and replaced by the capacity
and diversity grounds, with a graduation trigger for ordering.
