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

## The axis

Two things are **already ratified** and are not forks: the spec is a **SCHEMA / executable contract, not
prose**, and the model is **human-gates-spec / agent-implements** (below, *Fixed invariants*). Much of the
rest is **already statute** — the mechanical spec-vs-impl line, the human sample, and staged autonomy were
settled by #2563 and [`#agent-convergence-independent-validation`](../docs/agent/platform-decisions.md#agent-convergence-independent-validation).
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

## Recommended path at a glance

| # | Fork | Options | Default |
|---|------|---------|---------|
| 1 | Which WE artifact IS the central contract | (a) existing intent/protocol JSON *become* the spec (WE holds meta-schema + static conformance; behavioral suite → Plateau/FUI) · (b) author a TypeSpec→JSON-Schema layer above | **(a) definitions become the spec** — one source of truth |
| 2 | Contract granularity | (a) per-standard-entity, blast-radius = transitive closure over the cross-ref graph · (b) one per-boundary aggregate | **(a) per-entity** — finer independent-review units; spec-line cited to #2563 |
| 3 | Getting a real false-clear rate | (a) stratified sample across blast levels + periodic seeded-defect audit · (b) treat the #2563 backstop sample as sufficient measurement | **(a) purpose-built instrument** — the random sample is underpowered |
| 4 | Governing the non-executable slice | (a) allow prose behind a fail-safe human gate, **ratcheted** (executable-by-default, prose-only-with-warrant) · (b) require every invariant executable | **(a) ratcheted prose** — can't force faithful formalization |

## Fixed invariants (the ratified core — never a config knob)

- **The spec is a SCHEMA / executable CONTRACT, not prose.** Only contract-as-spec (JSON Schema / TypeSpec /
  Gherkin / property tests) makes *"did the spec change?"* a **deterministic** yes/no and *"did the impl
  preserve the spec?"* a machine-run conformance check. Prose specs (Kiro, Spec-Kit, Tessl) are validated by a
  human eyeballing a text-diff — no tool auto-detects semantic drift — which is exactly the non-deterministic
  part we must not inherit. (Ratified 2026-07-18.)
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

## Codified-in reconciliation

At ratification this decision sets `codifiedIn` to a **thin new anchor** — proposed
`#spec-is-schema-human-gates-spec` — carrying only its genuinely-new content: **(1)** the existing
`we:src/_data/*.json` definitions **are** the machine-diffable spec, and **WE holds only the meta-schema +
static contract-conformance** (the behavioral suite is Plateau/FUI); **(2)** the non-executable slice is
**prose-permitted-but-ratcheted** (executable-by-default, prose-only-with-warrant). Everything else
**composes with and cites** existing statute — it does not re-declare it:

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

No collision (verified: each tests different turf).

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
