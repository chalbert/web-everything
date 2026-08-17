---
bornAs: x7l22sz
kind: decision
parent: "2676"
status: open
dateOpened: "2026-08-15"
preparedDate: "2026-08-16"
relatedReport: reports/2026-08-16-tier-above-feature-rollup-basis.md
tags: [backlog, taxonomy, hierarchy, rollup, decision-prep]
---

# Name the tier above feature (rollup basis: points vs outcome-metrics)

Split off #2690's prep (2026-08-15): #2690 ("generalize the rollup tree to N levels + a program/portfolio
zoom above feature") names this exact fork in its own body as an open question — PROGRAM (rolls up
points) vs INITIATIVE (a time-boxed bet) vs OKR OBJECTIVE (rolls up outcome-metrics, not points). Per the
story-preparation checklist (`we:agent-memory-src/story-preparation-checklist.md` item 4), a real fork
must be named as its own open decision, never buried in a story — mirroring the sibling split already
done for #2689 (configurable hierarchy levels) out of the same feature-tracking-screen design session.

## Why this isn't cosmetic

The choice changes the DATA CONTRACT the rollup renders, not just a label:

- **PROGRAM** — a delivery grouping of features. Rolls up the same unit every lower tier already rolls up:
  **points**. The rollup/velocity/forecast primitives generalize with zero new shape.
- **INITIATIVE** — a time-boxed bet, not a point-rollup container. Would need its own "how much of this bet
  is done" measure, which may or may not be points.
- **OKR OBJECTIVE** — an outcome the features serve. Rolls up **outcome-metrics**, not points — a genuinely
  different aggregation (no natural "sum of points" semantics across features serving one objective), and a
  different honest-forecast story than the velocity-derived one #2718 built for points.

Whichever name wins, the rollup/read-model interface for the tier above feature (what a "program/initiative/
objective" node exposes upward — points total, or a metric, or both) follows from this call. Deciding it
after the tier is coded risks exactly the rework the checklist exists to prevent.

## Prior art — how mature trackers name and roll up the tier above "feature"

No system treats this as a free naming choice; each existing name is coupled to a specific
aggregation mechanism:

| System | Tier above "feature"-equivalent | Rollup basis | Mechanism |
|---|---|---|---|
| **SAFe** (Scaled Agile) | **Program** (the Agile Release Train, delivering a Program Increment of Features) | **Points/velocity** (PI predictability is measured in committed vs delivered story points across the train) | Fixed cadence (8–12wk PI), features assigned to a train, no separate outcome-metric primitive |
| **Jira Advanced Roadmaps** | **Initiative** (above Epic), **Theme** above that | No native rollup basis shipped — teams bolt on either a point sum or a percent-complete field | Initiative is a level in the one issue-type hierarchy |
| **Linear** | **Initiative** (first-class entity above Project) | Percent-complete by underlying issue/project status, not points | Explicit membership, not derived |
| **Microsoft Viva Goals** / **Asana Goals** (OKR tools) | **Objective**, rolling up **Key Results** | **Weighted % contribution** — each child KR/initiative is assigned a weight, contributions sum to 100% of the objective's progress | Explicitly *not* a point sum — a different aggregation primitive, hand-authored per objective |

Two things ground the fork directly:

1. **"Program" already has an established, load-bearing meaning as a points/velocity-rollup
   delivery grouping** (SAFe) — this is real prior art *for* Fork 1(a), not an invented rationale.
2. **OKR tooling never reuses a point-sum for Objective progress** — Viva Goals' own docs describe
   contribution weights that "add up to 100 percent," a mechanism with no relationship to `size`/points
   at all. This confirms the item's existing claim that OKR OBJECTIVE "rolls up outcome-metrics… a
   genuinely different aggregation" is not a guess; it is how every OKR tool actually works.

## Statute-overlap check — "PROGRAM" is not a free word in this repo (#1886 axis)

This is new grounding the prep pass surfaced, and it changes the fork's cost/benefit, not just its
color:

- **`we:docs/agent/backlog-workflow.md#program-definition` already ratifies "program" as a specific,
  unrelated technical term**: a perpetual `ongoing: true` epic that passes the four-part **Program
  Test** (standing goal with no Definition of Done · a conformance front · a currency front · a
  cadence). It is `codifiedIn`-cited from `we:docs/agent/platform-decisions.md:3502-3505` as a load-bearing
  statute anchor, and `check:standards` gates on it (the subtitle/parenthetical title rule for programs).
- **This decision's answer is very likely to become a literal `kind` enum value on the same axis, in the
  same file.** #2691's own ratified rule — `we:docs/agent/backlog-workflow.md:163` — already names the
  extension this decision is filling in: *"Nesting (a `feature → feature` **"initiative"/program** tier)
  is a non-breaking future extension… Program-level containment that the root rule drops is what that
  extension is for."* And #3123's parent context is not a customer-facing Plateau vocabulary insulated
  from WE's own backlog — **Plateau Loop is explicitly built to dogfood WE's own backlog model and
  vocabulary** (`#2505`: *"Web Everything's backlog setup is the reference for the model and
  vocabulary… not code to copy"*), starting with WE's own repo (`#2472`/`#2475` generalize to
  multi-repo later). So the tier #2690 renders is plausibly the WE `kind` axis's own next value, governed
  by the identical `we:docs/agent/backlog-workflow.md` that already has a hard, ratified, differently-scoped
  "Program" definition.
- **If Fork 1(a) (`PROGRAM`) is ratified as the *name*, the ruling must explicitly reconcile the two
  meanings in the same document** — e.g. a `kind: program` grouping-tier value is a **structurally
  different thing** from an epic carrying `ongoing: true` (an *instance* flag on `kind: epic`, not a
  `kind` value), so the two do not collide *mechanically* (different fields, different enum), but they
  **do collide *lexically*** — a reader or agent skimming `we:docs/agent/backlog-workflow.md` hits two independently
  load-bearing definitions of the bare word "program" in one file. `we:docs/agent/backlog-workflow.md:142`
  already uses "program" informally in the epic-description table ("An umbrella spanning multiple items
  (a program/initiative/vision)"), so the collision risk is not hypothetical — the word is already doing
  loose duty once in this exact file.
- **`INITIATIVE` carries no such collision.** Grepping `we:docs/agent/backlog-workflow.md` + `we:docs/agent/platform-decisions.md`
  finds "initiative" used only as an informal gloss (`:142`) and inside #2691's own tentative
  `"initiative"/program` placeholder (`:163`) — never as a defined, ratified, `codifiedIn`-cited term.
  Picking `INITIATIVE` as the enum *name* is lexically clean regardless of which rollup basis it carries.

**This decouples two things the original framing bundled as one 3-way choice: the *rollup basis*
(points vs a bespoke bet-progress measure vs outcome-metrics) and the *label* (which English word names
the tier).** Nothing requires them to travel together — "initiative" as a *label* does not force
"time-boxed bet" as its *rollup basis*; a `kind: initiative` node could be defined to roll up points,
exactly like Fork 1(a)'s PROGRAM semantics, while sidestepping the statute collision entirely. Recording
this as **Fork 1(d)** below since research reshaping the fork set is expected, not a scope violation of
the parent split.

## Fork 1 — rollup basis (and name) for the tier above feature

**Fork-existence justification:** exactly one aggregation basis can be the tier's canonical
rollup — the rollup/velocity/forecast renderer needs one `remaining`/`percent complete`/`trend` shape
per node type to keep "the tree generalizes upward with zero new visual language" (#2690's own claim)
true at the data layer, not just the visual one. A node that tried to expose both a point-sum AND an
independent outcome-metric would need the renderer to branch per tier — exactly the new visual/data
language the parent story is written to avoid. The branches are not composable at the render-contract
level, so this is a real either/or, not a "support both."

- **(a) PROGRAM — points-rollup.** A delivery grouping of features; rolls up the identical unit every
  lower tier already rolls up (`size`/points). Reuses `throughput()`/`rollUp()` in
  `we:scripts/readiness/velocity-metrics.mjs:122-149,235` verbatim — no new aggregation primitive. Matches
  SAFe's Program/ART semantics. **Cost:** collides lexically with the ratified
  `we:docs/agent/backlog-workflow.md#program-definition` "Program" (see statute-overlap check above) if `PROGRAM` is
  also chosen as the `kind` enum name.
- **(b) INITIATIVE — bespoke bet-progress rollup.** A time-boxed bet; needs its own "how much of this bet
  is done" measure, which the item correctly notes may or may not be points — that measure does not exist
  yet and is new scope (a primitive story of its own, the same shape #2718 was for forecast). **Benefit:**
  the label is lexically uncontested (see above).
- **(c) OKR OBJECTIVE — outcome-metrics rollup.** An outcome the features serve; rolls up outcome-metrics
  via a weighted-contribution model (per Viva Goals/Asana Goals prior art — contributions summing to
  100%, no relationship to `size`). Genuinely different aggregation from points, and the honest-forecast
  story (#2718's velocity-derived projection) does not carry over — an OKR-style objective is not
  forecast from throughput, it is tracked from contribution weight.
- **(d) [prep-surfaced] Decouple label from basis — a collision-free NAME carrying PROGRAM's
  points-rollup semantics.** E.g. `kind: initiative`, defined explicitly as "a delivery grouping of
  features, rolls up points" (Fork 1(a)'s aggregation basis, Fork 1(b)'s label). Keeps the zero-new-
  primitive engineering win of (a) while avoiding the `#program-definition` lexical collision. **Cost:**
  breaks the SAFe-alignment argument for the word "program" (real but weaker prior art once the label is
  no longer literal), and re-uses "initiative" in a sense that diverges from every surveyed tracker's own
  usage of that word (all of which pair "Initiative" with a bet/percent-complete measure, not a point
  sum) — so the *label* would be internally coherent but externally surprising to anyone coming from
  Jira/Linear.

**Code shape (what the default reuses verbatim), for (a) or (d):**

```js
// we:scripts/readiness/velocity-metrics.mjs — already ships this; the tier reuses it unmodified
export function throughput(items = [], { windowDays = DEFAULT_WINDOW_DAYS, asOf = null } = {}) {
  // sums Number(it.size) over resolved items in the trailing window
  // → { points, pointsPerWeek, count, itemsPerWeek, … }
}
```
A `PROGRAM`/`INITIATIVE`(d) node's `remaining` is just `sum(child feature points) − throughput-derived
resolved`, the same shape `epic`/`feature` already use — zero new fields, zero new render branch.

Contrast, for (c) OKR OBJECTIVE (no code exists yet — illustrative shape only, per the OKR-tool prior
art):

```js
// would-be new primitive — no analogue exists in the repo today
function objectiveProgress(objective, contributions /* [{ id, weight, percentComplete }] */) {
  // Σ(weight_i × percentComplete_i), weights sum to 1 — NOT a point sum
}
```

**Recommendation (for the eventual ratification, not pre-decided here):** the **points-rollup basis**
((a) or (d)) stays the strongest default, and on a **merit** ground stronger than "it's the cheapest to
build": the Plateau Loop console this tier renders inside is, top to bottom, a **points/velocity-native
system** — every tier below this one (slice, epic, feature) is already measured in `size`/points, and the
whole screen's honest-forecast story (#2718) is *derived from velocity*. A tier that switches units at
the very top is the outlier that would need to justify itself, not the default; (b)/(c) both require a
new, not-yet-built measure before the tier can render honestly (the same "don't invent a contract
against code that doesn't exist" caution #2690's own preparation note already applies to the tier
*below* this one) — reuse-cheapness is a *consequence* of being the semantically-native fit here, not an
independent justification. Between (a) and (d): **default to (a) PROGRAM**, with the SAFe citation used
narrowly — SAFe's Program level (an Agile Release Train) is an organizational/cadence concept, not
merely "sums points," so the citation supports only the narrower claim that **"program" is established
agile vocabulary for a points/velocity-tracked grouping above feature-equivalent work**, not that SAFe's
full ART semantics transfer. The lexical collision with `#program-definition` is real but **bounded**:
it only bites inside **WE's own dogfooded repo/backlog**, where a `kind: program` node and an
`ongoing: true` "Program Test" epic could coexist in the same file and the same natural-language surface
(Plateau Loop's own plain-language request intake, #2676) — a third-party Plateau customer's backlog
would not carry WE's own governance-specific "Program Test" concept unless they separately adopted it.
Within that bounded scope, the fix is a one-time disambiguating clause on `#program-definition` ("this
`kind: program` grouping tier is unrelated to the perpetual-watch `ongoing: true` Program Test above").
If the human weighs the lexical collision (including its natural-language-query surface, not just prose
reading) heavily enough to reject that reconciliation, (d) is the documented fallback that preserves the
entire engineering and merit argument under a collision-free label.

**Classification note (not a fork-flip):** could the tier instead support MULTIPLE simultaneous rollup
bases as a per-instance config (some groupings points, others outcome-metrics), making this a config
dimension rather than a fork? Deferred rather than adopted now — #2690 has no current consumer asking
for mixed bases, and forcing configurability ahead of a proven need repeats the exact anti-pattern
#2690's own preparation note already flags ("preparing interfaces now would be inventing a contract
against code that doesn't exist"). Mirrors #2691's own precedent (flat-now, nesting-as-non-breaking-
future-extension): **pick one canonical basis now; a later per-instance config is a non-breaking
extension to build when a real consumer needs mixed bases**, not a reason to leave V1 unpicked.

**Skeptic:** SURVIVES-WITH-AMENDMENT. A four-axis refutation pass was run against the recommended default
(dispatch to an isolated throwaway sub-agent was attempted twice and failed on a shared
concurrent-subagent-limit error both times — captured here so the gap is visible rather than silently
skipped; the same four-axis attack was instead run directly against the draft before stamping, and its
findings are folded in above, not merely asserted):
- **Classification** — attack: is this actually a config dimension (multiple bases could legitimately
  coexist) rather than a single-pick fork? **SURVIVES-WITH-AMENDMENT** → resolved by the Classification
  note above (pick one now, non-breaking config extension later, mirroring #2691's own precedent).
- **Merit** — attack: is "reuse is cheapest" a false economy that lets the wrong semantics (points, when
  the real use-case might be outcome-tracking) win on cost alone? **SURVIVES-WITH-AMENDMENT** → resolved
  by reframing the default's justification from cost to native-fit: the console is points/velocity-native
  top to bottom, so points-rollup is the semantically correct default, not just the cheap one; this
  reframe is folded into the Recommendation above.
- **Statute-overlap** — attack: is "one-time prose reconciliation" understating a real query/agent-
  confusion risk? **SURVIVES-WITH-AMENDMENT** → resolved by scoping the collision precisely (bounded to
  WE's own dogfooded backlog + its natural-language request surface, not the general product) and keeping
  the reconciliation-clause requirement explicit rather than hand-waved.
- **Citation-scope** — attack: does SAFe's "Program" (an Agile Release Train, an org/cadence concept)
  actually authorize a points-rollup naming claim, or is the citation stretched? **SURVIVES-WITH-
  AMENDMENT** → the SAFe citation is narrowed in the Recommendation above to "program is established
  agile vocabulary for a points-tracked grouping," not "SAFe's full semantics transfer."
No attack found grounds to prefer (b) or (c) as the *default* — both still require inventing a new
aggregation primitive with no present consumer.

**Screen:** clear. Two-confusion pass, applied directly (agent dispatch unavailable, same capacity
constraint as above): (1) this is not an implementation detail invisible across a WE↔FUI-style boundary —
it is a **data-contract / vocabulary** choice that determines what field(s) a future
`kind: program`/`initiative`/`objective` node exposes and what word appears in
`we:docs/agent/backlog-workflow.md`'s statute prose; a consumer (any agent or human reading the ratified rule, or a future #2726 rollup
renderer, or a Plateau end user typing a plain-language query) sees the outcome directly. (2) with all
four branches "free to build and instantly maintained," a real merit difference remains: points-rollup
composes with the shipped velocity/forecast primitives with zero adaptation and matches the console's
existing unit system end-to-end, while outcome-metric rollup is a structurally different,
honestly-incomparable-to-points measure — this is not prioritization in fork costume, it is an actual
data-shape fork.

**Skeptic (fresh-context, 2026-08-16):** Independent four-axis re-run by a throwaway agent with no role
in authoring these forks (per `we:docs/agent/backlog-workflow.md:421` — the original pass above was run
inline by the authoring session because subagent dispatch was saturated; this is the compensating
fresh-context run). **CONFIRMS SURVIVES on all four axes.** Verification, not re-assertion:
- **Classification** — re-ran the composability probe by hand: the fork-existence-justification's "can't
  expose both simultaneously" claim is an **intra-node** forced choice (one number can't be both a
  point-sum and a weighted-contribution at once), which is genuinely forced and distinct from the
  **inter-instance** "could different nodes carry different bases" question the Classification note
  correctly defers (no current consumer, mirrors #2691's flat-now/nested-later precedent). The two were
  not conflated. **Holds.**
- **Merit** — cross-checked against real code rather than trusting the prose: `we:scripts/readiness/velocity-metrics.mjs:122-149,235`
  (`throughput()`/`rollUp()`) does sum `size` over resolved items in a trailing window exactly as
  described; grepped `plateau-app:src/` for any OKR/outcome-metric/objective infrastructure — **none
  exists**, confirming (c) needs a genuinely new primitive; grepped
  `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` and confirmed it already talks in
  "velocity-based projection WINDOW" and "gated points" — the points/velocity-native framing of the
  console is grounded in shipped code, not asserted. **Holds.**
- **Statute-overlap (the axis flagged for special scrutiny)** — traced every citation to source: `#program-definition`
  (`we:docs/agent/backlog-workflow.md:169-190`), its `codifiedIn` anchor (`we:docs/agent/platform-decisions.md:3502-3505`),
  the #2691 nesting-extension citation (`:163`), and the informal epic-table usage (`:142`) all quote and
  cite accurately — **not overstated**. Also grepped every other `we:docs/agent/*.md` file
  (`we:docs/agent/build-ui.md`, `we:docs/agent/exercise-app-workflow.md`, `we:docs/agent/vision-tiers.md`,
  and `we:docs/agent/platform-decisions.md`'s other 12 "program" hits) for a *third* conflicting
  definition the item might have missed — found none; every other use is the same
  ratified program concept (#2606/#314-style) or a plain-English "the program" (= the codebase, `:1591`)
  sense, not a taxonomy collision. **One gap the self-run pass left implicit, non-blocking:** the proposed
  one-time disambiguating clause targets `#program-definition` only. It doesn't also flag that the epic
  row's own parenthetical at `:142` ("An umbrella spanning multiple items (a program/initiative/vision)")
  will read as stale once `kind: program` exists as its own value — an epic could no longer informally
  *be* "a program" once the word is a distinct sibling `kind`. Worth folding into the eventual
  ratification's implementation note alongside the `#program-definition` clause; **not** a reason to
  withhold ratification. **Holds, with this addendum.**
- **Citation-scope** — the SAFe Program/ART citation is correctly narrowed to "established points-tracked
  vocabulary," never stretched to claim full ART semantics transfer. **Holds.**

No attack in this independent pass overturns the recommended default. One structural nitpick, cosmetic
only: **Fork 1(d) is substantively a sub-fork under (a)** — a secondary "how to handle the label
collision" choice, conditional on points-rollup already winning the basis question on merit — rather
than an independent 4th top-level branch; the Recommendation section already walks that two-step logic
correctly in prose, so nothing is hidden from the decider. A future edit could relabel it "Fork 1(a)
sub-fork" per the repo's own fork-labeling convention, but this doesn't affect readiness.

**Screen (fresh-context, 2026-08-16):** Two-confusion pass re-run independently, same throwaway-agent
constraint as above. **(1) Standard-vs-implementation — clear.** This is WE's own backlog `kind`
vocabulary, not a classic WE↔FUI intent/block boundary case, but the underlying test still applies and is
answered correctly: the choice is directly observable — the word that appears in ratified statute prose,
the data shape a future rollup renderer exposes, and the vocabulary Plateau Loop's natural-language intake
dogfoods from WE's own backlog (per #2505) — not a detail hidden behind any implementation boundary.
**(2) Merit-vs-prioritization — clear.** Re-ran the "both branches free and instantly maintained" test:
a genuine merit difference survives — points-rollup and outcome-metrics-rollup produce different numbers
with different honesty properties (a velocity-derived forecast vs. a hand-authored contribution weight),
not merely a different build cost. This is a real data-shape fork, not prioritization in fork's clothing.

**Conclusion: readiness confirmed — the `✓ ready to ratify` stamp stands.** Neither pass overturns the
recommended default (points-rollup basis, defaulting to Fork 1(a) PROGRAM + a one-time disambiguating
clause on `#program-definition`, with Fork 1(d) as the documented collision-free fallback). The two items
noted above (the `:142` epic-row parenthetical, and the Fork 1(d) sub-fork labeling) are non-blocking
polish — implementation footnotes to fold in whenever this item is ratified, or in a later edit, not
grounds to hold the decision.

## Blocks

#2690 cannot be prepared past this fork — its rollup/velocity/forecast interface for the new tier
depends on the answer.

## Correction (2026-08-15)

Both `#2687` mentions above originally cited the standalone WE-side forecast-primitive story, which
`#3125` resolved `status: resolved` (superseded) the same day — reference updated to `#2718` (S1a,
`plateau-app:src/feature-tracker/forecast.ts`), the card that actually delivers the forecast primitive per
`#3125`'s ruling.
