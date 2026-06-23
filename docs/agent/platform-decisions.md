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
   capability, so it is interface/conformance, not implementation. **(#1566 bounds this: the carve-out
   covers tooling that checks WE's *own declarative artifacts* — manifests, golden-corpus
   completeness/schema-validity. A verifier that judges a running *implementation's* output is executable
   + neutral → Plateau, not WE; see [devtools-placement](#devtools-placement).)** **Interim state (honest):** a set of
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
7. **Mount-model selection (#1621):** within a consumer page (rule 6), pick the mount by the component's
   nature, not one-size-fits-all. **Heavy / interactive / trusted** embeds → **mode-C** (one shadow root +
   one dynamic `import()` per mount point, `fui:embed/in-document.ts`) — e.g. the #865 chrome shell.
   **Many-small, behavior-free, server-rendered** components (a board of hundreds of pills) → the FUI
   **transient custom element** (`registerBadge()`-style, §7.7 of block-standard.md): register the element
   **once** via a runtime cross-origin import from the FUI origin, emit `<we-*>` server-side, let each
   upgrade in place (light-DOM, no shadow root, no per-instance import); inject the block's exported CSS
   (`BADGE_CSS`-style) globally and ship a `we-*{}` SSR baseline to kill the upgrade flash (the #865
   baseline pattern). Per-instance mode-C for many-small pills is **rejected** (N shadow roots + N imports
   per page). Cross-surface categorical styling resolves through design tokens + the taxonomy provider
   (#1670), never per-component palettes.

**Lineage:** #604 #701 #707 (iframe boundary; "WE renders real FUI blocks" is mis-framed) · #700 ·
#1621 (rule 7 — mount-model selection: transient CE + cross-origin import for many-small server-rendered, mode-C for heavy/interactive) ·
#1246 (withdraws the rule-4 reference-vs-impl partition + reverses #697: no block runtime stays in WE) ·
#1282 (general rule — WE holds zero implementation; demos are a website concern that surfaces FUI) ·
#705 · #732 (escape SDK) · #765 (mode-C relaxation) · #788 (seed transport) · #791 (reference-vs-impl
partition) · #809 (workbench locus) · #932 (website≠standard; consumer may run WE runtimes in-document).

### Dev-tool placement: the consumer test {#devtools-placement}

**Where does a dev/test tool live across the constellation?** A user ruling — *dev-tools belong in
Plateau, not FUI* — does **not** mean "move every tool." It **refines** [constellation-placement](#constellation-placement)
into **one positive test**, the *consumer* of the surface (the same axis as
[conformance-verifier-vs-subject](#we-fui-embed-boundary) / #1467):

> **A developer-operated surface a human runs — to inspect / switch / explore / configure an
> implementation, against your OWN build — is a developer *product* → Plateau.**

The other buckets:

1. **Conformance — split by *what runs* (amended 2026-06-22, #1566).** The earlier "reads output as
   DATA → stays WE (a verifier implements no standard)" reading is **overturned**: judging is
   executable, and WE holds **zero executable** (#1282). Split three ways:
   - **The conformance *contract* — the verifier *interface*, the vector/golden **corpus**, and the
     golden/vector **schema** (declarative data) → stays WE.** The standard owns the *definition* of
     conformance — the WPT/Test262 expected-files archetype. Per #1467/#817 and rule 1 of
     [constellation-placement](#constellation-placement).
   - **The verifier *implementation* (the code that judges a running implementation's output) and the
     conformance *run* → Plateau** (#1566). **Neutrality** — the reason the verifier cannot live in FUI
     (the contestant) — is preserved by **Plateau** (a non-implementer product layer; the home of the
     #427 conformance dashboard / #1577 explorer product), not by WE. The implementation under test is
     reached through a per-target **binding** its owner ships (FUI is one target among many).
   - **Carve-out (unchanged):** conformance tooling a WE-side `check.ts` gate consumes to check **WE's
     own declarative artifacts** (e.g. `we:capability-manifest/check.ts` + `assert*` over the manifest;
     golden-corpus completeness/schema-validity) **stays WE** — it checks WE-owned *data*, needs no
     external implementation, delivers no capability. #1566 moves only the verifier of an
     *implementation's runtime output*, which WE cannot run once the impl is deleted.
   - **Load-bearing constraint:** the conformance *rules* must be expressible declaratively in WE (the
     interface + schema) so Plateau's verifier is a faithful *interpreter*, not the *author* of "what
     conformance means."
2. **Build-time implementation transform / reference-impl generator** (codegen, CSS lowering, bundler
   plugins, serve-time impl) → **stays FUI.** Per impl-is-not-a-standard (#020/#291).
3. **Operator-facing surface run against your own build** (workbench chrome¹, spec/dev-panel,
   autonomous-explorer CLI chrome, configurators, dev-browser, mock-server) → **Plateau.**

**Two carve-outs the blanket reading gets wrong** (both ratified under #1565):

- ¹ **The block-explorer / workbench stays FUI** — it is *impl, not a tool*. It ships as an embeddable
  `<iframe>` distribution showing *how FUI is consumed* on third-party / customer sites (chrome + block
  intra-frame, **no postMessage protocol**). Routing it through Plateau re-introduces the cross-origin
  boundary [#809](#we-fui-embed-boundary) (rule 5) dissolved — same-origin only holds *on plateau.app*.
  The distinguishing **third-party-embed test**: *ships embedded on customer sites = FUI distribution;
  runs against your own build = Plateau dev-tool.*
- **A conformance ENGINE splits into contract / impl / binding / product (amended 2026-06-22, #1566).**
  The generic vector-runner + trace-judge **interface** + the vector corpus is the standard's
  implementer-agnostic **contract → WE** (it must define how *any* WE implementer is tested). The runner +
  judge **implementation** (the executable engine) → **Plateau** (#1566 — neutral, non-implementer; the
  home of the #427 dashboard / #1577 explorer product). The per-target **binding** that drives a concrete
  implementation is the **subject adapter → the implementer** (FUI ships its own; a customer ships theirs).
  Layer-3 vision → Plateau ([#475](#no-leakage-client)). This **re-points #1565's** autonomous-explorer
  split: engine **interface** → WE, engine **impl** + product CLI chrome → Plateau (#1576/#1577), bindings →
  each implementer. Distinct from [reproduction-conformance](#reproduction-conformance)'s *deterministic-diff*
  engine (#1225), which is FUI (it diffs FUI's own reproductions, not a cross-implementer conformance suite).

**Embed mechanism *inside* a Plateau dev-tool (#1654).** Once a tool is placed in Plateau, how it mounts
its *own* surfaces is a trust/origin question, not an iframe-by-default one. A Plateau dev-tool's chrome and
its own same-bundle, same-origin trusted panels (e.g. the **dev-browser shell** mounting plateau-app's
Technical/Intent Configurator + Profiles via `mount*(el)`) use a **direct in-process import** — an iframe
there is pure tax *and* would forbid the DevTools-style docked-chrome control that is the point of the tool.
iframe + origin-validated `postMessage` (the [we-fui-embed-boundary](#we-fui-embed-boundary) bus) is reserved
for genuinely **cross-origin / untrusted** surfaces. The **app under test** the dev-browser loads is *not*
such a web iframe: per [#141](../../backlog/141/) the dev-browser is a **Chromium/extension** shell, so the
loaded app is a real privileged page introspected via the source-awareness substrate (#562) + live-patch
(#410) — a privileged-introspection boundary, not a `fui-embed` channel.

**The "every developer tool → Plateau" reading is *mostly* right, with one WE residual:** the conformance
**contract** — the verifier *interface* + the vector/golden corpus + schema (declarative data) — stays in
the standard layer (#1467/#817, [constellation-placement](#constellation-placement) rule 1). What moves to
Plateau is the verifier **implementation** + the **run** (#1566); what stays FUI is the per-target
**binding**. The only thing the blanket reading still gets wrong is dragging the *contract/vectors* out of WE.

**Lineage:** #1565 (ratified 2026-06-22; research topic `/research/devtool-placement-constellation/`);
**amended by #1566** (ratified 2026-06-22) — verifier *implementation* + conformance *run* move WE→Plateau;
WE keeps the declarative *contract* (interface + vectors + schema) only; this overturns the prior "verifier
stays WE" carve-out and re-points the engine split above. Composes
[constellation-placement](#constellation-placement), [we-fui-embed-boundary](#we-fui-embed-boundary)
(#809), [no-leakage-client](#no-leakage-client) (#475), [reproduction-conformance](#reproduction-conformance)
(#1225), and `project_conformance_verifier_vs_subject` (#1467, amended). Unblocks #1553.
**Refined by #1654** (ratified 2026-06-23) — the embed-mechanism rule above: a Plateau dev-tool's own
same-bundle trusted panels mount by direct import; the dev-browser's loaded app is a privileged-introspection
boundary (#141/#562/#410), not a web iframe. Unblocks the #1391 `S5` panel-embed slice.

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

**Converse guard — "technical strategy → Configurator" does *not* license a Configurator domain that
re-homes axes the config already carries.** When the technical axes already ride a `we:`-layer registry +
config-flavors (e.g. the credential-creation policy slots on `CustomCredentialProvider` + #483), minting a
`plateau:` Configurator domain over them is redundant cross-layer duplication, not the rule's intent. The
UX intent **references** those axes as constraints; it neither owns them nor justifies a second product-layer
home for them. The free *authorial* UX choices the ceremony leaves open (when to prompt, skippability, tone,
surface) are what the intent standardizes. #499 (credential-enrollment intent = the `create()`/enrollment
UX layer; technical creation axes stay on the #483 config, referenced not re-homed; the plateau Configurator
domain dissolved as redundant — re-judged on pure merit after a zero-consumer demand-gate "hold" was rejected).

**Lineage:** #030 (intent-vs-trait channel split) · #063 (native vocabulary) · #129 (guard intent
re-framed) · #499 (enrollment intent; converse-guard) · #634 · #1408 (durable-anchor contract split) · intents-open-design.

### Intent-conformance is compliance of a block against the intent contract — not a runtime gate {#intent-conformance-is-block-compliance}

An **intent is an interface; blocks (components/behaviors) implement it** — indirectly, via the
build-time resolver ([`we:webtraits/intentProfileResolver.ts`](../../webtraits/intentProfileResolver.ts)):
the intent never names a trait, the resolver maps the active profile → traits (keeps intents UX-only,
traits technical). An intent with no implementer does nothing, like an unimplemented interface. So
"**conformance** of an intent" means *does the implementing block satisfy the intent contract* — **not**
a runtime DOM watcher, and faking a tie is forbidden. It splits two ways:

- **Static / contract conformance** — does the block declare the required `intentDimension`s / bundle the
  required traits? Checkable in **WE at build time** (resolver / `we:webcases/requirementValidator.ts` shape).
- **Behavioral conformance** — does the *rendered* component behave per the intent? Needs a running
  subject: **contract → WE**, **runner/verifier → Plateau** (neutral, so *any* implementer consumes it —
  FUI is one subject, not the verifier's home), **subject → FUI**.

Never smuggle a conformance run into a *consumer* of traits (e.g. docs chrome) — that is silent
scope-expansion. The active intent profile is already present in the runtime DOM as `data-intent-*`
(plus element-level `action-intent` etc.), so *surfacing* an intent for inspection is a read-only,
near-zero-cost dev-tool, distinct from *checking* conformance.

**Lineage:** #947 (this semantic call) · #1566/#1576/#1597 (verifier→Plateau placement) · #934 (the
descope that triggered it) · #1657 (intent-inspector card) · [[project_conformance_verifier_vs_subject]].

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
5. **Dev-surface paid flagship (#1590):** the paid product is the **licensed local dev-browser
   (fixed-cost, JetBrains/Sublime model)**, not a SaaS — *recurring* server/support cost is the
   dominant solo-dev risk, so the on-device fixed-cost surface leads; SaaS is an optional *later* tier
   (its recurring cost is a liability, not a reason to lead). Extensions are the free funnel. **Build
   is decoupled from release timing**: pursue the product now, switch on paid release later.
   - **In-shell free/paid line (#1655, soft-accepted):** two **orthogonal** gates, not a
     per-capability map. **Gate 1 — commercial-use license:** the *whole local browser* (every
     local fixed-cost feature) is free for **non-commercial / individual / OSS / learning** use,
     paid for **commercial** use — a use-context license, not a feature split (no Community/Pro
     local subset: fixed-cost features give no structural hook to split). **Gate 2 — server-cost
     tier:** any capability that **requires a server to run** (hosted sync/collab/share-links,
     per-call AI) is **paid for everyone**, non-commercial included, as cost-recovery. Local
     persist/export/write-back (local repro export, fixtures, safe-edit→PR) stays **free** — only
     the *server-backed* variant is paid (faithful to #775's "deterministic+local = free; hosted =
     paid" line; the "persist/write = paid" read-vs-act framing over-reached).

**Lineage:** #098 #185 (licensing / GTM) · #089–#093 #086 (open-core constellation) · #182 #183
(licensing/payments) · #451 (MaaS tier) · #775 (assembler open-core) · #410 #141 #166 · #665 #690
(self-driven framing) · #1590 (dev-surface paid flagship = local fixed-cost browser; build
decoupled from release). *Confidence: principle firm; specific knobs provisional.*

### A separate product brand is earned by structural product-distinctness, not appetite {#brand-on-distinctness}

> A positioning sibling to [§ monetization](#monetization): *never brand on a shifting category*. A
> sub-component gets its **own marketed product brand only when it has a real standalone consumer
> surface** — not to *drive* the adoption that would *create* the case (the circular, appetite-based
> move the monetization rule forbids).

1. **Structural test:** a thing earns a separate brand when ≥1 consumer depends on it **without**
   depending on the parent product — the `ReactDOM`/`Rollup` case (shipped to millions directly), not
   the `@lit/reactive-element` case (a sub-package Lit does **not** separately market).
2. **Default is fold.** A sub-package identity under the constellation/Frontier-UI brand is the
   *cheapest* path to a later split — folding forecloses nothing; the npm scope + contracts already exist.
3. **webplugs ruling (#642):** `@frontierui/plugs` **folds** — no separate brand. Per #606 the plugs
   runtime is a POC with no standalone product surface and one consumer (plateau-app). **Un-park** only
   on the structural event: webplugs gains ≥1 external consumer that depends on it *without* depending on
   `@frontierui/blocks` / FUI components. Brand on that event, never on appetite.

**Lineage:** #606 (code home + brand deferral) · #775 (soft/revisitable monetization) · #642 (this
ruling). *Confidence: high — structural test + un-park trigger firm.*

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

### WE-compliance validation = a dev-browser lens, not a hosted SaaS {#compliance-validation-home}

WE-compliance validation (run the conformance vectors against a design system, get a report) lives as a
**dev-browser lens** ([#141](../../backlog/141-dev-browser-vision.md) Chromium/extension shell;
[#1636](../../backlog/1636-role-scoped-lenses-over-one-dev-browser.md) role-scoped lenses; Plateau-layer
per [constellation-placement](#constellation-placement) / #1565), **not** a hosted upload SaaS. We **just
analyse the page in front of us**: the conformance engine runs consumer-side (#891/#954), so the lens runs
WE vectors against the loaded subject *in the user's own browser* — no upload service, no server-side
execution, **no per-uploader credentials held by us** (any auth to reach the user's own page is the user's
own credential in their own password manager). It consumes WE vectors+runner as a
[no-leakage client](#no-leakage-client) (#475); standard + engine never leave WE (#855).

**Two distinct products — separate them:** (1) the **self-validation lens** above is the non-speculative
product and where compliance validation lives; (2) a **trusted third-party badge/attestation SaaS** (an
independent party vouches to the market) is a *different*, demand-gated product. A self-run lens can only
self-attest, so a trusted badge is not the same thing. **Only product (2) would ever need the
plateau-app-domain-vs-own-constellation-project granularity call** — revive it (and the structural
identity/credential test in #966) only if a hosted attestation product is actually demanded.

**Lineage:** #966 (this ruling) · #141/#1636/#1565 (dev-browser home) · #891/#954 (consumer-side engine) ·
#475 (no-leakage client) · #855 (standard/engine stay in WE). *Confidence: high — fits a settled surface,
reversible, trigger-armed.*

**Lineage:** #1033 (interactive design-review loop) #1034 (critique rubric) #490 (build epic) · #475
#488 (on-device fixed-cost floor) · #511/#512/#513 (Tier 1 tooling/training) #1073 (Tier 2 epic) #485
(hosted teacher bridge) #141 (dev-browser home) #514 (ONNX/WebGPU runtime). Promoted from
[vision-tiers.md](vision-tiers.md) per #1244. *Confidence: architecture firm; on-device-vs-hosted for
the rich tier provisional.*

### Trainable judge — portable corpus, Plateau-owned learning, advisory output {#trainable-judge}

The autonomous explorer's judge ([#1552](../../backlog/1552/)) is made **trainable** from human feedback
on real runs, without ever becoming a gate or leaking the capability. Four rulings, all extending
[no-leakage-client](#no-leakage-client) + [vision-tiers](#vision-tiers) and cross-referencing
[devtools-placement](#devtools-placement):

1. **Two composable feedback channels, both captured.** A *verdict on a candidate* trains precision +
   severity; a *missed-issue capture* (a human authors a finding the judge never flagged) is the **only**
   channel that trains **recall**. Verdict-only is a strict subset that caps the perceptual ceiling — so
   capture both. **Label anchor:** a frozen-frame corpus keyed on `stateId` for eval/training (no spatial
   replay), plus a composite spatial anchor for missed-issue authoring — `stateId` gates the match, **bbox
   primary, a11y-role/text tiebreak, DOM-path debug-only**.
2. **Learning mechanism = k-NN → probe → parked fine-tune.** k-NN over **cached DaViT vision-encoder
   embeddings** at cold-start (on-device, free, works from the first label) → **linear/logistic probe** on
   the same cache at ~tens of labels (eval-gated) → full VLM fine-tune parked past ~1k labels (server-side).
3. **Agent-portability is a hard constraint** (the zero-lock-in seam extended from inference to training):
   the **asset is the model-agnostic corpus** (`{frozen frame, domSnapshot, stateId, verdict, anchor, label
   vocab}`); **embeddings are a re-derivable cache** keyed `(encoder-id, frame)`; **the recipe is
   encoder-parameterized**, so swapping the judge agent ⇒ re-embed + retrain, zero data loss. A
   train-disjoint, variant-rich **held-out regression benchmark** (bad-pattern catalogue + false-positive
   traps) scores *outputs*, so it validates any judge agent and is **CI-gated on accuracy** — distinct from
   the judge's *output*, which stays advisory and **never gates an explored run** ([#1172](../../backlog/1172/)).
4. **Constellation boundary (three-way split, per [devtools-placement](#devtools-placement)):** **Plateau
   owns the implementation** (model/embeddings/store/training/#490 distillation — extends the
   #1073/#475/#490 vision service); **WE owns only the contract** (the `JudgeModel` type / judgment schema,
   never any impl, per [#1282](../../backlog/1282/)); **the explorer dev-tool produces the signal + hosts
   the seam** from its Plateau-side orchestration/report tier (the human + `improve-explorer` loop is the
   actual consumer). Only outputs cross the seam; a FUI-local judgment provider is the fragmentation #475
   forbids.

**Lineage:** #1553 (this decision) · #1552 (epic) · #1565 ([devtools-placement](#devtools-placement)) ·
#489 (frame/verdict pairs) #1168 (DOM-signature stateId) #1034 (critique rubric) #490 (distillation) ·
#1073/#475 (vision service). *Confidence: architecture firm; escalation-trigger label count provisional.*

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

### An interchange Protocol whose family is project-less gets a thin protocol-host project — never owner-less, never mis-homed {#protocol-host-project}

A WE Protocol entry (`src/_data/protocols/*.json`) **structurally requires** an owning project: `validateProtocol`
(`scripts/check-standards-rules.mjs:772-789`) makes `ownedByProject` + `anchor` required fields, rejects an owner that
doesn't resolve in `projects.json`, and demands a `<section id="protocol-<id>">` anchor in the owner's
`src/_includes/project-<id>.njk` — its rendered catalog home. There is **no project-less escape hatch** (all 39
protocols are owned). So when a ruling makes a *family* project-less (intent + block, no orchestration domain) yet
also extracts its serialized form as a first-class Protocol, the two collide at mint time. **Resolution: mint a thin
*protocol-host* project that owns only the schema** — the Protocol entry, its anchor, and its round-trip conformance
vectors, **nothing behavioural.** The intent + block stay project-less; only the interchange *schema* gets a home.

This is **not** a re-open of the family's no-project ruling: a host owning *only* the schema is a different category
from the impl/orchestration domain a "no project" ruling rejects — the standards world homes interchange formats in
dedicated host/registry surfaces (glTF→Khronos 3D Formats WG, OpenAPI→OpenAPI Initiative), **never owner-less**, and
docking-style incumbents share *no* coordinating body, so WE must home the schema itself. **Do not** attach the
Protocol to an unrelated existing project (mis-homing — conflates entity classes, blurs that project's meaning), and
**do not** relax the required-owner invariant to serve one protocol (erodes a rule all others satisfy on exactly the
surface — the escapable lock — that most needs to stay crisp). The model-relaxation path (`ownedByProject` optional
iff `ownedByIntent` resolves + an intent-anchored rendering path) is the **dormant escape**, engaged only if the
host-vs-reopen category split is rejected.

**Lineage:** #1653 (dockable layout-tree Protocol → owned by a new thin `weblayout` protocol-host; #1437 Fork 1's
project-less family + Fork 2's first-class Protocol both honoured; skeptic SURVIVED — host ≠ reopen; ratified
2026-06-23; unblocks #1486's mint). Kin to [composition-artifact-ownership](#composition-artifact-ownership),
[constellation-placement](#constellation-placement), [minimize-lock-in](#constellation-placement).

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

### Persistent-B element over a data-array kernel: source by typed property, not markup parse {#persistent-b-data-source}

A **persistent-B** `we-` element (the styled, light-DOM, **no-shadow** element hosting a kernel — per #1457)
whose kernel **renders the semantic DOM from a data array** (e.g. `TreeSelectBehavior(host, nodes, opts)`,
which does `host.innerHTML = ''` then builds) sources that array from a **typed property** (`.nodes` /
`.items` / `.rows`), mirroring `fui:blocks/wizard/WizardElement.ts` (property-sourced render-from-data) —
**not** by parsing author light-DOM markup. Markup-parse-as-primary is rejected *for this kernel shape*: peers
that treat markup as source-of-truth (native `<select>`, Open UI, `<sl-tree>`) do so behind a **shadow root**;
a no-shadow render-from-data kernel **destroys** any parsed markup on its first `innerHTML=''`, so the parse is
ceremony with negative payoff. The typed property is the floor. An **optional** declarative form is a binding
expression on the element's **own** observed attribute (`nodes="[[ data.tree ]]"`), resolved in the element's
own lifecycle by reusing `we:plugs/webexpressions/CustomExpressionParser` as a library — explicitly **not** a
globally-registered `CustomAttribute` over arbitrary elements (that is a framework-grade any-element binding
surface WE avoids); for data-array content, binding a *reference to a data source* is the right declarative
form, not hand-authored structural markup. **Scope guard:** this is specific to **render-from-data** kernels;
a **light-DOM-scan** kernel (`CustomAttribute` enhancing authored markup in place — type-ahead, data-grid,
stepper) has *no* data-source fork and mirrors `StepperElement` verbatim.

**Lineage:** #1570 (ratified — tree-select data-source; #1568/#1569 confirmed fork-free). Consumer refinement
of #1457 (support-both, element-over-behavior). Builds: #1567.

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

### Authoring form ids are distinct from consume-mode wrapper ids; served source emits as data, the endpoint owns transpile {#authoring-form-id-distinct-from-consume-wrapper}

An **authoring form** (lowers a `<component>` definition to a target shape — e.g. `functional`, `wc-class`)
and a **consume-mode wrapper** (wraps an *already-built* artifact for a framework — e.g. `react-wrapper` via
`genWrapper`) are **distinct artifact kinds in disjoint id-spaces**, reached by different endpoints. One
stable id per authoring form; **never alias an authoring form id onto a consume wrapper** — that is exactly
the ambiguity #977 removed. WE owns one neutral catalog-gated `form` param; the value-set is the serving
runtime's injected catalog ([impl-is-not-a-standard](#)).

The served authoring artifact follows a **data-emit-for-display / endpoint-for-execution split**: WE's
deterministic `serve()` emits the authoring *source* as data (#954 channel →
`we:src/_data/authorModeSource.json`) for the panel to *display*; the *mountable* artifact is transpiled at
the FUI endpoint via the injected `compilerRegistry` (the delivery layer registers the compiler), the same
rule as `genWrapper` transpile. FUI reads the emitted data and **never imports WE's `serve()`**.

**No-consumer corollary:** a backward-compat shim (e.g. a retired-form alias served as a deprecation
redirect) with **zero real callers** is dead weight — verify the consumer graph, then **drop it rather than
design around it** (e.g. rename a colliding id). No consumer ⇒ no backward-compat obligation.

**Lineage:** #1619 (ratified — FUI functional-component adapter shape) · #954/#956 (data-emit channel) ·
#974/#977 (wrapper-form catalog + `functional` retirement) · #700 (emit placement). Refines
[runtime-DI-seam](#runtime-di-vs-devtools-provider-seam) (the `compilerRegistry` endpoint seam) and
[constellation-placement](#constellation-placement) (contract+data → WE, serving endpoint → FUI).

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

### A boolean flag is an access-control gate; a multivariate flag is the experiment intent — same provider shape, different outcome family {#flag-gate-vs-experiment-selector}

"Feature flag" is an **overloaded incumbent word** that splits by outcome family ([decompose-overloaded-vocabulary](#decompose-overloaded-vocabulary-by-semantic-source)). A **boolean** flag (on/off) **IS the access-control gate**: it is `authority: feature-flag` on the [access-control](/intents/access-control/) intent over the **Guard** provider seam — its outcome is **allow/deny**, a trust-crossing authz mirror. A **multivariate** flag (one of N arms) is the separate **[experiment](/intents/experiment/) / variant-assignment intent**: its outcome is **pick-one-of-N** (a rendering choice, **no security semantics** — an arm is not an authz verdict), resolved by a *distinct* evaluation provider (`@webeverything/contracts/experiment`, returning `{value, variant, reason}`). The two **reuse the same provider *shape*** (native-first default → project override → custom plug) but must **never re-conflate**: different outcome families, different trust boundaries. OpenFeature's own typed-flag distinction is the upstream precedent — a **boolean** flag is a gate, a **string/object** flag is a selector.

**Lineage:** #1414 (placement: feature-flags vs experiments) · #1481 (this note) · #1479 (experiment intent + evaluation-provider contract). Sibling of [decompose-overloaded-vocabulary](#decompose-overloaded-vocabulary-by-semantic-source) and [intents-ux-only](#intents-ux-only).

### A multi-strategy concern is a configurable dimension; default extends the platform {#config-extends-platform-default}

When a concern has **more than one legitimate end-state** (e.g. auto-define: explicit / eager-barrel /
on-import / on-first-use / build-parse / declarative-map / convention / SSR), model it as a
**configurable strategy dimension** — never bake one mechanism (the *dimension-vs-fixed-mechanic* rule).
The **default is the most-permissive / native-first** value, with the restriction as the author's opt-in.
Defaults live in a **project config that *extends* a fully-defined platform default** (flavors); the core
tool/registry itself stays **default-less** (core `CustomRegistry` `extends`; the JSX render-strategy axis
is the precedent).

**Where those values materialize (#1662).** Storage is **per-dimension**: each dimension stores its value +
its own `extends`-to-flavor chain independently (the `CustomRegistry.extends` shape generalized — an
*open-set* dimension *is* a `CustomRegistry` subclass; a *scalar/mode* dimension realizes the same chain as a
plain config object). **File-count ≠ schema-coupling**, so the project **author surface defaults to one keyed
file** (`webeverything.config.{ts,js,json}` — one key per dimension, any key *extractable* to its own file;
`most-flexible-default`). A **unified config file as the authoritative SoT is rejected** (god-schema coupling
+ project-facing-format lock-in); a unified surface is supported **only as a derived, non-authoritative
discovery view** (a resolver that *reads* the per-dimension configs). `extends` is an ordered **nearest-wins
array** (lazy lookup, *not* a destructive merge); the same chain nests platform→project→app→fragment, so
settings scope to any subtree (runtime DI) and unregistered strategies tree-shake out. The discovery-view and
config-loader *builds* are separately prioritized, not triggered by this ruling.

**Lineage:** #227 (auto-define strategy axis) · #080 (render-strategy precedent) · #1662 (materialization:
per-dimension storage + one-keyed-file author surface + discovery-view). Process forms in [conventions.md](conventions.md) / [architecture.md](architecture.md).

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

### Tone is a shared token palette + a meta-contract, never a flattened cross-intent enum {#tone-meta-contract}

A semantic **tone** (an intent's `neutral`/`danger`/`success`/… value) names a **semantic color/severity
family the theme resolves — never a per-component hex** and never a behavior. Sharing happens at **two**
layers, and only those: (1) a shared **token palette** in webtheme — `--tone-{neutral · danger · success ·
warning · info · critical}`, the **severity family only**, scheme-aware via native `light-dark()`; and (2) a
shared **meta-contract** (the dimension is named `tone`; a canonical synonym table normalizes spellings —
`danger ≡ negative ≡ error`, `success ≡ positive`, `warning ≡ caution` — so the theme resolves any synonym
to one token; `neutral` and `info` stay **distinct**, collapsing them is lossy). The **value enum stays
per-intent** — never a single flat cross-intent vocabulary (the Bootstrap `btn-warning` smell). **Membership
test for the shared palette:** a value enters `--tone-*` only if it *differs only in semantic color, not in
behavior/lifecycle* — so `progress` (a lifecycle state, status-indicator) and `categorical` (non-severity
identity color, tag) **fail it** and stay **intent-local tokens**, never absorbed into the palette. This is
[open-numbered-variants](#open-numbered-variants) applied a second time (variant → tone): DRY where it's real
(palette + contract), divergent where it's real (the per-intent enums). **Test:** *does the value differ only
in color, or also in behavior/lifecycle? and is the difference a synonym of a canonical token?* — color-only +
synonym → the shared palette; behavior/lifecycle → intent-local.

**Lineage:** #1427 (cross-intent tone vocabulary — ratified 2026-06-21; #1337 spinoff, surfaced by the #1400
ARIA-APG lens). Realizing builds: #1458 (the `--tone-*` webtheme palette + this statute), #1459 (the per-intent
`severity`→`tone` rename + synonym normalization sweep). Second application of
[open-numbered-variants](#open-numbered-variants); composes [native-first-baseline](#native-first-baseline).

### Theme tokens are JS-first; the injector is the source of truth, CSS custom properties are a one-way projection {#tokens-js-first}

The **runtime source of truth** for a resolved theme token (colour, layout, spacing, font, radius — **every**
CSS-relevant value, not just colour) is **JS, held in the injector** WE already ships (`we:plugs/webinjectors/`
+ `webcontexts`). Any JS reads it **synchronously, off-DOM, with no cascade and no loop**. From that one
source a CSS custom property (`--token-*`) is **emitted one-way (JS→CSS)** for the declarative **paint** path
— cascade, light-DOM scope (the `scoped-token-override` semantic), dark-mode, zero render cost. **Direction is fixed:**
JS→CSS only; CSS custom properties are **never the source** and are **never hand-authored in parallel** (single
source ⇒ the two projections cannot drift). **Components read the injector to *know* their theme; CSS vars
exist only to paint** — `getComputedStyle` is **never** in the compute path. **Why CSS cannot be the source
(browser-validated #1682):** a detached element resolves an inherited/scoped var to `""` (no constructor /
pre-attach read); a worker/OffscreenCanvas, a `console.log("%c", …)`, SSR, and a test have **no element at
all**; and the `connectedCallback` read, even when it resolves, is a forced sync style recalc and the earliest
possible point (deferring to a later loop reintroduces FOUC). **Test:** *does JS need this value before/without
a painted element?* → read the injector, not CSS. This **refines the `design-tokens` protocol's runtime tier**:
"each resolved token compiles to a custom property" now reads — the **injector is the runtime source; the
custom property is the derived projection**. The categorical-taxonomy work (#1670) is one consumer: category
vocabularies are a JS-first token family (`--cat-*`), **not** a new provider/registry.

**Lineage:** #1682 (ratified 2026-06-23 — JS-first token SoT + one-way CSS sync; emerged from the #1670
categorical-taxonomy discussion). Realizing build: #1683 (injector resolves the theme; one-way CSS sync;
migrate the hand-authored `we:src/css/style.css` `:root` vars). Consumer: #1670 (categorical taxonomy).
Refines the `design-tokens` protocol; composes [tone-meta-contract](#tone-meta-contract) (the `--tone-*`
palette is one such emitted token family) and [native-first-baseline](#native-first-baseline).

### Categorical vocabularies are a closed-set token-family meta-schema; behaviour-owned axes (status) are excluded {#categorical-taxonomy}

An app's **categorical vocabularies** (`kind`/`tier`/`size` — closed lists reused across many surfaces:
badge, tag, numbered circle, link-pill, filter chip, border) are **one JS-first token family** — each
`(set, value)` row carries `{ token-ref, icon, shape }`, realized as `--cat-<set>-<value>-*` on the
[tokens-js-first](#tokens-js-first) runtime and synced to CSS. **There is no new "taxonomy provider" or
runtime registry** — the contribution is the **meta-schema + closed-set discipline** (a value resolves to a
token, never an author-supplied hex; the set vocabulary is *open* — an app adds `size` without touching
components), layered on the existing injector. Surfaces consume by `(set, value)`, blind to the rest; this is
what lets a category be **defined once** and read identically everywhere instead of re-hardcoded per macro.
**Membership test — what is a categorical set:** a *pure-presentation* axis with **no behavioural owner**.
**`status` fails it and is excluded:** the Web Lifecycle protocol owns which status values exist + their
transitions, and `lifecycle.json`'s `realizesIntent: status-indicator` already assigns status *presentation*
to the **Status Indicator intent** — so status lives end-to-end in lifecycle + Status Indicator, and
cross-surface reuse comes from **sharing that component**, not smuggling a status colour-row into the
categorical taxonomy (which would fork lifecycle authority + recreate a two-place join). Same boundary as
[tone-meta-contract](#tone-meta-contract)'s palette-membership test (`progress`/lifecycle ⇒ intent-local, not
the shared palette), applied to the categorical layer.

**Lineage:** #1670 (ratified 2026-06-23 — Fork 1 dissolved into [tokens-js-first](#tokens-js-first); Fork 2:
status excluded, lifecycle/Status-Indicator-owned). Consumers: #1669 (`we-tag`), #1598/#1208 (taxonomy-surface
migration). Composes [tokens-js-first](#tokens-js-first) and [tone-meta-contract](#tone-meta-contract).

### Curated-corpus credibility weighting: two-stage admission⟂weight, GRADE-shaped, config-extends-default {#credibility-weighting}

When WE curates a corpus of external sources and must rank them by authority (the design-knowledge
corpus is the first; the shape generalizes to any admitted-and-weighted source set), settle it as
**three orthogonal axes**, never a frozen source list (open-design: custom/project sources must
coexist). **(1) Admission ⟂ weight = two-stage.** A permissive **provenance/content admission floor**
(identifiable + traceable-to-origin + on-topic — **not** a quality bar; "authoritative" means
*attributable*, not *credible*) gates in/out; a **separate scalar weight** is computed only for
admitted sources. A low-credibility custom source is *admitted-but-downweighted*, never excluded —
collapsing admission into a weight-≥-threshold test breaks the open posture. **(2) Weight = GRADE-
shaped.** A **baseline tier from source-`kind`** + a **small fixed, named, *optional* set** of up/down
modifiers; each *applied* modifier records a **rationale + attribution** (only staleness is
deterministic). Flat-tier-by-type is the *degenerate config* (no modifiers), not a rival; a free
per-source number is rejected (un-auditable). The named-vocabulary + mandatory-rationale constraint is
exactly what keeps it auditable rather than re-inventing the free number. **(3) Governance =
[config-extends-platform-default](#config-extends-platform-default).** WE ships the **meta-schema**
(kind enum + modifier vocabulary + computation function) **+ a default flavor**; a project extends
weights / adds kinds & modifiers. **Freeze the meta-schema as the comparable spine**; **cross-project
*absolute* weight comparability is a non-goal** (intra-corpus *ordering* is the only contract — revisit
only if a cross-corpus consumer lands); add a **nonzero floor** on admitted sources so weight-to-zero
can't covertly re-exclude (mirror of axis 1's guarantee). Specializes
[surface-contract-not-computation](#surface-contract-not-computation) and
[config-extends-platform-default](#config-extends-platform-default); internal precedent is
`benchmarkCorpus.json`'s `selectionCriteria`+`inclusionRule` multi-criteria gate (binary inclusion for
coverage, here extended with a weight axis for credibility).

**Lineage:** #1588 (ratified 2026-06-22; child of the #1585 design-knowledge intake program; prep
survey `reports/2026-06-22-design-knowledge-source-admission-credibility.md`). Graduating build: #1591
(meta-schema + computation function + default flavor); tunable-weights Configurator: #1592; consumers
#1586 (ledger weight column) #1587 (rubric provenance) #1589 (distillation). All three forks survived a
refute-only skeptic pass.

### One canonical introspection slot — render alternate subject forms into it, never duplicate the surface {#single-introspection-slot}

An explorer / workbench has **one** canonical render target (the "stage") that its introspection panels
(inspector, event-log, anatomy) read **generically off the rendered DOM**. When an *alternate form* of the
subject must be shown — a cross-origin framework live-mount, a different framework's wrapper, a future
device-frame — it **renders into that same slot**, not into a second pane with its own parallel
introspection wiring. Prior art is unanimous (Storybook / Histoire / Ladle / Bit all read one canvas
framework-agnostically; a separately-wired second introspection target is the surveyed anti-pattern). The
enabler is that the live wrapper mounts the **real custom element** and forwards attrs+events, so native
bubbling + computed-style + the CEM declaration all keep working — the alternate form is *the same subject
re-mounted*, not a new one. A "render beside source" view is **additive** (a non-introspected display), not
a rival target, so it never forks the slot. **Tell:** a proposal to "add a preview pane" that re-derives
events/computed-style/anatomy — that's duplicating the introspection surface; route it through the stage and
resolve the nested subject node instead. Cost is the **subject-node resolution** + **prop-routed control** +
**`unmount()` lifecycle** seams, materially less than a second surface.

**Lineage:** #1594 (ratified 2026-06-22; render the `?form=react-live` live-mount into the stage, not a
separate pane; prep survey `reports/2026-06-22-workbench-live-render-target.md`; skeptic
SURVIVES-WITH-AMENDMENT — the three seams fold into the #1030 build). Under polyglot-sandbox #912; sibling of
[compose-intent-dont-duplicate](#compose-intent-dont-duplicate) (reuse-don't-duplicate, render-target face).

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
- **Backlog hold model** — two mechanisms for two jobs (#1620, amends #1392): `priority: low` *demotes*
  from auto-select but stays visible (settled-but-low-value-now); `maturityGated` (+ a typed, external
  `maturityTrigger`) *removes* until build-now-stops-being-worse. Parking is never a prioritisation escape →
  [backlog-workflow.md#hold-model](backlog-workflow.md#hold-model).
- **Program definition — the strict bar for a perpetual `ongoing` epic** (four-part Program Test:
  standing goal + conformance front + currency front + cadence; watch mode is a lifecycle state;
  L0→L2 maturity ladder; "evergreen" = the property a program maintains) →
  [backlog-workflow.md#program-definition](backlog-workflow.md#program-definition).
- **Prove claims by observation** → AGENTS.md hard rule 7 / [testing.md](testing.md).
