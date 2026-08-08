---
bornAs: xk8orcl
kind: decision
size: 2
status: resolved
dateOpened: "2026-08-04"
dateStarted: "2026-08-08"
dateResolved: "2026-08-08"
codifiedIn: "docs/agent/platform-decisions.md#converge-editor-gated-by-human-required"
preparedDate: "2026-08-04"
tags: [review, conveyor, converge-loop, orchestrator-mechanization]
relatedTo: ["2639", "2572", "2830", "2418"]
relatedReport: reports/2026-08-04-review-pipeline-unblock-plan.md
scope:
  - we:scripts/workflows/review-parked-prs.mjs
  - we:scripts/lib/jury-core.mjs
---

# Converge loop: editor-enablement default by care band

No design exists for *when* the parked-PR convergence loop may push fixes rather than only report them. **One
fork** below, grounded in the loop's first real run (PR #1018, 2026-08-04), in published evidence on
autonomous-fix quality, and — added at the decision turn — in a **re-read of the loop body that inverts the
original framing**. Two candidates that looked like forks were **dissolved** during prep and are recorded under
*Supported by default* rather than padding the call.

## Ruling (ratified 2026-08-08)

**Fork 1 → (d): the editor is enabled everywhere EXCEPT a `humanRequired` diff.** The prepared default (c) was
withdrawn as unimplementable and its repair (c′) was withdrawn on the operator's challenge; both corrections are
recorded in place below rather than as a bottom-of-file addendum.

- **The switch is `humanRequired`, not the care band.** No editor on a **statute** or **declarative-leash**
  diff; editor everywhere else. That is the smallest set containing the real hazard — a machine editing its own
  constraints — and it is a strict subset of blast-radius.
- **Care is restored to advisory-only.** It dials panel rigor and never decides who reviews. Blast-radius, diff
  size, cross-repo and dismissed-findings therefore stop being routes to the operator, honouring #2563 / #1095
  (diff size never routes to a human, because a human reviews a big diff worse than the panel does).
- **Rider: an editor-enabled band needs ≥ 2 rounds** (push, then a fresh panel judges the push), carried on a
  dedicated editor knob — never by raising the shared `panelRigorForCareLevel` dial that `/jury` and `/review`
  also read.
- **What now reaches the operator, exhaustively — four things.** By the diff: **(1)** a statute edit, **(2)** a
  declarative-leash edit. By the loop failing: **(3)** deadlock (rounds spent, panel still at `changes`),
  **(4)** breakage (the editor could not push, a mandatory correctness/security lens did not run, or the diff
  could not be fetched — a dead reviewer never reads as an accept).
- **Prevention strategies for (3) and (4) are deliberately OUT OF SCOPE** and filed as successors. The operator
  asked whether to fold them in; they are several distinct mechanisms with their own tradeoffs, and folding them
  in would ratify designs that were never prepared or red-teamed. Retry/transient-classification for (4) is a
  build with no coherent alternative branch (a network blip should not spend the operator's attention), so it is
  a story. Deadlock relief for (3) is a genuine fork — progress-gated round extension vs partial escalation of
  only the disputed finding — so it is its own `decision` item.

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

### Second correction, folded at the decision turn — the care band must not be the editor's switch

(c′) was presented, and then withdrawn during the discussion on the operator's challenge. Binding the editor to
the **care band** makes the band decide whether a human sees the PR — and the care level is documented as
advisory only, dialing panel rigor and **never** changing route or land
(`we:scripts/lib/review-escalation.mjs:244`). Two consequences made that fatal:

- **It re-opens the door #1095 closed.** Diff size is deliberately barred from routing to a human: the scored
  rubric caps size at `review:pending`, never `review:human` (#2563), and PR #1095 removed the last
  self-park loophole on the ground that *a human reviews a big diff worse than the panel does*. But under a
  care-band binding, size (weight 2) plus blast-radius (weight 3) reaches `high`, `high` is review-only, and
  review-only is the operator. Size routes to a human again, through the band instead of the label.
- **The exclusion set is far larger than the hazard.** The real conflict of interest is a machine editing *its
  own constraints*. That is the `humanRequired` set — the declarative leash and the statute layer — and it is a
  strict **subset** of blast-radius (`we:scripts/lib/review-escalation.mjs:315` fires the wide ring; only
  `isDeclarativeLeashPath` / `isStatutePath` force a human, per the #2445 two-tier flip and the #2771/#2785
  policy-tier split). Excluding the editor by care band excludes it from a much larger, fuzzier set that diff
  size and file count feed into.

### Recommended path at a glance

| | recommended default | main alternative | confidence |
| --- | --- | --- | --- |
| Fork 1 | **(d) editor enabled everywhere EXCEPT `humanRequired` (statute + declarative leash); care stays advisory and never routes; any editor-enabled band gets a 2-round minimum on a dedicated editor knob** | ~~(c′) editor by care band~~ — withdrawn: it turns the advisory dial into a routing dial | med-high |

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

**What the ruling does with this evidence — stated plainly, because (d) does not exclude the band where the
failure happened.** PR #1018 was `care: elevated`, therefore **not** `humanRequired` (a human-gated diff is
forced to `high`), so under (d) the editor would still have run on it. The ruling accepts that, on three
grounds. **(1) The loop's safety property held.** Round 2 caught the editor's bad repair; nothing defective
landed. What #1018 demonstrates is an **efficiency** failure — 1.08M tokens for a disposition review-only would
have reached — not a correctness one. **(2) One run is not a rate.** The 45.1% figure predicts recurrence but
says nothing about which axis predicts it, and `humanRequired` is the only axis with a stated mechanism (a
machine editing its own constraints) rather than a correlation. **(3) The efficiency failure is attacked
directly, not by disabling the editor.** Deadlock relief and transient-failure retry are filed as successors;
turning the editor off at `elevated` would buy the same disposition #1018 reached while routing every
`elevated` finding to the operator — the cost the system exists to avoid.

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
- ~~**(c′) Editor at `low` only, AND give `low` the 2-round budget.**~~ **Withdrawn at the decision turn.** It
  was the recommended default for most of the discussion; the operator's challenge on diff size refuted it. See
  the second correction above — binding enablement to the care band converts an advisory rigor dial into a
  human-routing dial and re-admits diff size as grounds for reaching a person.
- **(d) Editor enabled everywhere EXCEPT `humanRequired`.** **RULED.** The editor never runs on a diff that
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

**Sub-decision — DISSOLVED.** The threshold question (`low` only vs `low` + `elevated`) presupposed a care-band
binding. Under (d) there is no threshold: the switch is `humanRequired`, not a band edge.

**Skeptic:** `REFUTED → flipped to (c)`. The prep default was **(a)**, argued as *"the panel caught the editor's
mistakes, so the loop worked."* The skeptic refused that framing: the *outcome* on #1018 was the same escalation
review-only would have produced, at 1.08M tokens, plus a mutated branch — and `elevated` is precisely where round
caps are tightest and where the 45.1% figure predicts recurrence rather than a fluke. The default was flipped
before this item was stamped.

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
