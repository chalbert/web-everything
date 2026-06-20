# Platform Decisions — the standing rules (statute)

This file is the **source of truth for cross-cutting platform rulings**: the reusable rules that
govern *how* the constellation is built, promoted out of the ratified decisions in `backlog/`.

**Two layers, one discipline:**
- **Case law** — `backlog/*.md` `type: decision` items. Each records *one* call and *why* (the
  deliberation, the forks, the lineage). Immutable history.
- **Statute (this file + the topical `docs/agent/*.md`)** — the *rule* a decision established,
  stated once, named, and citable. This is what you read and cite when a new question lands.

> **Why this exists:** a 2026-06-18 sweep of all 166 resolved decisions found **64% were
> "case-law-only"** — the rule lived *only* in its backlog file, so each new instance re-derived
> the same axis instead of citing it. The worst offender was constellation placement (10 decisions
> re-deciding one test). The fix is this file plus a promotion discipline, below.

## How to use this file

1. **Before opening a new `type: decision` for a placement / naming / monetization / boundary
   question, check here first.** If a named rule covers it, the "decision" is just *applying* the
   rule — cite it, don't re-litigate. If the rule genuinely doesn't reach your case, the new
   decision records only the *novel* wrinkle and then extends the rule here.
2. **When you ratify a decision that establishes (or refines) a reusable rule:** state the rule in
   the relevant section here (or the topical doc), then set `codifiedIn:` on the decision's
   frontmatter pointing at it. The decision item keeps the lineage; this file carries the rule.
3. Rules are **reversible** (see [backlog-workflow.md](backlog-workflow.md) → reversibility). A
   reversal supersedes the rule here *with lineage* ("supersedes #NNN because …") — never erase it.

## Promotion discipline (enforced)

- `codifiedIn:` is a frontmatter field on `type: decision` items. Value = the guideline path that
  carries the rule (e.g. `docs/agent/platform-decisions.md#constellation-placement`), **or** the
  sentinel `one-off` for a narrow call that establishes no reusable rule (the analogue of
  `graduatedTo: none`).
- **Hard gate at resolve.** `node scripts/backlog.mjs resolve <NNN>` **refuses a `type: decision`
  that has no `codifiedIn`** — pass `--codified-to=<doc#anchor>` (the CLI stamps the field) or
  `--codified-to=one-off`. You cannot resolve a decision and walk away from its rule; the orientation
  is captured at the moment the deliberation is freshest, not in a later sweep.
- **`check:health` (`scripts/audit-backlog-health.mjs`) flag G6** is now the catch-up pool for the
  **legacy** decisions resolved *before* the gate existed. The count is the un-promoted backlog; it
  should only ever shrink. (New decisions can't add to it — the gate blocks them.)
- **Cite the rule, not the case.** When a work item leans on a settled orientation, link the **named
  rule here** (`platform-decisions.md#<anchor>`), not the originating `#NNN`. The decision file holds
  the lineage for an archaeologist; day-to-day work cites the statute so the rule, not the deliberation,
  is what propagates. A bare `#NNN` reference to a *codified* decision is a smell — replace it with the
  anchor.
- The full per-decision codification status is the register at
  `audits/2026-06-18-decision-codification-register.md` (regenerate via the
  `decision-codification-sweep` workflow).

---

## The standing rules

### Constellation placement {#constellation-placement}

**The test — where does a thing live (WE / Frontier UI / Plateau)?**
1. Code that **defines a contract** (types, protocol, conformance vectors) **or is consumed by a
   WE-side conformance gate** (`check.ts`) → **Web Everything**. Code that **delivers a capability
   at runtime** (registry-dispatching, artifact-producing, a running handler — incl. `assert*`,
   constants, engines, native-default strategies) → **Frontier UI**. A served, credential-holding
   product → **Plateau**. **Reference-implementation tier (#1078):** the WE *repo* may
   *additionally* host a **non-published reference runtime** — an executable spec consumed only by
   WE's own conformance demos/tests (a standard's DoD-mandated playground; generalises the block
   reference-runtime carve-out in [we-fui-embed-boundary](#we-fui-embed-boundary) rule 4 to
   subsystem engines) — even though it "delivers at runtime"; FUI still ships the *production* impl,
   the reference impl carries no lock-in (swappable; the contract is the only lock), and the
   `@webeverything` *package* stays types-only (rule 3, unchanged). The carve-out is the **repo**,
   never the **published package**, and never inverts the WE→FUI source arrow.
2. **The file seam is the cut:** `contract.ts` (pure types, compile-erased) → WE; `provider.ts` +
   `registry.ts` (runtime) → FUI. Split mixed modules *mid-file* at this seam.
3. **Distribution end-state:** FUI consumes WE contracts via a WE-published type-only package
   (`@webeverything/contracts`, one entry per subsystem); byte-replication is the interim. The
   contract crosses the seam; code never does. `@webeverything` = standard artifacts only, never
   imports FUI.
4. **Managed offerings decompose** across the constellation — there is no single "home" decision:
   standard→WE, primitives/adapters→FUI, served product→Plateau, open-core by usage.
5. **An impl/substrate is not a standard** (e.g. a native `base-select`): it registers as a
   `capabilityMatrix` resolver impl, not a new protocol; the work it implies is a deferred build.

*Soft sub-rule — locus tagging:* backlog items carry an explicit `locus:` field (WE / frontierui /
plateau-app / exercise-app); items gate in their own locus so cross-repo batches stay locus-agnostic.

**Lineage:** #730 #817 (the per-file define-vs-deliver holding) · #606 (plugs runtime → FUI) ·
#641 (block-protocol impl boundary) · #779 #426 #799 #497 #834 · #804 #872 #239 (contract package) ·
#091 (managed-offering decomposition) · #020→#291 (impl-is-not-a-standard) · #1078 (reference-impl
tier — refines #817: published-package purity vs repo-internal reference runtime).

### WE ↔ Frontier UI rendering & embed boundary {#we-fui-embed-boundary}

**WE never imports or renders FUI block code.** FUI owns the implementation *and* its rendered
display (its own site + demos, FUI branding).
1. **iframe-only:** WE embeds FUI-hosted demos via the `fuiDemo` iframe convention — no
   `frontierui` Vite alias, `@frontierui/*` never in WE `node_modules`. Cross-repo *import* is ruled
   out.
2. **Narrow relaxation (sanctioned, gated):** a future trust-gated, WE-FUI-only, runtime-SDK,
   Shadow-DOM-isolated **mode C** is allowed; it does not puncture impl ownership (FUI still
   renders) — only the iframe *mechanism* requirement relaxes. iframe stays the default.
3. **Escape/overlay** (modals breaking the iframe box) is host-side over an origin-validated
   `postMessage` channel via a **FUI-owned embed SDK**; seed transport is URL-canonical + additive.
4. **Reference-vs-impl partition:** a block stays in WE *iff* its demo exercises a WE standard (it
   *is* that standard's reference runtime); a block-impl demo moves to FUI and is iframe-embedded.
5. **Chrome / workbench is FUI-owned**, decoupled from distribution; WE keeps only its
   standards-panel overlay.
6. **The WE *website* ≠ the WE *standard*.** The boundary constrains the *standard artifacts* and
   the *`webeverything` package* (no FUI **source** dependency; unidirectional WE→FUI) — **not** the
   WE-docs *website*, which is a downstream product/consumer free to render FUI **and** to run WE
   standard runtimes (e.g. booting the webbehaviors `CustomAttributeRegistry` in a mode-C shadow
   mount), exactly like any app. The test is **source-dependency direction, not runtime execution or
   rendered pixels**: a consumer page running FUI impl + a WE standard together is the dogfood, not a
   crossing. The one guard — the site consumes FUI by **runtime URL bundle** (mode C), *never* a
   build-time `import '@frontierui'` into its build; that import would invert the direction (#700/#239)
   and is the only thing that actually violates the boundary. So "does running a WE runtime in-document
   cross the boundary?" is answered *no* by construction — don't re-open it.

**Lineage:** #604 #701 #707 (iframe boundary; "WE renders real FUI blocks" is mis-framed) · #700 ·
#705 · #732 (escape SDK) · #765 (mode-C relaxation) · #788 (seed transport) · #791 (reference-vs-impl
partition) · #809 (workbench locus) · #932 (website≠standard; consumer may run WE runtimes in-document).

### Is it a Project / Protocol — or just an intent? {#project-protocol-bar}

**Not every gap is a Project or a Protocol.**
1. Mint a **Protocol** only when independent vendors must conform to one contract — i.e. there is a
   real **provider seam** *or* an **interchange schema**. Otherwise it is an intent + block.
2. Mint a **Project** only for a genuine cross-cutting domain with orchestration. "Already homed in
   an existing project" is a valid resolution — do not spawn a project per homed gap.
3. **Temporal rule:** ship as a Block now; extract a Protocol only once a *second* independent impl
   exists and the contract has stabilised.
4. A paradigm with no provider seam and no UX dimensions is a **semantics term**, not a
   protocol/intent.

**Lineage:** #015 #016 #011 #014 #409 #616 #634 · #041 (protocol-extraction timing) · #258
(paradigm → semantics) · #020→#291 · #1175 (deck placement: a deck is composition, not a domain —
no `webdecks` project; novel surface is a *cross-media advanceable-sequence* family homed in webintents,
shared with video/carousel; rule 2 + temporal rule 3 applied).

### Intents are UX-only; technical strategy → Configurator {#intents-ux-only}

Intents describe desired interaction (what/why) at project level — dimensions, states, events,
per-level contracts only. They carry **no implementation refs** (no conformance tiers, DI, type
shapes, registries — those belong to the block). Technical strategies become a **Technical
Configurator** domain. Borrow official platform vocabulary (`aria-sort`, `Intl.Collator`), never
coin away from native terms. Intents are an **open, never-finished system**: custom non-standard
intents must coexist conflict-free — standardize the meta-schema, not the list. Defaults are the
**most permissive** value; restriction is the author's opt-in.

**Lineage:** #030 (intent-vs-trait channel split) · #063 (native vocabulary) · #129 (guard intent
re-framed) · #634 · intents-open-design.

### Monetization line *(soft — explicitly revisitable)* {#monetization}

> Tiering/pricing rulings get a **lighter, revisitable** treatment than standards. Fix the
> *structural partition principle* firmly; treat specific knob placements as provisional.

1. The paid line is a **structural property — per-call cost OR hosted/credential-holding — never a
   category** (never price on a shifting axis like proprietary-vs-open).
2. **Open-core:** the open standard + open reference impl are free; hosted/managed/collab is paid.
3. **Plateau linear-cost rule:** cost must scale ~linearly with revenue — no uncapped per-call SDK
   inside flat-rate pricing; prefer owned **on-device fixed-cost** capability; BYO-key is a tier,
   not the floor.
4. **Vision / AI is never a WE standard** → see [§ no-leakage client](#no-leakage-client).

**Lineage:** #098 #185 (licensing / GTM) · #089–#093 #086 (open-core constellation) · #182 #183
(licensing/payments) · #451 (MaaS tier) · #775 (assembler open-core) · #410 #141 #166 · #665 #690
(self-driven framing). *Confidence: principle firm; specific knobs provisional.*

### Vision / AI = a Plateau no-leakage service client {#no-leakage-client}

Any **implementation capability** (vision, AI model inference) is **never a WE standard**. It is a
**Plateau service** that the WE project consumes as a **no-leakage client** — only the *outputs*
reach the standard, never the capability. Interim thin client seams repoint to Plateau. Harvested
candidates promote only through the human-ratified `/new-standard` flow.

**Lineage:** #475 #488 (#488: on-device fixed-cost floor + BYO-key bridge) · #396 · #086 + #314
(exercise-app conformance loop as the forcing function).

### Custom-element tagName naming {#tagname-naming}

1. **Element-ness is opt-in / authored:** a block declares `tagName` (0 / 1 / N tags); never
   auto-derived from type.
2. **Value = `<prefix>-<id>`**, default prefix `we-`, configurable via Config-Extends-Platform-
   Default (`fui-` excluded). FUI's irregular names migrate to conform.
3. Registration is **parameterized** (tag = contract default, never a hard-coded literal); the
   override hatch is consumer-side.
4. The convention **binds only global-registration modes** — deep JSX / compile-time consumption
   stays totally flexible.
5. The custom-element surface (`tagName` + attributes/properties/slots) is a **WE-owned contract in
   `blocks.json`**; FUI is one conforming implementation (not WE mirroring FUI's
   `customElements.define`).

Plus the standing naming rules (machine-checked): traits `with[Capability]` (never `use*`),
registries `Custom[Name]Registry`, injector domains start with `@`, event attrs `on:event`. WE
never *mandates* conventions — it ships a default vocabulary projects customize, enforced via
`webcompliance`. See [conventions.md](conventions.md).

**Lineage:** #841 (tagName convention) · #822 (CEM surface as contract) · #045 #046 · #063 #030 ·
#436/#437 (conventions-fold-into-compliance).

### Host back-reference property naming {#host-backreference-naming}

A host-attached object names its back-reference to the host **by the relationship's native /
semantic name — never a universal `target`**. `target`/`currentTarget` are reserved for transient
dispatch/observation (`Event`, `MutationRecord`), not persistent ownership, and collide with the
`e.target` a behaviour reads in its own listeners.

1. An `Attr`-derived host object (`CustomAttribute` + subclasses, which chain to `Attr.prototype`)
   uses **`ownerElement`** — the exact native `Attr.ownerElement`.
2. A non-attribute host-attached object (`Injector`, `CustomContext`, controllers) uses **`host`**
   (matches `ShadowRoot.host`, Lit `ReactiveControllerHost`, Angular host element).
3. **Name by semantics, not by uniformity:** two right names (`ownerElement` for `Attr`, `host`
   elsewhere) beat one wrong-but-uniform name — the web platform itself diverges this way
   (`Attr.ownerElement` vs `ShadowRoot.host`). A permanent dual name for one class is excluded; a
   deprecated alias getter for one cycle is a rollout tactic, not a second canonical name.

**Lineage:** #1121 (`CustomAttribute` → `ownerElement`, scoped to `Attr` subclasses) · #1042
(sibling `Injector`/`CustomContext` → `host`, open) · derived from [native-first
baseline](#native-first-baseline).

### Guard / Gate vocabulary {#guard-gate}

**Guard** gates a *transition*; **Gate** gates *presence*. Protocolize only the **provider +
predicate seam** as the single lock; each member (exit-guard #273, access #178) owns its
deny-outcome family. Enforcement is **server-side, never in the UX intent**. The next gate-shaped
feature is a *member* of the open Guard protocol, not a fresh abstraction.

**Lineage:** #272 (protocol) · #129 (navigation/exit guard) · #178 (access/authorization gate).

### `<component>` declarative-component (DC-N) decisions {#component-dc}

The `<component>` build-time transform's design calls are consolidated as a **DC-decisions
reference table in `src/_includes/block-descriptions/component.njk`** (the canonical block home).
Read the table before re-opening a `<component>` question. Covers: tag name (DC-1), shadow attr
(DC-2), registration timing (DC-3), reactive depth / binding (DC-4 / #792), scripting hook (DC-5),
toggle (DC-7), implicit/explicit template (DC-9/10/11), `attachInternals` (DC-12/13/14),
preserve-on-move (DC-15), scoped registration **off** `<component>` (#854 → carves #900/#901/#902),
toolchain reach (#127).

> Key sub-ruling (#854): `<component>` is a *build-time* transform (gone by runtime) so it **cannot
> host a runtime registry** — scoped registration lives off it, as a runtime declared-registry
> (`<script type=registry>`) + IDREF association + a CustomAttribute binding behavior. The
> `{{ }}` / `[[ ]]` expression-binding layer (`webexpressions`) already exists — reuse its grammar,
> not a new runtime.

**Lineage:** #039 #040 #042 #043 #044 #045 #046 #047 #074 #082 #084 #127 #792 #854.

### Compose an existing trait — don't hand-roll a covered pattern {#compose-dont-handroll}

A block/component **MUST compose an existing WE trait/behavior/contract for any capability a
standard already covers** (disclosure → `nav:section`, roving focus → `nav:list`). Hand-rolling an
interaction a registered trait provides (ad-hoc `addEventListener` re-implementing the pattern) is a
**conformance defect, not a style choice**. New behavior is allowed — but authored as a *new trait*
(a `CustomAttribute`), never as per-block event wiring.

**Advisory alone is insufficient** — the rule existed in spirit (authoring skills + `AGENTS.md`) and
still failed twice (`sectioned-nav` #870, `disclosure-nav` #931), so a **mechanical gate is
required**, not just a checklist. Enforced by two orthogonal mechanisms:
1. **Declaration** — a block records the traits it *consumes* in a `composesBehaviors` field
   (distinct from the `traits` it *provides*), projected into CEM `x-webeverything` and asserted to
   resolve against `src/_data/traits.json`. Mirrors the existing `composesIntents` field.
2. **Detection** — a `check:standards` gate (`validateBlockComposesTraits`, beside
   `validateBlockImplConformance`) runs a **curated "source-pattern → required-trait" deny-list**
   over FUI source (e.g. click/keydown on an `aria-expanded` head → must compose `nav:section`),
   **warn-first → ERROR** once curated (the #840/#844/#477 rollout precedent). Open-ended
   `addEventListener` sniffing is *rejected* (false-positive factory); declaration-only is *rejected*
   (can't catch a block that declares nothing and hand-rolls — the #931 mode). A *rendered* axe check
   **cannot** substitute: a hand-rolled disclosure is a11y-clean, so the defect is visible only in
   source + declaration → the gate is static.

The authoring pre-flight ("search the trait registry before wiring an interaction; compose, don't
re-implement") ships as the gate's **complement**, never as the enforcement. The declarative-only
end-state (trait-marked templates with no behavior code to hand-roll) is the long-term fix, sequenced
after #932/#934 — it removes the *temptation*; the gate catches what slips *now*.

**Lineage:** #933 (ratified 2026-06-18) · incidents #870 #931 · precedent #436/#437 (conventions
fold into compliance), #840/#844/#477 (warn-first rollout).

### A composition artifact is owned by its *new* substance; referenced parts stay home {#composition-artifact-ownership}

When a new artifact is a **composition of capabilities that already exist** across the constellation (a
record that *binds* an existing snapshot + journal + trace + identity into one consumable thing), do
**not** mint a new project or duplicate any part's format. The artifact is a **thin envelope that
references** the existing protocols; each referenced **payload schema stays owned by its existing
project**. Ownership of the *envelope* goes to the project of the artifact's **new substance** — the
one capability the composition actually adds (e.g. an *ordered timeline* of spans → the tracing
project) — **not** to the project that owns the heaviest referenced payload, and never to a brand-new
"consumer-composition" project (that fragments the constellation for no interop gain —
[minimize-lock-in](#constellation-placement)). When a fork asks "which project owns this composite?",
the answer is: locate the single new substance, own it there, reference the rest.

Corollary (determinism/observation records): when such a record must *replay*, anchor the determinism
guarantee on the **recorded state-diff journal** (re-apply diffs, run no app code) — bounded explicitly
to *journaled* state, with a snapshot↔journal consistency precondition and an off-journal-state-out-of-scope
boundary. Action/event **re-fold through handlers is not the determinism anchor** (it assumes handler
purity the platform can't guarantee); it is a valid *optional* behavioral-replay mode, and event-identity
is load-bearing only there and for **correlation**, never for journaled-state determinism.

**Lineage:** #992 (trace/replay substrate — envelope owned by webtraces, journal stays webstates,
determinism anchor = state-diff A; ratified 2026-06-19). Kin to [constellation-placement](#constellation-placement),
[compose-dont-handroll](#compose-dont-handroll), [surface-contract-not-computation](#surface-contract-not-computation).

### Mandate the surface contract, not the computation {#surface-contract-not-computation}

A WE standard normatively pins the **observable surface contract** — the hand-off shape, the regions,
the stable-id events — and **never the computation behind it**. Competing "models" that emit the same
surface are not separate models; they are **swappable provider strategies** (e.g. a `ValidityMergeRegistry`
resolver) that conform *iff* they leave the surface unchanged. So a state-derived engine, an event-driven
engine, and a degenerate/flat strategy all conform — conformance is the observable contract, never the
internal computation. When a fork looks like "which algorithm/model do we mandate?", the answer is almost
always: mandate neither, pin the surface, register both as strategies.

**Lineage:** #4 (validation validity-model & conformance-tier). Relates to [native-first-baseline](#native-first-baseline),
[forward-generation-adapters](#forward-generation-adapters) (both are "contract is the authority, impl is swappable").

### Export-shape drift: classify by coherence, resolve per-symbol by trim-or-build {#export-shape-drift}

When the export-shape gate (#170/#927) flags a `we:` contract `exports` symbol absent from the resolved
FUI barrel, it is a **source-of-truth call decided per symbol** — never one verdict for the whole block.
Classify each declared-but-absent symbol on **merit**: is it **load-bearing to the block's promised
coherence** — it delivers a capability the shipped core lacks (a *different mechanism*, not the same one
re-wrapped) → **build** the `locus: frontierui` impl and keep it declared — or is it
**additive/superseded/aspirational over an already-complete core** — sugar the impl never chose, or a
design it superseded → **trim** the contract `exports` array in place? The tell: a symbol that re-exposes
the *same* mechanism the core already ships (an optional element wrapper, a mixin form of a shipped base
class) is additive → trim; a symbol that adds a *capability the core cannot do* is load-bearing → build.
Cost (build size) is **excluded** from the classification — it only schedules a spawned build, never
selects the branch (an instance of *fork-is-not-a-prioritization-tool*). Reverse drift — the barrel exports
a symbol the contract omits — is a forced **add** (contract = barrel in both directions).

**Lineage:** #1165 (`tabs`/`transient-component` → trim; `view` show/if/switch → build via #1217; under
#904). Specializes [surface-contract-not-computation](#surface-contract-not-computation) for the
#1164/#927 export-shape arm.

### Native-first baseline floor {#native-first-baseline}

Standards **assume modern web-platform primitives are present** (Baseline-2024: FACE/`ElementInternals`,
`popover`, `:state()`/`CustomStateSet`, `:user-invalid`, anchor positioning) and treat anything below the
floor as **out of scope**. A spec stays **single-substrate** — it never carries a dual native-vs-shimmed
contract — and **polyfills are an opt-in enhancement layer the consumer adds**, never part of the standard.
This is the standards-level statement of the native-first default (`AGENTS.md` hard rule 6 carries the
day-to-day form; cite whichever fits).

**Polyfill-surface fidelity (corollary).** When you *do* ship a polyfill, its contract **is** the native
surface — it mirrors what the platform deliberately *omits*, not just what it provides. Don't add a method
the platform refuses to (e.g. no `downgrade()` on a `CustomElementRegistry` polyfill: native upgrade is
one-way and the registry is append-only with no `undefine`, so the symmetry the name implies doesn't
exist). A real per-subtree/teardown need is designed *then* as a **named, explicitly non-standard
extension** with documented semantics — never a mystery method whose name overpromises.

**Lineage:** #31 (polyfill baseline floor); #1103 (polyfill-surface fidelity / `downgrade()` omission).
Mirrors `AGENTS.md` rule 6 + the native-first authoring default.

### Shape a new contract's surface by platform idiom, not capability {#contract-surface-platform-idiom}

When inventing a **new** protocol surface, pick the API shape the platform already uses for that *kind* of
thing — and never justify a shape by a capability difference that does not exist. A relationship to another
element that is **declared by an IDREF attribute** is a **writable element-reference property**
(`popovertarget`/`popoverTargetElement`, `for`/`htmlFor`), **not** a method; only the **derived/resolved
chain** stays read-only (`parentNode`, `assignedSlot`, `label.control`). A new propagation/visibility concern
that is **orthogonal** to an existing platform flag gets its **own flag** — never an overload of the existing
one (`composedLogical`, not a reinterpreted `composed`). "Use a method so we get validation/events" is a
**non-reason**: an accessor's setter validates and fires events exactly as a method does, so decide on idiom,
not capability.

**Lineage:** #1000 (Web Portals contract shape — `logicalParent` writable element-reference property +
`composedLogical` separate flag; the capability-not-idiom trap was caught by author review). Refines
[native-first-baseline](#native-first-baseline) (this shapes *new* surfaces to the platform; that floors on
*existing* features) and relates to [surface-contract-not-computation](#surface-contract-not-computation) and
[compose-intent-dont-duplicate](#compose-intent-dont-duplicate) (Web Portals composes Focus Containment, Q3).

### Behavior activation lifecycle — connected ≠ active {#behavior-activation-lifecycle}

A behavior (webtraits `CustomAttribute`) has **two orthogonal states**: **connected** (in the DOM, via
`connected/disconnectedCallback`) and **active** (should actually run, via a shared `activate()`/`deactivate()`
lifecycle). They are independent — a connected behavior can be dormant. Activation boundaries **reuse native
attributes** (e.g. `inert` marks a dead-zone) rather than inventing markers; **auto-dormancy is scoped by
meaning** to interaction-driven behaviors only; and a per-usage `<trait>-active` override re-enables. The
lifecycle contract is specified **once** and consumed by every activation gate (visibility #221, inert
dead-zone #222) — gates don't each re-derive what "active" means.

**Lineage:** #221 #222 (behaviour activation / inert dead-zone). Distinct from [guard-gate](#guard-gate)
(predicate-gated *transitions*; this is behavior *run-state*).

### Forward (generation) adapters for polyglot reach {#forward-generation-adapters}

A WE standard projects **outward** into non-JS / enterprise runtimes (.NET, Java, Go) via a
**forward/generation adapter** — the inverse of an ingest adapter. The authority is a **language-neutral
contract/IR** (no language, *including JS*, is privileged); **generation is deterministic** (byte-identical
output; AI assists only at adapter-*development* time, never in the gen path or the gate); and a **shared
cross-language conformance suite gates every target's release**. The forward adapter is a WE `webadapters`
standard artifact; the generated origins are ecosystem impl, and any served product is Plateau (per
[constellation-placement](#constellation-placement)).

**Lineage:** #463 (ratified — polyglot MaaS origin generation) · builds #505/#506/#507. Relates to
[surface-contract-not-computation](#surface-contract-not-computation) (neutral contract is the SoT).

### Framework-free core; vendor frameworks segregated at the package boundary {#framework-free-core-vendor-segregation}

Frontier UI's **framework-free principle scopes to the core/floor packages only** — *not* identity-wide.
A framework-coupled vendor adapter lives in its **own published `@frontierui/<block>-<vendor>` package**, with
that vendor's framework as a **normal dependency of that package alone**, loaded **opt-in via a plain dynamic
`import()`** so the core's dependency tree stays *provably* framework-free. The whole mechanism is "a published
package + a dynamic import" — **no Module Federation**. If cross-deploy runtime sharing is ever needed, it uses
web-standard import-maps / Native-Federation, never webpack Module Federation (per the bundler-agnostic axis).

**Lineage:** #963 (Slate/React optional-dep fork). Refines — does not duplicate — [constellation-placement](#constellation-placement)
(WE/FUI/Plateau division); this is *intra-FUI* framework containment.

### Runtime-DI seam vs devtools provider seam {#runtime-di-vs-devtools-provider-seam}

A capability is a **runtime-DI standard seam** — a mandated `CustomXRegistry` or protocol — **only if
the running app or standard consults it at runtime** (#052/#081). A capability consulted by a **tool at
author / build time** (an upgrader analyzer, a version-migration *input adapter*, #094/#191) is a
**devtools provider seam**: plain injected providers, **never** a global mutable singleton or a mandated
protocol. The cargo-cult tells are a kinship doc-comment + a global mutable registry where a passed
provider would do — demote build-time providers *out* of the runtime-registry surface.

**Lineage:** #052/#081 (runtime registries the standard consults) · #094/#191 (upgrader analyzer / migration adapter = devtools provider seam).

### A multi-strategy concern is a configurable dimension; default extends the platform {#config-extends-platform-default}

When a concern has **more than one legitimate end-state** (e.g. auto-define: explicit / eager-barrel /
on-import / on-first-use / build-parse / declarative-map / convention / SSR), model it as a
**configurable strategy dimension** — never bake one mechanism (the *dimension-vs-fixed-mechanic* rule).
The **default is the most-permissive / native-first** value, with the restriction as the author's opt-in.
Defaults live in a **project config that *extends* a fully-defined platform default** (flavors); the core
tool/registry itself stays **default-less** (core `CustomRegistry` `extends`; the JSX render-strategy axis
is the precedent).

**Lineage:** #227 (auto-define strategy axis) · #080 (render-strategy precedent). Process forms in [conventions.md](conventions.md) / [architecture.md](architecture.md).

### Compose an existing intent — don't duplicate an owned model {#compose-intent-dont-duplicate}

The intent-level analogue of [compose-don't-hand-roll](#compose-dont-handroll). When a standard needs
async / lifecycle / interaction behavior a **registered intent already owns**, it **composes that intent
and cross-references it — it never spins up a parallel model**. `<Resource>` resolves *through* the Loader
Intent's state machine (`idle|pending|success|error|stale|loadingMore`) rather than re-implementing one
(#124); a Menu block composes the owned anchor / focus / type-ahead / selection / disclosure intents and
builds **only the one genuinely-missing intent** (command invocation), not a fresh interaction stack
(#173). Build only the irreducibly-new vocabulary; wire the rest.

**Lineage:** #124 (Resource → Loader Intent) · #173 (Menu → existing intents + the one missing `command`). Sibling of [compose-dont-handroll](#compose-dont-handroll).

---

## Standing process & method rules (codified in the topical docs — pointers)

These are already enforced/written elsewhere; listed here so the platform's rules are findable from
one place:

- **Design-first / materialization** → [design-first.md](design-first.md): document in JSON/njk
  before implementing; plan → discrete homes (reports + JSON + research topics).
- **Native-first default; config extends a platform default** → [conventions.md](conventions.md),
  [architecture.md](architecture.md).
- **Minimize lock-in; the protocol is the only lock** — devtools = zero lock-in; protocols =
  impl-swappable + graceful degradation. Forward (generation) adapters reach polyglot/enterprise
  (#463); adapter-as-normalization-hub for ingest.
- **Baseline-2024 substrate floor; polyfills opt-in** → AGENTS.md hard rule 6 (#031).
- **Backlog & decision workflow** (fork-existence test, fork-is-not-prioritization, support-all,
  prepared=DoR, reversibility, no decision+epic conflation, resolve-by-parent-edges) →
  [backlog-workflow.md](backlog-workflow.md).
- **Prove claims by observation** → AGENTS.md hard rule 7 / [testing.md](testing.md).
