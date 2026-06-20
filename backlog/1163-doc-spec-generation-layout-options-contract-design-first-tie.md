---
type: decision
workItem: story
size: 3
parent: "1038"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#configurability-partition"
preparedDate: "2026-06-20"
relatedReport: reports/2026-06-20-webdocs-doc-spec-generation-contract.md
tags: [webdocs, docs-as-code, generation-contract, conformance-vectors, decision-prep]
relatedProject: webdocs
---

# Doc Spec — generation layout + options contract (design-first, Tier-C)

WE-layer **Doc Spec** (webdocs): define the generation-layout + options **contract** the FUI generator
(`fui:webdocs/generator.ts`, from #424) conforms to. Tier-C child of the #1038 webdocs spec-surface epic.

## Digest

Grounded in the [Web Docs Doc Spec prior-art survey](/research/webdocs-doc-spec-generation-contract/)
([report](../reports/2026-06-20-webdocs-doc-spec-generation-contract.md)) — the navigation/options
contracts of the six leading docs generators (Mintlify, Docusaurus, VitePress, Astro Starlight,
Storybook, TypeDoc), constrained by the **#091 docs-as-code ruling**.

The webdocs *product* is built (#424/#425/#427) but its **WE-layer spec is greenfield**: `webdocs` is a
`status: poc` stub on the WE side ([we:src/_data/projects/webdocs.json](../src/_data/projects/webdocs.json))
with **no WE code surface** — the only running impl is FUI's generator. So this is a contract authored
*over a shipped impl*, not drawn cold, and the original item's "not file:line-groundable" blocker is
resolved: the forks ground against `fui:webdocs/generator.ts` + the statute layer. Three genuine forks
survive the standing test; everything else is settled by prior ruling, invariant, or is prioritization.

## Axis-framing

The shipped generator already pins most of the contract, *implicitly*, and that is the axis: the Doc Spec
makes those choices **normative WE contract** or leaves them impl-private. `WebManifest { id, name,
description?, blocks? }` ([fui:webdocs/generator.ts:83-89](../../frontierui/webdocs/generator.ts#L83)) has
exactly one layout-bearing field — `blocks?`, an optional ordered block-id list. `generateDocsSite`
([fui:webdocs/generator.ts:112-118](../../frontierui/webdocs/generator.ts#L112)) fixes the layout rules:
pages follow `manifest.blocks` order else stable id order; a non-empty `blocks` is the **scope source of
truth**; a manifest block with no cases still yields an (empty) page. The output is a **flat**
`DocsSite { pages: DocsPage[] }` data model ([:92-103](../../frontierui/webdocs/generator.ts#L92)) — not
rendered HTML. There are **zero options** (the pure `(manifest, cases) → DocsSite` signature).

The survey places this on the **derived ↔ authored** spectrum of docs-generator contracts: Mintlify's
single `docs`/`mint` JSON config (pure declarative single-manifest) is the docs-as-code archetype #091's
single-source-of-truth points at; Docusaurus/Starlight are the hybrid (declarative + `autogenerate{directory}` + frontmatter
override); Storybook/TypeDoc are fully derived from source. Hierarchy is universal at the sidebar level
(flat survives only in top nav) — so the generator's flat shape is the *immature* one, and
flat-vs-hierarchical is **now-vs-later**, not which-is-correct. The placement of the contract is settled
by the **#817/#855 statute** (types + golden conformance vectors → WE as `@webeverything/contracts/webdocs`
per #239/#700/#872; all runtime → FUI) — not a fork.

### Recommended path at a glance

Ratify all three rows, or override just the one you'd change. Confidence says where judgment is actually
needed vs. where to nod. The forks are unified by one boundary — see *Contract vs configuration boundary*
below. **webdocs is an implementer-general standard; FUI is the *reference* implementer, not "the
engine."** Configurability splits along the **declarative/imperative line**, not along FUI-vs-not: a
**declarative strategy vocabulary** (sort/group/filter/order as data) is part of the WE standard,
golden-vector-locked, and reproducible across *any* conforming implementer (FUI, a .NET/Go generator);
**imperative custom functions** are a per-implementer **escape hatch** — inherently non-portable, so using
one is an explicit graceful-degradation opt-out of cross-implementer reproducibility for that aspect. So
the WE contract freezes envelopes + the **default** mapping + determinism + the **declarative vocabulary**
(grown on demand); reproducibility is multi-implementer over the declarative surface, degrade-gracefully
over the imperative one. Unlimited configurability at two levels, standard stays runtime-agnostic.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · contract strength** | conformance-lock the **defaults + declarative strategy vocabulary** (implementer-general, golden-vector-locked); **imperative custom functions are a per-impl escape hatch** (non-portable, graceful-degradation) | thin type-only contract, even defaults are impl freedom *(rejected — breaks #091 no-drift on the default path)* | **High** (lock); **Med** (declarative vocab depth) |
| **2 · navigation model** | declarative-manifest authority + derived fallback: manifest is the authoritative TOC; blocks omitted ⇒ derive from cases, alphabetic | pure-derived (Storybook), no manifest authority *(rejected — contradicts #091 scope-SoT)* | **High** |
| **3 · options locus** | fold into the manifest as an open declarative `docs.*` extension; meta-schema standardized, not the list | a separate imperative `DocsOptions` argument *(rejected — second source that drifts)* | **Med-High** |

## Fork 1 — contract strength: conformance-locked spec vs thin type-only contract

*Fork exists because:* the thin type-only branch is **coherent but excluded** — it cannot satisfy #091's
requirement that Plateau-hosted docs not drift from self-hosted output (the "cancel and self-host always
holds" guarantee is empty if the two generators produce different sites from the same input). A standard
that ships only input/output *interfaces* and leaves the manifest→site mapping to each impl breaks that
guarantee. So this is a real either/or: lock the mapping, or don't.

- **(A — recommended) Conformance-lock the defaults + a declarative strategy vocabulary; imperative
  functions are a per-implementer escape hatch.** WE owns, **implementer-general**: the **default**
  manifest→`DocsSite` mapping (blocks = scope SoT; alphabetic fallback; empty-page completeness) + the
  data-shape envelopes + the determinism invariant + a **declarative strategy vocabulary** (sort / group /
  filter / order expressed as *data*, e.g. `docs.order` pin, `sort by field then field desc`), and ships a
  **golden conformance-vector suite** — `(manifest, cases) → expected DocsSite` pairs over the default path
  *and the declarative vocabulary* on the established kit
  ([we:conformance-vectors/schema.ts](../conformance-vectors/schema.ts), pattern
  [we:conformance-vectors/validator-resolution.vectors.ts](../conformance-vectors/validator-resolution.vectors.ts),
  #899/#1016). **Any** conforming generator — FUI, a future .NET/Go generator — is **byte-equivalent** over
  that declarative surface, because it is portable data, not code. **Imperative custom functions** (a JS
  `SortStrategy`, etc.) are a per-implementer **escape hatch**: inherently non-portable, so a manifest that
  uses one opts that aspect *out* of cross-implementer reproducibility (another implementer can't run it →
  declares non-support / falls back to the declarative default — graceful degradation, the escapable lock).
  Determinism within one implementer is **impl-enforced**, mirroring the in-repo precedent — the
  module-service generator emits twice and throws `NonDeterministicBackendError` if outputs differ
  ([we:blocks/renderers/module-service/generation/generate.ts:7-8,47-48](../blocks/renderers/module-service/generation/generate.ts#L7),
  #463). Cost: the default mapping + the declarative vocabulary become a frozen, versioned contract; the
  vocabulary grows on demand (promotion path below).
- **(B) Thin type-only contract** — WE ships `WebManifest`/`WebCases`/`DocsSite` interfaces only; **even the
  default mapping** is each generator's private behavior. Lighter still, but two generators produce
  different sites from one *bare* manifest, breaking #091's no-drift floor and the docs-as-code
  reproducibility that is the offering's whole point. *Rejected* — (A) keeps the contract thin (defaults +
  a *small, growable* declarative vocabulary) without surrendering the reproducible floor.

*Confidence: High* on locking the defaults. *Med* on the vocabulary-depth sub-call below.

*Sub-call — how much declarative vocabulary to standardize now (NOT a vendor-vs-vendor fork).* The
design is fixed: declarative vocabulary = WE (implementer-general, portable); imperative functions =
per-impl escape hatch (non-portable, degrade-gracefully). FUI is the **reference** implementer, not a
required engine. The only open knob is **how much vocabulary to standardize up front** vs leave to the
escape hatch and **promote later**: **(recommended) start minimal** — a small declarative vocabulary
(order/group/sort-by-field) in v1, FUI's imperative escape hatch covers the long tail today, and a
high-value option is **promoted into the declarative vocabulary** when real demand or a second implementer
appears (open-system growth, *Intents Open Design* — grow the *vocabulary*, not "FUI's private knobs").
The alternative — standardize a large vocabulary up front — is speculative work for a hypothetical second
implementer. *Confidence: Med (~75%);* residual = the v1 vocabulary's exact span. Separately, golden
vectors do not pin *rendered* output (rendering is FUI's, #817; vectors stop at the `DocsSite` model).

## Fork 2 — navigation model: declarative-manifest authority vs pure-derived

*Fork exists because:* the pure-derived branch (Storybook's "the content's own structure *is* the nav,
no manifest authority") is a **coherent, shipped model elsewhere** but is **excluded by #091** — which
makes the customer's `webmanifest` the source of truth for scope. The two cannot coexist: either the
manifest is authoritative over the TOC or the content is. The survey shows both are real industry choices,
so the deciding agent must consciously affirm the manifest-authority one rather than inherit it.

- **(A — recommended) Declarative-manifest authority, with scope and order as two decoupled axes.**
  `manifest.blocks` is the **authoritative scope set** — which blocks become pages — exactly as the
  generator's scope-SoT rule already does
  ([fui:webdocs/generator.ts:112-118](../../frontierui/webdocs/generator.ts#L112)); omitting it
  auto-includes every block present in the cases (most-permissive default). **Order is a separate axis**,
  *not* folded into the `blocks` list: an optional `manifest.docs.order` (the Fork-3 `docs.*` namespace) is
  a **partial pin** — listed ids lead in that order, the remainder follows the frozen alphabetic
  tiebreaker. Omit both ⇒ everything, alphabetic; pin a prefix ⇒ those first, rest alphabetic. This
  decouples "everything but in my order" / "pin an intro page first" from having to enumerate the whole
  scope — the limitation the shipped `blocks`-does-double-duty shape cannot express. It is the Mintlify
  single-manifest archetype plus the Docusaurus/Starlight autogenerate fallback. Cost: changes the shipped
  semantics (today `blocks` *order* is the TOC order) — the generator + its golden vectors change; cheap
  now (POC), but a real behavior change to record. No filesystem-folder-derived hierarchy in v1 (see
  *Supported by default*).
  - *Sub-call (scope/order decoupling) — recommend the **full decouple** (`blocks` = scope only) over the
    **minimal** shape (`blocks` stays order-bearing; `docs.order` applies only when `blocks` is omitted).
    Full decouple makes scope and order genuinely orthogonal — one axis, one field; the minimal shape's
    "order means a different thing depending on whether `blocks` is present" is conditional semantics that
    ages badly. ~75%; residual is whether a consumer needs the shipped `blocks`-order behavior preserved
    for compat.*
- **(B) Pure-derived, no manifest authority** — the docs structure is emergent from the cases (Storybook
  title-path model); the manifest contributes only identity. Lowest authoring friction, but the manifest
  is no longer the scope source of truth, contradicting #091's ratified docs-as-code model. *Rejected.*

*Confidence: High* on manifest-authority. **Refined in discussion:** scope and order are split into two
decoupled axes — `manifest.blocks` = scope, `manifest.docs.order` = a declarative order-pin (Fork-1
vocabulary) with the frozen alphabetic remainder. The fallback tiebreaker is part of the **default**
mapping (frozen contract — see *Contract vs configuration boundary*); `docs.order` is a declarative,
implementer-general option. Open sub-call: full vs minimal decouple (~75% full).

## Fork 3 — options locus: fold into the manifest vs a separate options contract

*Fork exists because:* both branches are coherent and **genuinely cannot coexist** — you cannot
simultaneously hold "the manifest fully determines the output" (single source) and "a separate options
object also determines the output." One must own presentation. The standing *bias toward separation*
pulls one way; #091's single-source-of-truth pulls the other; that tension is the fork.

- **(A — recommended) Fold into the manifest as a declarative `docs.*` slot — a two-level options surface,
  implementer-general.** Presentation knobs — **page order (`docs.order`, the worked example from
  discussion)**, case ordering, grouping, future hierarchy, per-page options — live under a
  `manifest.docs.*` namespace, declarative data in the one manifest (preserving #091 single-source — one
  reviewable artifact fully determines the site, the Mintlify per-node-field model). The surface has **two
  levels**: (i) options expressed in the **WE declarative strategy vocabulary** (Fork 1) are
  **implementer-general and golden-vector-locked** — any conforming generator honors them identically; (ii)
  an option naming an **imperative custom function** is a per-implementer **escape hatch** carried in the
  same slot as an opaque reference, interpreted only by an implementer that supports it. The generator's
  pure `(manifest, cases) → DocsSite` signature is unchanged. The project config extends a default-less base
  (*Config-Extends-Platform-Default*). Cost: presentation and identity share one file (the manifest), so
  the manifest envelope (owned by webmanifests, #1161) must reserve the webdocs-namespaced slot.
  - *Who owns what.* The **declarative vocabulary** is **WE's** (implementer-general, portable, vectored).
    The **interpretation runtime + the imperative escape-hatch execution** is the **implementer's** (FUI as
    reference; a .NET generator its own) — all-runtime-→-FUI (#817/#855) names FUI as *an* implementer, not
    the engine. webmanifests (#1161) treats `docs.*` as an **opaque pass-through** namespace; webdocs owns
    the declarative vocabulary's *meaning*. Degradation rule: a generator that cannot run a declared
    imperative strategy must **degrade loudly** (declare non-support / fall back to the declarative
    default), never silently differ. New declarative options are **promoted into the WE vocabulary** on
    demand (Fork 1 sub-call) — growing the *vocabulary*, not "an implementer's private knobs."
- **(B) A separate imperative `DocsOptions` argument** — a distinct options object passed to the
  generator alongside the manifest, splitting "what to document" (manifest) from "how to lay it out"
  (options), the TypeDoc/Storybook scope-vs-presentation separation. Cleaner conceptual split and the
  *separation bias*'s default, **but** it re-introduces a second source of truth that can drift from the
  manifest — the served site no longer reproducible from the manifest alone, weakening #091's guarantee.
  The separation the survey praises is scope-vs-presentation *within* one declarative artifact, which (A)
  delivers without a second runtime input. *Rejected.*

*Confidence: Med-High* on fold-into-manifest over a separate `DocsOptions` arg. **Refined in discussion:**
the `docs.*` slot is a two-level surface — WE-declarative-vocabulary options (implementer-general, vectored)
+ imperative-function escape hatch (per-impl, non-portable). webmanifests (#1161) reserves the namespace as
opaque pass-through; webdocs owns the declarative vocabulary's meaning; the implementer owns interpretation
+ escape-hatch execution. The how-much-vocabulary-now choice is the Fork-1 sub-call, not re-decided here.

---

## Contract vs configuration boundary — implementer-general standard, FUI is the reference impl

The partition runs along the **declarative/imperative line**, not "FUI vs not-FUI": **webdocs is a
runtime-agnostic standard** (constellation premise + the polyglot/forward-adapter goal — a .NET/Go
generator is a first-class possibility), and FUI is the **reference** implementer, not the engine. The WE
contract freezes the **envelopes + default mapping + determinism + a declarative strategy vocabulary**, all
**implementer-general and portable** (data, not code); everything else is a per-implementer escape hatch.
The shipped generator already draws the I/O seam: `fetchSource` is injected ("the transport is the caller's
to supply", [fui:webdocs/generator.ts:133-150](../../frontierui/webdocs/generator.ts#L133)) while
`generateDocsSite`/`resolveWebcasesInput` are pure. Four layers:

- **1 — WE contract, frozen (golden-vector-locked, implementer-general).** The data-shape envelopes
  (`WebManifest`, `WebCases`, `DocsPage`, `DocsSite`); the **default** mapping (scope selection, the
  alphabetic fallback tiebreaker, empty-page completeness — what a *bare* manifest produces); the
  determinism invariant; and the **declarative strategy vocabulary** (sort/group/filter/order as data).
  Golden vectors cover the default path **and** the vocabulary. **Any** conforming generator is
  byte-equivalent here — this is the portable, multi-implementer core. Changing it = a versioned change.
- **2 — Per-implementer escape hatch (imperative, non-portable).** An option naming an **imperative custom
  function** (FUI: a JS `SortStrategy`; a .NET generator: a C# one). Inherently non-portable — code, not
  data — so using one **opts that aspect out of cross-implementer reproducibility**: an implementer that
  can't run it **degrades loudly** (declares non-support / falls back to the declarative default). This is
  where "people have strong preferences about every aspect" is satisfied without bloating the standard;
  popular escape-hatch options are **promoted into layer 1's vocabulary** on demand.
- **3 — Vendor-injected DI seam (drift-safe).** The transport `FetchSource(input) → RawCases`. Produces
  *inputs into* the mapping and provably cannot change `DocsSite` given the same resolved `(manifest,
  cases)`, so any generator vendor may swap it freely. The contract pins the *interface* + *resolved shape*;
  the fetch mechanism and the *set of kinds* (`git | bundle | registry`, extensible) are impl/open. Matches
  the *Runtime DI vs Devtools Provider* test.
- **4 — Impl-private (outside the contract entirely).** The renderer `DocsSite → HTML`, theming, nav chrome,
  search. The reference impl (FUI) owns its rendering (#817); golden vectors stop at the `DocsSite` model.

**The distinction that resolves "custom sort function — contract or impl?":** it depends on whether the
option is **declarative or imperative**. A declarative sort (`sort by field, desc`) is **layer 1** — WE
vocabulary, portable, every implementer honors it. An **imperative** custom sort *function* is **layer 2** —
a per-implementer escape hatch, non-portable by nature, used with eyes open that another implementer will
degrade to the default. Net: the standard stays thin **and runtime-agnostic** (envelopes + defaults +
declarative vocabulary), configurability is unbounded at two levels (portable declarative + per-impl
imperative), and #091 holds across *any* implementer over the declarative surface, degrade-gracefully over
the imperative one.

## Supported by default (no fork — invariant, prior ruling, or prioritization)

- **WE/impl placement** — type contracts + declarative-vocabulary + golden vectors → WE
  (`@webeverything/contracts/webdocs` subpath on [we:contracts/package.json](../contracts/package.json),
  type-only re-export per the [we:contracts/lifecycle.ts](../contracts/lifecycle.ts) pattern); all runtime →
  the implementer (FUI as the **reference** impl; a future .NET/Go generator holds its own). The #817/#855
  statute, applied — ratify, don't re-litigate.
- **Distribution** — `@webeverything/contracts/webdocs`, type-only, #239/#700/#872 end-state.
- **Resolver / input shape** — `git | bundle | registry` behind one contract
  ([fui:webdocs/generator.ts:122-151](../../frontierui/webdocs/generator.ts#L122)); already settled by
  #091 Fork 1's sub-decision. Not re-opened.
- **Flat vs hierarchical (v1)** — **flat now, contract reserves a forward-compat hierarchy extension
  point.** The survey says hierarchy is the mature end-state (flat survives only in top nav), so
  "which is correct" is settled (hierarchical, eventually); flat-now-vs-hierarchical-now is therefore
  *prioritization* (now vs later), not a merit fork — and prioritization is decided at what-to-build-next
  time, not in the fork. v1 ships the flat shape matching the generator + the #1161 "carry richer fields,
  not drop them" theme (reserve, don't preclude). Build hierarchy when a consumer demands it.
- **The webdocs/webmanifests/webcases seam** — the Doc Spec *references* the base manifest envelope
  (webmanifests, #1161) and the case pivot (webcases, #1162); it owns only the docs-layout interpretation
  (the `docs.*` extension namespace + the mapping rules). No schema duplicated across the three specs.

## Per-fork classification (7-question pass)

- **Layer:** contract (types + vectors) → WE; mapping runtime → FUI (#817/#855).
- **Protocol or intent dimension:** a generator-conformance protocol, not a UX intent.
- **Expose the whole axis:** yes for options (Fork 3) — open meta-schema, default-less, project-extends.
- **Fixed mechanic or dimension:** navigation model (Fork 2) is a fixed mechanic (manifest authority is
  baked; pure-derived is excluded, not a co-equal end-state). Hierarchy depth is a deferred dimension.
- **DI-injectable:** the resolver transport (`fetchSource`) is injected; the mapping rules are not (they
  are the normative contract).
- **Most-permissive default:** yes — omitting `manifest.blocks` auto-includes every case block; an
  explicit `blocks` list is the author's opt-in restriction.
- **Seam between intents:** webdocs/webmanifests/webcases — each spec owns its own envelope; webdocs owns
  only the orchestration/layout interpretation.

## Progress

- **Status:** active — under discussion, NOT yet ratified.
- **Done:** prepared to DoR (3 forks + prior-art survey). Discussion refinements folded in: (1) scope/order
  decoupled into two axes in Fork 2 (`blocks` = scope, `docs.order` = order; full-decouple ~75%);
  (2) **webdocs is an implementer-general standard, FUI is the *reference* impl** — configurability splits
  along the **declarative/imperative line**: WE freezes envelopes + **default** mapping + determinism + a
  **declarative strategy vocabulary** (portable, vectored, multi-implementer), and **imperative custom
  functions are a per-impl escape hatch** (non-portable, graceful-degradation); the false (a)-vs-(b) binary
  is dissolved, recast as a **how-much-vocabulary-now** sub-call (~75%, start minimal + promote on demand);
  (3) boundary section rewritten to *Contract vs configuration boundary* (4 layers, implementer-general);
  Fork 3 reframed — `docs.*` is a two-level surface (WE declarative vocab + per-impl imperative escape).
  Grounding re-verified against `fui:webdocs/generator.ts`. *(Reverses the earlier "FUI owns the whole
  engine" framing — corrected to keep the standard runtime-agnostic.)*
- **Next:** red-team the defaults (declarative/imperative partition, Fork-3 separation-bias vs #091, full-
  vs-minimal decouple, v1 vocabulary span) on an explicit ratify go, then resolve + carve build slices.
- **Notes:** all three forks recommend (A). Open sub-calls: v1 declarative-vocabulary span [Med ~75%] and
  full-vs-minimal scope/order decouple [~75%]; both lean as written.

## Preserved context (original item)

WE-layer Doc Spec (webdocs): define the generation-layout + options contract the FUI generator (#424,
`fui:webdocs/generator.ts`) conforms to. NOT batchable yet — no WE code surface exists (webdocs is a POC
project stub), so the seams are not file:line-groundable. Needs a design-first pass (survey + a
/research/ topic, constrained by the #091 docs-as-code ruling) before build slices can be carved. Tier-C
child of the #1038 webdocs spec-surface epic.
