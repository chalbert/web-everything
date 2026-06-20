---
kind: story
size: 5
parent: "099"
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: webcases/requirementValidator.ts
tags: [requirement-as-code, bdd, ai, verification, evergreen, conformance, editor, spec, propose-and-verify]
relatedReport: reports/2026-06-06-front-end-platform-book.md
relatedProject: webcases
crossRef: { url: /backlog/099-evergreen-app-vision/, label: "Evergreen app (#099)" }
---

# Requirement-as-code — the meta-schema + a deterministic typed-slot validator (slice A)

Ship the WE-resident, deterministic half of requirement-as-code's authoring+validation capability: the
**meta-schema** (the typed requirement record in #714's ratified EARS-over-Given/When/Then format, every
slot a typed reference into the live registries) plus a **deterministic validator** that resolves each
slot and reports unresolvable references. A requirement naming a nonexistent intent dimension, semantic
event, or protocol observable **fails at author time** — the typed binding generic BDD lacks. This is the
foundational, near-term standalone slice of the requirement-as-code capability central to the evergreen
app ([#099](/backlog/099-evergreen-app-vision/)); it produces the corpus everything downstream needs.

> **Sliced 2026-06-16 (`/split 100`, after #714 ratified the format).** #100 was a `story·13` staging
> three capabilities; with the gating meta-schema fork resolved it split into this re-scoped slice A plus
> two siblings under #099 — see *Sibling slices* below. Report:
> `we:reports/2026-06-16-backlog-split-analysis.md`.

## Slice A — what ships here

The WE-resident, **deterministic** core of capability 1 (authoring + validation):

1. **The meta-schema** — a typed requirement-record type (per #714's worked YAML example): `role` →
   governance persona; `given` → an intent-dimension value (`we:intents.json`); `when` → a `we:semantics.json`
   event; `then` → a `we:protocols.json` observable state/event at a conformance tier.
2. **The validator** — a pure, dependency-free resolver (the `we:webcases/driftCheck.ts` pattern) that walks
   a requirement record and checks every slot against `src/_data/{intents,semantics,protocols}.json` plus
   the persona roster, reporting each unresolvable reference with a pointer to the offending slot.

**Out of scope (deliberately):** the AI contradiction/ambiguity/gap checker is a *swappable
Plateau-served provider* (no-leakage, [#475](/backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/)),
not part of this WE-resident slice. The exact EARS clause set and required-vs-optional role slot are
slice-A **authoring details, not forks** (confirmed in #714).

**Acceptance:** a fixture requirement (the #714 worked example) validates green; a variant naming a
nonexistent registry term fails with a slot-pointed finding (fixture-driven demo).

## Why it's uniquely possible here

The constellation already gives requirements something to bind to: **intents** (UX vocabulary),
**protocols** (conformance contracts), **semantics** (event vocabulary), and the **webcases** suite (the
machine-checkable target). A requirement expressed in that vocabulary is verifiable by construction —
generic BDD tools have no ground truth; here the standard *is* the ground truth.

## Sibling slices (under #099)

- **Slice B — requirement→webcase compiler** ([#797](/backlog/797-requirement-to-webcase-compiler-deterministic-1-n-projection/),
  blocked on this slice): the deterministic 1:N projection of a typed requirement record into webcases
  (the compile-to ratified in #714 fork 2). The AI test-generator for non-compilable requirements is a
  separate Plateau-served provider.
- **Slice C — code-from-requirement** — could not become a clean build slice: it has no WE-resident
  deterministic artifact (pure Plateau-served codegen) and buries a source-of-truth fork. That fork is
  tracked as the parked decision
  [#798](/backlog/798-code-from-requirement-source-of-truth-requirement-only-codeg/); slice C is carved
  once it ratifies and the Plateau codegen capability is real.

## Design grounding — #714 (ratified 2026-06-16)

The format is an **EARS-style constrained grammar over Given/When/Then, every slot a typed reference into
the existing registries**; requirements **compile to** webcases (1:N). The typed schema is the neutral
pivot — other formats (Gherkin/EARS) are adapters around it
([#794](/backlog/794-gherkin-ears-interop-adapter-for-requirement-as-code-emit-de/), deferred, sequenced
after this slice). Placement is settled (Plateau-served AI providers, no-leakage #475); only the
meta-schema (this slice) and the webcases it compiles to (#797) are WE-resident.

## Progress (resolved 2026-06-16)
- Shipped the typed meta-schema + deterministic validator at
  [`we:webcases/requirementValidator.ts`](../webcases/requirementValidator.ts) (the pure, dependency-free
  `we:driftCheck.ts` pattern): a `RequirementRecord` type for #714's `role`/`given`/`when`/`then` shape, and
  `validateRequirement(req, registries)` resolving every typed slot, returning a **slot-pointed finding**
  for each unresolved reference.
- **Registries are injected, never imported** — keeps the core free of `_data` coupling and the governance
  **persona roster** a no-leakage injected input (#475; roster is plateau-app-owned, #141/#166). `role` is
  optional; resolved only when a roster is passed.
- Grounding coverage today: `given.{intent,dimension,value}` → we:intents.json, `when.event` → we:semantics.json
  term, `then.protocol` → we:protocols.json id, `then.tier` → the fixed L1/L2/L3 vocabulary — all **hard**
  (error on miss). `then.observe` grounds to an **info** finding (we:protocols.json models no observable states
  yet — minting that registry is a separate future artifact), so protocol + tier still ground hard.
- Tests ([`we:webcases/__tests__/requirementValidator.test.ts`](../webcases/__tests__/requirementValidator.test.ts))
  run against the **live** registries: the #714 worked example (grounded to real terms — validation intent's
  `execution: blur`, the `Commit Policy` semantic term, the `validation` protocol at L1) validates green; a
  variant naming nonexistent terms fails with findings on exactly `given.dimension`, `when.event`,
  `then.protocol`, `then.tier`. 5/5 green; `tsc --noEmit` + `check:standards` clean.
- **Out of scope (deliberately, per #714):** the AI contradiction/ambiguity/gap checker (Plateau-served, #475)
  and the requirement→webcase compiler ([#797](/backlog/797-requirement-to-webcase-compiler-deterministic-1-n-projection/), blocked on this slice).
