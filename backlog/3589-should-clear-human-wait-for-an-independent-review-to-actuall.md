---
bornAs: xmyj37e
kind: decision
status: resolved
relatedTo: ["2895", "2844", "3279"]
scope: ["we:scripts/review-set-label.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/operations/review-pr.mjs", "we:scripts/lib/review-independence.mjs", "we:docs/agent/platform-decisions.md"]
dateOpened: "2026-09-07"
dateResolved: "2026-09-14"
codifiedIn: "docs/agent/platform-decisions.md#clear-human-requires-current-head-advisory-review"
preparedDate: "2026-09-14"
tags: [review, gate, drain]
---

# Should clear-human wait for an independent review to actually run before the drain merges — config toggle

## Ruling (2026-09-14)

**Ratified 2026-09-14** — per the operator's explicit in-conversation instruction to ratify this card
("I ratify 3589"), confirming both live forks on the card's own bolded recommended defaults. No alternative
picked, no amendment beyond what each fork's own prepared reasoning — including its self-conducted
`Skeptic:` attack and the fresh-context `Screen:` pass (#2091) already run under this card — already folded
in.

- **Fork 1: (a) — apply the wait to every `clear-human` clearance, no sub-scoping, the bold default.**
  `review:human` is already the narrow, high-blast-radius tier by ratified design (#2771/#2840); there is
  no larger population to protect against by carving out a `#2011`-shaped subset, and nothing in the
  incident or the existing statute motivates cutting an already-deliberately-narrow tier in two.
- **Fork 2: (c) — `clear-human` gets one more precondition, the bold default.** It refuses unless the PR
  already carries the `advise` step's (#3453) advisory-note comment for its CURRENT head. If absent, the
  refusal names the fix — dispatch `we:scripts/operations/review-dispatch.mjs --pr=<n>` (or wait for the
  next conveyor tick), then retry `clear-human`. Nothing about `advise`, `we:scripts/operations/review-dispatch.mjs`,
  or the conveyor's dispatch decision changes: a single new guard clause, the same shape as the existing
  `--actor`/`--reason` checks already in `decideSetLabel`'s `clear-human` target
  (`we:scripts/review-set-label.mjs`).

**Fork 3 (the config default) is not a third ratifiable fork — already correctly dissolved at `/prepare`,
not re-opened here.** The fresh-context Screen pass (#2091) reclassified it as a config dimension (both
`on`/`off` are legitimate end-states once build/maintenance cost is zeroed out), so it carries an
**operational default, not a ratified pick**: **ON** by default, via a
`WE_REQUIRE_REVIEW_AFTER_OPERATOR_CLEARANCE`-style env var (name TBD at build time, following the existing
`WE_MERGE_BREAK_GLASS` convention in `we:scripts/merge-ai-prs.mjs`) — recorded as the item's own "Supported
by default" text, above, unchanged by this ruling.

**Follow-on build filed at ratification, deliberately NOT built in this same PR** — the item's own "What
this does not settle" section explicitly deferred the exact precondition-check implementation and the
`advise`-step per-head marker Fork 2(c) itself flags as a real residual (`renderAdvisoryNote` posts no
durable per-head marker today, so an exact "is this the CURRENT head's note" check needs a
`<!-- advisory-sha: … -->` marker, mirroring `buildReviewedShaMarker` in `we:scripts/lib/review-escalation.mjs`,
before the coarse "does any advisory comment exist" check can be tightened):

- [Gate `clear-human` on a posted advisory review for the current head](/backlog/3692-gate-clear-human-on-a-posted-advisory-review-for-the-current/)
  (parent: this item; filed `3692`, numbered on land) — implements Fork 2(c)'s guard clause in
  `we:scripts/review-set-label.mjs`, the per-head `advisory-sha` marker in
  `we:scripts/operations/review-pr.mjs`'s `renderAdvisoryNote`, and the
  `WE_REQUIRE_REVIEW_AFTER_OPERATOR_CLEARANCE`-style config toggle (Fork 3, default on) that gates it.

Codified in `we:docs/agent/platform-decisions.md#clear-human-requires-current-head-advisory-review`.

---

**Prepared** (#3589 `/prepare` close-out, 2026-09-14) — the inline authoring already carried real forks,
concrete `file:line` grounding, and a self-conducted per-fork `Skeptic:` attack. This pass added the
missing DoR artifacts: a fresh-context two-confusion `Screen:` line under every fork (#2091 — it flagged
the original Fork 3 as prioritization-in-fork-costume, folded below), a concrete code example for Fork
2(c)'s code-level shape, and — since the scope touches `we:docs/agent/platform-decisions.md` (a statute
file), which makes the eventual build `humanRequired` and therefore `careLevel: high` — the pre-registered
review jury charter (#2638). No fork's substance/recommendation changed; Fork 3 was reclassified, not
re-decided (see "Supported by default," below).

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

`clear-human`'s rollout posture (on/off) is **not a third fork** — see "Supported by default," below; the
`/prepare` two-confusion screen reclassified it as a config dimension (both values legitimate operating
states), operational default **on**, medium confidence.

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

**Screen (fresh-context, #2091):** clear. (1) impl-vs-standard — this rules on the width of an internal
`review:human` governance tier already owned end-to-end by this repo's own review machinery, not a
WE↔FUI-crossing contract; no mis-layering. (2) merit-vs-prioritization — with cost zeroed out, (a) and (b)
still differ on a real risk-ordering claim (does gate-self/leash deserve the same protection as a
statute-anchor edit?), not just on which ships first; a genuine merit split survives.

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

*Illustrative shape only — the actual marker/grep design is real build work per the residual above:*

```js
// we:scripts/review-set-label.mjs — inside decideSetLabel's `to === 'clear-human'` branch,
// alongside the existing `!isHuman` guard (:530-559 already has this shape for --actor/--reason):
if (to === 'clear-human') {
  if (!isHuman) { /* existing: nothing to clear */ }
  if (!hasAdvisoryNoteForHead(currentComments, headSha)) {
    return {
      allowed: false,
      addLabel: '',
      removeLabels: [],
      keepsHuman: true,
      reason: 'no advisory note posted for this head yet — dispatch '
        + '`we:scripts/operations/review-dispatch.mjs --pr=<n>` (or wait for the next conveyor tick) '
        + 'and retry clear-human once it lands',
    };
  }
  // ...existing clear-human success path, unchanged
}
```

**Skeptic (self-conducted):** *does (c) just formalize "wait a bit," without the operator's actual complaint
— that findings get seen — being addressed?* The advisory note's findings are already rendered in the
comment before `clear-human` may now fire, so a human (or the clearing session) sees them before deciding,
which is exactly "wait for advisory review… in case the mechanic or details have problems." (c) does not
make the note *binding* — the operator keeps full authority to clear over real findings — because the
incident was about *ordering*, not about *overruling* the operator.

**Screen (fresh-context, #2091):** clear. (1) impl-vs-standard — a guard clause inside this repo's own
label-decision function, no cross-repo contract touched. (2) merit-vs-prioritization — with cost zeroed
out, (a) and (c) still differ on what `clear-human` *means* (a real clearance vs. a relabel that isn't one
yet) and on failure semantics (an ordinary `review:pending` PR reads as "still needs review," a refused
`clear-human` reads as "your clearance was refused, here's why") — a genuine semantic/UX split, not
sequencing.

## Supported by default — clear-human's rollout posture (not a ratified fork)

*Reclassified at `/prepare` (2026-09-14).* The original draft framed the config default (on vs. off) as a
third ratifiable fork. **Screen (fresh-context, #2091): flagged(prio)** — with build/maintenance cost
zeroed out, the write-up's own reasoning ("the toggle is a one-shot env var away regardless of default")
concedes both states are reachable at zero lasting cost; what's left is which risk posture ships *first*,
not a merit difference between two end-states. That mirrors the per-fork classification pass's Q4 test
(`we:docs/agent/backlog-workflow.md` — "both branches legitimate end-states" → a config dimension, not a
ratifiable fork): a real either/or between two operating modes isn't a fork when nothing is actually
excluded, only sequenced. **Citation-scope check (#1932):** the ratified
[config-extends-platform-default](docs/agent/platform-decisions.md#config-extends-platform-default)
anchor states the same general shape but its authoring scope is a WE-*authored* project/platform config
dimension (`webeverything.config.*`, a strategy a standard's consumer picks) — narrower than this case, an
internal drain/review-tooling env var with no author-facing surface at all. It is cited below as
*supporting precedent* for the general principle, not as the *authority* deciding this case; the
reclassification itself rests on the Q4 test alone. Fix applied: dissolved to this "supported by default"
entry; no `## Fork N` heading, no table row, no ratifiable pick.

- **Both values are legitimate, coexisting operating states** of the same `WE_REQUIRE_REVIEW_AFTER_OPERATOR_CLEARANCE`-style
  env var (name TBD at build time, following the existing `WE_MERGE_BREAK_GLASS` convention,
  `we:scripts/merge-ai-prs.mjs`) — a project/session config knob, not a WE-standard type.
- **Operational default: on.** Cost when the advisory note already posted — the common case, 4/5 the night
  of the incident — is exactly zero: `clear-human` proceeds unchanged. Cost when it hasn't is one clear,
  actionable refusal naming the fix (Fork 2(c)'s reason string), not a silent block. Directly motivated by
  the dated #2011 incident rather than a hypothetical, and reversible with one flag by an operator who hits
  it during time-sensitive incident response — so this is a rollout choice, not a standards-layer ruling,
  and can be revisited on real operational data without reopening this decision.

## What this does not settle

- The exact precondition-check implementation and the `advise`-step marker it needs (Fork 2(c)'s residual,
  above) — real build work, not decided here.
- Whether `landMode`'s `shadow → enforce` flip (a separate, already-ratified #2838 gate) should be revisited
  in light of this — out of scope; this decision does not touch that flip.
- The exact env var name and its CLI-flag mirror (if any) — a naming detail for the build, not a fork.

### Review jury (provisional — pre-registered #2638)

Care level: `high` — the scope touches `we:docs/agent/platform-decisions.md` (a statute file), so the
eventual build is `humanRequired` per #2771/#2840, which `deriveCareLevel` (`we:scripts/lib/review-escalation.mjs:397`)
maps straight to `high` regardless of scored signals. This jury binds against the item's predicted scope
and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
| claim-accuracy#2 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

*Predicted touch-set (#2619) for the buildable child this decision authorizes* — the item's own `scope:`:
`we:scripts/review-set-label.mjs` (Fork 2(c)'s guard clause), `we:scripts/operations/review-pr.mjs` (the
`advise`-step per-head marker, Fork 2(c)'s stated residual), `we:scripts/operations/review-dispatch.mjs` /
`we:scripts/lib/review-independence.mjs` (unchanged, cited for grounding only), and
`we:docs/agent/platform-decisions.md` (codifying the ratified rule). That scope seeds the child's `scope:`
at carve-off.

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
