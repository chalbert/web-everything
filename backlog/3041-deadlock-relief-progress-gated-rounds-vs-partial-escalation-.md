---
bornAs: xky175w
kind: decision
status: open
blockedBy: ["2908"]
relatedTo: ["3040", "3042", "3043", "2950", "2641", "3077"]
relatedReport: reports/2026-08-13-run-observability-spike.md
dateOpened: "2026-08-08"
preparedDate: "2026-08-16"
tags: [review, conveyor, converge-loop]
---

# Deadlock relief: progress-gated rounds vs partial escalation of the disputed finding

No greenfield design is at stake here — this is internal delivery-tooling policy, grounded entirely in
the shipped mechanism (every claim below is a `file:line` cite into the real tree), the same carve-out
#2908 and #3043 used for adjacent questions on this loop. **Two independent forks, not one either/or** —
the original framing paired them as alternatives, but nothing forces a choice between them: a round-budget
policy (how long the loop keeps trying) and an escalation-granularity policy (what gets handed to a human
when it stops trying) answer different questions and could both ship, one, or neither.

### Correction folded at prep — "elevated gets 2 rounds" describes code that #2908 (ratified the same day
### this item opened) already retired; genuine round-cap deadlock is narrower than the opening text assumes

The opening line — *"The round cap is flat: elevated gets 2 rounds whether the loop is converging or
oscillating"* — describes the PRE-#2908 loop. Tracing the CURRENT loop (`we:scripts/workflows/review-parked-prs.mjs`)
top to bottom: the round-cap backstop (`:1226-1229`, `if (last.outcome === OUTCOME_CONTINUE && round >=
roundCap)`) sits BEFORE the editor gate (`:1299-1303`), and the editor gate — `if
(!editorMayPush(editorEnabled, careLevel))` — forces an escalate-and-`break` on the FIRST `changes` verdict
at any review-only band, **regardless of `round`**, because a review-only band has no editor to advance
the diff between rounds. `elevated`/`high` are review-only under `#converge-editor-enabled-at-low-only`
(#2908) — so an `elevated` PR whose round-1 panel says `changes` escalates at round 1, never reaching
round 2 of its nominal 2-round allocation via ordinary editor-revise-then-rereview. **Genuine "rounds
spent, panel still at `changes`" deadlock — the thing `we:docs/agent/platform-decisions.md:3432` names as
its own category, distinct from "a review-only band whose panel wants changes"** — is reachable only two
ways:

1. **`low`-band editor-revise-then-rereview.** The only band where the editor runs, so the only band where
   an ordinary round 1 → editor push → round 2 re-review cycle happens at all. `low`'s `roundCap` is fixed
   at 2 (`EDITOR_MIN_ROUNDS` floor, `careRigorFor`, `:918-920`) — a round-2 `changes` verdict here is a
   real deadlock: the editor already tried once, the panel is still unsatisfied, and the loop stops.
2. **Juror-invite-driven round consumption (#2640), at ANY band.** An accepted invite increments `round`
   and re-reviews the SAME diff with a grown roster (`:1234-1277`) — no editor step involved — and that
   re-review's outcome is checked against the round-cap backstop on the LOOP'S NEXT PASS, before the
   editor gate. So an `elevated`/`high` PR that accepts an invite can spend its nominal round budget
   entirely on invite-driven re-reviews and hit the backstop that way, even though it never reaches an
   editor.

This narrows both forks below to the traffic that actually exists: mainly `low`-band deadlocks (an
editor's fix still disputed after one revision), plus the rarer invite-driven case at any band. It does
not remove the item's reason to exist — the backstop is real and reachable — but it changes what "tuning
it" or "splitting its hand-off" actually means, and the recommended defaults below are sized to that
narrower, verified surface rather than the wider one the opening line implied.

### Recommended path at a glance

| | recommended default | main alternative | confidence |
| --- | --- | --- | --- |
| Fork 1 — round-budget policy at deadlock | **NOT-YET: report the round-by-round finding trend on every escalation (cheap, ships now, not a fork); hold auto-extending the round cap itself until the ledger can tell convergence from relocation** | (b) silently auto-extend the cap while the outstanding-blocker count is strictly falling | med — the auto-extend mechanism is where the evidence below cuts against the original framing |
| Fork 2 — escalation granularity at deadlock | **NOT-YET: stay at whole-diff escalation until the jury ledger (#2641) has enough deadlock events, tagged with the same finding-identity signal Fork 1 needs, to show disputes are reliably file-localized** | (b) split the diff, land the agreed part, escalate only the disputed finding | med — real machinery, and its one candidate precedent (PR #1018) predates the regime that would produce today's deadlocks |

## Fork 1 — Should the round-cap backstop auto-extend when the panel is visibly converging?

*Fork-existence justification:* at the round-cap backstop, a given round's disposition either forces
escalate at the fixed number or grants one more pass — a round cannot be both capped and extended at once.
Not a cost question: strip implementation effort to zero and the two policies still differ in how many
genuine deadlocks vs. genuine near-misses reach a human.

**The axis, narrowed per the correction above.** The backstop this fork would modify
(`we:scripts/workflows/review-parked-prs.mjs:1226-1229`) fires only on the two reachable-deadlock paths
above — mainly a `low`-band PR whose editor-revised diff is still `changes` at round 2. The shared hard
ceiling already exists and needs no new constant: `NEGOTIATION_ROUND_CAP = 5`
(`we:scripts/lib/jury-core.mjs:545`), "a tuning knob… any caller that needs a DIFFERENT cap should say so
explicitly" — and the operator has already moved it once, from 3 to 5, on 2026-07-13, "raised… operator
call… the operator's aim is fewer hand-offs to a human" (`:538-543`). The auto-extend idea below is the
adaptive, per-PR version of that same stated aim.

**Which count is "progress"? — and why the answer is NOT what the original framing assumed.**
#2950 (`status: active`, already landed in `we:scripts/lib/jury-core.mjs`) routes findings to
`blocker`/`carve-out`/`nit` and makes only `blocker` earn a round (`earnsRound`, `:318-330`);
`deriveVerdict`'s `changes` branch already computes exactly that set (`:461`). A first cut of this fork
proposed extending the round cap whenever THAT count strictly falls round over round. **Independent
research already tested this exact signal, on this exact constant, days after this item opened, and
rejected it** (`we:reports/2026-08-13-run-observability-spike.md`, backlog #3077, `status: resolved`,
dated 2026-08-13):

> "PR **#1164** ran five review rounds and every one found a real bypass. Its per-round finding counts
> were 3 → 1 → 1 → 1. Any count-based or decay-based rule flags that as thrashing. It was the most
> productive review sequence in the repo, and the round cap is 5 *specifically because of it*. PR
> **#1186**, this week, ran four rounds where rounds 1–3 each found *the same defect in a different
> place*. A human reading them says 'same class recurring'. A count rule says exactly what it said about
> #1164. Those two are indistinguishable to every cheap signal available, and they want opposite
> responses. A `stuck` detector was proposed in this repo earlier and refused on this same evidence."
> (`we:reports/2026-08-13-run-observability-spike.md:32-40`)

That report's own ruling for the analogous "is the loop actually converging" question (Q4, over the
conveyor's `judge`-step budget, the same `NEGOTIATION_ROUND_CAP`) is **not** "trust a falling count and
silently extend" — it is **"SUSPEND AND ASK… never stop silently, never continue past the ceiling… the
budget is a checkpoint, not a kill switch"** (`:120-132`). Falling finding-COUNT is not the signal that
would separate a genuinely converging round from a defect relocating: *"the ledger records neither finding
identity nor counts. Making it do so is separate work"* (`:157-158`) — meaning the one signal that would
make an auto-extend trustworthy does not exist in this repo's jury ledger (#2641) today, even though the
ledger already logs per-round `FINDING`/`VERDICT`/`ROUND_ADVANCED` events
(`we:scripts/lib/jury-core.mjs`'s `JURY_EVENT_TYPES`).

- **(a) Leave the cap flat — the reachable status quo.** No change; the backstop at `:1226` is
  unconditional. The escalation notice today reports the LAST round's findings only (`last.findings`), not
  the round-over-round trend, so a human triaging a `low`-band deadlock cannot tell #1164-shaped
  convergence from #1186-shaped relocation without re-reading every round's raw comment.
- **(b) Silently auto-extend while the outstanding-blocker count strictly falls.** **Rejected as the
  default per the evidence above** — the mechanism this fork would add is exactly the class of signal
  #3077 tested twice on live data and found indistinguishable between the two cases that most need
  telling apart, and it recommends against a silent mechanical response to either. Kept here, not deleted,
  because it is the shape the original item text implied and the record should show why it was not
  carried forward as-is.
- **(c) Report the trend, extend nothing — RECOMMENDED, ships now, not gated on a decision.** At the
  backstop, before forcing escalate, compute and carry the round-over-round outstanding-blocker counts
  (already available — no new agent call, no new schema field, reuses `isFindingOutstanding` +
  `earnsRound` over each round's `last.findings`, already retained per round) into the escalation
  notice/comment. Behavior is UNCHANGED — the cap still fires exactly when it does today — only the
  human's triage view gets richer: "3→1" (converging — like #1164, worth a manual re-open) vs. "3→4→3"
  (oscillating — like #1186, a real disagreement) at a glance, instead of forcing them to re-derive it
  from the raw per-round comments. **This is arguably not a genuine fork at all** — no branch is worse
  than today's on any axis, so it is closer to "supported by default" than a ratifiable pick; it is kept
  in this table because it is the concrete, buildable alternative to (b) that the skeptic pass below
  surfaced, and it can ship independent of how (b)/not-yet resolves.
  - **Code shape (illustrative, `we:scripts/workflows/review-parked-prs.mjs`, at the `:1226` backstop):**
    ```js
    // Track the outstanding-blocker count per round (reusing deriveVerdict's own predicate — the SAME
    // definition of "outstanding" the verdict itself uses, never a second one).
    let previousOutstanding = null;
    const trend = [];
    // … after `last = await reducePanelRound(...)`:
    const outstandingCount = normalizeFindings(last.findings)
      .filter((f) => isFindingOutstanding(f) && earnsRound(f)).length;
    trend.push(outstandingCount);
    if (last.outcome === OUTCOME_CONTINUE && round >= roundCap) {
      log(`  ${prTag(item)}: round ${round} reached the round cap (${roundCap}) — forcing escalate ` +
          `(deadlock → review:human). Outstanding-blocker trend: ${trend.join('→')}.`);
      last = {
        ...last, outcome: OUTCOME_ESCALATE, verdict: 'needs-human',
        disposition: { mode: 'human', autoLand: false }, findingTrend: trend, // rides into the notice
      };
    }
    previousOutstanding = outstandingCount;
    ```
- **NOT-YET verdict on (b), the auto-extend.** **Concrete un-gate trigger, same shape as Fork 2's below:**
  re-open (b) once (1) the jury ledger records a finding-CLASS/identity signal — the piece #3077 names as
  "separate work" and does not build — AND (2) a rolling window of **N ≥ 10** `low`-band round-2 `changes`
  verdicts shows the class-signal agreeing with a human's post-hoc "was this converging or relocating"
  read in **≥ 80%** of them (a held-out precision bar for trusting the new signal enough to automate on
  it — deliberately higher than Fork 2's 50%, because (b) would act autonomously on the signal, where
  Fork 2's split is merely a routing choice a human still reviews either way). Below that, (c) ships the
  observability win now with none of (b)'s risk.

**Skeptic:** `REFUTED (b) / RECOMMENDED (c) added` — dedicated subagent dispatch, four-axis attack, citations
independently spot-checked against the live tree (file:line references verified, including
`we:reports/2026-08-13-run-observability-spike.md` and its Q3/Q4 sections). **Merit** was the decisive axis:
the subagent found #3077 as a same-repo, same-constant (`NEGOTIATION_ROUND_CAP`), dated-after-this-item
precedent that directly contradicts (b)'s load-bearing premise ("the SAME predicate the verdict uses" does
not make a COUNT TREND trustworthy — #1164/#1186 are indistinguishable by count alone). The subagent also
caught that the ORIGINAL ordering-guard amendment (extending a lower band's cap only up to the next
stricter band's flat count) silently zeroed the benefit for whichever band it applied to first — moot now
that the correction above narrows the reachable surface to mostly `low`, but the general lesson (an
amendment can hide a side effect the same pass should have caught) is carried into (c)'s much smaller
surface area, which has no such side effect because it changes no control flow. **Classification:**
confirmed as a genuine axis, not a dissolve — #2908's Fork 1 is precedent that "how many rounds a band
gets" is a ratifiable design question, not a self-evident knob. **Statute-overlap:** none found beyond what
is already reconciled — `#converge-editor-enabled-at-low-only` governs the editor gate, not the panel round
count, and explicitly scopes deadlock prevention out of itself; `#fix-review-convergence-independent-root-cause`
(#2851) states escalation happens "ONLY on non-convergence (the round cap is hit)" — (c) does not change
when the cap is hit, only what rides along when it is. **Citation-scope:** #2908's `scope:` frontmatter
(`we:scripts/workflows/review-parked-prs.mjs`, `we:scripts/lib/jury-core.mjs`, `we:scripts/lib/review-core.mjs`,
`we:scripts/review-core-cli.mjs`) covers exactly what (c) would touch; no over-reach.

**Screen:** `clear`. Fresh-context, same two fixed questions. Q1 (standard-vs-impl): no boundary issue —
internal delivery tooling under `scripts/`, nothing observable across the WE↔FUI boundary; a trend note in
an escalation comment is externally observable, not hidden. Q2 (merit-vs-prioritization): imagine (c) free
to build and instantly maintained — merit still differs from doing nothing: a human triaging a deadlock
today re-derives the trend by hand from raw round comments; (c) hands it to them precomputed. That is a
real information difference, not a timing question. (b) also screens clear on Q2 (a real trust/safety
difference between silent-extend and flat-cap survives cost-stripping) — its rejection above is a MERIT
finding, not a classification dissolve.

## Fork 2 — When the loop deadlocks, does escalation carry the whole diff or only the disputed finding?

*Fork-existence justification:* at the moment of forced escalate, the disposition either names the WHOLE
diff as the human's unit of work, or a SPLIT of it — the branches cannot compose within one deadlock event.
Not a cost question: even at zero implementation cost, a human clearing a multi-file diff to fix a defect
confined to one file is a materially larger review than clearing that one file.

**The axis, and a correction to the item's own grounding.** On escalate, the loop sets `disposition =
{ mode: 'human', autoLand: false }` over the WHOLE PR (`we:scripts/workflows/review-parked-prs.mjs:1325-1328`),
and the only landing mechanism (`gh pr merge`, via the drain) merges one PR as one unit — no file- or
hunk-level split exists anywhere in this codebase today. Findings already carry an optional `file`/`line`
anchor (`Finding` typedef, `we:scripts/lib/jury-core.mjs:42-58`), so a blocker finding is OFTEN
file-localized in principle, but nothing today reads that anchor to decide what to land vs. escalate.
**The draft first prepared here cited PR #1018 as "landed cleanly, no deadlock observed" — that is wrong,
and the record should say so plainly.** Per #2908's own account, PR #1018 (`care: elevated`, pre-#2908
regime where the editor still ran at `elevated`) **did** hit the round-cap backstop and escalate: *"the
loop hit its round cap and escalated having cleared nothing"* (`we:backlog/2908-…:186-188`); the
`2026-08-04` unblock-plan snapshot mid-run shows it at `review:changes`, "blocked on: its lane"
(`we:reports/2026-08-04-review-pipeline-unblock-plan.md:28`). So a round-cap deadlock over an
editor-introduced, file-localized defect (a fail-open "in the very gate the fix had just written") IS the
one concrete precedent this repo has — it just occurred under the PRE-#2908 regime and cannot recur in
that exact shape today, because `elevated` no longer runs an editor at all (§ correction above). The
analogous shape reachable TODAY is a `low`-band deadlock, which by construction already went through
exactly one editor revision before deadlocking — the same "editor fixed most of it, one thing is still
disputed" pattern, just narrower in how it can arise.

- **(a) Escalate the whole diff (status quo).** No change. Matches the loop's own stated invariant that a
  `land` means "the FINAL round's fresh-context panel… accepted" the diff it signs off on
  (`:1149-1150`) — nothing is ever landed without a panel looking at exactly what lands. Cost: a
  `low`-band deadlock over one localized defect in an otherwise-agreed diff hands the operator the whole
  diff, most of which nobody disputed.
- **(b) Partial escalation: split at deadlock, land the agreed part, escalate only the disputed
  finding.** Partition the diff by the still-outstanding blocker's `file` anchor(s); the agreed set gets
  ONE MORE focused panel round on the reduced diff (never skipped — the land invariant still has to hold
  on whatever actually lands) before merging; the disputed set opens a small escalation carrying just that
  file and the finding's history. Rejected as the default FOR NOW — see the validation-gate reasoning
  below.
  - **Real machinery this requires:** (1) a reliable finding→file mapping — a cross-cutting finding has no
    clean split and must fall back to whole-diff escalation, so (b) only ever helps the file-localized
    subset of deadlocks; (2) a git-level split — extracting a subset of a branch's changes into a
    mergeable unit while the rest lands separately, which nothing in `we:scripts/pr-land.mjs` or the drain
    does today; (3) a re-review of the reduced "agreed" diff before it lands, to preserve the
    non-author-signoff invariant.
  - **Code shape — deliberately not written**, for the same reason as Fork 1's (b): spending prep budget on
    a snippet for machinery gated NOT-YET is the wrong sequencing; it belongs in the buildable child this
    fork spawns if and when the trigger fires.

**Why this is a validation-gate, not a forced pick today.** No round-cap deadlock has been observed under
the CURRENT regime (post-#2908); the one precedent (PR #1018) predates the editor-gate ruling that
eliminated its exact reachability path. So (b)'s payoff is unmeasured against a real, present cost: real
new machinery, a fallback that only fires for file-localized disputes, and a genuine risk of weakening the
non-author-signoff invariant if the "one more focused round" step is ever skipped under schedule pressure.

**Digest + verdict: NOT-YET.** The jury ledger (#2641) is the deterministic instrument that can answer the
open empirical question without building anything: once `low`-band round-cap deadlocks start accumulating,
a retrospective query over the ledger can show what fraction had their outstanding blocker(s) confined to
a small file subset. **Concrete un-gate trigger — deliberately the SAME prerequisite Fork 1 names:** once
the ledger carries a finding-identity/class signal (#3077's named gap) AND a rolling window shows **N ≥ 5**
`low`-band round-cap-deadlock escalations with **≥ 50%** having every outstanding blocker anchored to ≤
20% of the diff's changed files, re-open this fork. Below that, (a) stands.

**Skeptic:** `SURVIVES-WITH-AMENDMENT` — dedicated subagent dispatch, four-axis attack, citations
independently spot-checked. **Merit:** the "PR #1018 landed cleanly" claim in the first prepared draft was
false against its own cited source (`we:reports/2026-08-04-review-pipeline-unblock-plan.md`) — corrected
above; it does not flip the not-yet verdict (#1018 is still pre-#2908 evidence, not a live-regime
precedent) but the record needed fixing before this could stamp. **Statute-overlap — a real citation the
first pass missed.** `#agent-convergence-independent-validation` (#2398,
`we:docs/agent/platform-decisions.md:2872-2873`) states plainly: *"Non-convergence (round cap) or
`needs-human` escalates to `review:human`, unchanged."* That is a direct, on-point prior statement —
ratified 2026-07-10, three weeks before this item opened — that the round-cap-deadlock path routes to a
WHOLE-PR `review:human` hand-off, stated as a background invariant while ratifying an unrelated auto-fix
scope. It does not foreclose revisiting that path (a statute can be amended by a later ratified decision),
but Fork 2 needed to cite and reconcile it rather than claim no anchor governs this turf. **A second
anchor, `#blast-radius-advisory-care-not-a-gate` (#2563, `:2879-2889`), was also checked and is
DISTINGUISHABLE, not colliding:** its "never a blanket 'escalate the whole PR'… applies to any
AI-review/convergence surface" clause governs the HIGH-BLAST AUTO-LAND backstop — a diff that DOES land,
with a post-hoc, sampling-style point-level audit check — a different modality from Fork 2's case, where
nothing lands until a human clears it and any point-level split would have to be BLOCKING, not
advisory-sampling. #2563 was never meant to reach a blocking-gate scenario, but its infrastructure is
directly relevant: if Fork 2's buildable child is ever built, it should reuse the point-level ruling
console (#2494/#2555) #2563 names, rather than invent a bespoke split surface — #2563 says explicitly that
console "is not a duplicate." **Amendment, folded above:** cite and reconcile both anchors; carry the
#2494/#2555 console pointer into the eventual buildable child's scope note. **Classification:** correctly
a validation gate, not a forced either/or — the "not exclusive" framing in the original item text is the
tell. **Citation-scope:** no over-reach — the item does not lean on #2908's scope to authorize new
machinery and explicitly declines to prescribe the unbuilt shape.

**Screen:** `clear`. Fresh-context, same two fixed questions. Q1: no boundary issue, internal tooling
only. Q2: imagine (b) free to build and instantly maintained — a merit difference survives (a smaller,
more precise human hand-off is a real quality difference in what a person reviews), so this is a genuine
validation gate on whether the payoff is real yet, not a timing question dressed as one.

### Review jury (provisional — pre-registered #2638)

_Care band: **elevated** (system-machinery — the buildable child(ren), if either fork's trigger ever
fires, touch shared convergence-loop plumbing, `we:scripts/workflows/review-parked-prs.mjs` and
`we:scripts/lib/jury-core.mjs`; not `high` — neither fork edits the statute layer or a declarative leash).
Predicted touch-set for Fork 1(c)'s buildable child (the only piece that ships without waiting on a
trigger): `we:scripts/workflows/review-parked-prs.mjs` (trend tracking at the `:1226` backstop),
`we:scripts/lib/__tests__/review-parked-prs`-adjacent test coverage if one exists, or a new focused test.
Fork 1(b) and Fork 2 spawn no child yet (both not-yet)._

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

- **correctness (mandatory):** does the trend note (Fork 1(c)) change ANY control-flow decision, or is it
  strictly additive to the escalation notice as scoped — a regression here would silently reintroduce (b)'s
  rejected risk under a different name?
- **standards-conformance (mandatory):** does the eventual buildable child (whichever fork, whenever
  triggered) reuse `NEGOTIATION_ROUND_CAP` / `isFindingOutstanding` / `earnsRound` rather than inventing
  parallel definitions (#51 hookable-vs-judgment; single source of the shared predicates)?
- **simplicity:** does Fork 1(c) stay loop-local bookkeeping (no new agent call, no new schema field) as
  scoped here?

## Context

### Supported by default (not decisions)

**Fork 1(c) — reporting the round-over-round finding trend on every escalation.** Both the skeptic and the
screen agreed this is closer to an obvious, no-downside observability win than a ratifiable fork: no
branch is worse than today's on any axis once (b)'s risk is set aside, so it can ship on its own schedule,
independent of how the two NOT-YET verdicts above eventually resolve.

**#2950's disposition routing (blocker/carve-out/nit) is reused, not re-litigated.** Both forks build on
#2950's existing "which findings earn a round" split rather than proposing a competing one — #2950 is
`status: active` (already landed in `we:scripts/lib/jury-core.mjs`, rollout in progress) and neither fork
depends on it finishing; `earnsRound` fails closed to `true` for any undeclared/legacy finding shape
(`we:scripts/lib/jury-core.mjs:330`), so both forks degrade gracefully if #2950 is ever reverted.

### Why this is decided now

`#converge-editor-enabled-at-low-only` (#2908) explicitly named deadlock as a reachable-to-the-operator
path and filed its prevention separately: *"Prevention strategies for the last two [deadlock, breakage]
are out of scope of this rule and filed separately"* (`we:docs/agent/platform-decisions.md:3432`). This
item, opened the same day, is that filing. #3040 (breakage/transient-retry, its sibling filing) and #3042
(the #2908 editor-gate implementation, resolved in PR #1106) round out the trio #2908 spun off.

### Lineage

`blockedBy: 2908` — resolved 2026-08-08, codified `#converge-editor-enabled-at-low-only`
(`we:docs/agent/platform-decisions.md:3430`); the stale `blockedBy` edge is left in place (matches sibling
#3043's precedent) since `blockedBy` gates tier only for buildable (non-`decision`) kinds
(`we:scripts/readiness/engine.mjs`'s `isBuildable`) and this item is `kind: decision`. Composes with —
does not alter — `#agent-convergence-independent-validation` (#2398,
`we:docs/agent/platform-decisions.md:2849`, its "Non-convergence… escalates to `review:human`, unchanged"
line cited and reconciled under Fork 2) and `#blast-radius-advisory-care-not-a-gate` (#2563, `:2879`,
distinguished from Fork 2's blocking-gate case under Fork 2). `relatedTo`: #3040 (breakage/transient-retry,
same #2908 filing), #3042 (the #2908 editor-gate build, resolved), #2950 (finding disposition, `status:
active`, the shared predicate Fork 1 reuses), #2641 (jury ledger, the instrument both forks' triggers
read), #3077 (run-observability spike, `status: resolved` 2026-08-13, the direct evidence against Fork
1(b) and the source of both forks' shared un-gate trigger — a finding-identity/class signal neither this
repo's ledger nor this item builds).
