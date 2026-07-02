---
kind: decision
parent: "2079"
status: open
relatedReport: reports/2026-07-02-spec-register-prior-art.md
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
preparedDate: "2026-07-02"
tags: [spec-register, normative-specs, rfc-2119, conformance, house-style]
---

# Spec register — home, skeleton house style, and scope policy for normative WE specs

**Prepared for ratification.** No normative spec surface exists today (zero RFC-2119 language across all 279
registry standards), so this is greenfield: the three forks below are grounded in a spec-ecosystem prior-art
survey (W3C/WHATWG · TC39 · IETF · design-system component specs) published as the
[spec-register-prior-art](/research/spec-register-prior-art/) research topic (session report via
`relatedReport`), each with a recommended default in **bold**. Ruling them sets the home, the register, and the
work-list for every authoring wave of epic
[#2079](/backlog/2079-author-w3c-spec-shaped-normative-standards-for-every-we-stan/).

The concern decomposes into three orthogonal axes. **Home** — the four categories author prose on four
different surfaces today, and the repo's own statutes name those surfaces contract-bearing (design-first: "the
website is the spec"): blocks via [we:src/_includes/block-descriptions/](src/_includes/block-descriptions/)
partials (83, called the block's "behavioral spec",
[we:docs/agent/design-first.md](docs/agent/design-first.md):138); intents via an inline HTML `description`
field in the JSON entry ([we:src/_data/intents/action.json](src/_data/intents/action.json)) that the statute
bars from carrying implementation refs — conformance tiers, DI, type shapes, registries
([we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md):464 `#intents-ux-only`;
[we:docs/agent/design-first.md](docs/agent/design-first.md):160-165); plugs via a registry entry **plus** a
gate-required `we:src/_includes/plug-descriptions/<id>.njk` mandated to carry the interface/contract definition
([we:scripts/check-standards.mjs](scripts/check-standards.mjs):141-143;
[we:docs/agent/design-first.md](docs/agent/design-first.md):155 — 59 partials exist; the original "bare 10-line
stub" premise was wrong); protocols via a section of the owning project page, named their canonical home
([we:docs/agent/design-first.md](docs/agent/design-first.md):50,125;
[we:src/_includes/project-webcomponents.njk](src/_includes/project-webcomponents.njk):424). **Register** — the
skeleton, RFC-2119/8174 boilerplate, conformance classes, error model (shape template: the
[#2074 conformance table](/backlog/2074-customnoderegistry-node-kind-extensibility-standard/), lines 145-162 of
[we:backlog/2074-customnoderegistry-node-kind-extensibility-standard.md](backlog/2074-customnoderegistry-node-kind-extensibility-standard.md)),
and interface notation — bounded by `#surface-contract-not-computation`
([we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md):912). **Scope** — which of the 279
entries (81 blocks / 98 intents / 59 plugs / 41 protocols; active = 39/6/31/0 = 76) owe a spec at which
lifecycle tier ([we:docs/agent/design-first.md](docs/agent/design-first.md):217-221, the one canonical
lifecycle).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1** — the normative authoring home | **a new one-file-per-standard spec partial (category-qualified) that becomes the single normative home for an in-scope standard — existing surfaces keep explainer prose and transclude/link it; rendered at `/specs/<category>/<id>/`** | keep authoring normative content inside the four existing per-category surfaces | med-high |
| **Fork 2** — skeleton + house style | **house-adapted W3C register: fixed skeleton, BCP-14 (RFC 2119 + 8174) boilerplate, implementation/document conformance classes, #2074-shaped typed-error table, observable-surface requirements only, TypeScript (a defined declaration subset) notation** | full W3C-clone (WebIDL + Infra-style processing models) | high |
| **Fork 3** — scope + maturity policy | **the spec obligation derives from the one lifecycle badge: `active` ⇒ required (an explicit amendment of the promotion bar; the 76 current actives are the migration work-list), `draft`/`experimental` ⇒ permitted + required-for-promotion, `concept` ⇒ exempt; pilot = CustomNodeRegistry (#2097)** | an independent spec-maturity axis per entry | high |

## Fork 1 — the normative authoring home: one spec partial per standard

*Fork-existence:* the **rendered** surfaces compose (one partial can be transcluded into the standard's
existing page *and* render at a dedicated URL — support-both, see below), but the **authoring** home cannot: a
normative sentence lives in exactly one file, and "a new uniform artifact class" vs "the four existing
per-category surfaces" are two coherent, mutually exclusive homes for it — a genuine either/or decided on
merit.

**Crux.** Mature spec ecosystems separate the explainer from the normative document (TC39 README vs ecmarkup
document; WICG explainer vs Bikeshed spec; ARIA APG vs the ARIA spec). WE's surfaces are today *mixed* — mostly
explainer prose, with real contract fragments embedded (the plug Interface sections, e.g.
[we:src/_includes/plug-descriptions/customtextnoderegistry.njk](src/_includes/plug-descriptions/customtextnoderegistry.njk):7-16;
the protocol bodies). The register needs one uniform, citable home across all four categories, and the keyspace
must be category-qualified (`audit-trail` exists as both a block and a protocol —
[we:src/_data/blocks/audit-trail.json](src/_data/blocks/audit-trail.json) /
[we:src/_data/protocols/audit-trail.json](src/_data/protocols/audit-trail.json)).

- **(a) A new one-file-per-standard spec partial as the single normative home** *(recommended)* — one
  normative partial per in-scope standard at `we:src/_includes/spec-descriptions/<category>/<id>.njk`, rendered
  to a dedicated `/specs/<category>/<id>/` page by a size-1 pagination template (the
  [we:src/research-topic-pages.njk](src/research-topic-pages.njk):2-11 pattern) and gate-required per the Fork 3
  scope rule ([we:scripts/check-standards.mjs](scripts/check-standards.mjs):137-147 idiom). **With the
  migration clause the single-source-of-truth discipline forces:** when a standard's spec is authored, the spec
  partial becomes its *only* normative home — the existing description keeps non-normative explainer prose and
  transcludes or links the spec; a plug's Interface section moves into (or transcludes) it; a protocol's
  normative body moves out of the owning project page into it, the project page keeping the anchor as a
  transclusion/link. That last move deliberately **supersedes** the "protocol body lives in the owning project
  page" rule ([we:docs/agent/design-first.md](docs/agent/design-first.md):50,125) — recorded with lineage at
  codification, never silently. Merits: one register enforced by construction across all four categories
  (including intents, whose inline JSON HTML string cannot reasonably host a multi-section register and whose
  description is statute-capped away from type shapes/registries); a stable citable URL per spec
  (precedent-consistent with the explainer/spec split); no dual authoring home for any contract fact.
- **(b) Keep authoring normative content inside the four existing per-category surfaces** — *Rejected on
  merit:* coherent (it is today's statute position for plugs/protocols), but it fragments the register into
  four structural conventions — an intent's register would live inside an inline JSON HTML string capped by
  `#intents-ux-only` (no type shapes/registries — content a full normative spec needs the moment the intent's
  contract touches events or interfaces), a protocol's inside another page's section — so the "every spec reads
  the same way, enforced by construction" property (the register's core merit, and the survey's cross-ecosystem
  law) is structurally unreachable; and each mixed page keeps normative and explainer prose interleaved, which
  is exactly the ambiguity RFC-2119 registers exist to remove.
- **(c) A structured JSON conformance field as the home** — *Rejected as the home:* processing-model and
  conformance prose do not serialize into structured fields (every surveyed ecosystem authors normative text as
  a document). The machine-readable half **already exists and stays**: the conformance-vector suite
  (`we:conformance-vectors/`, compared under the closed matcher vocabulary of
  [we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md):387
  `#non-verdict-conformance-matcher`) — the spec's error table and the vectors must cross-reference, never
  duplicate (see Supported by default).

**Example (Fork 1 (a))** — keyed to the real wiring. No new registry field: the collection derives from the
partials + the four registries (scope is governed by Fork 3's badge rule):

```njk
{# we:src/spec-pages.njk — the research-topic-pages.njk pattern, size-1 pagination #}
---
pagination: { data: specs, size: 1, alias: spec }
permalink: "specs/{{ spec.category }}/{{ spec.id }}/"
layout: base.njk
---
{% include "spec-descriptions/" + spec.category + "/" + spec.id + ".njk" %}
```

(`specs` is a small loader that pairs each `we:src/_includes/spec-descriptions/<category>/<id>.njk` with its
registry entry and fails on an orphan partial; the standard's existing page gains a "Normative spec" link
and/or transcludes the same partial. The new `/specs/` route segment is added to the Vite proxy allowlist at
[we:vite.config.mts](vite.config.mts):135, which `check:standards` cross-checks per
[we:docs/agent/design-first.md](docs/agent/design-first.md):229-235.)

Skeptic: SURVIVES-WITH-AMENDMENT → the attack split authoring-home from rendered-surface (rendering is
support-both via transclusion — folded in); killed the "(b) is statute-broken" claim (`#intents-ux-only` bars
implementation refs, not UX-scoped MUSTs) — (b) is now rejected on register-uniformity merit; demoted the
:1267 citation from fork-existence authority to supporting context (its own scope is declarative-vs-serializable
of one artifact); and forced the migration clause — the first draft's "nothing migrated" left plug Interface
sections and protocol bodies as dual normative homes, the exact drift the cited statute names, and left the
protocol-home rule (we:docs/agent/design-first.md:50,125) unreconciled; the default now supersedes them with
lineage.

## Fork 2 — skeleton + house style: the normative register

*Fork-existence:* most register ingredients are settled by precedent (BCP-14 boilerplate is the universal
keyword rule; TS is the incumbent contract notation on every existing WE surface) — the residual genuine
either/or is the **single normative interface notation and fixed section list of the one house register**: a
register is one register, so full-WebIDL-and-Infra vs the house adaptation cannot coexist as the mandated form,
and a keyword sprinkle with no skeleton is the named broken branch (nothing testable, nothing gateable).

**Crux.** The surveyed ecosystems enforce their register by construction (Bikeshed/ReSpec/ecmarkup/xml2rfc
templates), name their conformance classes (SpecGL), use BCP-14 keyword boilerplate, and throw typed named
errors from normative requirements (WHATWG conventions). WE already has the error-model template — the #2074
conformance table
([we:backlog/2074-customnoderegistry-node-kind-extensibility-standard.md](backlog/2074-customnoderegistry-node-kind-extensibility-standard.md):145-162)
— and a hard boundary the register must encode:
[we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md):912
`#surface-contract-not-computation` — a WE standard pins the observable surface contract, never the
computation behind it.

- **(a) House-adapted W3C register** *(recommended)* — a fixed skeleton every spec follows: **status line**
  (lifecycle + links to explainer/registry entry) → **non-normative intro** (one paragraph) → **Conformance**
  (BCP-14 boilerplate — RFC 2119 as amended by RFC 8174, keywords normative only in ALL CAPS — plus the two
  named conformance classes: *implementation* (FUI or any vendor building the contract) and *document/author*
  (a page using the standard)) → **Terminology** (binds terms to the glossary, `we:src/_data/semantics.json` —
  the existing hard rule, never redefined locally) → **Interface definitions** (TypeScript, in a **defined
  declaration subset**: interface/type-alias declarations, method + property signatures, union and literal
  types, `readonly` — no generics-variance, conditional, or mapped types in normative signatures; throw
  behavior is normative in the error table, not the type) → **Observable behavior requirements**
  (MUST/MUST-NOT addressed to a named class and pinned to the *observable surface contract* — states, events,
  reflected attributes, typed errors — never the computation behind it, per `:912`; stepwise numbering is
  permitted only where the observable ordering is itself the contract) → **Conformance cases & error model**
  (the #2074-shaped table: enumerated well-formed cases + one typed, named error per rejected input;
  cross-referenced to the standard's conformance vectors) → **Web standards alignment** (the existing house
  table format, [we:docs/agent/design-first.md](docs/agent/design-first.md):201-210) → **Lineage** (the
  ratifying decision + statute anchors). Merit: the platform-faithful register (classes, keywords, typed
  errors) in the notation WE's actual conformance class reads — the *implementation* class consumes TS
  contracts today, and class-addressed MUSTs keep every requirement on the observable side of the WE↔FUI
  boundary.
- **(b) Full W3C-clone (WebIDL + Infra-style processing models + Bikeshed tooling)** — *Rejected on merit:*
  WebIDL's normative semantics (`[CEReactions]`, `enforceRange`, binding coercions) govern browser-engine
  binding behavior that WE's JS-level registry/class contracts do not exercise — for this register it is
  vocabulary without referent, while the parts that matter (signatures, throws) are carried by the TS subset +
  typed-error table; and Infra-style processing models mandate internal computation, which `:912` forbids WE
  specs to pin. The platform-shape steelman (WE proposals take the closest native shape, #1983) governs the
  *proposed contract's shape*; at an actual standards-body submission the register's derived WebIDL translation
  is the boundary artifact (the internal-spelling pattern as supporting context, not authority).
- **(c) Minimal keyword sprinkle (MUST/SHOULD added to existing prose, no fixed skeleton)** — *Rejected (broken
  branch):* with no conformance-class addressing and no typed-error spine there is nothing an implementation
  can be tested against and nothing a gate can require — it decorates explainers instead of creating specs
  (the #2074 lesson: the enumerated-cases + typed-errors table *is* the conformance substance).

**Example (Fork 2 (a))** — the skeleton as a spec partial, keyed to the pilot's ratified content:

```njk
{# we:src/_includes/spec-descriptions/plugs/customnoderegistry.njk #}
<p class="spec-status">Normative · explainer: /plugs/customnoderegistry/</p>

<h2>Conformance</h2>
<p>The key words MUST, MUST NOT, SHOULD, and MAY are to be interpreted as described in
BCP 14 (RFC 2119, RFC 8174) when, and only when, they appear in all capitals.</p>
<p>Two conformance classes: an <dfn>implementation</dfn> (builds the contract) and a
<dfn>document</dfn> (authors against it).</p>

<h2>Interface</h2>
{% highlight "typescript" %}
interface CustomNodeRegistry {
  define(node: typeof CustomNode): void;
  whenDefined(open: string): Promise<typeof CustomNode>;
}
{% endhighlight %}

<h2>Observable behavior</h2>
<p>An implementation MUST reject a class that sets both <code>static value</code> and
<code>static children</code> by throwing <code>AmbiguousPayloadError</code>.</p>

<h2>Conformance cases &amp; errors</h2>
<table><tr><th>Case</th><th>Verdict</th><th>Error</th></tr>
  <tr><td>both value and children set</td><td>reject</td><td><code>AmbiguousPayloadError</code></td></tr>
  <tr><td>children without regionClose</td><td>reject</td><td><code>MissingRegionCloseError</code></td></tr></table>
```

Skeptic: SURVIVES-WITH-AMENDMENT → the attack surfaced the uncited `#surface-contract-not-computation` (:912)
colliding with the first draft's "Processing & behavior requirements" section — renamed and constrained to the
observable surface contract, computation never mandated, and the statute now reconciled in the item; the
undefined "WebIDL-translatable subset" was made a concrete declaration-subset definition; the WebIDL rejection
was re-derived on merit (vocabulary-without-referent + :912) after the attack correctly struck the
zero-consumer demand-gate and "forks the notation mid-register" (migration-cost) arguments; the platform-shape
(#1983) steelman is answered in the option text.

## Fork 3 — scope + maturity policy: who owes a spec, when

*Fork-existence:* blanket "full MUSTs for all 279 now" is broken — normative prose over unratified `concept`
designs asserts requirements no ruling backs; its stub-spec variant fabricates nothing but is refuted on merit
below; the surviving either/or — obligation derived from the one canonical lifecycle vs a second per-entry
spec-maturity axis — cannot coexist: two ladders would give one standard two public maturity truths.

**Crux.** TC39 makes spec text a stage-entry requirement (initial at stage 2, complete at 2.7); W3C's CR
demands complete normative text — and in both ecosystems that ladder **is the standard's single public
maturity axis**, not a second axis beside one. WE likewise has exactly one badge
(`concept → draft → experimental → active`,
[we:docs/agent/design-first.md](docs/agent/design-first.md):217-221). Census against it: `active` = 39 blocks +
6 intents + 31 plugs + 0 protocols = **76 specs owed**; protocols owe zero until one matures.

- **(a) The spec obligation derives from the lifecycle badge** *(recommended)* — `active` ⇒ a normative spec
  is **required** (an `active` entry without a spec partial is a conformance error); `draft` / `experimental` ⇒
  a spec is **permitted and encouraged** (encoded by simply authoring the partial early — no new registry
  field, no sub-states), and **required to be promoted to `active`** (the stage-entry rule); `concept` ⇒
  **exempt** (nothing ratified to assert). **This deliberately amends the `active` promotion bar** — until now
  the badge asserted readiness with zero conformance text; the ruling makes the badge's "ready" include "its
  contract is normatively stated," recorded as a statute amendment with lineage at codification, and the 76
  existing actives become the enumerated migration work-list (carved per-category by re-running `/slice 2079`
  per [we:reports/2026-07-02-backlog-split-analysis.md](reports/2026-07-02-backlog-split-analysis.md)) — owned
  as the ruling's cost, not hidden as rollout mechanics. The ruling also **extends the lifecycle statute's
  enumeration to protocols explicitly** (their entries already carry the statuses in data; the statute's own
  sentence omits the category) — orthogonal to the protocol temporal rule (internal until a 2nd independent
  impl conforms), which governs protocol *graduation*, not spec obligation. **Pilot confirmed:
  CustomNodeRegistry ([#2097](/backlog/2097-pilot-normative-spec-customnoderegistry-2074-in-the-ratified/))**
  — settled by enumeration: the only standard whose conformance spine is already ratified (#2074) and codified
  ([we:docs/agent/block-standard.md](docs/agent/block-standard.md):554-581). Honestly scoped: #2097 must mint
  the missing plug registry entry (no `we:src/_data/plugs/customnoderegistry.json` exists) at `draft`/
  `experimental` under zero-impl reality — so the pilot exercises the *permitted* arm (register + home + page
  wiring); the *required* arm and the gate's error path are first exercised by authoring wave 1 over the 76
  actives.
- **(b) An independent spec-maturity axis per entry** (a second status field tracking spec progress separately
  from the standard's lifecycle) — *Rejected:* two public maturity truths per standard. The W3C/TC39 steelman
  actually cuts the other way: their document ladder is the standard's *only* public maturity axis — the
  analogue of WE's one badge — not a parallel axis beside an implementation ladder. What (b) uniquely encodes
  (a complete spec on a `draft` standard) branch (a) already encodes by the partial's presence; finer
  document-workflow states (drafting/complete) are working notes, not registry truth.
- **(c) Blanket coverage — all 279 now** — *Rejected:* in its full form it writes MUST/MUST-NOT prose over
  unratified `concept` designs — asserting requirements no ruling backs (the broken branch). Its steelman —
  a *stub* spec per entry ("no normative requirements ratified yet"), which fabricates nothing — fails on
  merit: under (a) the lifecycle badge already carries exactly that information (`concept` ⇒ not owed), so
  universal stubs are a redundant encoding that dilutes the register (a /specs/ catalog where ~100 pages
  assert nothing erodes the citability and trust the register exists to create — a UX/correctness-of-signal
  merit, not an effort argument).

**Example (Fork 3 (a))** — the gate rule, in the existing check-standards idiom
([we:scripts/check-standards.mjs](scripts/check-standards.mjs):137-147); obligation derives from the badge, no
per-entry field:

```js
// active ⇒ spec partial required; any partial ⇒ entry must be past concept
for (const e of allRegistryEntries) {
  const has = hasDesc(`spec-descriptions/${e.category}`, e.id);
  if (e.status === 'active' && !has)
    err(`Standard "${e.category}/${e.id}" is active but has no normative spec (Fork 3 (a): active ⇒ spec required)`);
  if (has && e.status === 'concept')
    err(`Standard "${e.category}/${e.id}" is concept but carries a spec partial (nothing ratified to assert)`);
}
```

Skeptic: SURVIVES-WITH-AMENDMENT → the attack caught the first draft's `spec` field + `normative-draft`
sub-states as the rejected axis (b) sneaking back in *and* in cross-tension with Fork 1's declared-scoping —
both dropped (obligation now derives from the one badge; the partial's presence is the pre-active opt-in);
the retroactive effect on the 76 actives is now owned as an explicit promotion-bar amendment with a migration
work-list, not waved as rollout mechanics; the blanket-*stub* steelman is refuted on redundancy/signal merit
instead of only the weakest full-MUSTs variant; the stretched `#faithful-derivation-exclude-not-fabricate`
citation was struck (the refutation needs no statute costume); and the pilot's arm-coverage gap is stated
honestly in the default.

## Supported by default (not forks)

- **Rendered surfaces compose** — the one spec partial can render at its dedicated `/specs/<category>/<id>/`
  URL *and* be transcluded into the standard's existing page; both are supported, neither is a second
  authoring home.
- **Living-document editing** — specs refine in place like every website surface
  ([we:docs/agent/design-first.md](docs/agent/design-first.md):34); the dated audit trail lives in
  reports/research supersession ([we:docs/agent/research-workflow.md](docs/agent/research-workflow.md):49-73).
  Settled by statute, not a fork.
- **Explainer prose coexists with the spec** — the existing descriptions keep the non-normative overview,
  usage, and research tables; only *normative* content (interfaces, conformance requirements, error models)
  migrates to the spec home under Fork 1 (a)'s migration clause.
- **Machine-readable conformance stays with the vector suite** — `we:conformance-vectors/` under the closed
  matcher vocabulary ([we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md):387) is already
  the machine-readable conformance surface; the spec's error table cites the standard's vectors and vice
  versa — prose register and vector suite are two faces of one contract, never two authoring homes for one
  fact.
- **Terminology** — every normative term registers in the glossary (`we:src/_data/semantics.json`, the existing
  hard rule); the spec skeleton's Terminology section links, it never redefines.
- **Intent specs stay UX-scoped** — an intent's normative spec covers its UX contract (dimensions, values,
  observable states); block compliance against it is judged per
  [we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md):497
  `#intent-conformance-is-block-compliance`; implementation refs stay out per `#intents-ux-only`.

## Statute overlap (reconciled)

The rule this decision would codify — *"one gated normative spec home per standard; a fixed house register
pinned to the observable surface; obligation derives from the lifecycle badge"* — composes with, collides
where stated, and supersedes where stated: `#constellation-placement`
([we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md):67) — a spec is pure definition,
WE-side by construction; its conformance classes bind implementations elsewhere. `#intents-ux-only` (:464) +
`#intent-conformance-is-block-compliance` (:497) — honored by UX-scoping intent specs and homing them off the
intent description. `#single-authoring-sot-derived-projection` (:1267) — supporting context for the
one-normative-home discipline (its own scope is declarative-form vs serializable-view); the migration clause
is what actually enforces single-home here. `#surface-contract-not-computation` (:912) — encoded directly
into the register's requirements section (observable surface only). `#non-verdict-conformance-matcher`
(:387) — the vector suite remains the machine-readable conformance surface; the register cross-references it.
**Deliberate supersessions, recorded with lineage at codification:** the protocol-body home
([we:docs/agent/design-first.md](docs/agent/design-first.md):50,125 — body moves to the spec partial once
authored, the project page transcludes/links) and the `active` promotion bar
([we:docs/agent/design-first.md](docs/agent/design-first.md):217-221 — gains "normative spec present").
`#custom-node-recipes` ([we:docs/agent/block-standard.md](docs/agent/block-standard.md):554) — the pilot spec
*renders* the ratified #2074 rules into the register, it never re-opens them.

## Context

Carved from epic #2079 by the `/slice 2079` pass
([we:reports/2026-07-02-backlog-split-analysis.md](reports/2026-07-02-backlog-split-analysis.md) — the original
`relatedReport`, still the split's source of record; this item's `relatedReport` now points at the prep
session's prior-art report). Blocks [#2097](/backlog/2097-pilot-normative-spec-customnoderegistry-2074-in-the-ratified/)
(the pilot applies the ratified skeleton) and, transitively, every per-category authoring wave #2079 will carve
after the pilot calibrates effort-per-spec. The codify step of ratification authors the skeleton partial +
boilerplate as statute-adjacent artifacts, per the epic's plan.
