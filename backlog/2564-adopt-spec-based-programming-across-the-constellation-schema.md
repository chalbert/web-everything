---
bornAs: x0n1nax
kind: decision
status: open
dateOpened: "2026-07-18"
preparedDate: "2026-07-18"
relatedReport: reports/2026-07-18-spec-based-programming-deep-research.md
tags: [spec-driven, standards, review, architecture, strategy]
---

# Adopt spec-based programming across the constellation — schema/contract specs, human-gates-spec / agent-implements

Strategic direction: move the constellation toward spec-based (spec-driven) programming, Kiro / GitHub
Spec-Kit style, where the **spec is a human-owned artifact** and the **implementation under it is
agent-clearable** when a conformance suite stays green and an independent review agrees the spec is
preserved. #2563 Fork 1 (a human gates a change to the review-policy *spec*, not the whole trust-chain path)
is the **first concrete instance**; this item is the general direction it previews.

## Grounding digest

The constellation is *already* a spec-vs-impl split, and the machinery to run it as one is *already on disk*.
WE holds the standard — intents and protocols as JSON (`we:src/_data/intents/action.json`,
`we:src/_data/protocols/transport-negotiation.json`), platform decisions as prose
(`we:docs/agent/platform-decisions.md`); FUI/plateau hold the implementation. And
`we:scripts/check-standards.mjs:6-8` **already calls `src/_data/*.json` "the spec"** and its stated job is to
"keep the spec … and the implementation in sync — so agents … can't silently let documentation drift from
code." So the intent/protocol JSON is *already* a machine-diffable contract (a `git diff` on
`we:src/_data/intents/action.json`'s `dimensions.level.values` **is** "did the spec change?"), and
[`#surface-contract-not-computation`](../docs/agent/platform-decisions.md#surface-contract-not-computation)
(`we:docs/agent/platform-decisions.md:1058`) already rules that a WE standard pins **the observable contract,
never the computation** — spec-based programming is that principle carried onto the review gate and the
authoring discipline, not a foreign model.

Deep research landed 2026-07-18 (adversarially verified: 22 sources → 25 claims → 22 confirmed, 3 refuted;
104 agents; full report `we:reports/2026-07-18-spec-based-programming-deep-research.md`, published survey
`/research/spec-based-programming-constellation/`). Verdict: the direction is **validated with named prior
art**, but the space is **< 18 months old** and mostly "spec-first" maturity — adopting it means
**assembling** the discipline (schema spec + contract tests + CI gate + authority tiers), not buying one tool.
Load-bearing findings, in one line each:

- **Prose specs (Spec-Kit / Kiro / Tessl) are not machine-diffable; schema-as-spec is.** TypeSpec →
  OpenAPI / JSON Schema / Protobuf gives a mechanical "did the contract change?" — confirming the
  schema-not-prose ruling. LLMs author *formal* specs badly (TLA+: 8.6% semantic across 2,730 runs),
  reinforcing human-authors-spec / agent-implements.
- **Specmatic's central-contract-repository ≈ the constellation, one-to-one.** Contracts live in ONE repo
  (WE); downstream repos **reference and never own** them (FUI/plateau); cross-boundary changes gate on a
  human PR + backward-compat check, plus a conformance suite in the consumer repos.
- **The "Spec Growth Engine" preprint (arXiv 2606.27045) already unifies #2563 + #2564** — it splits merge
  authority **by blast radius** (boundary/contract → HARD human; internal refactor → AUTO) and makes drift a
  **blocking merge condition** via a deterministic **Intent-Graph**-vs-Evidence-Graph diff (a graph, not
  per-file islands). *Blueprint only — single-author, unimplemented preprint.*
- **Two hard limits to design around.** (1) A green conformance suite proves *code matches spec*, never
  *spec is right* — so a human on every spec change + an independent review agent are non-negotiable. (2)
  The Productivity-Reliability Paradox (METR RCT: 19% slowdown for experienced devs on mature codebases):
  raw agent throughput inflates review cost without improving delivery — the case for the contract gate +
  keep-changes-small over a better generator.

## Layered governance — constitution → spec/law → implementation (ratified in discussion 2026-07-18)

The model is a **three-tier amendability hierarchy**, borrowed from jurisprudence — each tier derived from
the one above, each with its own gate:

- **Constitution** — the core principles that must *never* be breached (the non-author invariant; WE holds
  zero implementation; segregation of duties over the review leash). It is **not directly applicable to a
  diff** — too abstract to check code against; it is the *source* from which laws are derived. Amending it is
  the highest-stakes act: a **constitutional-amendment gate** — rare, deliberate, the strongest human
  ratification (**Fork 5**).
- **Spec = law / statute** — machine-checkable contracts **derived from** the constitution and **directly
  applicable** to code (the schema + conformance layer of Forks 1–2). A spec change is human-gated (#2563
  Fork 1) and carries a second obligation: at authoring/amendment time it is checked for **constitutional
  consistency** — *that* is where the constitution is applied, not at code review (**human-decided, never
  machine-decided** — the ruling below; a machine may only advise).
- **Implementation** — derived from a fixed spec; agent-clearable on conformance-green + independent
  (AI-panel) review (Fork 3 measures that panel's reliability).

**The load-bearing rule: the constitution is never applied to a case directly.** You never gate a diff against
the constitution — only against the derived spec/law. Constitutional consistency is verified when a *law/spec*
is written or amended, never when code is reviewed (a court applies the statute; it tests the statute against
the constitution only when the statute itself is challenged). Maps onto what we already have:
`we:docs/agent/platform-decisions.md` is the statute/law layer (the *Platform Decisions = Statute Layer* rule,
#911), the FOUNDATIONAL core invariants are a proto-constitution; GitHub Spec Kit's
`constitution` file and Anthropic's Constitutional AI are precedents for a named principle layer. The two
Open items this framing raised — the amendment ceremony and whether constitutional-consistency is
machine-assisted — are worked below: the ceremony is **Fork 5**; the consistency check **dissolved** (screen
+ skeptic agreed it is not a real fork) into a ruling + a support-both build.

## The axis

Two things are **already ratified** and are not forks: the spec is a **SCHEMA / executable contract, not
prose**, and the model is **human-gates-spec / agent-implements** (below, *Fixed invariants*) — now nested in
the three-tier hierarchy above. Much of the rest is **already statute** — the mechanical spec-vs-impl line,
the human sample, and staged autonomy were settled by #2563 and
[`#agent-convergence-independent-validation`](../docs/agent/platform-decisions.md#agent-convergence-independent-validation).
So this item's genuinely-*new* content is thin and precise, and each fork below carries it, pinned to a real
artifact and **citing** the existing statute rather than re-declaring it:

1. **Which WE-owned artifact plays Specmatic's central contract** — the existing definitions
   (`we:src/_data/intents/*.json`, `we:src/_data/protocols/*.json`) *become* the spec, or a new schema
   formalism is authored above them; and precisely *which* conformance work WE holds vs hands to Plateau/FUI.
2. **At what granularity the contract is drawn** — per-standard-entity vs one boundary aggregate; the "spec
   change → human" *line* is the path/artifact test #2563 Fork 1 already settled
   (`isGateSelfPath`, `we:scripts/lib/review-escalation.mjs:206-210`; carve-out at `deriveReviewDisposition`,
   `we:scripts/lib/review-core.mjs:455-457`) — cited, not re-ruled.
3. **How to obtain an actual false-clear *rate*** for the auto-clear path — the permanent human sample is
   already #2563's settled backstop; a sparse random sample is a tripwire, not an instrument, so the live
   call is the measurement *design*.
4. **How the standard governs the *non-executable* slice** — the prose fields of a contract artifact
   (`summary`/`description` in every intent JSON; the prose rules in `we:docs/agent/platform-decisions.md`)
   that no mechanical diff can prove drift-free.
5. **The constitutional-amendment gate** — how a change to the constitution tier is entrenched so it is
   strictly harder than amending a law (else the tier gives no extra protection).

*(A sixth candidate — whether constitutional-consistency checking is wholly human or machine-assisted —
**dissolved**: it is a ruling (human-decided, never machine-decided) plus a support-both build, not a fork.
See below.)*

## Recommended path at a glance

| # | Fork | Options | Default |
|---|------|---------|---------|
| 1 | Which WE artifact IS the central contract | (a) existing intent/protocol JSON *become* the spec (WE holds meta-schema + static conformance; behavioral suite → Plateau/FUI) · (b) author a TypeSpec→JSON-Schema layer above | **(a) definitions become the spec** — one source of truth |
| 2 | Contract granularity | (a) per-standard-entity, blast-radius = transitive closure over the cross-ref graph · (b) one per-boundary aggregate | **(a) per-entity** — finer independent-review units; spec-line cited to #2563 |
| 3 | Getting a real false-clear rate | (a) stratified sample across blast levels + periodic seeded-defect audit · (b) treat the #2563 backstop sample as sufficient measurement | **(a) purpose-built instrument** — the random sample is underpowered |
| 4 | Governing the non-executable slice | (a) allow prose behind a fail-safe human gate, **ratcheted** (executable-by-default, prose-only-with-warrant) · (b) require every invariant executable | **(a) ratcheted prose** — can't force faithful formalization |
| 5 | The constitutional-amendment gate | (a) **substantive entrenchment** (#911-irreversible + cooling-in-days + committed external artifact) · (b) headcount quorum (≥2 humans, on polity growth) · (c) same as a spec change | **(a) entrenchment now, (b) on growth** — ceremony alone isn't a tier boundary |
| — | Constitutional-consistency check on a new spec | *dissolved (screen: prio · skeptic: settled)* → **ruling:** human-decided, never machine-decided · **+ support-both build:** an advisory per-principle critique | *not a fork* |

## Fixed invariants (the ratified core — never a config knob)

- **The spec is a SCHEMA / executable CONTRACT, not prose.** Only contract-as-spec (JSON Schema / TypeSpec /
  Gherkin / property tests) makes *"did the spec change?"* a **deterministic** yes/no and *"did the impl
  preserve the spec?"* a machine-run conformance check. Prose specs (Kiro, Spec-Kit, Tessl) are validated by a
  human eyeballing a text-diff — no tool auto-detects semantic drift — which is exactly the non-deterministic
  part we must not inherit. (Ratified 2026-07-18.)
- **Constitutional-consistency is human-*decided*, never machine-decided.** The "does this new/amended law
  honour the constitution?" check at spec-authoring time is the *is-the-spec-right?* question a green suite
  cannot answer and a correlated AI panel cannot certify — so the ruling is always a human act. A machine may
  *assist* it (an advisory per-principle critique, below), never decide it. (This is the dissolved former
  "Fork 6," now a ruling.)
- **The model is human-gates-spec / agent-implements.** A change to the spec always needs a human; an
  implementation change under a fixed spec is agent-clearable on conformance-green + independent review.
  (Ratified 2026-07-18.)
- **A green conformance suite governs "code matches spec," never "spec is right."** So the human-on-every-
  spec-change gate and an independent review agent are non-negotiable — the suite cannot substitute for
  either (research finding 4).
- **One shared core.** The spec artifact, the mechanical spec-line, and the review gate read the *same*
  contract definitions and disposition functions (`we:scripts/lib/review-core.mjs`); the behavioral
  conformance runner (Plateau) consumes that *same* contract — no divergent second implementation.

## Fork 1 — Which WE-owned artifact plays the central contract

*Fork-existence: two branches that genuinely cannot coexist as **the** single source of truth — either the
existing definitions ARE the contract, or a schema formalism authored **above** them is; running both means
two artifacts describe the same contract and drift (the exact hazard `check-standards` exists to prevent).*

Specmatic gives its central OpenAPI file the role of "the contract." WE's question is which artifact holds
that role. The definitions in `we:src/_data/intents/*.json` and `we:src/_data/protocols/*.json` are **already**
that artifact — structured, machine-diffable, and already validated by `check-standards`.

- **(a) The existing intent/protocol definitions *become* the machine-diffable spec.** **Chosen.** Formalize
  the contract `check-standards` already implicitly enforces into an *explicit* **meta-schema** over
  `we:src/_data/*.json` — "each definition conforms to its kind's schema." **Placement is precise, per
  [`#intent-conformance-is-block-compliance`](../docs/agent/platform-decisions.md#intent-conformance-is-block-compliance)
  (`we:docs/agent/platform-decisions.md:532-537`):** WE holds the *contract* + **static** contract-conformance
  (build-time — does a block declare the required dimensions/traits); the **behavioral** conformance suite is
  **not WE's** — its runner lives at **Plateau** (neutral, any implementer consumes it) with **FUI** as
  subject. Folding a behavioral suite into WE would violate that anchor and *MEMORY rule 6* (WE holds zero
  implementation). One source of truth; no new authoring surface.
- **(b) Author a new TypeSpec → JSON Schema layer *above* the definitions.** Rejected — it stands up a
  *second* description of the same contract. TypeSpec's value (per the research) is emitting JSON Schema
  from one source; but WE **already has** the JSON, so a TypeSpec layer becomes a parallel source that must
  be kept in sync with the JSON `check-standards` validates — reintroducing the drift the whole discipline
  removes. Adopt TypeSpec's *idea* (a typed contract with a reproducible check), not a redundant *layer*.

```jsonc
// (a) The contract already lives as machine-diffable JSON — a git diff on this file IS "did the spec change?"
// we:src/_data/intents/action.json
{
  "id": "action",
  "requiresCapabilities": ["invokers"],                         // ← contract surface (structured, mechanical)
  "dimensions": {
    "level":   { "values": ["primary", "secondary", "tertiary"] },  // ← editing a value = a SPEC change → human
    "variant": { "values": ["fill", "outline", "ghost", "link"] }
  }
}
// (b, excluded) A TypeSpec source authored ABOVE it — a SECOND source of truth for the same contract:
//   model ActionIntent { level: "primary" | "secondary" | "tertiary"; }   // emits the JSON — now which is canonical?
```

**Known occurrences:** Specmatic's single central OpenAPI contract repo; the Custom Elements Manifest as the
shipped structural contract for Shoelace/Web Awesome, Carbon, Spectrum, Fluent (surveyed in the #641
block-protocol research); TypeSpec→OpenAPI/JSON-Schema. WE's own precedent: `we:src/_data/*.json` is already
treated as "the spec" by `we:scripts/check-standards.mjs`.

*Skeptic:* SURVIVES-WITH-AMENDMENT — the branch is right (the JSON is already the machine-diffable spec; (b)
is a genuine second-source footgun). Amendment folded: the default originally folded a whole "conformance
suite" into WE, which over-reached — split it, per `#intent-conformance-is-block-compliance`: WE holds the
**meta-schema + static** contract-conformance; the **behavioral** suite runs at **Plateau (runner) / FUI
(subject)**, not WE (MEMORY rule 6). Citation-scope corrected: `#surface-contract-not-computation` is cited
as *supporting context* (it blesses "the contract is authority, impl swappable") but does not itself decide
artifact-identity — branch (b) is killed on **single-source-of-truth**, not on that anchor.
*Screen:* clear — Q1: decides the identity of the human-owned contract artifact on the WE↔FUI boundary
(standard-side, not script wiring); Q2: a real single-source-of-truth merit gap survives "both free to
build" (one authoritative artifact vs a derived layer that can drift and changes what is machine-diffable).

## Fork 2 — Contract granularity

*Fork-existence: two branches that cannot coexist — one contract per standard entity, or one aggregate per
WE↔FUI boundary. The aggregate branch is broken for the auto-clear path: a single boundary contract makes
**every** impl change appear to touch "the boundary," so the spec-change signal never localizes and nothing
is agent-clearable.* The mechanical "spec change → HARD human" *line* is **not** re-decided here — it is the
path/artifact test #2563 Fork 1 already settled (contract-file diff → human; "size is the wrong metric";
semantic-diff refuted); this fork decides only the *unit* that test keys on.

- **(a) Per-standard-entity granularity.** **Chosen.** One contract *per intent / protocol / platform-decision
  anchor* — the grain the JSON files already have, giving the finest independent-review units. **Blast radius
  is the transitive closure over the entity cross-reference graph** `check-standards` already resolves (intents
  compose, protocols reference intents, decisions cite each other) — *not* per-file islands; a change to one
  entity's contract shifts its dependents' blast radius, mirroring the Spec Growth Engine's Intent-Graph diff.
  The spec-line stays the path/artifact test: a diff **touching a contract artifact** (`we:src/_data/**/*.json`,
  `we:docs/agent/platform-decisions.md`, the meta-schema) → **human**; an impl-only diff under a **green
  conformance suite** → agent-clearable; ambiguous → **human** (fail-safe).
- **(b) One per-boundary aggregate contract.** Rejected — can't localize the spec-change signal to the changed
  entity, so it collapses the agent-clearable path.

```js
// The spec-vs-impl LINE is #2563's settled path/artifact test (cited, not re-ruled); this fork sets the UNIT.
// we:scripts/lib/review-escalation.mjs:206-210 (isGateSelfPath) generalizes to every contract artifact:
const CONTRACT_GLOBS = ['src/_data/**/*.json', 'docs/agent/platform-decisions.md', 'src/_data/**/*.schema.json'];
const isSpecChange = (changedPaths) =>
  changedPaths.some((p) => CONTRACT_GLOBS.some((g) => minimatch(p, g)));   // per-standard-entity granularity
// Blast radius of a spec change = transitive closure over the entity cross-ref graph check-standards resolves —
// distinct from #2563's path-based isBlastRadiusPath care-level signal (scoped apart; the graph MAY feed it).
```

**Known occurrences:** Specmatic's per-contract granularity (one spec file per service boundary); the Spec
Growth Engine's **Intent-Graph** reachability (blast radius as graph closure, not per file); CODEOWNERS /
SonarQube path-sensitivity as a *hard* gate — the path/artifact test is the ownership-gate form, correctly
hard here.

*Skeptic:* SURVIVES-WITH-AMENDMENT — per-entity *unit* and the #2563-cited spec-line both survive. Two
amendments folded: (1) the original "blast-radius localizes to the changed entity" was **false** — entities
cross-reference, so blast radius is the **transitive closure over the cross-ref graph** `check-standards`
already builds; (2) statute-overlap avoided — #2563 already ships a **path-based** `isBlastRadiusPath`, so
this fork's entity-graph reachability is **explicitly scoped apart** (a finer notion that may *feed* the path
test) to prevent two rival "blast radius" definitions drifting.
*Screen:* clear — Q1: contract-unit granularity is standard-side governance; the spec-line is #2563's, cited.
Q2: per-entity vs per-aggregate is a structural composability/blast-radius choice even at zero cost (finer
review units vs aggregate authority) — not "build first."

## Fork 3 — How to obtain an actual false-clear rate for the auto-clear path

*Fork-existence: two branches that cannot coexist as the measurement design — a purpose-built instrument, or
reusing the #2563 backstop sample as if it measured the rate. The reuse branch is broken on **statistical
validity**, not timing: #2563's sample is a random draw over **high-blast auto-lands only**, so it is a biased,
low-power estimator — and the very risk it names (a **systematic, correlated** validator blind spot: same
model family, diff-borne prompt injection, an un-probed bug class) is exactly what a sparse random sample has
almost no power to detect. It is a tripwire, not an instrument.* That correlated-blind-spot risk is no longer
hypothetical: #2563's **cognitive-science pass** (`we:reports/2026-07-18-human-vs-ai-review-cognitive-science.md`,
folded into #2563 Fork 2) confirms **AI reviewers do not decorrelate** — LLM pairs agree ~60% *when both
wrong*, correlation *rises* with capability, an ensemble realizes only ~0.43 of the independence gain (the
Knight & Leveson 1986 analogue). So the AI "independent review" the auto-clear path leans on is a **weak
backstop against blind spots it shares**, which is precisely why an instrument that can surface the
*confidently-wrong-and-never-flagged* class is needed. The **permanent non-zero human sample itself is not
re-decided** — it is #2563 Fork 2's settled backstop, kept **never to zero on a structural basis** (the human
is the *only proven decorrelated axis*; a measured-green rate can never license removing it, because the panel
cannot cover a blind spot it shares), with autonomy graduation the staged-autonomy clause of
`#agent-convergence-independent-validation` (`we:docs/agent/platform-decisions.md:2775-2776`); both are
**cited, not re-declared** (no third overlapping anchor).

- **(a) A purpose-built measurement instrument.** **Chosen.** To get a false-clear *rate* with power on the
  correlated-blind-spot tail: a **stratified sample across blast levels** (so low-blast auto-lands are
  measured too, not just the hard tail) **plus a periodic seeded-defect / known-answer audit** (inject a known
  spec-violating change and confirm the independent reviewer catches it). The seeded-defect audit is the
  instrument for the *confidently-wrong-and-never-flagged* class — the same danger #2563 Fork 2's touchpoint 4
  routes to a human ("the only way a *shared* blind spot reaches a human"); here it is *measured*, not just
  sampled. This closes the open question the research flagged as unmeasured.
- **(b) Treat the #2563 backstop sample as sufficient measurement.** Rejected — it conflates a safety tripwire
  with an instrument; a random high-blast sample under-measures the population and is underpowered on the
  correlated blind spot, so a "clean" reading would be a false reassurance. (Block-until-measured out-of-band
  is worse still: with no offline benchmark it is block-*forever* / a #1620 soft-park.)

```js
// The PERMANENT human sample (backstop) is #2563 Fork 2's, cited. THIS fork adds the measurement INSTRUMENT.
// we:scripts/lib/review-escalation.mjs:182-222 (scoreEscalation) — the sample stays; measurement is purpose-built:
if (autoClearedByAgentValidator && sampledForHumanSpotCheck(prNum, cfg.autoClearHumanSampleRate)) {
  humanRequired = true;                                  // #2563's backstop: fixed non-zero fraction, never sunsets
}
// (a) the RATE comes from a stratified draw across blast levels + a periodic seeded-defect audit — power on the
//     correlated blind spot the random sample can't see. The measured rate feeds staged-autonomy graduation.
```

**Known occurrences:** #2563 Fork 2's high-blast human spot-check (the backstop this cites — a tripwire, not a
rate); #2563's cognitive-science pass (LLM reviewers don't decorrelate — ~60% agreement when both wrong, ~0.43
of the independence gain; the Knight & Leveson 1986 N-version analogue) as the evidence the correlated blind
spot is real; seeded-defect / mutation-style audits as the standard way to *measure* a reviewer's catch rate
(the research refuted a specific 86–100% mutation-score claim, but the *method* of injecting known defects to
measure power is sound); the Productivity-Reliability Paradox / METR RCT (why an *unmeasured* auto-clear path
is a real hazard).

*Skeptic:* the "the #2563 sample **doubles as** the measurement instrument" sub-claim was **REFUTED**
(biased, low-power tripwire; no power on the correlated blind spot). Recast: the permanent sample is cited to
#2563 as the *backstop* only; the genuinely-new content is a **purpose-built instrument** (stratified sample
+ seeded-defect audit). No third anchor minted — graduation cites `:2775-2776`. *Post-prep evidence update
(2026-07-18):* #2563 Fork 2's cognitive-science refinement independently **confirms** this fork's premise —
AI panels don't decorrelate, so the AI reviewer is not an independent axis — which *strengthens* the default
(the permanent human sample is kept on a structural basis, and the seeded-defect audit measures the shared
blind spot the panel hides). The default did not flip.
*Screen:* flagged(prio) → fixed. The fresh-context screen flagged the *original* "sample-as-measurement vs
block-until-measured" framing as timing-in-costume. The skeptic-driven recast moves the fork onto a
**statistical-validity** merit axis: a powered stratified+seeded audit vs an underpowered random tripwire — a
correctness/coverage gap that survives "both free to build," independent of when it's built. A fresh-context
**re-screen of the recast** confirmed both questions clear.

## Fork 4 — Governing the non-executable slice

*Fork-existence: two branches that cannot coexist as the authoring rule — either a prose-only invariant is
**allowed** (behind a human gate) or it is **forbidden** (every invariant must be executable). The excluded
"require executable" branch is broken: forcing formalization on invariants that resist it yields
faithfully-wrong formal specs (the TLA+ 8.6%-semantic finding) — a worse artifact than honest prose.* Drift
is mechanically detectable only for the executable part; the prose fields of a contract artifact
(`summary`/`description` in every intent JSON; the prose rules in `we:docs/agent/platform-decisions.md`) carry
meaning no diff can prove preserved. The prose→human gate itself is #2563's settled rule (any prose-field diff
= spec change = human; can't-prove-impl-only → human) — **cited, not re-declared**.

- **(a) Allow prose invariants, fail-safe human-gated, but *ratcheted*.** **Chosen.** Prose is admitted — but
  not as a free escape hatch. **New invariants default to executable form; a prose invariant is admitted only
  with a stated warrant that it genuinely resists faithful formalization** (the TLA+ finding is the
  exception's justification, not a general license). Without the ratchet, "prose is allowed + every prose diff
  → human" quietly re-admits the exact prose-diff eyeballing the schema-not-prose premise set out to kill:
  the low-friction path becomes "write it as prose, get a human gate, dodge machine drift-detection," and the
  deterministic core erodes. The ratchet keeps the prose slice bounded and shrinking.
- **(b) Require every invariant in executable / machine-checkable form.** Rejected — some semantic invariants
  genuinely cannot be faithfully formalized, and forcing them produces valid-parsing, behaviourally-wrong
  specs (TLA+ 8.6% semantic); it also blocks authoring a legitimate invariant until someone can encode it.

```jsonc
// (a) One intent artifact carries BOTH a mechanical contract and a prose slice — governed differently, ratcheted.
// we:src/_data/intents/action.json
{
  "dimensions": { "level": { "values": ["primary", "secondary"] } },  // EXECUTABLE — default form; machine-diffable gate
  "requiresCapabilities": ["invokers"],                               // EXECUTABLE
  "summary": "Semantic hierarchy of interactive elements to establish visual priority."  // PROSE — human-gated; admitted only with a resists-formalization warrant
}
// Ratchet: a NEW invariant must be executable unless a warrant states it can't be faithfully formalized.
```

**Known occurrences:** TLA+ 8.6%-semantic (why executable form can't be forced); Node-RED 55% drift (why the
*executable* part still needs a mechanical gate); Kiro's EARS requirements (the prose form in the wild).

*Skeptic:* SURVIVES-WITH-AMENDMENT — allowing prose survives (TLA+ finding); (b) correctly excluded. Two
amendments folded: (1) **dropped** the `#configurability-partition` mapping — verified wrong turf (that anchor
splits *author-facing config* by data-vs-code **serializability**, and its escape hatch is *executable* code
*outside* the contract; prose semantic invariants are non-executable and *inside* the contract — the opposite
on both axes); (2) added the **ratchet** (executable-by-default, prose-only-with-warrant) to close the
loophole where the prose slice silently grows and erodes the schema-not-prose thesis. The prose→human gate is
cited to #2563, not re-declared.
*Screen:* clear — Q1: decides what authoring is allowed vs what falls to a human gate (standard-side
governance). Q2: merit survives zero cost — some semantic invariants are inherently non-executable, so
require-executable trades coverage for determinism regardless of effort (a real correctness/coverage tradeoff,
not prioritization).

## Fork 5 — The constitutional-amendment gate

*Fork-existence: a constitution amendment is either the **same** gate as an ordinary spec change or a
**strictly harder** one — they cannot both be the rule. "Same as a spec change" (c) is the broken branch: if
amending the constitution is no harder than amending a law, the tier is **not** a constitution — the hierarchy
collapses, because a constitution that amends as easily as statute gives the principles laws derive from no
extra protection. So the fork is which **harder** form.*

The subtlety the skeptic forced (fold below): the ordinary spec gate **already** has propose → red-team →
separate ratify (MEMORY rule 39 / `preparedDate` → later ratification + a mandatory skeptic pass). So
"deliberation + time-separation" is **not** a tier boundary — the spec gate has it too. Distinctness must come
from a **substantive entrenchment**, not extra ceremony.

- **(a) Substantive entrenchment (not merely a heavier ceremony).** **Chosen.** A constitution change is
  gated by three things the spec gate does *not* impose: **(i) irreversibility by the ordinary path** — it is
  **exempt from #911's supersede-with-lineage** (a normal statute is reversible by an ordinary superseding
  decision; the constitution is append-biased and can only be changed by *this* gate, never by a routine
  supersede — otherwise #911's back door silently un-entrenches it); **(ii) a cooling period measured in
  days, not sessions** (a single actor re-reading a self-proposal minutes later is the automation-bias setup
  #2563 ruled backfires); **(iii) a committed external artifact** — the written amendment diff **and** its
  red-team transcript land as a durable public record, so the act leaves an independent trace. The two-phase
  propose → red-team → separate-ratify shape rides on top of these. **Honest residual:** solo, the *author*
  still ratifies, so the non-author invariant the constitution itself holds **cannot be fully satisfied** —
  (i)–(iii) are the strongest mitigation available without a second human; the real fix is (b), on polity
  growth.
- **(b) A headcount quorum (≥2 independent humans / supermajority).** The **genuine constitutional form** —
  real entrenchment (US **Article V**: 2/3 + 3/4) comes from needing many independent wills to concur, which
  is the only thing that actually satisfies segregation-of-duties on the amendment itself. Rejected **only for
  now** (no body of independent human ratifiers exists), and adopted the moment the polity grows — tracked to
  the governance-persona roster/charter (#166; note its roster is today descriptive/non-enforcing, so this is
  a promise, not a live gate). Article V is cited **here**, for (b) — it is a headcount precedent and does not
  support (a).
- **(c) Same gate as a spec change.** Rejected — collapses the tier (above).

*Skeptic:* SURVIVES-WITH-AMENDMENT (heavy) — (a)'s original distinguisher ("deliberation + time-separation")
was **refuted as non-distinct** from the existing prepare→ratify+skeptic spec gate, so the default was
re-grounded on **substantive entrenchment** (i–iii). Statute-overlap folded: reconciled with **#911** — the
constitution is **exempt from ordinary supersede-with-lineage**, else entrenchment is a front door with #911's
back door open. Citation-scope folded: the **Article V** citation was moved off (a) (it is a *headcount*
precedent) onto (b); Spec Kit's constitution file / Constitutional AI reach only "have a principle layer," not
the amendment ceremony. The single-actor self-ratification weakness is now stated openly, not papered over.
*Screen:* clear — Q1: governs how the top (constitution) tier is amended (pure standard-side governance).
Q2: the three options give genuinely different protective strength and (b) is structurally invalid solo
regardless of cost — tier-protection merit, not "build first."

## Constitutional-consistency check — a ruling + a build, not a fork (dissolved)

The prepared draft carried this as "Fork 6 — is the check wholly human or machine-assisted." **Both the
fresh-context screen and the skeptic dissolved it as a fork:** the screen flagged it *prioritization* (an
advisory assist strictly dominates once built, so the only reason to skip it is cost); the skeptic classed it
**settled-by-precedent** (it is #2563 Fork 2's point-level-escalation pattern applied to consistency, and the
control model is *forced* by settled invariants). So it splits into a ruling and a build:

- **Ruling (fixed — added to *Fixed invariants* above): constitutional-consistency is human-*decided*, never
  machine-decided.** It is the "*is the spec right?*" question a green suite cannot answer (Fixed invariant)
  and a correlated AI panel cannot certify (#2563 cognitive-science pass). Wholly-*human*-with-no-assist is
  also wrong (the vigilance decrement on eyeballing the whole constitution per law change) — so the control
  model (**machine assists, human decides**) is not a live fork; it is forced.
- **Support-both build (not a fork): an *advisory* constitutional-consistency critique.** Built when
  affordable, with three guardrails the skeptic required so the assist doesn't rebuild the automation-bias
  trap: **(i) per-principle coverage** — it argues *for and against* consistency against **each** constitutional
  principle, never a filtered "candidate-inconsistencies" list that anchors the human and implies the unlisted
  principles are clean; **(ii) the human stays active** — forms an independent read (or a sampled independent
  pass over AI-"clean" principles), never merely adjudicating the AI's list (#2563 Fork 2's active-not-passive
  rule); **(iii) a fresh non-author validator** — the critique AI is fresh-context, adversarial, and **not the
  spec's authoring agent** (inherits `#agent-convergence-independent-validation`). Constitutional AI is a
  *capability* precedent only ("a machine can critique against a constitution"); its own governance is
  machine-*decided* — the opposite of this ruling — so it is demoted to capability-evidence, not authority.

## Codified-in reconciliation

At ratification this decision sets `codifiedIn` to a **thin new anchor** — proposed
`#spec-is-schema-human-gates-spec` — carrying only its genuinely-new content: **(1)** the existing
`we:src/_data/*.json` definitions **are** the machine-diffable spec, and **WE holds only the meta-schema +
static contract-conformance** (the behavioral suite is Plateau/FUI); **(2)** the non-executable slice is
**prose-permitted-but-ratcheted** (executable-by-default, prose-only-with-warrant); **(3)** the **three-tier
amendability hierarchy** (constitution → law → impl), with the constitution never applied to a diff directly,
a **substantively-entrenched constitutional-amendment gate** (Fork 5: #911-irreversible + cooling-in-days +
committed external artifact — headcount when the polity grows), and **constitutional-consistency
human-decided, never machine-decided** (the dissolved former Fork 6, with an advisory per-principle critique
as a support-both build). The constitution tier is the legitimate home of Fork 4's *permitted-prose*
invariants — core principles are inherently prose, so they sit at the top of the prose-allowed hierarchy,
human-gated by construction. Everything else **composes with and cites** existing statute — it does not
re-declare it:

- [`#agent-convergence-independent-validation`](../docs/agent/platform-decisions.md#agent-convergence-independent-validation)
  (#2398/#2410) — the convergence bar, the non-author invariant, and the **staged-autonomy** clause
  (`we:docs/agent/platform-decisions.md:2775-2776`). Fork 3 cites its graduation clause; the permanent human
  sample is #2563 Fork 2's. No third anchor.
- `#blast-radius-advisory-care-not-a-gate` (#2563) — the **mechanical spec-vs-impl line** (path/artifact
  test, "size is the wrong metric") and the **permanent human sample**. This item is the constellation-wide
  generalization; #2563 Fork 1 is its first concrete instance. Fork 2 **scopes its entity-graph blast radius
  apart** from #2563's path-based `isBlastRadiusPath` so the two definitions don't drift.
- [`#intent-conformance-is-block-compliance`](../docs/agent/platform-decisions.md#intent-conformance-is-block-compliance)
  — the **static (WE) vs behavioral (Plateau runner / FUI subject)** conformance split Fork 1 respects.
- [`#surface-contract-not-computation`](../docs/agent/platform-decisions.md#surface-contract-not-computation)
  — supporting context (the contract is authority, impl swappable), not the authority that decides
  artifact-identity.
- **Platform Decisions = Statute Layer (#911)** — governs the *law* tier and its supersede-with-lineage
  reversibility. Fork 5 **reconciles explicitly**: the **constitution tier is exempt** from ordinary
  supersede-with-lineage (only the entrenched amendment gate changes it), so #911's reversibility does not
  silently un-entrench the constitution. The two compose — #911 for statute, this gate for the constitution
  above it.

No collision (verified: each tests different turf; the #911 reconciliation is stated, not left implicit).

## Related

First instance: #2563 (blast-radius advisory; Fork 1 narrows the trust-chain human gate to *spec* changes) —
the Spec Growth Engine shows these are one design; #2563 Fork 2's **cognitive-science refinement**
(`we:reports/2026-07-18-human-vs-ai-review-cognitive-science.md`) grounds Fork 3's correlated-blind-spot
premise (AI panels don't decorrelate; the human is the only proven independent axis). Composes with the
constellation placement model (WE = standard/spec, FUI/plateau = impl) and
`#agent-convergence-independent-validation`. Research:
`we:reports/2026-07-18-spec-based-programming-deep-research.md` +
`/research/spec-based-programming-constellation/`. Ready to ratify once `/prepare` stamps it — the call is
`/next decision`'s.
