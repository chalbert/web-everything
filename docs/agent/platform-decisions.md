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

> **⚖️ THIS DOC IS THE SINGLE SOURCE OF TRUTH FOR SETTLED ORIENTATION — read and cite _it_, not the
> backlog decision chain.** When you need to know *the rule* (a placement / naming / boundary /
> monetization orientation), read **this file** and cite the **named anchor**
> (`platform-decisions.md#<anchor>`). **Do NOT reason from, or cite, the `backlog/*.md` `type:decision`
> items (`#NNN`) unless you specifically need the _history_** — the deliberation, the forks, the
> lineage behind a rule. The case-law items are an **archive**, not the reference; a bare `#NNN`
> citation of an already-codified rule is a smell (swap it for the anchor). This doc **must be kept
> complete and current** — if a settled rule is missing or stale here, that is a **codification gap to
> fix** (promote/repair the rule in this file, per the discipline below), never a licence to fall back
> to citing the work item. `#NNN` is correct in exactly two places: this doc's own **`Lineage:`**
> footers, and when you *genuinely mean the historical call* (e.g. a reversal that supersedes it).

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
   product → **Plateau**. **WE holds zero implementation — contract / protocol / interface only.** WE
   never hosts delivery runtime, not even as a "reference implementation." The former
   reference-implementation tier (a WE-repo reference runtime kept so WE conformance demos had something
   real to run) is **withdrawn** — it conflated the WE *website* with the WE *project*. A conformance
   demo is a **website** artifact: the WE-docs site is a downstream *consumer* that **surfaces FUI**
   (mode-C runtime bundle / `fuiDemo` iframe — [we-fui-embed-boundary](#we-fui-embed-boundary) rule 6),
   so it exercises **FUI's** runtime, never a WE-project copy. Delivery runtime
   (`we:webpolicy/enforcement.ts`, block engines, parser/proof logic, …) is **FUI-canonical**; the WE
   project keeps the **contract + conformance vectors (data)** only. The `@webeverything` *package*
   stays types-only (rule 3); the source arrow is WE→FUI, never inverts. **The one runtime-ish thing
   that stays WE is conformance *tooling* a WE-side `check.ts` gate consumes** (e.g.
   `we:capability-manifest/check.ts` + its `assert*`) — it *checks* conformance, it does not *deliver* a
   capability, so it is interface/conformance, not implementation. **Interim state (honest):** a set of
   WE-resident logic reference runtimes predate this rule and currently **violate** it —
   `we:webpolicy/enforcement.ts`/`proof.ts` (consumed by `we:demos/webpolicy-conformance-demo.ts` via a
   build-time local import) and the ~10 subsystems #1078 covered. They are **tracked relocation debt**,
   **not** a sanctioned standing tier: their move to FUI is gated on (a) a FUI home existing and (b) a
   working way for the WE-website conformance demo to surface FUI runtime for *headless* logic (the
   `fuiDemo` iframe serves only rendered components today; the #899 vector-runner is designed, not
   built). Until both clear they stay put **as debt under this rule** — and crucially **no _new_
   WE-resident delivery runtime may be added.** Relocation tracked by #1294; the rule is #1282.
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
6. **Relocating the runtime does not retire the WE project that owns the contract.** When a
   standard/impl split moves a subsystem's *runtime* to FUI (the #606 move), the WE project
   *survives* on its contract surface (spec page + interface defs + conformance) — you reconcile its
   status drift, you do not delete it. A project whose surface ships as **spec + data defs** (not a
   `relatedProject`-tagged resolved item) can read as `concept` despite being live; bump it **off**
   `concept` (`poc` is the convention — project `status` is not enum-validated; the `LIFECYCLE` set
   governs *descriptors*, not projects). *Retire* is only on the table if WE owns **no** contract
   surface distinct from the moved runtime.
7. **The public compat table lists every impl as a peer — no privileged/reference column.** The
   `capabilityMatrix` catalog (capability-row × impl-column, rendered publicly) broadens from native
   substrates to incumbent libraries (Floating UI, Mousetrap, TanStack, FUI, …); **FUI is one column
   like any other**, its strength *earned and visible* (greenest column), never status-declared. No
   "reference / recommended impl" column — that reintroduces the single-lib perception the table
   exists to dispel and conflicts with minimize-lock-in. An adoption pointer, if wanted, lives in
   clearly-editorial getting-started prose, not the neutrality grid (matches BCD / caniuse /
   wpt.fyi / OpenFeature). Ruling #1450.

*Soft sub-rule — locus tagging:* backlog items carry an explicit `locus:` field (WE / frontierui /
plateau-app / exercise-app); items gate in their own locus so cross-repo batches stay locus-agnostic.

**Lineage:** #730 #817 (the per-file define-vs-deliver holding) · #606 (plugs runtime → FUI) ·
#1248 (relocating the runtime does not retire the contract-owning project — `webplugs` survives #606) ·
#641 (block-protocol impl boundary) · #779 #426 #799 #497 #834 · #804 #872 #239 (contract package) ·
#091 (managed-offering decomposition) · #020→#291 (impl-is-not-a-standard) · #1078 (introduced a
WE-resident reference-implementation tier — **superseded by #1282**: conflated WE-website with
WE-project; WE holds zero implementation) · #1246 (blocks → FUI, reverses #697) · #1282 (**withdraws
the reference-implementation tier wholesale** — webpolicy + all delivery runtimes → FUI; WE = contract +
vectors only; demos are a *website* concern that surfaces FUI).

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
4. **No block runtime in WE (#1246, reverses #697):** **every** block's runtime is FUI-canonical —
   *none* stays in WE, not even one whose demo exercises a WE standard. (This is the rendered-UI
   instance of the general rule in [constellation-placement](#constellation-placement) rule 1 — *WE
   holds zero implementation*, #1282.) Its demo is
   **FUI-hosted and iframe-embedded** (or consumed as a mode-C runtime URL-bundle per rule 6); WE owns
   only the block **protocol + conformance vectors** (#817/#899, data not impl). The former "stays in
   WE *iff* it is the standard's reference runtime" partition is **withdrawn** — the headline above
   ("WE never imports or renders FUI block code") now holds without exception.
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
#1246 (withdraws the rule-4 reference-vs-impl partition + reverses #697: no block runtime stays in WE) ·
#1282 (general rule — WE holds zero implementation; demos are a website concern that surfaces FUI) ·
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

**Temporal-rule clarification — "a second independent impl" counts _external convergent_ impls, not only WE-internal ones (#1437).** Rule 3 exists to avoid freezing an *unvalidated* contract; for an **interchange schema** (not a provider seam) that validation can come from **convergent prior art in the world**. When N≥2 independent incumbents already emit the same shape (dockview / FlexLayout / golden-layout all serialize a `row→column→stack-of-tabs` tree), the temporal rule's "second impl + stabilised contract" precondition is **already met** — mint the **core schema now + an open extension slot** for the parts that still diverge (don't wait for WE itself to ship two impls). The deck case (#1175) is the contrast that proves the rule: it got "no protocol" precisely because it had **no** convergent external interchange schema. Caught when a decision-turn flip to "protocol-later" mis-read the rule as requiring WE-internal impls; the skeptic refuted it.

**Lineage:** #015 #016 #011 #014 #409 #616 #634 · #041 (protocol-extraction timing) · #258
(paradigm → semantics) · #020→#291 · #1175 (deck placement: a deck is composition, not a domain —
no `webdecks` project; novel surface is a *cross-media advanceable-sequence* family homed in webintents,
shared with video/carousel; rule 2 + temporal rule 3 applied) · #1437 (temporal rule counts external convergent
impls; `dockable` layout-tree minted core-schema-now + extension-slot).

### Intents are UX-only; technical strategy → Configurator {#intents-ux-only}

Intents describe desired interaction (what/why) at project level — dimensions, states, events,
per-level contracts only. They carry **no implementation refs** (no conformance tiers, DI, type
shapes, registries — those belong to the block). Technical strategies become a **Technical
Configurator** domain. Borrow official platform vocabulary (`aria-sort`, `Intl.Collator`), never
coin away from native terms. Intents are an **open, never-finished system**: custom non-standard
intents must coexist conflict-free — standardize the meta-schema, not the list. Defaults are the
**most permissive** value; restriction is the author's opt-in.

**Corollary — technical machinery splits off into a composed contract, and an upstream-bundled data
model does not force a monolithic one.** When a UX intent needs durable/technical machinery
(serialize/re-resolve/fuzzy/orphan, etc.), that machinery is its own contract the intent *composes*
(referenced, not owned) — the same seam an intent already uses for a native capability. A canonical
upstream model that bundles several concerns into one object (e.g. W3C Web Annotation's
`target`+`selector`+`body`) is a **serialization-vocabulary** fact, *orthogonal to the runtime
ownership seam*: adopt the wire format wholesale while still splitting which artifact owns the
machinery. #1408 (annotation = UX intent composing a separate durable-range-anchor contract; the
platform itself split quote-anchoring into `#:~:text=`).

**Lineage:** #030 (intent-vs-trait channel split) · #063 (native vocabulary) · #129 (guard intent
re-framed) · #634 · #1408 (durable-anchor contract split) · intents-open-design.

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

### Vision capability tiers — the on-device-first cascade {#vision-tiers}

The vision service (a [no-leakage client](#no-leakage-client)) ships as **three layered tiers**, not
interchangeable models — pick by job, and let the cheap tier gate the expensive one:

1. **Tier 1 — verdict classifier** (≤10 MB, on-device, free at any volume, **benchmarkable/gateable**):
   the always-on triage/router. Reach for it when the work is high-volume, must run everywhere/offline,
   must be instant, or needs a deterministic gate. Closed label set, whole-screen only — no "why/where".
2. **Tier 2 — small VLM** (device-gated, an opt-in download in the dev browser): open-ended describe /
   localize / tag — the "what's wrong and where" a real review needs. Generative → no clean agreement
   metric, so it is **never** deterministically gated the way Tier 1 is.
3. **Hosted** — richest, but **per-call cost**, so never the free floor: a dev tool / BYO-key bridge /
   premium upgrade only (the [linear-cost rule](#monetization)).

**The cascade is the load-bearing rule:** Tier 1 runs on every frame and decides *whether it's even
worth* an expensive call; only escalated frames reach Tier 2 / hosted. That filter is what makes the
heavy tier affordable under flat pricing. **Deployment floor:** Tier 1 bundled, on by default (in-browser
via ONNX Runtime Web + WebGPU); Tier 2 an opt-in dev-browser download on capable devices only; hosted
BYO-key / premium, never on mobile. Every tier registers behind the one `registerVisionProvider` seam —
swapping a tier is a provider swap, not new plumbing. The design-critique rubric (#1034) is the service's
*output contract*, not a published `@webeverything` artifact, and rides the same seam.

**Still deferred (a later call, not a fork):** whether a Tier-2-class critique model is ever built
on-device vs. stays hosted — the architecture holds either way and the provider seam absorbs the choice.

**Lineage:** #1033 (interactive design-review loop) #1034 (critique rubric) #490 (build epic) · #475
#488 (on-device fixed-cost floor) · #511/#512/#513 (Tier 1 tooling/training) #1073 (Tier 2 epic) #485
(hosted teacher bridge) #141 (dev-browser home) #514 (ONNX/WebGPU runtime). Promoted from
[vision-tiers.md](vision-tiers.md) per #1244. *Confidence: architecture firm; on-device-vs-hosted for
the rich tier provisional.*

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

### Registry name-validation guards the host-shared namespace, not every `define()` {#registry-name-guard-namespace}

A `CustomRegistry.define()` name-validation throw is justified **iff the registry's keys enter a
namespace shared with the host platform** — never by a flat "every `define()` call validates the
same way" rule.

1. **The test is namespace sharing, not the `define()` call.** A key is guard-worthy iff it lands in
   a namespace where a bare name collides with a host built-in. Today that is the **HTML-attribute**
   namespace (`CustomAttributeRegistry` → DOM attributes, where `title`/`value`/`type` are taken).
   Element tags are the other host-shared namespace, but the platform **already** hyphen-forces them.
2. **Framework-internal keys are not guarded.** Parser / expression / text-node / store / context
   registry keys never reach the DOM, so their bare grammar tokens (`value`, `pipe`, `call`,
   `mustache`, `polymer`) stay bare — no guard, no rename. The base `CustomRegistry` stays guard-less;
   the throw is a deliberate per-registry override, not a base invariant.
3. **This is the web platform's own rule.** Native `customElements.define` guards *only* element tags
   (the one host-shared namespace) and imposes nothing on internal JS registries — so scoping the
   guard generalizes the platform; a flat uniformity rule would be **stricter than the platform's
   own**, on namespaces it never guards.
4. **The separator set tracks what each namespace permits** (not uniformity): tags are hyphen-only
   (a colon isn't a valid tag char); attributes accept hyphen **or** colon (`xml:lang`, `nav:list`).
5. **One-line statement to cite:** *guard the namespace you share with the host.* This is an instance
   of the same "name/guard by semantics, not by uniformity" discipline as
   [host back-reference naming](#host-backreference-naming) and derives from the [native-first
   baseline](#native-first-baseline).

**Lineage:** #1347 (scope of #1120's guard → `CustomAttributeRegistry` only; sets #1348 rename
scope) · #1120 (the `CustomAttributeRegistry` `#assertValidName` guard) · derived from [native-first
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
determinism anchor = state-diff A; ratified 2026-06-19) · #1411 (treegrid = a `hierarchy` projection on
`data-grid`, not a new block — the new substance is the Right/Left arbitration rule, homed on data-grid's
movement-engine seam; hierarchy's flatten-to-visible projection is referenced, not duplicated; ratified
2026-06-21) · #1423 (bulk-action = a thin `bulk-action` **intent** composing `selection` + `command` over a
target set, not an assemblerPreset/trait — the new substance a preset can't carry is fan-out across the live
selection set + the select-all `matching` predicate + the partial-failure outcome + the count-announce
binding; selection/command/#1409 toolbar are referenced and stay home; ratified 2026-06-21) · #1420
(offline-first sync = a composition over four already-ratified orthogonal axes — webrealtime transport +
webreliability durable outbox + change-tracking merge-strategy + `mutation` apply/rollback — so **no new
WE artifact**; the replay-on-reconnect *choreography* (FIFO + exactly-once + sync-cursor) rides a FUI
`sync-coordinator` **block** the `draft-persistence` way, never a 5th standard. **Deferral-bar corollary:**
don't mint an orchestrator over already-homed axes until a *real cross-cutting consumer* appears — that is
`storage.json`'s own bar, and it is unmet by the current exercise-app roadmap (loan/insurance/healthcare/
government/logistics are form/workflow apps, not collaborative-realtime). Presence stays its own render
intent (bias-to-separation; `CoEditCoordinator` "does not merge state"); ratified 2026-06-21). Kin to [constellation-placement](#constellation-placement),
[compose-dont-handroll](#compose-dont-handroll), [surface-contract-not-computation](#surface-contract-not-computation).

### Data-shape evolution is a storage facet, not a reliability concern {#data-shape-vs-mechanism-failure}

When persisted client state **outlives the schema that reads it** (a stored value predates the shape the
current code expects — a renamed key, a changed field), the capability that detects + migrates/discards it
is a **webstates storage facet**, *not* a webreliability concern. webreliability owns **mechanism /
operation failures** (network timeout, server error, DB unreachable, computation crash) and is ratified
"distinct from validation — not input invalidity"; a schema-shape mismatch is **data evolution**, which
falls on the same far side of that line. The discard-to-defaults fallback merely *rhymes* with graceful
degradation — that resemblance does not move the home. **Test:** if the trigger is "the stored shape
changed", it's webstates; if the trigger is "an operation failed", it's webreliability.

Corollary (decision shape): such a placement question splits cleanly into **WE-internal architecture forks**
the developer never sees (which project owns it; how it attaches to the contract — WE must pick one on merit)
and **developer-facing behavior axes** with two legitimate end-states each (detection, mismatch policy,
on-disk granularity — *support both, record a most-flexible default*, never a mandate). Don't promote a
support-both axis to a fork. See [config-extends-platform-default](#config-extends-platform-default).

**Lineage:** #1251 (client-storage schema versioning + migration; home = webstates, granularity = configurable
dimension defaulting to per-key envelope; ratified 2026-06-20). Kin to [constellation-placement](#constellation-placement),
[composition-artifact-ownership](#composition-artifact-ownership), [config-extends-platform-default](#config-extends-platform-default).

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
extension** with documented semantics — never a mystery method whose name overpromises. The fidelity rule
applies **one level up too**: a *shared contract* that polyfills implement (an interface, a type guard, an
abstract base) must not **mandate** a method the platform omits — relax the requirement to optional
(`downgrade?`) so the native-faithful implementation is conformant, even when API symmetry (`upgrade`/`downgrade`
"look like a pair") tempts otherwise. Real implementers that genuinely need the method still ship it; only the
*requirement* relaxes.

**Lineage:** #31 (polyfill baseline floor); #1103 (polyfill-surface fidelity / `downgrade()` omission on the
`CustomElementRegistry` surface); #1350 (the corollary at the shared `Plug` contract — `isPlug`/`HTMLRegistry`
drop the `downgrade` *requirement*, `downgrade?` optional; build #1413). Mirrors `AGENTS.md` rule 6 + the
native-first authoring default.

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

### Standard consumability: author to the standard, ship removable agnostic adapters {#standard-consumability}

**How a WE standard reaches consumers with zero lock-in.** A standard is a *guarantee*; making it work today
is a separable, removable concern. **Three layers, never conflated:** **(1) contract** = the guarantee (WE);
**(2) authoring source-of-truth** = the standard's *own form* — write to the platform (e.g. `@scope` CSS),
**never a tooling/impl format**; when the native form ships, the adapters drop and the authored source is
unchanged (minimize-lock-in / graceful-degradation applied to *authoring*, not just runtime); **(3)
impl/lowering** = removable *make-it-work-today* adapters (build-transform / runtime polyfill).

The lowering is **one pure, agnostic transform core + thin adapters**, and the adapters span every
consumption axis — which are **orthogonal**: **timing** (build / serve / runtime) ⟂ **host/bundler** (vite /
rspack / webpack / esbuild / rollup / CLI — *none privileged*; a project must consume **uncompiled** source
with **its own** bundler) ⟂ **guarantee-strength** (the Configurator dimensions). Expose these as **config**,
never as authoring choices — that is what "more than one valid way available to the user" means. The
trait-enforcer is the reference shape (pure functions + per-bundler shims over a WE-resident contract).

The **only lock is the contract + conformance** (the single escapable protocol lock); reference tools are
optional and swappable. **Placement:** contract + conformance vectors → WE; the reference transform + adapter
family → published impl/tooling (FUI-owned, zero-lock-in), **never `@webeverything`** — the contract crosses
the seam, the tool does not. Conformance is what makes the standard adoptable *independent of* the reference
tool.

**Lineage:** synthesizes [forward-generation-adapters](#forward-generation-adapters),
[framework-free-core-vendor-segregation](#framework-free-core-vendor-segregation) (the bundler-agnostic
axis), [native-first-baseline](#native-first-baseline),
[config-extends-platform-default](#config-extends-platform-default), and the #855 generator-is-a-tool /
npm-scope-mirrors-layer rules under [constellation-placement](#constellation-placement). First worked
instance: #1377 (webisolation L2 — author base `@scope`; pure PostCSS core + per-bundler adapter family).

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

### A declarative author-facing seam over an already-built provider is a non-rendering behavior/directive — not a new intent or protocol {#declarative-seam-over-existing-provider}

When a standard **already ships the transport** — a contract + a runtime-DI provider ([runtime-DI seam](#runtime-di-vs-devtools-provider-seam)) + a controlled vocabulary — and the only unbuilt piece is the **author-facing declarative seam** (a `data-*`-style annotation that says "do X on interaction I" *without* sprinkled imperative calls), that seam is a **non-rendering behavior/directive that consumes the existing provider**. It is **not** a new [Intent](#intents-ux-only) (intents are UX-only and *render a surface*; an emission/binding seam renders nothing, so an intent would be the catalog's lone non-rendering member) and **not** a new Protocol (the contract + vocabulary already exist — the seam adds *vocabulary entries*, never a new transport, like [compose-don't-duplicate](#compose-intent-dont-duplicate)). Whether to ship the seam at all is a genuine support-vs-not call (imperative-only is coherent, not broken), decided on **end-state merit** (every scaled prior-art ships the `data-*` binding) with the build filed as **separately-prioritized** ([fork-is-not-a-prioritization-tool](#)); two emission concerns sharing the emit-to-a-sink shape stay **two homes that compose** (one emits *through* the other), never an umbrella ([bias-toward-separation](#)). Native-first floor: unconfigured provider → silent no-op default.

**Lineage:** #1415 (telemetry declarative emission seam → behavior/directive over the built `CustomTracker` sink + Analytics Event Vocabulary; #1414 experiment-exposure composes through it). Sibling of [runtime-DI-vs-devtools-provider-seam](#runtime-di-vs-devtools-provider-seam) and [intents-ux-only](#intents-ux-only).

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

### A thin role-container over a shared primitive stays a preset/parameter until a 2nd consumer; graduate to a block then {#thin-container-graduation-trigger}

The placement face of [compose-intent-dont-duplicate](#compose-intent-dont-duplicate), for APG
composite-widget *containers* (toolbar, menubar, tabs-container). The roving/managed-focus algorithm is
**not** the container's — it is the owned `focus-delegation` intent + its `composite-widget` behavior
block, which the container *consumes* (`strategy=roving; orientation=…`). What the container actually adds
is a thin role surface — a `role` value (`role="toolbar"`), separators, a label, grouping — too small to
justify a first-class artifact on its **first** consumer. **The rule:** carry that role surface as
**assemblerPreset config + a `role` parameter on `composite-widget`**, *not* a new intent (no UX dimension
of its own) and *not* yet a new block. **Graduation trigger:** the moment a **second** container consumer
wants shared *container* concerns (separators, overflow, label), promote the preset into a **thin block**
composing `focus-delegation` + `action`. One consumer → preset; two → block. Matches Radix/Ariakit/React
Aria (thin role wrapper over one shared focus primitive; the algorithm is never re-homed per container).

**Tell:** a candidate "new roving control-group standard" names a role but supplies no focus mechanic of
its own (it delegates arrow-nav wholesale) — that's a consumer of `focus-delegation`, not a new standard.

**Lineage:** #1409 (Toolbar — roving unit = `focus-delegation`+`composite-widget` consumer (Fork A,
resolved invariant); container semantics = the webdocs `toolbar` assemblerPreset + promoted
`composite-widget`, thin `toolbar` block gated on a 2nd container consumer (Fork B)). Surfaced by the
ARIA-APG lens #1400; sibling of [compose-intent-dont-duplicate](#compose-intent-dont-duplicate) and
[intents-ux-only](#intents-ux-only).

### Decompose an overloaded incumbent word by semantic source; never widen one intent to absorb a foreign family {#decompose-overloaded-vocabulary-by-semantic-source}

The split-side complement of [compose-intent-dont-duplicate](#compose-intent-dont-duplicate). Incumbent
design systems overload a single word (classically **"badge"**) across **distinct semantic families** —
a decorative/categorical label (author-supplied tone, static, no provider), a lifecycle/state status (an
entity's state machine), a count/dot notification marker (a number overlaid on a host). The word lands in
a *different* family per system (shadcn's Badge is decorative; Ant's Badge is a count marker). The rule:
**carve one intent per semantic family along the semantic-source axis**, and **never widen an existing
intent to admit a foreign family** — widening *dilutes* the absorbing intent (a decorative label has no
provider/transition/state, so a lifecycle intent's machinery would have to go optional and hollow,
falsifying its own contract). The unhomed family earns its **own** home; the name must avoid colliding
with a token or element already owned by a sibling family (`badge` is a `shape` token; `label` collides
with the form-label intent **and** the HTML `<label>` element). Interactivity is **composed** (Action /
Selection), not baked in.

**Tell:** an incumbent component maps "close enough" onto an existing intent but supplies none of that
intent's defining inputs (no provider, no state, no transitions) — that's a foreign family asking for its
own home, not a widening candidate.

**Lineage:** #009 (Notification Marker — split the count/dot family off "badge") · #1319 (Tag Intent —
split the decorative label family off "badge"; Status Indicator keeps lifecycle) · #1395 (Mutation Intent —
the word **"optimistic"** is overloaded across two axes: a *read/blocking* strategy on `loader` ("don't
block the UI, sync in background") vs a *write apply-then-rollback* lifecycle; carve a first-class `mutation`
intent (symmetric to `loader` for reads) rather than widen the visual-weight `action` intent — `action`
supplies none of the write-lifecycle's inputs, the foreign-family tell). Inverse face of
[compose-intent-dont-duplicate](#compose-intent-dont-duplicate); kin to [reproduction-conformance](#reproduction-conformance)
(the gap sweeps that surface these overloads) and [intents-ux-only](#intents-ux-only).

### Configurability partition — declarative vocabulary is the portable standard; imperative is the per-impl escape hatch {#configurability-partition}

A runtime-agnostic standard's **author-facing configuration** splits along the **declarative/imperative
line**, *not* along "the reference impl vs others." A **declarative strategy vocabulary** (options expressed
as *data* — `sort by field, desc`; `group by tag`; an order pin) is **part of the standard**: portable,
golden-vector-locked, honored identically by **any** conforming implementer. An **imperative custom
function** (a JS/C# sort fn) is **inherently non-portable** (code, not data), so it is a **per-implementer
escape hatch**, never in the standard — and reaching for one is an explicit, **graceful-degradation** opt-out
of cross-implementer reproducibility for that aspect (another implementer declares non-support and falls
back to the declarative default, never silently differs). Consequences: configurability is **unbounded at
two levels** (portable declarative + per-impl imperative) without bloating the contract; the named
implementer is the **reference** impl, not "the engine" — the standard stays runtime-agnostic so a second
generator (`.NET`/Go) is a first-class possibility; the declarative vocabulary **starts minimal and grows on
demand** (promote a popular escape-hatch option into the vocabulary when real demand / a second implementer
appears — grow the *vocabulary*, not an impl's private knobs). Reproducibility (e.g. #091 no-drift) holds
across *any* implementer over the declarative surface, degrade-gracefully over the imperative one. **Tell:**
when "we must let people customize X" tempts a vendor-injected plugin *inside* the contract, the right move
is a declarative vocabulary entry (if expressible as data) **plus** an imperative escape hatch outside the
contract — never an imperative seam folded into the standard.

**Lineage:** #1163 (webdocs Doc Spec — declarative `docs.*` vocabulary in WE, custom `SortStrategy` fn as a
per-impl escape hatch; FUI = reference impl). Composes [surface-contract-not-computation](#surface-contract-not-computation)
(pin surface / swap impl), [intents-ux-only](#intents-ux-only) + Intents-Open-Design (standardize the
meta-schema, not the list), and the minimize-lock-in / escapable-lock principle; the config-surface analogue
of [forward-generation-adapters](#forward-generation-adapters) (contract is the authority, code crosses no seam).

### Presentational variants are an open-numbered axis off one semantic contract {#open-numbered-variants}

When two things differ **only in presentation** — same semantics, same behavior, same DOM — that
variation is an **open-numbered axis**, never a closed enum. WE standardizes the **variant contract**
(*a value names a purely-presentational treatment that leaves the semantic meaning and behavior
unchanged*) **plus a recommended core set**; authors **mint as many members as they want from that
contract** (Intents-Open-Design applied to the presentational axis — standardize the meta-schema, not
the list). Membership is a **semantic test**, not a vote: *differs only in presentation* → a valid
member; *differs in semantics* (changes role, behavior, navigation) → a **different contract**
(different intent/dimension), never folded in. The axis lives **on its owning intent** (value sets are
intent-specific — a button's `ghost`/`link` ≠ an input's `borderless`), never as a shared cross-cutting
intent that would flatten the divergent vocabularies. Name the axis for the *treatment*, not the
attention it draws (`variant`/`treatment`, not `emphasis` — prominence is a separate semantic axis).

**Ceiling — variant vs block polymorphism.** The rule is bounded to **presentational treatment of one
rendering**. Three tiers: (1) **intent** = the semantic contract; (2) **variant** = a value the *same
block, same DOM* renders differently, CSS/token-reachable; (3) **block polymorphism** = when materially
**different DOM/markup** is required (one single-select intent as radios *vs* a segmented control *vs*
card-tiles), which is interchangeable *blocks* under one intent or a *structural/layout* axis — **not**
a variant value. **Diagnostic:** *can I reach it with CSS/tokens on the same markup?* — yes → variant;
no → block/structure layer. This stops "everything visual is a variant" sprawl. Generalizes beyond
Action to **sectioning and layout**: define the semantic contract once, expose presentational variants
as an open-numbered axis. Surface is a **plain attribute consumed by CSS** (`button[variant]`) — no
wrapper required, because a behavior-free axis needs none.

**Lineage:** #1318 (Action Intent `variant` axis — `fill | outline | ghost | link`, open vocabulary;
`link` in the core set; named `variant` not `emphasis`; renders via plain attribute, no wrapper).
Composes [intents-ux-only](#intents-ux-only) + Intents-Open-Design, [compose-intent-dont-duplicate](#compose-intent-dont-duplicate)
(divergent vocabularies stay on their owning intent), and the most-permissive-default / native-first
floor. Follow-ups: #1320 (build) · #1321 (FUI variant-surface packaging) · #1323 (sectioning/layout
application) · #1324 (`level`-as-outcome-role).

**Tone extension (#1427).** Applied a third time, to the cross-intent **`tone`** axis (semantic
color/severity). Same holding — the **value enum stays per-intent** (action `neutral | danger`; message
`neutral | positive | caution | negative`; status-indicator `+progress`; tag `+categorical`;
feedback/sys-notif `info | success | warning | error`), a flat shared enum is **rejected** (flattens; the
Bootstrap `btn-warning` smell). The tone axis adds **one nuance variant lacks: a shared DRY token layer.**
Because tone *is* color, the shared layer is two things, not one: (1) a shared tone **meta-contract** (*a tone
value names a semantic color/severity family the theme resolves — never a hex; open-numbered; membership test
= differs only in semantic color, not behavior/lifecycle*), and (2) a shared **`--tone-*` token palette** in
webtheme. The palette is **severity-family only** (`neutral · danger · success · warning · info · critical`);
values that fail the membership test stay **intent-local tokens** — `progress` (a lifecycle state) and
`categorical` (non-severity identity color) never enter the shared palette. Dimension name standardized to
**`tone`** with a canonical synonym table (`danger ≡ negative ≡ critical ≡ error`; `success ≡ positive`;
`warning ≡ caution`); `info` and `neutral` stay **distinct** (collapsing them is lossy). Action keeps
`neutral | danger` regardless (#1337, non-negotiable). Realized by #1458 (palette + statute) / #1459 (rename
sweep). Composes [intents-ux-only](#intents-ux-only) (tone is UX-only; the theme owns the hex).

### Reproduction-conformance: reproduce incumbents as theme+intents; the copy is a forcing function {#reproduction-conformance}

Reproducing a third-party design system (Material, Ant, Carbon, Fluent, shadcn…) on the constellation is a
**forcing function, never a product**. The hypothesis under test is that the only difference between any two
top design systems is `theme tokens + intents`; everything structural/behavioral is shared WE-standard over
FUI primitives (the headless-library thesis — React Aria/Radix/Ark/Base — applied as a conformance probe).
Each target yields three buckets: a **theme pack** (DTCG tokens), an **intent set**, and a **gap list** — the
residue reproducible *only* by escaping the standard. **The gap list is the deliverable.** The governing
discipline mirrors [exercise-app *active-bypass = FAIL*](#) : a divergence you can only hit by hand-rolling
outside WE/FUI is a **gap to file, never a hack to add** — per-library escape hatches buy the screenshots and
learn nothing. Three consequences, all forced:

1. **No assumed quality — parity is a measured fact.** No parity claim may rest on eyeballing; each gates on a
   confirmed measurement. The oracle is **layered** (support-all, not a fork): **fuzzy-tolerance pixel**
   (WPT-reftest model — max per-channel color delta + max differing-pixel count, *not* naïve pixel-diff, which
   throws 30–40% false positives), **structural DOM/ARIA/focus-order diff** (deterministic), and an
   **advisory VLM/semantic judge** (never the sole gate). Reproduction-as-conformance *is* the WPT/reftest
   method: the incumbent's own render is the reference, the FUI-themed repro is the test.
2. **Validation-engine ownership splits at the capability seam** (the load-bearing rule). The **deterministic
   diff engine** (drives + captures + compares) is **FUI** (impl/devtool, like the #809 block-explorer); the
   **VLM/vision judgment** is **Plateau** ([no-leakage-client](#no-leakage-client) — #475 is categorical: a
   tool containing a vision capability cannot fold it into FUI); **WE consumes only the verdict + gap deltas**
   (never renders FUI, never runs the judge). The Plateau→WE delta protocol stays **deliberately thin**
   (pass/fail + gap list, not a fat schema).
3. **The instrument need not be finished before reproduction starts** (prioritization, not a fork). "No claim
   without measurement" is the invariant; *when* the validator reaches parity-grade relative to the first
   target is a scheduling call — the validator co-evolves, specified by a concrete adversarial target, with
   the claim-gate (not a hard `blockedBy`) carrying the correctness guarantee.

**Lineage:** #1225 (program charter — reproduction-conformance; ratified 2026-06-20; research topic
`/research/reproduction-conformance/`). Composes [no-leakage-client](#no-leakage-client) (vision → Plateau),
[we-fui-embed-boundary](#we-fui-embed-boundary) (FUI owns impl + render, WE consumes outputs),
[constellation-placement](#constellation-placement), and the backlog *fork-is-not-prioritization* rule
(sequencing demoted out of the fork set). Sibling forcing-function to the exercise-app conformance loop (#314).

### First-party dogfood: our own products render only from FUI components + WE intents, differentiated solely by a theme {#first-party-dogfood}

The internal twin of [reproduction-conformance](#reproduction-conformance). Where that program proves the
`theme + intents` thesis against **incumbents**, this rule proves it on **our own product surfaces**. A
first-party product (plateau-app today; the same bar reaches any served product) composes its UI **only** from
FUI components driven by WE intents; the **sole** thing distinguishing its look from WE-docs or any other
first-party surface is its **theme (DTCG tokens) + intent set** — nothing structural or behavioral is
hand-authored. Three consequences:

1. **Hand-rolled UI is a conformance defect, not a style choice.** Reaching for `document.createElement` /
   bespoke CSS to build an interaction a FUI component already provides is the product-layer analogue of
   [exercise-app *active-bypass = FAIL*](#) and [compose-don't-hand-roll](#compose-dont-handroll). The
   residue — anything the product *can't* build from `theme + intents` — is a **standards/FUI gap to file,
   never a hack to keep** (the forcing-function thesis: the product is a probe for FUI + intent coverage).
2. **Preserve once it lands (the load-bearing clause).** Once a surface migrates onto FUI, regressing it back
   to hand-rolled UI is a **gated defect, not a tradeoff**. This is *why* the goal is codified to the statute
   layer rather than living only as epic scope: the epic delivers the state, the rule keeps it durable.
3. **Unblocked by the WE↔FUI boundary.** Unlike the WE-docs dogfood (#777, which waits on a mode-C relaxation),
   a served product is the **product layer** and already consumes FUI directly ([constellation-placement](#constellation-placement)
   — served product → Plateau, free to render FUI). No boundary gate applies; the only gate is FUI shipping
   the parts (#658 promoted `@frontierui/blocks` canonical, so the floor exists).

**Lineage:** #1253 (charter — plateau-app dogfooding mandate; ratified 2026-06-20; lands via epic #1254).
Internal twin of [reproduction-conformance](#reproduction-conformance); parallel to the WE-docs dogfood
mandate #777; kin to the exercise-app conformance loop (#314). Composes [compose-don't-hand-roll](#compose-dont-handroll)
and [constellation-placement](#constellation-placement). Enforcement (a `check:`-style plateau-app render
conformance gate giving "preserve once landed" teeth) is a filed follow-up, not a precondition for the rule.

---

### Visualization-family shape: placement & seam count key on whether position is *derived* or *invented* {#viz-family-shape}

A visualization standard (charts, graphs, maps, timelines, …) is a family with a settled skeleton: a
**semantic profile** (data + meaning, presentation-free) + a **renderer-swap protocol** with a
**native-first SVG default** + **3-axis conformance** (semantic fidelity · theme · a11y), with
contract→WE / runtime→FUI per [constellation-placement](#constellation-placement) and adapters deferred
per-engine. Two recurring forks resolve by a single test — **is a mark's position *derived* from its datum,
or *invented* by an algorithm?**

1. **Own project vs sub-profile.** A family earns its **own project** iff it has a positioning **degree of
   freedom** the host family lacks — most often a **layout-algorithm axis**. Charts derive position from
   data via scales (`x = f(field)`); a graph *invents* position via a layout algorithm (force / layered /
   tree / radial) — that axis can't ride as a webcharts sub-profile without bolting a foreign dimension on,
   so graph is its **own** project. No new positioning axis → a sub-profile of the existing family.
2. **Protocol seam count.** Position **derived** from the spec (charts) → a **single** renderer seam
   (`CustomChartRenderer`: spec → output). Position **invented** by a swappable algorithm (graphs) →
   **split into two seams**: a layout protocol (`CustomGraphLayout`: spec → positioned coordinates) ⟂ a
   render protocol (`CustomGraphRenderer`: positioned + theme → output). This is
   [dimension-vs-fixed-mechanic](#config-extends-platform-default) applied to position: an independently
   swappable layout (ELK layered + SVG render) is a legitimate end-state, so it's its own dimension. A
   single-seam precedent from a *derived-position* family is **not** evidence for one seam in an
   *invented-position* family.
3. **Native-first default.** The default layout/renderer must be **deterministic** (pure: same input →
   same coordinates) so it is **conformance-assertable**; non-deterministic engines (force-directed) ship
   as **adapters** behind the layout contract, never as the default. ([native-first-baseline](#native-first-baseline).)

**Lineage:** #1352 (webgraph shape — ratified 2026-06-21; builds via scaffold epic #1351), generalizing the
webcharts family (`CustomChartRenderer`). Composes [constellation-placement](#constellation-placement),
[config-extends-platform-default](#config-extends-platform-default), [native-first-baseline](#native-first-baseline).

### A readout's home keys on its value-type; presentation is a dimension, not a home {#readout-placement-by-value-type}

A status/quantity readout gets its **own** intent for each distinct **value-type**, and the native ARIA
roles draw the lines: a **discrete-state enum** (`status-indicator` — `tone`/`shape`/`affordance`, a
lifecycle state), a **position in a known range** (`meter` / `role=meter` — `value`/`min`/`max`/`low`/
`high`/`optimum`, always determinate, has zones), and **task completion over time** (`progress` /
`role=progressbar` — `value`/`max`, may be indeterminate, drops `aria-valuenow`, no zones; its **own thin
intent** per #1469, with `loader.progress` and `flow-progress` as *consumers* — a determinate bar shown
*during* a pending op is a `progress` readout under a loader strategy, not `loader`'s to define). These are
**incompatible contracts** — folding a continuous bounded scalar into the discrete-state enum or the
task-over-time progress role **mis-types it** (the documented Chakra defect: a measurement that renders
`role="progressbar"`), so a home that has to mis-type the value is the genuine either/or. **Test:** *is
the value an enum, a position in `[min,max]`, or a completion fraction over time?* — three answers, three
homes. **Presentation is never a home:** a gauge (radial) is the meter contract rendered as an arc — a
`presentation` dimension value, not a separate intent (rating / password-strength are likewise meter
*presentations*, consumers not standards). This is [open-numbered-variants](#open-numbered-variants) +
[decompose-overloaded-vocabulary-by-semantic-source](#decompose-overloaded-vocabulary-by-semantic-source)
applied to the readout family, with WE owning the intent contract and FUI the block per
[constellation-placement](#constellation-placement).

**Lineage:** #1410 (meter placement — ratified 2026-06-21; surfaced by the #1400 ARIA-APG lens). Realizing
build #1468 (`meter` intent + FUI block). Sibling progress placement #1469 (ratified 2026-06-21 → `progress`
gets its own thin intent; `loader.progress`/`flow-progress` are consumers); realizing build #1488. Composes
[native-first-baseline](#native-first-baseline) (adopt `<meter>`/`<progress>` vocabulary verbatim).

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
- **Program definition — the strict bar for a perpetual `ongoing` epic** (four-part Program Test:
  standing goal + conformance front + currency front + cadence; watch mode is a lifecycle state;
  L0→L2 maturity ladder; "evergreen" = the property a program maintains) →
  [backlog-workflow.md#program-definition](backlog-workflow.md#program-definition).
- **Prove claims by observation** → AGENTS.md hard rule 7 / [testing.md](testing.md).
