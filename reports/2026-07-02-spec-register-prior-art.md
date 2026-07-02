# Spec register prior art — how real spec ecosystems publish normative standards, and what WE already has

**Date**: 2026-07-02
**Point**: Prior-art survey for decision #2096 (spec home + skeleton house style + scope policy for normative WE specs, gating epic #2079) — W3C/WHATWG/TC39/IETF house styles + design-system component specs, grounded against the four in-repo prose surfaces; findings published as [/research/spec-register-prior-art/](/research/spec-register-prior-art/).
**Research page**: `/research/spec-register-prior-art/`

---

## Question

Where does a W3C-spec-shaped normative write-up live for each of the 279 WE registry standards, in what
skeleton/house style (RFC-2119 boilerplate, conformance classes, error model, interface notation), and which
standards owe one at which maturity tier? No normative surface exists today — zero RFC-2119 language in any
registry entry (epic [we:backlog/2079-author-w3c-spec-shaped-normative-standards-for-every-we-stan.md](../backlog/2079-author-w3c-spec-shaped-normative-standards-for-every-we-stan.md)).

## Recommendation

- **Home**: a new one-file-per-standard normative spec collection (`we:src/_includes/spec-descriptions/<category>/<id>.njk` +
  paginated detail pages on the [we:src/research-topic-pages.njk](../src/research-topic-pages.njk) pattern),
  gate-required per the lifecycle-derived scope rule — no new registry field — in the gate idiom of the
  block/plug/research description partials ([we:scripts/check-standards.mjs](../scripts/check-standards.mjs):137-147).
  The spec partial becomes the standard's *single* normative home (existing surfaces keep explainer prose and
  transclude/link it — a migration clause that deliberately supersedes the protocol-body-in-project-page rule,
  recorded with lineage). The explainer/spec split is the universal prior-art pattern; in-place authoring is
  rejected on register-uniformity merit (the intents surface is an inline JSON HTML string, statute-capped away
  from type shapes/registries).
- **Register**: a house-adapted W3C register — fixed section skeleton, RFC 8174 boilerplate, two named
  conformance classes (implementation · document/author), the #2074-shaped conformance-case + typed-error
  table as the mandatory spine, requirements pinned to the observable surface contract only (per
  `#surface-contract-not-computation`), and TypeScript in a defined declaration subset as the single interface
  notation.
- **Scope**: spec obligation derives from the existing lifecycle badge — `active` ⇒ required (an explicit,
  owned amendment of the promotion bar; the 76 current actives are the migration work-list), `draft`/`experimental` ⇒
  permitted + required-for-promotion, `concept` ⇒ exempt (normative prose over unratified design fabricates
  requirements). Pilot = CustomNodeRegistry (#2097), settled by enumeration (the only standard with a ratified
  conformance spine); it exercises the permitted arm — the required arm is first exercised by wave 1.

## Key Findings

### External prior art (the spec-ecosystem survey)

1. **Explainer ≠ spec — every mature ecosystem separates them.** TC39 proposals pair a README explainer with an
   ecmarkup normative document; WICG pairs an explainer with a Bikeshed spec; WAI keeps the APG (guidance)
   distinct from the ARIA spec (normative). The normative artifact is always its own document with its own URL,
   never a section grafted onto the intro prose. WE's existing block/plug descriptions and intent `description`
   fields read as explainers.
2. **W3C/WHATWG house style is tool-enforced boilerplate, not hand-typed.** Bikeshed (and ReSpec) auto-inject
   the conformance section, style RFC-2119 keywords, validate inline WebIDL (`<pre class=idl>`), and autolink
   `<dfn>` terms across specs. The reusable lesson is not "adopt Bikeshed" but "make the skeleton + boilerplate
   a template the author cannot vary" — the register is enforced by construction, mirroring how WE's shared
   badge macros already work.
3. **Conformance classes are named, and requirements are addressed to a class.** W3C specs (per the QA
   Framework / SpecGL) state who each MUST binds: user agent vs author vs authoring tool. The WE mapping is
   **implementation** (FUI or any vendor building the contract) vs **document/author** (a page using the
   standard) — this is exactly the WE↔FUI boundary, so conformance-class discipline keeps every requirement on
   the observable side of it.
4. **RFC 8174 superseded bare RFC 2119 boilerplate**: keywords are normative only in ALL CAPS. Modern W3C/IETF
   boilerplate cites both ("BCP 14"). Adopting 8174 up front avoids the lowercase-"must" ambiguity in prose-heavy
   pages.
5. **The platform's error model is typed-and-named.** WHATWG specs throw named `DOMException`s or `TypeError`
   from numbered algorithm steps (conventions defined once in the Infra standard). The #2074 conformance table
   ([we:backlog/2074-customnoderegistry-node-kind-extensibility-standard.md](../backlog/2074-customnoderegistry-node-kind-extensibility-standard.md):145-162)
   — enumerated well-formed cases + a typed error per rejected input — is already this shape.
6. **Interface notation: WebIDL is an engine-binding language.** W3C uses WebIDL because browser engines
   generate bindings from it. TC39 uses its own ecmarkup grammar. Component ecosystems (Fluent's per-component
   spec markdown files, Open UI proposals) specify anatomy/states/API in prose + TypeScript-ish signatures. WE's
   consumers are TS-reading implementers and framework adapters; every existing WE contract surface is already TS
   (`{% highlight "typescript" %}` in plug descriptions and protocol bodies).
7. **Spec text is a maturity-stage entry requirement, not a birthright.** TC39: initial spec text required at
   stage 2, complete text at 2.7, tests + implementations before 4. W3C: a FPWD may be rough, but CR demands
   complete normative text + implementation experience. Nobody writes MUST prose for a stage-0 sketch — the
   direct precedent for exempting `concept` entries.
8. **Living-standard editing with a dated audit trail.** WHATWG maintains one evergreen document per standard,
   edited in place; IETF instead versions via Obsoletes/Updates chains. WE already has both halves: registry +
   descriptions refine in place ([we:docs/agent/design-first.md](../docs/agent/design-first.md):34), and the
   research-topic supersession model ([we:docs/agent/research-workflow.md](../docs/agent/research-workflow.md):49-73)
   is the RFC-style dated chain. No new mechanism needed — specs are living; history lives in reports.
9. **Design systems do NOT publish implementor-conformance specs.** Material/Carbon/Ant publish usage guidelines;
   component libraries publish API references. Only WAI-ARIA APG and Open UI approach normative register, and
   neither ships a typed-error model. A WE spec register with a #2074-style error spine is genuinely
   differentiating, not catch-up.

### In-repo ground truth (the four surfaces, corrected)

- **Blocks** — 81 entries ([we:src/_data/blocks/](../src/_data/blocks/)), 83 partials in
  [we:src/_includes/block-descriptions/](../src/_includes/block-descriptions/); real explainer prose with
  contract tables (e.g. autocomplete's trait-selection table) but zero RFC-2119 register.
- **Intents** — 98 entries ([we:src/_data/intents/](../src/_data/intents/)); JSON-only, spec renders from an
  inline HTML `description` field; **statute forbids conformance/technical content there**
  ([we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md):464 `#intents-ux-only`;
  [we:docs/agent/design-first.md](../docs/agent/design-first.md):160-165).
- **Plugs** — 59 entries; **correction to #2096's premise**: a plug is *not* only a bare 10-line registry entry —
  every plug also has a gate-required `we:src/_includes/plug-descriptions/<id>.njk`
  ([we:scripts/check-standards.mjs](../scripts/check-standards.mjs):141-143; 59 partials exist), typically with a
  TS interface block already.
- **Protocols** — 41 entries ([we:src/_data/protocols/](../src/_data/protocols/)); no partial dir — the normative
  body lives in the owning project page under a stable anchor
  ([we:src/_includes/project-webcomponents.njk](../src/_includes/project-webcomponents.njk):424).
- **Lifecycle census** (for the scope ladder): blocks 39 active / 30 draft / 12 concept; intents 6 active /
  57 draft / 35 concept; plugs 31 active / 26 concept / 2 experimental; protocols 0 active / 14 draft /
  27 concept. So "spec required at `active`" = **76 specs owed now**, and protocols owe zero until one reaches
  `active`.
- **Collision fact forcing category-qualified spec ids**: `audit-trail` exists in both
  [we:src/_data/blocks/](../src/_data/blocks/) and [we:src/_data/protocols/](../src/_data/protocols/) — a flat
  `/specs/<id>/` keyspace collides; the home must be `<category>/<id>`. (An earlier draft mis-cited the pair as
  intent+protocol; the skeptic pass corrected it to block+protocol.)
- **The wiring pattern to copy**: [we:src/research-topic-pages.njk](../src/research-topic-pages.njk):2-11
  (pagination size 1, per-entry permalink) + the one-file-per-topic loader
  ([we:src/_data/researchTopics.js](../src/_data/researchTopics.js), #1145). A new `/specs/` route segment must
  be added to the Vite proxy allowlist ([we:vite.config.mts](../vite.config.mts):135;
  [we:docs/agent/design-first.md](../docs/agent/design-first.md):229-235 — `check:standards` cross-checks it).
- **Statutes already governing this turf**: `#single-authoring-sot-derived-projection`
  ([we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md):1267) — single-home discipline
  (supporting context; its own scope is declarative-form vs serializable-view of one artifact);
  `#surface-contract-not-computation` (:912) — a WE standard pins the observable surface contract, never the
  computation — the bound the register's requirements section must encode; `#non-verdict-conformance-matcher`
  (:387) + `we:conformance-vectors/` — the machine-readable conformance surface already exists; the prose error
  table cross-references it, never duplicates it; `#intent-conformance-is-block-compliance` (:497);
  `#constellation-placement` (:67 — WE holds zero implementation: a spec is definition, so it is WE-side by
  construction). The declared-over-auto-derived convention
  ([we:docs/agent/block-standard.md](../docs/agent/block-standard.md):554 `#custom-node-recipes` rule 4) is
  scoped to CustomNode close-grammar house style — it does not authorize a mandated per-entry `spec` field,
  which the prep accordingly dropped (obligation derives from the lifecycle badge).
- **Pilot readiness**: CustomNodeRegistry has a ratified conformance spine (#2074) and codified statute
  ([we:docs/agent/block-standard.md](../docs/agent/block-standard.md):554-581) but **no registry entry yet**
  (no `we:src/_data/plugs/customnoderegistry.json` exists) — #2097 must mint the entry so the spec artifact has
  a registry row to hang off.

## Files Created/Modified

| File | Action |
|---|---|
| `we:reports/2026-07-02-spec-register-prior-art.md` | created (this report) |
| `we:src/_data/researchTopics/spec-register-prior-art.json` | created — research topic registry entry |
| `we:src/_includes/research-descriptions/spec-register-prior-art.njk` | created — published survey write-up |
| `we:backlog/2096-spec-register-home-skeleton-house-style-and-scope-policy-for.md` | rewritten to prepared-fork shape; `relatedReport` re-pointed here (prior split-analysis report cited in body) |
