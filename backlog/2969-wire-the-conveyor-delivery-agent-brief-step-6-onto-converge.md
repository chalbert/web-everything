---
bornAs: xmjiqhc
kind: story
size: 2
status: open
dateOpened: "2026-08-06"
tags: []
---

# Wire the conveyor delivery-agent brief step 6 onto /converge

#2971 was resolved on the claim that it gives the conveyor's converge-before-PR step a real bounded loop, but its named consumer was never wired: we:skills-src/conveyor/delivery-agent-brief.md step 6 is unchanged prose (spawn a code-review subagent, address every finding to convergence) with no round cap, no panel reduction and no ledger, and #2970 covers only we:scripts/workflows/review-parked-prs.mjs. /converge therefore ships with ZERO production callers and nothing filed to give it one. Replace step 6's prose loop with a /converge run against the lane clone, keeping the step ADVISORY (it reports a verdict; it never gates opening the PR).

## Why this is filed separately

Found in the PR #1064 human review of the /converge change. `graduatedTo` on #2971 records where the CODE
went, which reads as proof of delivery and masks that the named caller was never connected — so nothing in the
tracker said the loop had no user. This item is that missing edge.

## The gap, concretely

Step 6 of we:skills-src/conveyor/delivery-agent-brief.md today says: spawn one adversarial code-review subagent,
read its returned verdict, "address every finding to CONVERGENCE", re-run after any nontrivial fix "until a pass
comes back clean". Every bound in that sentence is a model's judgment:

- **No round cap.** "Until it comes back clean" has no ceiling, so a non-converging pair can loop until context
  runs out. `/converge` has `panelRigorForCareLevel().rounds`, enforced from the loop's own counter.
- **No panel reduction.** ONE reviewer, one lens, one opinion — versus a multi-lens panel reduced by
  diversity-selection, in which a mandatory lens that fails to run can never read as accept.
- **No ledger.** The verdict lives in a subagent's return value and is gone. `/converge` carries a round history
  and an accumulated dismissal trail.
- **No red-team.** #2707 requires an adversary to try to break an accept before it counts; step 6 has none.

## Definition of done

- Step 6 drives `we:scripts/converge-cli.mjs` against the lane clone instead of describing a hand-run loop.
- The step stays ADVISORY: an `escalate` is reported in the PR body / escalation path, and never blocks PR-open
  (that would gate every drain lane, doc-only lane, and the lane shipping this very change — the reason
  #2971 dropped its `pr-land` refusal).
- The brief's step-6 prose no longer restates any bound the core owns (per #51: the deterministic half belongs in
  the tested core, not in the brief).
- Care band comes from #2954's derivation once that lands; until then step 6 passes an explicit `--care`.

## Design

### The gap is still exactly as filed (re-verified on this tree)

`we:scripts/converge-cli.mjs` has **no production caller**. Its only non-test references anywhere in the repo
are its own skill (`we:skills-src/converge/SKILL.md`) and a handful of backlog items — no `.mjs`, no workflow
harness, no brief. And `we:skills-src/conveyor/delivery-agent-brief.md` step 6 (~L160–181, *"Review your own
diff — spawn an adversarial code-review subagent (converge BEFORE the PR)"*) is unchanged prose: one
subagent, "address every finding to CONVERGENCE", "re-run … until a pass comes back clean". So the item's
premise holds without modification.

### What step 6 becomes

`/converge` is not a one-shot command — it is a driven loop (`init` → `step` per round) documented in
`we:skills-src/converge/SKILL.md`. Step 6 should hand the delivery agent to that skill rather than restate its
mechanics. Four things the rewrite must get right, each of which is already decided elsewhere and must not be
re-litigated in the brief (#51 — the deterministic half belongs in the tested core):

1. **`--lane` is the lane clone root.** The CLI rejects a relative path, a subdirectory, a non-repo, and a
   shared primary checkout (`validateLaneTarget`, `we:scripts/lib/converge-transports.mjs`). The delivery
   agent already acquired a lane-pool clone in step 1 of this same brief, so it has the path — say which
   variable, don't re-explain the rule.
2. **`--care` is passed explicitly** until #2954 lands. `we:skills-src/converge/SKILL.md` states the default
   band (`elevated` — `low` caps the run at one round, so the editor never runs) and that `--jurors` /
   `--round-cap` can only RAISE rigor. The brief names a band; it does not restate the dial.
3. **`--goal`** is one sentence from the item's lead paragraph. Cheap, and the SKILL explains why (#2950).
4. **Jurors are seated through `judgePanel`, never the `Agent` tool** (#3145) — a subagent inherits this
   session's `CLAUDE_CODE_SESSION_ID`, which is the identity `we:scripts/lib/review-independence.mjs` keys
   independence on. This is the one thing a delivery agent is most likely to get wrong by habit, since step 6
   *today* tells it to spawn a subagent. Point at the SKILL's *Seating a juror* section rather than
   paraphrasing it.

### ADVISORY — and the brief has two other places that say "step 6"

Keep the step non-gating: an `escalate` is reported in the PR body / escalation path and never blocks PR-open.
Two cross-references in the same file must be updated with it or they will describe a step that no longer
exists:

- **Step 7** (~L182, the UI visual self-review) opens *"Step 6 proves the diff is correct"* and explicitly
  mirrors step 6's converge-before-PR discipline.
- **Escalation reason 3** (~L408) — *"the step-6 adversarial code review (or the step-7 visual …)"* — is the
  route an `escalate` verdict travels, so it is the seam that keeps the step advisory rather than blocking.

**And two OTHER briefs cite step 6 as their own doctrine source.** Both name it and then restate its
pre-change mechanics verbatim, so the moment step 6 becomes a bounded loop their claim becomes false:

- `we:skills-src/conveyor/fix-agent-brief.md` step 5 (~L93–100) — *"spawn **one adversarial code-review
  subagent** … AWAIT its returned report as the verdict — the same converge-before-handback discipline the
  delivery brief uses (…step 6)"*.
- `we:skills-src/conveyor/fix-agent-ci-brief.md` step 5 (~L107–113) — the same sentence, for the CI heal.

A fix agent reading either would believe its repair review carries `/converge`'s round cap, panel reduction
and ledger when it does not. **Rule which of the two this item does:** (a) point them at `/converge` too
(wider scope, but keeps the claim true), or (b) sever the claim — drop *"the same discipline the delivery
brief uses"* and let each brief own its own, weaker loop explicitly. Either is defensible; leaving both files
untouched is not, because that is the only outcome where a brief states something false.

### Where the proof goes

The change is a markdown edit, but it is **not** unprovable: this repo already pins load-bearing skill prose
from a test. `we:scripts/lib/__tests__/doc-prose.mjs` exports `proseContains` / `normalizeProse` — a
whitespace-normalizing matcher written precisely so a pin does not encode where a sentence happened to wrap —
and `we:scripts/lib/__tests__/jury-core.test.mjs` (~L992–1065) uses it to pin safety controls in
`we:skills-src/drain/SKILL.md`, including a negative assertion that harvests predicate names out of the prose
and compares them against the core's real exports. That is the pattern to copy: pin what step 6 must SAY, and
pin that it does not restate a bound the core owns.

## Done when

1. `npx vitest run jury-core` (or a new sibling suite using the same `proseContains` helper) fails before and
   passes after, asserting on `we:skills-src/conveyor/delivery-agent-brief.md`: step 6 names
   `we:scripts/converge-cli.mjs`, and passes `--lane`, `--care` and `--goal`. Fixture-free — it reads the real brief, so
   it goes red the day someone reverts the step to prose. (Tier 1.)
2. The same suite carries the **negative** assertion, which is the half that enforces #51: step 6's text
   contains no round cap, no juror count, and no "until it comes back clean" style termination rule — every
   bound is the core's. Assert on the absence of a number-bearing bound in the step-6 block, not on an exact
   sentence. (Tier 1.)
3. A repo-wide `grep` for the string `converge-cli` across `.mjs` and `.md` lists at least one caller that is
   **not** a test, **not** a skill definition and **not** a backlog item — i.e. the brief. Today that command returns only the CLI itself, its
   two test files, its own skill, `we:scripts/check-standards-rules.mjs`, and backlog items. (Tier 2.)
4. No file in `we:skills-src/` still claims the delivery brief's step 6 works the way it used to. One
   repo-wide `grep` for the brief's basename (plus a `grep` for the phrase *"the same converge-before-handback
   discipline"*) lists every citing file, and each has been either re-pointed or had the claim severed — the
   two known ones are `we:skills-src/conveyor/fix-agent-brief.md` and
   `we:skills-src/conveyor/fix-agent-ci-brief.md`, plus the in-file step-7 opener and escalation reason 3.
   (Tier 2 — one grep, no judgment about the result set.)
5. Step 6 remains ADVISORY: nothing in it refuses PR-open on an `escalate`. (Tier 3 — read the step-6 block;
   this is the property #2971 dropped its `pr-land` refusal for, and re-adding a gate here would stall every
   drain lane and doc-only lane.)

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion up front) — Re-verified live: we:scripts/converge-cli.mjs has zero non-test/non-skill/non-backlog callers (confirmed by grep across the `.mjs` and `.md` corpus), and we:skills-src/conveyor/delivery-agent-brief.md step 6 (L160-180) is still unchanged one-subagent prose exactly as quoted. we:backlog/2971-*.md L58-61 independently corroborates the same gap in its own 'What this item did NOT deliver — #2969' section.
- **consumer** (NOT addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — we:skills-src/conveyor/fix-agent-brief.md L93-100 and we:skills-src/conveyor/fix-agent-ci-brief.md L107-113 both cite 'the same converge-before-handback discipline the delivery brief uses (the delivery brief, step 6)' and then restate the OLD one-subagent/no-round-cap mechanics verbatim. The card's Definition of Done only checks in-file cross-references (step 7 opener, escalation reason 3) via DoD #4/#3 grep, never searching for other files that cite the delivery brief's step 6 as their own doctrine source — a real second-direction consumer the taxonomy's 'find consumers TWO ways' strategy is meant to catch.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Card's cited `we:scripts/converge-cli.mjs` flags (`--lane`, `--care`, `--goal`) and the `Seating a juror` / `judgePanel` / `CLAUDE_CODE_SESSION_ID` references in `we:skills-src/converge/SKILL.md` match the live source exactly — no seam mismatch found.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The proposed we:scripts/lib/__tests__/jury-core.test.mjs-style pin (positive: names `we:scripts/converge-cli.mjs` plus `--lane`/`--care`/`--goal`; negative: no round-cap/juror-count/until-clean language) is mutation-sound by design — both assertions would currently fail against the live unfixed step-6 prose (which lacks the CLI mention and DOES contain 'until a pass comes back clean'), matching the `proseContains` precedent over `we:skills-src/drain/SKILL.md` the card cites at we:scripts/lib/__tests__/jury-core.test.mjs L995-1070.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — DoD explicitly requires escalation reason 3 (L408 live) to keep naming how an escalate verdict is reported, and the /converge loop's own editor round (per `we:skills-src/converge/SKILL.md`) already drives fixes during rounds — only the terminal escalate stays non-gating, so nothing goes silent.

**Corrections recommended:**

- none — the preparation held up as written.

The card's factual claims (`we:scripts/converge-cli.mjs`'s `--lane`/`--care`/`--goal` interface, the zero-production-caller gap, exact line numbers for step 6/7/escalation reason 3, the `proseContains` pinning precedent in `we:scripts/lib/__tests__/jury-core.test.mjs`, judgePanel/CLAUDE_CODE_SESSION_ID mechanics, and #2971/#2970/#2954/#3145 status) all check out against the live repo, but the design misses two real consumers of the delivery brief's step 6 that will go stale once step 6 changes.

_Recorded through the declared `review-prep` operation._
