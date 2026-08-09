---
bornAs: xk8orcl
kind: decision
size: 2
status: resolved
dateOpened: "2026-08-04"
dateStarted: "2026-08-08"
dateResolved: "2026-08-08"
codifiedIn: "docs/agent/platform-decisions.md#converge-editor-enabled-at-low-only"
preparedDate: "2026-08-04"
tags: [review, conveyor, converge-loop, orchestrator-mechanization]
relatedTo: ["2639", "2572", "2830", "2418"]
relatedReport: reports/2026-08-04-review-pipeline-unblock-plan.md
scope:
  - we:scripts/workflows/review-parked-prs.mjs
  - we:scripts/lib/jury-core.mjs
  - we:scripts/lib/review-core.mjs
  - we:scripts/review-core-cli.mjs
---

# Converge loop: editor-enablement default by care band

No design exists for *when* the parked-PR convergence loop may push fixes rather than only report them. **One
fork** below, grounded in the loop's first real run (PR #1018, 2026-08-04), in published evidence on
autonomous-fix quality, and — added at the decision turn — in a **re-read of the loop body that inverts the
original framing**. Two candidates that looked like forks were **dissolved** during prep and are recorded under
*Supported by default* rather than padding the call.

## Ruling (ratified 2026-08-08)

**Fork 1 → (c′): the editor is enabled at `low` and NOWHERE ELSE, and `low` is given the 2-round budget it
needs.** Mechanical fixes get repaired and re-judged; anything carrying a blast-radius or trust-chain signal
gets a **report and the operator**, with the author's branch untouched.

- **The switch is the CARE BAND.** The editor may push at `low`. `elevated`, `high`, `none` and any band that
  cannot be resolved are **review-only**. The gate reads the *same resolved band the panel already dialed*
  (`careLevelFromReasons` → the band, then both `panelRigorForCareLevel` and the new `editorPolicyForCareLevel`
  read that one value) — never a second derivation, because a second derivation is a second thing to drift.
- **Rider — enablement and round budget are ONE decision, on a DEDICATED knob.** An editor-enabled band needs
  **≥ 2 rounds**: one to push the fix, one for a fresh panel to judge the push. That minimum is carried on
  `EDITOR_MIN_ROUNDS` / `editorPolicyForCareLevel` in `we:scripts/lib/jury-core.mjs`, **never** by raising
  `panelRigorForCareLevel`'s `low` entry from 1 to 2 — that dial is shared with `/jury`, `/review` and
  `/converge` (`we:scripts/lib/jury-core.mjs` `resolveRoster` reads it), so raising it would silently double the
  round budget of every other consumer to buy a property only this loop needs. The shared dial is unchanged:
  `low` is still 1 panel round everywhere else.
- **The gate FAILS CLOSED.** An absent, malformed or unresolvable care level means review-only, never editor-on.
  This is load-bearing rather than decorative: the escalation-reason list reaches the loop through a fetch agent
  and fails open to `[]`, and the loop's only statute signal is that reason prose. Before this ruling the
  `low`/1-round fallback protected against that **by accident** — the editor was unreachable at `low` anyway.
  Giving `low` two rounds removes the accident, so the protection has to become deliberate. Mutating someone
  else's branch is not reversible from their side.
- **An agent echo may VETO the editor, never GRANT it.** Wherever the band or the budget crosses an agent
  boundary, the loop re-derives it from state it holds itself — the enablement from the escalation reasons, the
  round budget from the 2-round floor — and the gate is re-evaluated on **every** round, so a juror invite
  (#2640) that raises care mid-run turns the editor off for the rest of that PR. (Added at the PR #1106 review;
  it is how the ruling above is enforced across an untrusted boundary, not a change to what it says.)
- **Review-only still REPORTS.** Turning the editor off changes what the loop *does* with the panel's findings,
  never whether it produces them: the findings, the reduced verdict and the operator-facing comment ride out on
  the escalation exactly as they do on a deadlock.
- **Sub-decision — SETTLED: `low` only, not `low` + `elevated`.** Adding `elevated` would re-enable the editor
  at precisely the band where it was observed to fail (PR #1018 below). The one run we have is an argument
  against that band specifically, not a general one.

### Two options were withdrawn, and one withdrawal was itself reversed — recorded in place, honestly

1. **(c) "editor at `low`, review-only above" was withdrawn as unimplementable.** Correct, and the defect is
   real: at `roundCap: 1` the loop forces `escalate` before the editor step, so (c) as written selects the one
   band where the editor cannot run. See the first correction below.
2. **(c′) — (c) plus the 2-round repair — was then withdrawn during the decision turn** on a diff-size
   challenge, and (d) ("editor everywhere except a `humanRequired` diff") was ruled in its place.
3. **The operator reversed that on 2026-08-08 and ratified (c′).** (d) is **not narrower** than the prepared
   default, it is **looser**: `deriveCareLevel` returns `high` whenever `humanRequired`, so `{humanRequired}` is
   a strict subset of `{high}` and (d) leaves the editor ON at `elevated` and at non-`humanRequired` `high` —
   including the exact band of the only observed editor failure. The diff-size objection that carried (d) is
   answered below rather than deleted.

## The axis

The loop ([`we:scripts/workflows/review-parked-prs.mjs`](scripts/workflows/review-parked-prs.mjs)) is one
mechanism with a risk-posture setting, not three architectures. A fresh multi-lens panel judges the diff; on a
`changes` verdict an **editor subagent** rewrites the code and pushes to the PR branch; the panel re-reviews.
The panel's rigor scales — `panelRigorForCareLevel` in
[`we:scripts/lib/jury-core.mjs`](scripts/lib/jury-core.mjs) dials jurors and rounds by band (`none` 0 rounds ·
`low` 1 juror / 1 round · `elevated` 1 / 2 · `high` 2 / 3).

### Correction folded 2026-08-08 — the editor is NOT enabled at every band, and the prepared default turns it OFF

~~The editor's enablement scales with nothing — it runs at every care band, unexamined.~~ **That framing is
false against the live loop, and correcting it inverts the fork.** Enablement is not an independent knob: it is
already governed by the round budget the same care dial sets.

- **The editor is unreachable at `low`.** The loop breaks out on the cap *before* the editor step. A `continue`
  outcome at `round >= roundCap` is forced to `escalate`
  (`we:scripts/workflows/review-parked-prs.mjs:997-1003`), and the editor round is only reached at
  `we:scripts/workflows/review-parked-prs.mjs:1050`. At `low`, `roundCap` is **1** — so round 1 can only ever
  `land` or `escalate`. The editor never runs.
- **So today's real behaviour is "editor at `elevated` and `high` only".** And a PR parked with **no escalation
  reason** short-circuits to `low` / 1 round (`we:scripts/workflows/review-parked-prs.mjs:712`) — meaning the
  editor is currently enabled **precisely and only on the PRs that carry a risk signal**. That is the inversion
  the fork wants to fix, stated accurately.
- **Consequence for the prepared default:** *"editor at `low`, review-only at `elevated`/`high`"* selects the
  one band where the editor cannot run. As written it is **behaviourally identical to (b) review-only
  everywhere** — it does not narrow the editor, it deletes it.
- **The structural rule this exposes.** The editor cannot be enabled at a band with fewer than **2** rounds: one
  to push the fix, one for a fresh panel to judge it. Anything less either never reaches the editor, or lands a
  machine-authored patch no panel re-read — which would break the loop's own stated invariant, *"a `land`
  outcome means the final diff was signed off by a fresh-context panel that did not author it"*
  (`we:scripts/workflows/review-parked-prs.mjs:85`). **Enablement and round budget are one decision, not two.**

### Correction folded 2026-08-08 (PR #1106 review, F5) — "a parked PR always has a reason" is FALSE

The fail-closed clause above was justified, in the statute and in two code docblocks, by the claim that every
parked PR carries an escalation reason — so an empty list could only be a broken read. **That claim is wrong.**
`we:scripts/pr-land.mjs`'s `--park=review:pending` (#2622) applies the review label **at open** and writes no
`## Escalation reason` block at all: the block is appended only on the separate `scoreEscalation` verdict path,
and `buildEscalationReasonBlock([])` returns `''`. A legitimately reason-less `review:pending` PR therefore
exists, and this loop will see it.

**The rule does not change — fail-closed is still right.** `[]` now has two producers the loop cannot tell
apart (a degraded read, and a genuinely reason-less park), and one of them may be a statute diff, so `[]` must
still mean review-only. What changes is the reasoning and the stated consequence:

- The justification is now *"`[]` is ambiguous"*, not *"`[]` is evidence of a broken read"*.
- **Consequence, previously unstated:** a `--park=review:pending` PR opened with no reason block is
  **permanently review-only** under this ruling. Its panel still runs and its findings still reach the operator;
  it is simply never machine-edited, and it escalates to `review:human` after its panel round. Accepted
  deliberately — the alternative reads a broken fetch as a safe diff.

### The diff-size objection — raised at the decision turn, and ANSWERED (not deleted)

(c′) was presented, withdrawn mid-discussion on the operator's challenge, and then re-ratified. The challenge is
recorded here in full because it is a real constraint the implementation has to respect, not a bad argument that
went away.

**The challenge.** Binding the editor to the **care band** makes the band decide whether a human sees the PR —
and the care level is documented as advisory only, dialing panel rigor and **never** changing route or land
(`we:scripts/lib/review-escalation.mjs:244`). Under a band binding, size (`CARE_WEIGHTS.size` 2) plus
blast-radius (3) reaches `high`, `high` is review-only, and review-only means the operator. So **diff size would
route to a human again**, through the band instead of the label — which #2563 barred (the scored rubric caps
size at `review:pending`, never `review:human`) and PR #1095 closed the last loophole on, on the ground that *a
human reviews a big diff worse than the panel does*.

**The answer, in three parts.**

1. **The objection applies just as hard to (d), which is why it cannot be the reason to pick (d).** Under (d) a
   big blast-radius diff still escalates to the operator whenever the loop deadlocks or breaks — and a `high`
   band's 3-round cap with a 15-file editor patch to re-judge is exactly the deadlock generator #1018
   demonstrated. (d) does not remove size from the path to a person; it removes the *honest, legible* place
   where that happens.
2. **Review-only is not the same route as `review:human`-by-label, and the rubric's bar is about the label.**
   What #2563/#1095 barred is size *parking* a PR for a human. Under (c′) a review-only band still gets the full
   AI panel, the full verdict and the full findings; a person is reached only on the paths that already reached
   them — deadlock, breakage, statute, leash. The band decides whether a *machine writes to the branch*, which
   is a different question from who reviews.
3. **The residual is real and is accepted deliberately.** A `high`-band diff whose panel wants changes now
   reaches the operator one round sooner than it would have with an editor attempt in between. That is the cost
   of the ruling, it is bounded by the successors filed below (deadlock relief, transient retry), and the
   operator ratified it with that cost stated.

**And the exclusion-set argument, also answered.** (d)'s case was that `humanRequired` (statute + declarative
leash) is the *narrowest* set containing the hazard, and that is true as far as it goes — but narrowness is only
a virtue if the wider set is empty of hazard, and it is not. `{humanRequired}` is a strict **subset** of
`{high}` (`deriveCareLevel` forces `high` on `humanRequired`), so (d) is strictly **looser** than (c′) — it
leaves the editor running at `elevated` and at non-`humanRequired` `high`. The one failure we have observed sits
inside exactly that difference.

### Recommended path at a glance

| | ruled | main alternative | confidence |
| --- | --- | --- | --- |
| Fork 1 | **(c′) editor at `low` ONLY, review-only at `elevated` and above, fail-closed on an unresolvable band; `low` gets a 2-round budget on a dedicated editor knob** | ~~(d) editor everywhere except `humanRequired`~~ — withdrawn: `{humanRequired} ⊊ {high}`, so it is *looser* than the prepared default and keeps the editor on at the one band where it was observed to fail | med-high |

## Fork 1 — When may the editor push fixes?

*(Titled "at which care bands" in prep. The ruling is that the care band is the wrong axis entirely, so the
question is restated; the options below are unchanged apart from the two withdrawals.)*

*Why this is a fork:* the branches cannot coexist — a given pass either mutates the author's branch or it does
not, and the mutation is not reversible from the author's side. Not a cost question: strip effort entirely and a
machine-authored patch substituting for the author's own fix is still a correctness, trust and accountability
difference.

**The crux, from the only run we have.** PR #1018, `care: elevated` (1 juror/lens, 2 rounds): round 1 requested
changes; the editor pushed a **15-file** fix (`729a9d8b`); round 2 faulted *that repair* three ways — including
introducing a **fail-open** in the very gate the fix had just written; the loop hit its round cap and escalated
**having cleared nothing**. The disposition was therefore *identical to review-only* — escalate to a human —
reached at 16 agents, 1.08M tokens and 56 minutes, and it handed the human a branch **mutated with a
self-inflicted defect the original diff did not contain**.

Published evidence points the same way: **45.1%** of autonomously generated PRs require post-review fixes, and
*"the model that wrote the code is the one that introduced the bugs, which makes it less equipped to find them
than an independent reviewer."*

**What the ruling does with this evidence.** PR #1018 was `care: elevated`. Under the ratified rule the editor
would **not** have run on it: `elevated` is review-only, the panel's three findings would have gone to the
operator on round 1, and the branch would have been handed over clean instead of carrying a self-inflicted
fail-open. That is the whole case for `low`-only, and it is why the sub-decision resolves against adding
`elevated`: the one run we have is evidence about *that band*, and re-admitting it would re-enable the editor
exactly where it misfired.

Two honest qualifications, recorded so the ruling is not read as stronger than it is. **(1) One run is not a
rate.** #1018 is a single observation; the 45.1% figure predicts recurrence but says nothing about which axis
predicts it. **(2) #1018's safety property held** — round 2 caught the bad repair and nothing defective landed,
so it evidences an *efficiency* failure (1.08M tokens for a disposition review-only would have reached) rather
than a correctness one. The ruling treats a demonstrated efficiency failure plus an unmeasured correctness risk
as sufficient to keep a machine off the branch at that band, and attacks the remaining efficiency cost directly
through the successors (deadlock relief, transient-failure retry) rather than by widening the editor.

**The statute/leash hazard is covered, not dropped.** (d)'s core insight — a machine editing its *own
constraints* is the sharpest conflict of interest — survives intact under (c′), because `deriveCareLevel` forces
`humanRequired` to `high`, and `high` is review-only. `{humanRequired} ⊊ {high} ⊆ {review-only}`: every diff (d)
would have excluded is excluded here too, and then some.

- **(a) Leave it as built.** Described in prep as "editor always on"; the correction above shows the built
  behaviour is actually **editor at `elevated` and `high`, never at `low`** — i.e. the editor is enabled *only*
  on PRs that carry a risk signal. Maximum leverage when it converges; on the one observed run it converged
  nothing and degraded the branch. *Rejected as the default* — it is the branch the only evidence we have argues
  against, at the tier where it was tested, and the correction shows it is the exact inversion of the intended
  posture rather than a neutral status quo.
- **(b) Review-only everywhere.** No editor, no pushes. Safe and cheap, but leaves the operator hand-fixing every
  finding, which is the problem the loop exists to solve. **Note:** this is what the *un-corrected* (c) silently
  delivers, so if (c′) is rejected for cost, (b) is the honest way to say so — it should be chosen explicitly,
  never arrived at by picking an unreachable band.
- ~~**(c) Editor ON below a care threshold** — editor at `low`, review-only at `elevated`/`high`.~~ **Withdrawn
  as unimplementable.** `low` carries a 1-round cap, so the loop escalates before the editor step is reached;
  the option selects the one band where the editor cannot run. See the correction above.
- **(c′) Editor at `low` only, AND give `low` the 2-round budget it needs.** **RULED.** The editor may push at
  `low` and nowhere else; `elevated`, `high`, `none` and an unresolvable band are review-only. The 2-round
  budget rides a **dedicated editor knob** (`EDITOR_MIN_ROUNDS` / `editorPolicyForCareLevel`), never the shared
  `panelRigorForCareLevel` dial that `/jury`, `/review` and `/converge` read. It was withdrawn mid-turn on the
  diff-size challenge and re-ratified by the operator on 2026-08-08 once that challenge was answered (above).
  This is the narrowest option that keeps the editor useful on mechanical work while keeping it off the branch
  at every band carrying a risk signal.
- ~~**(d) Editor enabled everywhere EXCEPT `humanRequired`.**~~ **Withdrawn — it is looser than the prepared
  default, not narrower.** `deriveCareLevel` forces `high` on `humanRequired`, so `{humanRequired} ⊊ {high}`:
  (d) leaves the editor ON at `elevated` and at non-`humanRequired` `high`, including the band of the only
  observed editor failure. Its insight is preserved under (c′) (statute/leash lands in `high`, which is
  review-only). Its original statement, kept for the record: the editor never runs on a diff that
  edits the **statute layer** (`isStatutePath`) or the **declarative leash** (`isDeclarativeLeashPath`); it runs
  everywhere else regardless of band. This excludes exactly the hazard — a machine patching its own constraints
  — and nothing more. **Care returns to being purely advisory:** it dials how hard the panel looks and never
  decides who looks, so blast-radius, size, cross-repo and dismissed-findings all stop being paths to the
  operator. **Rider (carried over from (c′)):** the editor is only reachable at a band with ≥ 2 rounds — one to
  push, one for a fresh panel to judge the push — so an editor-enabled band needs a 2-round minimum. Carry that
  on a **dedicated editor knob**, **not** by raising `panelRigorForCareLevel`'s `low` entry from 1 to 2 — that
  dial is shared with `/jury` and `/review` (`we:scripts/lib/jury-core.mjs:1113` `resolveRoster` reads it), so
  raising it would silently double the round budget of every other consumer to buy a property only this loop
  needs.

**Sub-decision — SETTLED: `low` only.** The threshold question (`low` only vs `low` + `elevated`) is live again
under (c′), and it resolves against `elevated`: that is the band where the editor was observed to fail (PR
#1018 — a 15-file repair that the next round faulted three ways, including a fail-open in the gate the fix had
just written). Adding `elevated` would re-enable the editor at precisely the observed failure point.

**Skeptic:** `REFUTED → flipped to (c)`. The prep default was **(a)**, argued as *"the panel caught the editor's
mistakes, so the loop worked."* The skeptic refused that framing: the *outcome* on #1018 was the same escalation
review-only would have produced, at 1.08M tokens, plus a mutated branch — and `elevated` is precisely where round
caps are tightest and where the 45.1% figure predicts recurrence rather than a fluke. The default was flipped
before this item was stamped.

**Standing of that skeptic pass, stated explicitly (raised by the independent technical review of PR #1106).**
Under the withdrawn (d) this block was *stale and adverse* — it argued the editor should be OFF at `elevated`
while (d) left it ON, and (d)'s ground (1) revived the very "the loop worked" framing the skeptic refused. Under
the ratified (c′) the block is **current and concordant**: the editor is off at `elevated`, and the ruling above
explicitly declines to lean on the "safety property held" framing as a reason to keep it on. It is left
unedited — the argument is unchanged, only the option it now supports is.

**Screen:** `clear`. Q1 (standard-vs-impl): no boundary issue — internal delivery tooling, and whether commits
appear on the author's branch is fully observable, not a hidden impl detail. Q2 (merit-vs-prioritization): merit
survives cost-stripping — a machine-authored patch replacing the author's own is a correctness and
accountability difference even at zero cost. The screen also noted the fork is **one mechanism with a setting**,
not three architectures; the framing above was rewritten to say so.

---

## Context

### Supported by default (not decisions)

**Mechanical agents run on a cheap model.** The loop's `fetch` / `discover` / `labels` / `rigor` / `reduce` /
`record` agents each shell ONE command and return a shape the `schema` option then validates. Both the skeptic
and the screen agreed this is **not a fork**: strip cost and a stronger model yields the same validated output,
so no merit difference remains. Applied in PR #1031 as a default, not ratified as policy.

**Bootstrap governance — dissolved on a factual refutation.** This item was drafted with a second fork asking
what governs a change that enables independent review but cannot be reviewed by the mechanism it enables —
concretely PR #1031, which makes the loop launchable. **The premise was false.** `/jury` and `/review` run
through [`we:scripts/lib/jury-core.mjs`](scripts/lib/jury-core.mjs) and
[`we:scripts/review-core-cli.mjs`](scripts/review-core-cli.mjs), which do **not** go through the Workflow
harness — and PR #1031's own audit found only `we:scripts/workflows/review-parked-prs.mjs` affected. A fresh
session can therefore review #1031 today, at ordinary cost, with no circularity. **There is no bootstrap deadlock
to govern.**

The screen dissolved it independently as `flagged(prio)`: strip cost and a full read strictly dominates
alignment-only clearance, so it was a timing squeeze wearing a fork's clothes. **Default:** a bootstrap change
gets a fresh-session review like anything else; alignment-only clearance is a logged exception, never a standing
option.

### Why this is decided now

The loop ran for the first time on 2026-08-04 — it had been unlaunchable since it was written (see the
[unblock plan](reports/2026-08-04-review-pipeline-unblock-plan.md)). That run is the entire empirical basis for
this call, and the editor's enablement is the one behaviour to set before the loop is turned loose on a queue of
parked PRs. Deciding it after a batch run means discovering the answer on other people's branches.

### Lineage

#2639 built the convergence loop · #2830 the scheduled runner (shadow) · #2572 the enforce flip (blocked by
#2864) · #2418 the "decisions stay in the loop" boundary this fork operates inside.
