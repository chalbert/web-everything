# Requirement-as-code meta-schema — prior art & format survey

> Research backing for decision **#714** (Requirement meta-schema — BDD-like format & relationship to
> webcases), the gating fork for **#100** (requirement-as-code) under the **#099** evergreen-app vision.
> Surveys how existing requirement/behaviour formats bind plain language to a verifiable ground truth, and
> maps the viable shape onto the constellation's existing typed vocabulary (intents · states · protocols ·
> semantics · webcases).

## The question

#100 wants requirements captured as a **structured, machine-readable artifact** — plain language, BDD-like
— that an AI can reason over, test a growing share of, and eventually generate code from. #714 ratifies the
**format** of that artifact (standardize the *format*, not a fixed requirement list — mirroring the intents
"standardize the meta-schema, not the list" principle) and its **relationship to webcases**.

The hard part is not "natural language for requirements" — many tools do that. It is making the requirement
**verifiable by construction**: a requirement that can drift from what it describes is just a comment. The
survey below is organised around exactly that axis — *what does each format bind to as ground truth, and
where does it leak?*

## Prior art

### 1. Gherkin / Cucumber (classic BDD) — Given/When/Then, free-text steps
- **Shape.** `Given <context>` / `When <action>` / `Then <outcome>`, written as free natural-language steps;
  each step is matched by a regex to a "step definition" (glue code) a developer writes.
- **Ground truth.** *None in the format itself.* The binding lives entirely in hand-written step defs. The
  same English sentence can map to any code; two scenarios that read identically can test different things.
- **Known failure modes.** Step-definition drift, regex brittleness, "feature files that lie", combinatorial
  glue maintenance. The format's familiarity (Given/When/Then) is its lasting contribution; its lack of a
  typed referent is its lasting weakness.
- **Lesson for us.** *Keep the Given/When/Then skeleton; reject the free-text slot.* The slots must
  reference a typed vocabulary, not arbitrary prose, or we inherit Gherkin's ground-truth gap.

### 2. EARS (Easy Approach to Requirements Syntax) — constrained sentence templates
- **Shape.** A tiny fixed set of sentence *patterns* (not a fixed requirement *list*): Ubiquitous ("The
  system shall …"), Event-driven ("**When** <trigger> the system shall …"), State-driven ("**While** <state>
  …"), Unwanted-behaviour ("**If** <condition> then the system shall …"), Optional ("**Where** <feature> …"),
  plus composites. Originated at Rolls-Royce for jet-engine control; widely used in aerospace/automotive/med.
- **Ground truth.** Not executable on its own, but the constrained grammar **removes ambiguity at authoring
  time** — every requirement is one of a handful of shapes, so contradictions/gaps are detectable.
- **Lesson for us.** This is the strongest precedent for "**standardize the format, not the list**." A small
  closed set of clause shapes (trigger / state / response) gives a linter something to check without ever
  enumerating the requirements themselves. Our editor's "flags contradictions, ambiguity, missing
  requirements" (#100 capability 1) is essentially EARS-linting plus a typed referent.

### 3. Formal specification (TLA+, Alloy, Z) — full ground truth, high authoring cost
- **Shape.** Mathematical state/transition specs; model-checkable, genuine ground truth.
- **Trade-off.** Maximum verifiability, minimum approachability — not plain language, not authorable by an
  app's domain owner. Right for protocol *cores*, wrong for an app-requirement surface.
- **Lesson for us.** We want the *binding* formal (typed slots, machine-checkable) but the *surface* plain.
  The win is a natural-language skin over a typed core — not asking authors to write formal logic.

### 4. Spec-by-example / living documentation / property-based testing
- **Shape.** Requirements *are* the executable suite (Fitnesse, Concordion, Specflow; property tests assert
  invariants rather than examples).
- **Lesson for us.** Validates "requirements **compile to** the executable layer" — the requirement is the
  source, the test is the derived artifact, and the documentation stays true because it runs. This is fork 2.

### 5. The constellation's own precedent — "standardize the meta-schema, not the list"
- **Intents** (`intents.json`) are an explicitly open system: WE standardizes the intent meta-schema and lets
  projects author custom intents that coexist conflict-free, rather than freezing a list. #714's fork 1 is the
  *same move one level up*: standardize the requirement grammar, not a catalog of requirements.

## What the constellation already gives a requirement to bind to

The differentiator #100 claims — "generic BDD tools have no ground truth; here the standard *is* the ground
truth" — is real and concrete in today's tree:

| BDD slot | Binds to (existing artifact) | Concrete shape in repo |
|---|---|---|
| **Role / persona** | governance personas (#141/#166) | one persona family, charter-scoped lenses |
| **Given** (precondition / state) | an **intent dimension value** | `intents.json` → `dimensions.<axis>.values[]` (e.g. `motion.physics ∈ {natural, immediate, reduced}`) |
| **When** (trigger / action) | a **semantic term / event** | `semantics.json` terms (e.g. "Viewport Presence" enter/leave transitions) |
| **Then** (observable outcome) | a **protocol's observable state/event** | `protocols.json` → conformance tiers, `realizesIntent` (e.g. `validation` L1/L2 observable states) |
| **executable check** | a **webcase** | `webcases/driftCheck.ts` — structural/contract verification, the machine-checkable target |

So a requirement in this grammar is not free prose: each slot is a *typed reference* into an existing
registry. That typing is the ground truth Gherkin lacks — an outcome clause that names a protocol-observable
state can be checked against the protocol; one that names a nonexistent state fails validation at author
time. The requirement is **verifiable by construction**.

## Synthesis — the recommended shape

Combine the three viable precedents:

- **Gherkin's skeleton** (Given/When/Then — familiar, plain-language surface),
- **EARS's constrained templates** (a closed set of clause shapes → ambiguity/contradiction/gap detectable;
  "standardize the format, not the list"),
- bound to the **constellation's typed vocabulary** (role = persona, Given = intent-dimension state, When =
  semantic event, Then = protocol-observable state/event) — the ground truth the first two lack.

A requirement is then a small typed record (role + trigger/state + observable response, each a reference into
intents/semantics/protocols), authored through a plain-language EARS-style surface, that **compiles down to**
one or more **webcases** as its executable form. The webcases suite stays the single machine-checkable target;
requirements are the higher-level, human-authored source that generates it (one target, not two parallel ones).

This directly supports both of #714's open recommendations:
- **Fork 1 (format):** an intent/role/state grammar binding requirements to the standard's typed vocabulary
  (not free-text Gherkin, not a frozen requirement list, not raw formal logic).
- **Fork 2 (webcases relationship):** requirements **compile to** webcases (sibling-of would create two
  drifting machine-checkable layers; compile-to keeps one).

## Open sub-questions left for the decision turn
- Exact clause set (do we adopt EARS's five patterns verbatim, or a trimmed trigger/state/response trio?) —
  an authoring-detail for slice A, not a fork blocker.
- Whether a requirement compiles to *one* webcase or *many* (1:N is the safe assumption; a requirement can
  imply several observable checks).
- Persona/role slot: required or optional (lean optional — most requirements are role-agnostic; role is the
  EARS "Where <feature>" style refinement).

## Bottom line
The recommendation in #714 is well-supported by prior art: **don't invent a format, adapt one** — EARS-style
constrained templates over a Given/When/Then skeleton, with every slot a typed reference into the existing
intents/semantics/protocols registries, compiling to webcases. The novelty is not the BDD shape (decades old)
but the *typed binding to a live standard*, which is precisely what makes these requirements verifiable where
generic BDD is not.
