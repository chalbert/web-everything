---
type: decision
workItem: story
parent: "583"
size: 5
status: resolved
blockedBy: ["583"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
preparedDate: "2026-06-14"
relatedReport: reports/2026-06-14-reference-retirement-convention.md
relatedProject: webdocs
crossRef: { url: /research/reference-retirement-convention/, label: research topic }
tags: [monitoring, references, retirement, convention, freshness]
---

# General reference-retirement convention (generalize the corpus 'retired' shape across all reference homes)

**Prepared (no convention existed — the prior-art survey reshaped the call).** Four forks below, each grounded
in the published [/research/reference-retirement-convention/](/research/reference-retirement-convention/)
(report linked), each with a **bold** recommended default. The survey was decisive on two points that set the
defaults: standards bodies apply the *same* retirement vocabulary across every document type (homes differ in
**container**, not in the retirement **concept** → uniform shape), and they universally treat **death** and
**supersession** as *distinct, linkable* states (W3C superseded-vs-obsolete; IETF Obsoletes-header-vs-Historic-status)
— which dissolves the original "how does it mesh with #192's supersedes chain?" question into a concrete
markers-vs-enum fork. This is the [#583](/backlog/583-external-reference-health-monitoring-liveness-retirement-rep/)
epic's **dogfood layer** (a self-run convention over *this* repo), not the later WE platform-strategy setting.

## The axes

The concern decomposes into four orthogonal axes, each pinned to the real tree:

- **(1) Uniformity.** The project cites external URLs in five structured JSON homes — corpus
  `docsUrl`/`repoUrl` ([benchmarkCorpus.json:63](../src/_data/benchmarkCorpus.json#L63), the only home that
  already has `retired`/`retiredDate`/`retiredReason` from #546), library links
  ([references.json:19](../src/_data/references.json#L19)), block & intent design-system refs
  (`designSystemResearch[].reference`, e.g. [intents.json:97](../src/_data/intents.json#L97)), and deep
  per-row doc URLs ([benchmarkCapabilityPresence.json:27](../src/_data/benchmarkCapabilityPresence.json#L27))
  — plus freeform prose in `reports/*.md` and `src/_includes/research-descriptions/*.njk`. One uniform
  field-set, or per-home shapes?
- **(2) Location.** There are **no JSON Schema files** in the repo; validation is imperative in
  [check-standards-rules.mjs](../scripts/check-standards-rules.mjs) (the only reference-touching rule today is
  the `verified`-row-needs-`url` warning at [check-standards-rules.mjs:740](../scripts/check-standards-rules.mjs#L740)).
  So "where the convention lives" is: one shared documented convention + one shared validator helper, vs the
  fields defined/validated separately per home.
- **(3) Retirement vs supersession.** #546 modelled only *death* (`retired` triplet); #192 modelled only
  *replacement* (`supersedes`/`supersededBy`, e.g. [researchTopics.json:60-85](../src/_data/researchTopics.json#L60-L85)).
  A general convention must hold both, and a reference can be both at once (FAST: dead docs **and** folded into
  Fluent). Two orthogonal markers, or one richer `status` enum?
- **(4) Scope now.** Structured JSON homes can carry enforceable fields; freeform prose can't. Which homes does
  the convention cover in this slice?

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Uniformity | **One uniform field-set across all structured homes** | Per-home shapes | High — prior art is document-type-agnostic |
| 2 · Location | **One documented convention + one shared validator helper** | Define/validate per home | High — DRY; no schema files exist |
| 3 · Retire vs supersede | **Two orthogonal markers (reuse #192 `supersededBy`)** | Single W3C-style `status` enum | Med-high — the genuine judgment call |
| 4 · Scope now | **Structured homes now; freeform = documented style only** | Include freeform extraction now | High — extraction deferred to #597 |

## Fork 1 — one uniform shape vs per-home shapes

**Crux:** the homes are heterogeneous *containers* (a JSON source row, a `links[]` entry, a
`designSystemResearch[].reference`, a presence row, a markdown link). Do they all carry the *same* retirement
field-set, or does each define its own?

- **A — One uniform field-set, applied wherever a home is structured JSON. ✅ default.** The survey shows the
  retirement concept is document-type-agnostic: W3C applies the same superseded/obsolete/rescinded states to a
  REC, a Note, and a Group decision; IETF the same `Obsoletes:`/Historic machinery to every RFC. The homes
  differ in container, not concept — so one shape (the #546 triplet + a `supersededBy` pointer, see Fork 3)
  reads identically everywhere, makes the shared validator (Fork 2) trivial, and lets a future liveness sweep
  (#585) emit one marker shape regardless of which home it patches. Native-first vocabulary reuse.
- *Rejected* — **B — Per-home shapes.** Lets each home name fields to taste, but multiplies the surface a
  reader, a validator, and the #585 sweep must each special-case, for zero analytical gain — the homes have no
  *conceptual* difference in what "retired" means. Violates bias-toward-separation's mirror: don't fragment one
  concept into N vocabularies.

## Fork 2 — where the convention lives

**Crux:** given a uniform shape, is it documented + validated **once** (shared), or defined per home? The repo
has no JSON Schema files, so this is about the imperative validator and the docs, not a schema `$ref`.

- **A — One documented convention + one shared validator helper. ✅ default.** Add the field-set to a single
  `docs/agent/*` convention note (next to the backlog-workflow conventions), and a single
  `validateRetirementShape(entry)` helper in [check-standards-rules.mjs](../scripts/check-standards-rules.mjs)
  that each home's existing validator calls on its rows (corpus sources, `references.json` links, `designSystemResearch`
  refs, presence rows). One source of truth for the shape and its rules (e.g. `retired:true` ⇒ `retiredReason`
  present; `supersededBy` resolves). DRY; a shape change touches one place.
- *Rejected* — **B — Define/validate the shape separately per home.** Mirrors today's per-home imperative
  validators, but duplicates the same field rules across five call sites that will drift; the corpus already
  proved (#546) that the shape is reusable, so duplicating it is gratuitous.

## Fork 3 — retirement vs supersession (the one genuine judgment call)

**Crux:** the survey's sharpest finding — every mature registry treats *death* and *replacement* as distinct,
linkable states, and a reference can be both. #546 has only `retired`; #192 has only `supersededBy`. How does
the general convention model both without re-litigating either?

- **A — Two orthogonal markers; reuse #192's `supersededBy` pointer. ✅ default.** Keep #546's death triplet
  (`retired` + `retiredDate` + `retiredReason`) for "this reference is dead/kept-for-audit," and reuse #192's
  existing `supersededBy` (+ optional `supersedes`) pointer for "a newer canonical replaces this."
  **The load-bearing reason is expressiveness, not adoption cost: death and supersession are two independent
  facts, and a single enum (B) is mutually exclusive by construction — it cannot hold both at once.** The
  reference space has four real states: (1) live & current — neither marker; (2) dead, no replacement (FAST docs
  404, nothing replaced them) — `retired` only; (3) still-reachable but a newer canonical exists — `supersededBy`
  only; (4) **dead *and* superseded** (FAST: docs dead **and** folded into Fluent) — both. State 4 is the crux:
  enum-B would force picking `obsolete` *or* `superseded` and lose the other fact, or grow a second field and
  collapse back toward A. Two orthogonal markers represent all four states natively, honouring
  bias-toward-separation (two facts, two fields) and most-permissive-default (each marker independently optional).
  *Secondary (cost, non-deciding):* it happens to reuse shipped vocabulary (#546 + #192/#441) with no migration
  of `researchTopics.json`'s chain and matches JSON-Schema's `deprecated`-boolean minimal model — a convenience,
  not the reason to choose it. The shared validator (Fork 2) cross-checks a `supersededBy` target resolves.
- *Rejected* — **B — One richer W3C-style `status` enum** (`active`/`superseded`/`obsolete`/`rescinded`). Reads
  as the more expressive option, but (i) fuses two orthogonal facts into one mutually-exclusive field — it cannot
  represent state 4 (dead *and* superseded) without a second field, the exact deficit A avoids; (ii) is a
  strawman against *real* W3C, which itself carries a lifecycle status **plus** separate supersedes pointers (i.e.
  closer to A than to a single enum); (iii) mints new jargon over platform terms already in the tree, for no
  capability the two-marker model lacks. Its only genuine merit-edge is making *kind of death* queryable
  (rescinded vs obsolete vs merely-dead) where A's `retiredReason` is freeform — but that serves aggregation
  needs absent here (zero `rescinded` references; #585's sweep emits death/moved/404, which map to the triplet).
  Reconsider only if a future need for the `rescinded` (license-withdrawn) distinction actually appears.

## Fork 4 — scope of this slice

**Crux:** structured JSON homes can carry enforceable fields; freeform `reports/*.md` and
`research-descriptions/*.njk` prose cannot. What does *this* slice cover?

- **A — Structured JSON homes now; freeform = documented style only. ✅ default.** Apply the convention to the
  five structured homes (corpus, references, blocks/intents design-system refs, presence rows) where the shared
  validator can enforce it. For freeform prose, document the recommended inline style (e.g. annotate a dead link
  in place rather than deleting it) but enforce nothing — and defer *structured extraction* of prose citations
  to [#597](/backlog/597-reference-registry-substrate-index-the-structured-reference-/) (the reference-registry
  substrate), which already scopes itself to the structured homes first with freeform extraction deferred. Keeps
  this slice shippable and non-overlapping with #597.
- *Rejected* — **B — Include freeform extraction now.** Pulling reference citations out of markdown/Nunjucks
  prose into a structured, retire-able form is exactly #597's job; doing it here duplicates that substrate work
  and balloons a size-5 convention slice. Out of scope.

---

## Context

**Where this sits.** A child of epic
[#583](/backlog/583-external-reference-health-monitoring-liveness-retirement-rep/) (reference-health
monitoring), seeded by [#546](/backlog/546-corpus-source-fast-has-a-dead-docsurl-fast-docs-decommission/)
(the corpus `retired` shape). Sibling of [#585](/backlog/585-reference-liveness-detection-sweep-multi-modal-404-moved-arc/)
(active liveness sweep — the *detector* that will emit these markers) and
[#597](/backlog/597-reference-registry-substrate-index-the-structured-reference-/) (the reference-registry
substrate). `blockedBy: ["583"]` — the epic frames the three-layer constellation decomposition this slice's
"dogfood layer" scoping depends on; the convention's *content* is independent and prepared here regardless.

**Classification — data governance, not a WE standard.** Like #546, #584 governs the project's *internal
reference data*, not a project-facing standard (the platform-strategy *setting* is #583's later layer-2 slice).
The 7-question layer sequence (Block / Intent / Protocol / Capability) is N/A. The binding principles are
native-first vocabulary reuse (borrow `retired`/`supersededBy`/`deprecated`, don't mint jargon),
reproducibility under [#192](/backlog/192-longitudinal-research-freshness-system/) (keep-not-delete so a re-run
sees *why* a reference left), bias-toward-separation (orthogonal markers over a fused enum), and
most-permissive default (the metadata is opt-in, never a required field).

**On resolution** (the `/next decision` turn, not now): apply the ratified field-set to the structured homes,
add the shared `validateRetirementShape` helper + call sites in
[check-standards-rules.mjs](../scripts/check-standards-rules.mjs), document the convention, and confirm the
freeform-style note. No `researchTopics.json` supersedes-chain migration is needed under the default (Fork 3-A
reuses the existing field).

---

## Ruling (2026-06-14)

**All four forks ratified at their bold defaults: 1-A (one uniform field-set), 2-A (one documented convention
+ one shared validator helper), 3-A (two orthogonal markers — death triplet + `supersededBy`), 4-A (structured
homes now; freeform = documented style only).** Fork 3 was the one genuine call; resolved on **merit** (not
adoption cost): death and supersession are two independent facts and a single `status` enum is mutually
exclusive — it cannot represent the dead-*and*-superseded state (FAST). The enum's only unique advantage
(queryable retirement-*kind*) serves an aggregation need absent in this repo (zero `rescinded` references).

**Shipped:**
- `validateRetirementShape(entry, { label, resolveSupersededBy })` in
  [check-standards-rules.mjs](../scripts/check-standards-rules.mjs) (+ 9 unit tests).
- Call sites in [check-standards.mjs](../scripts/check-standards.mjs) §6a-ter over the four structured homes
  (corpus sources, `references.json` links, `designSystemResearch` refs on blocks+intents, capability-presence
  rows); `supersededBy` resolved against corpus source ids. `researchTopics.json` keeps its own bidirectional
  rule (richer topic-id pointer space).
- Convention documented in [docs/agent/reference-retirement.md](../docs/agent/reference-retirement.md) (+ AGENTS.md
  routing row); freeform prose = documented annotate-in-place style, structured extraction deferred to #597.

## Progress

- **Status:** resolved
- **Done:** all four forks ratified; shared validator + call sites + docs shipped; gate green (0 errors, 105 unit tests pass).
- **Next:** none — #585 (liveness sweep) will emit these markers; #597 owns freeform extraction.
