---
bornAs: xmyj37e
kind: decision
status: open
relatedTo: ["2895", "2844", "3279"]
scope: ["we:scripts/review-set-label.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/operations/review-pr.mjs", "we:scripts/lib/review-independence.mjs", "we:docs/agent/platform-decisions.md"]
dateOpened: "2026-09-07"
tags: [review, gate, drain]
---

# Should clear-human wait for an independent review to actually run before the drain merges — config toggle

**Not yet `preparedDate`-stamped** — this item was authored inline (grounding + forks + recommended
defaults + confidence below) but has not been through the full `/prepare` close-out (`check:health` green,
a per-fork fork-existence line, a `Skeptic:`/`Screen:` line each). Treat the forks below as a strong first
pass, not `✓ ready to ratify`; a `/prepare` pass (or the operator's own read) should confirm or amend before
this is ratified (rule: never take an unprepared decision, #1457).

## What happened

Tonight PR #2011 (`WE #3174`, ratify+codify the git-forge provider seam, touching
`we:docs/agent/platform-decisions.md`) was parked `review:human` by the drain's own escalation rubric
(statute + blast-radius). The operator said **"I approve 2011"**, and the session ran
`we:scripts/review-set-label.mjs --to=clear-human` — the sanctioned #2895 ceremony — which dropped
`review:human`, added `review:accepted`, and the drain landed it. The operator's follow-up — that this
class of PR "should wait for advisory review, in case the mechanic or details have problems" — arrived
seconds after the merge had already happened.

**This was a race, not a one-off human slip, and not "clearance was always meant to skip review."** The
gate already HAS an automatic, unattended independent-review step for exactly this tier —
`we:scripts/operations/review-pr.mjs`'s `advise` step (#3453): an `effect` step that runs unconditionally,
before `confirm`, the moment a `review:human` PR's independent judge panel reduces to a verdict, posting a
`⚠️ Advisory review (informational only)` comment. It is dispatched onto a genuinely independent session by
`we:scripts/operations/review-dispatch.mjs` (#3279, mints a fresh `--session-id`) and the conveyor already
auto-dispatches it for any PR in `needs-review` phase (`we:scripts/conveyor/reconcile-core.mjs`'s
`DISPATCH_KINDS = ['fix', 'review']`). Checking every review:human PR the operator cleared tonight via
`gh pr view --json comments` confirms the pattern directly:

| PR | advisory note posted before `clear-human`? |
| --- | --- |
| #1913 (`Ratify #3001`) | **yes** — advisory note ("0 findings, human review required") precedes the clear-human comment |
| #1920 (`#2412` engine-tier auto-land) | **yes** — advisory note precedes clear-human |
| #1966 (`#3557` parked-PR conflict dispatch) | **yes** — advisory note precedes clear-human |
| #1968 (`#2819` build-brief-discipline detectors) | **yes** — advisory note precedes clear-human |
| **#2011 (`#3174` ratify+codify)** | **no** — only the park-reason comment, then `clear-human`; no advisory note ever posted |

Four of five clearances tonight already had the independent review land first — the conveyor's ordinary
dispatch cadence usually wins the race. #2011 is the one where the operator's own "I approve" beat it.
**Nothing in `decideSetLabel`'s `clear-human` target (`we:scripts/review-set-label.mjs:183-212`), or in
`runReviewLabelCli`'s `clear-human` preconditions (`:530-559`, today only `--actor` + `--reason`), checks
whether that advisory note exists.** The mechanism the operator asked for tonight is not a new idea — it is
already built and already usually wins — it just isn't a *gate*, so it can lose.

### Recommended path at a glance

| | recommended default | main alternative | confidence |
| --- | --- | --- | --- |
| Fork 1 — scope | **(a) every `clear-human` clearance** | (b) narrow further within the `review:human` tier | high |
| Fork 2 — mechanism | **(c) `clear-human` refuses unless an advisory note already posted for the current head** | (a) relabel to `review:pending`, ride the mechanical-accept pipeline | medium-high |
| Fork 3 — config default | **on** | off (preserve today's fast path) | medium |

## Fork 1 — Which operator-cleared PRs must wait?

*Fork-existence justification:* the excluded branch is (b) — a sub-scope inside `review:human` (e.g. "only a
raw statute-anchor touch like #2011, not a declarative-leash file"). It is a real, buildable alternative
(the escalation rubric already computes `statuteFiles` vs `leashFiles` separately per
`#review-human-declarative-leash-only`, #2771), so this is a genuine either/or, not a forced invariant.

**(a) Apply the wait to every `clear-human` ceremony, no sub-scoping — RECOMMENDED.** `review:human` is
*already* the narrow, high-blast-radius tier by ratified design: #2771/#2840 restrict it to exactly three
triggers (a statute-anchor edit, an already-present `@principle`/`@invariant` edit, or the declarative-leash
path floor) and #2840 pins that floor "permanently." Tonight's five clearances *are* that whole population
for the session — there is no larger group to protect against by sub-scoping, and the leash-contract /
gate-config / conformance-suite files that `humanRequired` also catches are at least as sensitive as a
statute-anchor prose edit (arguably more — they are the code that *enforces* every other gate). Cutting the
tier in two would need its own defensible risk ordering within an already-deliberately-narrow set, which
nothing in tonight's incident or in the existing statute motivates.

**(b) Narrow to a `#2011`-shaped subset (e.g. only `statute` touches, not `gate-self`/leash touches) —
Rejected as the default.** Costs a second predicate to compute, test and explain (mirroring but not reusing
`humanRequired`'s own file-class split), for a population `check:health`/the escalation rubric already
holds small and uniformly `review:human`-gated. No incident data from tonight argues gate-self clearances are
safer to rush than statute ones.

**Skeptic (self-conducted):** *does (a) just relabel the existing `review:human` scope as a new gate, buying
nothing?* No — the wait is a genuinely new constraint (today `clear-human` clears with zero coupling to
`advise`); (a) only says the constraint should bind uniformly across the tier it was already scoped to,
which is the narrower, load-bearing part of the fork (whether to bind at all is Fork 2/3, not this one).

## Fork 2 — How does "wait" actually work?

*Fork-existence justification:* the excluded branches genuinely differ in what code exists and what a
caller of `clear-human` experiences — a relabel-and-ride-the-pipeline design (a) leaves `clear-human`
succeeding immediately but not-yet-mergeable, while a precondition-refusal design (c) leaves `clear-human`
itself failing until a prior step ran. These are not the same code shape stripped of cost.

**(a) `clear-human` stops adding `review:accepted`; it relabels `review:human → review:pending` instead**
(drops the human gate — still the ONLY route that may do so — but does not itself grant mergeability). This
rides two already-ratified, already-built mechanisms with zero new review machinery:
`#review-pending-clean-verdict-mechanical-accept` (#2851 — a clean independent verdict clears
`review:pending` mechanically once `landMode` flips to `enforce`) and the conveyor's existing `needs-review`
auto-dispatch (`DISPATCH_KINDS`, above) — the PR is now just an ordinary `review:pending` PR and the
existing pipeline picks it up on its own cadence.
- **Rejected as the default, not as unreasonable.** Two costs: (1) while `landMode` is still `shadow`
  (current state, per `we:docs/agent/platform-decisions.md`'s own text — the flip predicate is not yet
  confirmed armed), nothing auto-accepts `review:pending`, so the operator who just said "I approve" would
  have to clear a *second* label on the *same* PR — confusing, and not what "wait for advisory review"
  asked for. (2) it changes what `clear-human` *means* (a human clearance that isn't a clearance yet) rather
  than adding a precondition to when it may fire — a bigger conceptual shift for a narrower actual gap.

**(c) `clear-human` gets ONE more precondition, alongside the existing `--actor`/`--reason` honesty tax
(`we:scripts/review-set-label.mjs:530-559`): refuse unless the PR already carries the `advise` step's
advisory-note comment for its CURRENT head — RECOMMENDED.** If absent, the refusal names the fix: dispatch
`we:scripts/operations/review-dispatch.mjs --pr=<n>` (or wait — `needs-review` PRs are already
auto-dispatched every conveyor tick) and retry `clear-human` once the note lands. Nothing about `advise`,
`we:scripts/operations/review-dispatch.mjs`, or the conveyor's dispatch decision changes; this is a single
new guard clause, same shape as the existing ones in the same function.
- **Why this over a literal synchronous dispatch-and-block (the "or does clearance dispatch a review... with
  the drain blocked until it completes" reading the task posed):** blocking a CLI call for the multiple
  minutes a real independent `claude --bg` review takes is a bad interactive shape and cuts against the
  standing rule that a session must never sit on a passive/backgrounded wait — better to fail fast with an
  actionable next command than to hang. A background/async variant of "dispatch then wait" collapses to (c)
  anyway once the wait is made non-blocking: check for the marker, refuse with instructions if absent.
- **Real residual, stated rather than hidden:** `renderAdvisoryNote` (`we:scripts/operations/review-pr.mjs:978`)
  posts NO durable per-head marker today — unlike `record`'s `reviewed-sha`/`reviewed-diff` HTML comments,
  there is nothing (c)'s precondition check could grep to confirm the posted note covers the PR's *current*
  head rather than a stale one from an earlier revision. A build under this fork owes `renderAdvisoryNote`
  a `<!-- advisory-sha: … -->` marker (mirroring `buildReviewedShaMarker` in
  `we:scripts/lib/review-escalation.mjs`) before the precondition can be exact; until then a coarse
  "does any advisory comment exist" check is a real but bounded weakening (a PR force-pushed after its
  advisory note would pass the check on stale grounds — narrower than today's total absence of a check).

**Skeptic (self-conducted):** *does (c) just formalize "wait a bit," without the operator's actual complaint
— that findings get seen — being addressed?* The advisory note's findings are already rendered in the
comment before `clear-human` may now fire, so a human (or the clearing session) sees them before deciding,
which is exactly "wait for advisory review… in case the mechanic or details have problems." (c) does not
make the note *binding* — the operator keeps full authority to clear over real findings — because the
incident was about *ordering*, not about *overruling* the operator.

## Fork 3 — Config default

*Fork-existence justification:* on vs. off is a real behavior split for every future `clear-human` call, not
a cost question — off reproduces tonight's race exactly; on removes it, at the cost of an occasional refusal.

**On by default — RECOMMENDED**, name TBD at build time (`WE_REQUIRE_REVIEW_AFTER_OPERATOR_CLEARANCE`
follows the existing `WE_MERGE_BREAK_GLASS`-style convention, `we:scripts/merge-ai-prs.mjs`). Cost when the
advisory note already posted — the common case, 4/5 tonight — is exactly zero: `clear-human` proceeds
unchanged. Cost when it hasn't is one clear, actionable refusal naming the fix, not a silent block. Directly
motivated by a real, dated incident (#2011) rather than a hypothetical.

**Off by default — the alternative.** Preserves today's fast path unconditionally; an operator wanting the
new bar opts in per-session. Real argument for it: `review:human` PRs are exactly the population most likely
to be touched during genuinely time-sensitive incident response, where a new precondition failure is least
welcome. Weighed against: the failure mode is a loud refusal with a next command, not a silent block, and the
toggle is a one-shot env var away regardless of default — so the emergency case is one extra flag, not a
blocked path.

**Skeptic (self-conducted):** *is "on by default" over-reacting to an N=1 incident?* Tonight's population is
small (5 clearances) but the base rate is favorable to "on" specifically because 4/5 *already* satisfy the
precondition for free — "on" is not asking for new work most of the time, only for the ordering that already
usually holds to become guaranteed.

## What this does not settle

- The exact precondition-check implementation and the `advise`-step marker it needs (Fork 2(c)'s residual,
  above) — real build work, not decided here.
- Whether `landMode`'s `shadow → enforce` flip (a separate, already-ratified #2838 gate) should be revisited
  in light of this — out of scope; this decision does not touch that flip.
- The exact env var name and its CLI-flag mirror (if any) — a naming detail for the build, not a fork.

## Context

### Lineage

- `#2895` — the `clear-human` ceremony this decision adds a precondition to (`decideSetLabel`'s `clear-human`
  target, `we:scripts/review-set-label.mjs`).
- `#2844` — the independence/self-clear refusal `clear-human` is exempt from; unaffected by this decision
  (the precondition below is additive, not a change to who may clear).
- `#3279` — `we:scripts/operations/review-dispatch.mjs`, the independent-session mechanism this decision
  reuses rather than duplicating.
- `#3453` — the `advise` step (`we:scripts/operations/review-pr.mjs`) whose comment is the signal Fork
  2(c) checks for.
- `#2771`/`#2840` — the ratified `review:human` trigger set Fork 1 relies on already being narrow.
- `#2851` — `#review-pending-clean-verdict-mechanical-accept`, the pipeline Fork 2(a) (the non-default
  branch) would have ridden.
