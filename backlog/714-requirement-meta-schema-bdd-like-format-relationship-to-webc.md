---
type: decision
workItem: story
size: 3
parent: "099"
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
tags: [requirement-as-code, meta-schema, bdd, conformance, webcases, evergreen]
crossRef: { url: /backlog/100-requirement-as-code/, label: "Requirement-as-code (#100)" }
relatedReport: reports/2026-06-16-requirement-meta-schema-prior-art.md
---

# Requirement meta-schema — BDD-like format & relationship to webcases

Ratify the requirement-as-code meta-schema: the BDD-like intent/role/state vocabulary (standardize the format, not a fixed requirement list) and the requirements-compile-to-cases relationship to webcases. Placement settled by [#475](/backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/) (Plateau-served AI capabilities; only the meta-schema + webcases reach the standard). Gating design fork for [#100](/backlog/100-requirement-as-code/) / the strong evergreen-app vision ([#099](/backlog/099-evergreen-app-vision/)).

## Why this is a parked decision card

This fork was previously buried in #100's body as "Design notes (**recommended**)". `/split 100`
(2026-06-15) ruled #100 un-splittable precisely because slice A's core — the meta-schema **format** — is
an unratified fork (rubric (1): you can't split away a fork). Filed here as its own `type:decision` card
so the fork is tracked rather than carried inline (a design fork is a backlog decision item, never a buried checkbox).

**Parked, not open:** the requirement-as-code capability is a far-future vision-tier ingredient of the
evergreen app. Deferral governs *when* we ratify, not *whether* the fork is tracked. The card un-parks
when slice A (the authoring + validation editor) is picked up as a near-term standalone win — at which
point ratify the format here, then build slice A against it.

Prior-art survey backing the recommendations: [`reports/2026-06-16-requirement-meta-schema-prior-art.md`](../reports/2026-06-16-requirement-meta-schema-prior-art.md)
(Gherkin · EARS · formal specs · spec-by-example, mapped onto the constellation's typed vocabulary).

## Forks to ratify

### Fork 1 — meta-schema format / vocabulary *(the live, undecided call)*

The question is **what the BDD slots bind to** — that binding is what makes a requirement verifiable
rather than just a comment. Options:

| Option | Shape | Verdict |
|---|---|---|
| **(a) Free-text Gherkin** | Given/When/Then with prose steps + hand-written glue (classic Cucumber) | ✗ no ground truth in the format; binding lives in arbitrary step-def code → requirements drift from what they test. Forfeits the one edge #100 claims. |
| **(b) Fixed requirement list** | standardize *which* requirements exist | ✗ violates "standardize the meta-schema, not the list" (same principle as intents); requirements are an open per-app set. |
| **(c) Raw formal spec** | TLA+/Alloy-style logic | ✗ as a *surface* — not plain-language, not authorable by a domain owner. Borrowed only as the *binding* idea. |
| **(d) EARS-style constrained templates over a Given/When/Then skeleton, every slot a typed reference into the existing registries** | role = persona, Given = intent-dimension value, When = semantic event, Then = protocol-observable state/event | ✓ **recommendation** |

**Recommendation: (d).** Don't invent a format — adapt one. EARS (the aerospace constrained-requirement
syntax) is the strongest precedent for *format-not-list*: a closed set of clause shapes a linter can check
without enumerating requirements (this is exactly #100's "editor flags contradictions/ambiguity/gaps").
Gherkin contributes the familiar Given/When/Then skeleton. The novelty — and the ground truth generic BDD
lacks — is that **each slot is a typed reference into a registry that already exists in the tree**, so a
requirement naming a nonexistent state fails validation at author time.

**Concrete worked example.** A requirement record (the authored source) and what it binds to:

```yaml
# requirement: "validation errors surface immediately on blur"
role: end-user                       # → governance persona (#141/#166)
given:                               # precondition = an intent-dimension value
  intent: validation                 # → intents.json#validation
  dimension: timing
  value: on-blur
when:                                # trigger = a semantic event
  event: control-blur                # → semantics.json term
then:                                # outcome = a protocol-observable state/event
  protocol: validation               # → protocols.json#validation (realizesIntent: validation)
  observe: invalid-state-announced   # an L1 observable state of that protocol
  tier: L1
```

Every reference (`intents.json#validation`, the `timing` dimension value, the `validation` protocol's L1
observable state) is checkable against a live registry — that is "verifiable by construction." Authors write
this through a plain-language EARS surface ("*When* a validated control loses focus *while* timing is on-blur,
the invalid state shall be announced"); the typed record is what the editor validates and what compiles to a
webcase. *(Exact clause set — EARS's five patterns verbatim vs. a trimmed trigger/state/response trio — and
required-vs-optional role slot are slice-A authoring details, not fork blockers; see report.)*

**Format interop — the typed schema is the neutral pivot; Gherkin/EARS/… are adapters around it.** Choosing
(d) is what *makes* round-tripping to other formats possible — a free-text Gherkin SoT (option a) has nothing
richer to convert *to*. Same doctrine as the shipped ingest adapters ([#552](/backlog/552-storybook-ingestion-adapter-storybook-csf-to-the-webcases-pi/)
Storybook→webcases, [#426](/backlog/426-incumbent-ingestion-adapters-storybook-mintlify-to-the-webca/) contract
ruling) and the forward/generation adapters ([#463](/backlog/463-polyglot-reach-forward-generation-adapters/) neutral-contract SoT). The two directions are
**asymmetric**, and that asymmetry is correct, not a flaw:
- **Emit (schema → Gherkin/EARS):** deterministic downward projection — every typed requirement renders to a
  valid Given/When/Then scenario (forward-adapter pattern). Loses only the typed binding; prose stays faithful.
  Subset-trivial for EARS (our grammar *is* EARS-shaped → mostly 1:1).
- **Ingest (Gherkin → schema):** subset-deterministic (a controlled step library mapping 1:1 to `semantics`/
  `protocols` terms is a lookup table) + **AI-assisted, lossy** for free-form steps (the [#475](/backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/)-served
  checker *proposes* a binding a human confirms — the normalization-hub pattern). The **unmappable residue is
  the valuable signal**: a step that won't ground is exactly "this requirement has no ground truth," the lint
  #100 capability 1 wants.
- **Round-trip:** `schema→Gherkin→schema` is lossless on our subset; `Gherkin→schema→Gherkin` is lossy (free
  text that never grounded can't be recovered) — expected under the normalization-hub model.

The adapter itself is a **deferred build, not a fork** — filed as [#794](/backlog/794-gherkin-ears-interop-adapter-for-requirement-as-code-emit-de/)
(blocked on the #100 impl existing), sequenced after slice A.

### Fork 2 — relationship to webcases

| Option | Verdict |
|---|---|
| **(a) Sibling** — requirements and webcases are two parallel machine-checkable layers | ✗ two targets that can disagree; you'd have to verify the verifiers. |
| **(b) Compile-to** — a requirement is the human-authored source that compiles down to **one-or-many** webcases | ✓ **recommendation** |

**Recommendation: (b).** The requirement is the higher-level authored source; the webcase is the derived
executable artifact (1:N — one requirement can imply several observable checks). The existing
[webcases](../webcases/) suite (e.g. [`driftCheck.ts`](../webcases/driftCheck.ts)) stays the single
machine-checkable target; requirements sit above it as the living-documentation source. Matches
spec-by-example precedent — the documentation stays true because it runs.

### Fork 3 — AI-provider placement *(already resolved, recorded for completeness)*

Per [#475](/backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/) no-leakage: the
contradiction/ambiguity checker and the test-generator are Plateau-served swappable providers the tool
consumes as a no-leakage client; only the requirement **meta-schema** and the **webcases** they compile to
are WE-resident artifacts. *Not an open branch.*

## Ruling (2026-06-16)

**Fork 1 = (d).** The requirement meta-schema is an **EARS-style constrained grammar over a Given/When/Then
skeleton, every slot a typed reference into the existing registries** — role = persona, Given = intent-dimension
value, When = `semantics` event, Then = `protocols` observable state/event. Not free-text Gherkin (no ground
truth), not a fixed requirement list ("standardize the meta-schema, not the list"), not raw formal logic (not
authorable). The typed binding *is* the ground truth generic BDD lacks: a requirement naming a nonexistent
state fails validation at author time. The schema is the **neutral pivot**; other formats are adapters around
it (emit = deterministic forward adapter; ingest = subset-deterministic + AI-assisted lossy normalization),
filed as deferred build [#794](/backlog/794-gherkin-ears-interop-adapter-for-requirement-as-code-emit-de/).

**Fork 2 = compile-to.** A requirement is the human-authored source that **compiles down to one-or-many
webcases** (1:N). The [webcases](../webcases/) suite stays the single machine-checkable target; compile-to does
not forbid hand-authored webcases coexisting, so it strictly dominates sibling (one verifiable layer, not two).

**Fork 3** = settled by [#475](/backlog/475-design-ref-vision-gated-capture-qc-candidate-surface-quality/) (recorded above), not reopened.

*Red-team:* the strongest cases for free-text Gherkin (interop) and sibling-of (standalone tests) both fail —
the first is recovered by the #794 ingest adapter without losing verifiability; the second survives under
compile-to anyway (hand-authored webcases still allowed). No principle violation found in (d)/compile-to.

## Unblocks

Now ratified: land foundational **slice A** (authoring + validation editor — produces the requirement
corpus everything else needs) as a standalone win, then re-run `/split 100` to carve the auto-testing
loop (slice B) and code-from-requirement (slice C) against the now-real tree. The format-interop adapter
([#794](/backlog/794-gherkin-ears-interop-adapter-for-requirement-as-code-emit-de/)) sequences after slice A.
