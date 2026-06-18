---
type: decision
workItem: story
size: 3
parent: "076"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#component-dc
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
preparedDate: "2026-06-17"
relatedReport: reports/2026-06-17-854-scope-declarative-scoped-registration-spelling.md
tags: [webcomponents, component, declarative, scoped-registry]
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# `scope=` declarative scoped-registration spelling on `<component>`

The **runtime** for scoped autonomous elements is fixed — [#228](/backlog/228-scoped-autonomous-element-construct-and-lifecycle/) (resolved 2026-06-10) landed the construction fix so a scoped `CustomElementRegistry` produces real-class instances. What is **still unsettled is the author-facing design**: how a `<component>` definition *declares* it registers into a scoped registry rather than the global one, and how that aligns with the native scoped-registry proposal. Carved out of epic [#076](/backlog/076-component-declarative-wc-apis/) as its own `type:decision` child.

## Grounding digest

**Tree (verified this prep):**
- **The lowering registers GLOBALLY today.** [`we:declarativeComponent.ts:162`](../blocks/renderers/component/declarativeComponent.ts#L162) emits `customElements.get(tag) ?? customElements.define(tag, Cls)` — the global registry. Targeting a scoped one needs a *registry reference* the generated code can call `.define()` on.
- **WE's runtime is already object-keyed (no string id).** The scoped-registry plug constructs with object references + hierarchical inheritance: `new CustomElementRegistry({ extends: CustomElementRegistry[] })` ([`we:plugs/webregistries/CustomElementRegistry.ts:41`](../plugs/webregistries/CustomElementRegistry.ts#L41)); #228's `ensureNativelyConstructible` registers the real class under a private tag ([same file, :28](../plugs/webregistries/CustomElementRegistry.ts#L28)).
- **#242 already reserved the imperative seam.** The Auto-Define registry (resolved) ships a `RegistryScope` token ([`we:auto-define/defineElement.ts:47`](../blocks/renderers/auto-define/defineElement.ts#L47)) and `AutoDefineStrategy.define(tag, ctor, scope?)` ([same file, :79](../blocks/renderers/auto-define/defineElement.ts#L79)), default global. So *imperative* scoped placement has a home — the lowering passes a scope to `define`. **Tension to reconcile:** that token is `{ readonly id?: string }` — a *string* id, which the native survey says has no platform analog.
- **The block page pre-commits to the contested spelling.** [`we:component.njk:105`](../src/_includes/block-descriptions/component.njk#L105) + [`:149`](../src/_includes/block-descriptions/component.njk#L149) already describe a "Tier-2 `scope` attribute … global by default" — a **presumption** this decision may overturn; reconcile the page at ratify time.

**Prior art (this prep — full survey in [the related report](../reports/2026-06-17-854-scope-declarative-scoped-registration-spelling.md), research topic [`scoped-registry-declarative-spelling`](/research/#scoped-registry-declarative-spelling)):**
- **The native proposal SHIPPED and keys on objects, not strings.** Scoped Custom Element Registries merged into the WHATWG DOM/HTML Living Standard 2025-04-14 ([whatwg/dom#1341](https://github.com/whatwg/dom/pull/1341); revamp [whatwg/html#10854](https://github.com/whatwg/html/issues/10854)). A registry is `new CustomElementRegistry()` — a **JS object with no name/id** — bound to a subtree at `attachShadow({ mode, customElementRegistry })` (option `customElementRegistry`, **not** `registry`), late-bound via `registry.initialize(root)`. No option ⇒ global. **Shipped Chrome/Edge 146 + Safari 26**; Firefox in progress ([bug #1874414](https://bugzilla.mozilla.org/show_bug.cgi?id=1874414), Interop 2026) — 2-of-3 engines.
- **A declarative form exists but is boolean-only by design.** `shadowrootcustomelementregistry` on `<template shadowrootmode>` ([Chrome blog](https://developer.chrome.com/blog/scoped-registries); serialization [whatwg/html#11892](https://github.com/whatwg/html/issues/11892)) is **presence-only**: it marks a DSD root's registry as `null` (awaiting init) and **cannot name a registry** — you bind one from JS afterwards. *The platform shipped a declarative form and deliberately declined to put a registry id in markup.*
- **No library uses a string-id scope.** [@open-wc/scoped-elements](https://open-wc.org/docs/development/scoped-elements/) (`static scopedElements = {tag: Class}`), [Lit `scoped-registry-mixin`](https://www.npmjs.com/package/@lit-labs/scoped-registry-mixin) (`static elementDefinitions`), and the [@webcomponents polyfill](https://www.npmjs.com/package/@webcomponents/scoped-custom-element-registry) all key on a registry **object** reachable via the host class.

## Axis-framing

The native model splits scoping into **two concerns the original `scope=` fused**:
1. **Consumption** — which registry the markup *inside* the component's shadow root resolves against. Native: `attachShadow({customElementRegistry})` (imperative) + `shadowrootcustomelementregistry` (declarative, boolean). Subtree-keyed, **has a declarative form**.
2. **Definition placement** — which registry the `<component name>` definition *lands in*. Native: `registry.define(tag, cls)` — **imperative only, no declarative form at all.**

`<component>` is a *definition* element, so its instinctive scope question is the placement concern (#2) — exactly the one the platform gives no declarative spelling. The decision is therefore **what author surface, if any, expresses scoped registration**, decided by the native-first invariant (a forced WE invariant: align to the platform, don't invent). The lowering impact is a *consequence* (already seam-ready via #242's `RegistryScope` / `define(tag, ctor, scope)`), and native alignment is the *deciding criterion*, not a separate fork — so the three original bullets collapse to **one genuine fork**.

The recommended default **reverses the item's title**: a string `scope="<id>"` is the branch native-first *excludes* (the platform shipped a *boolean* declarative form and refused string registry ids; every library keys on an object; a string scope reintroduces the global string namespace scoping exists to remove and can't survive a native DSD round-trip). The native-aligned spelling is a **presence-only boolean** forwarding the native path, with the registry **object** bound imperatively via the #242 seam.

## ✅ RATIFIED RULING (2026-06-18) — scoped registration lives OFF `<component>`

> This ruling **supersedes the prepared default (option B "spelling *on* `<component>`")**. The live decision discussion reversed it via two findings the prep lacked: (1) `<component>` is a *build-time transform*, not a live element — it is gone by runtime and structurally cannot host a runtime registry object; (2) the shipped `webinjectors` DSL already solved the parallel problem with a *local IDREF*, dissolving the "named-id ⇒ global namespace" objection. B's **object-identity substrate survives**; B's **"on `<component>`" home does not.** The title premise ("`scope=` spelling *on* `<component>`") is **dissolved.** Confidence: model ~85%, carve-structure ~90%.

### The ruling, in full

**1. Home — NOT on `<component>`.** Scoped registration is a **runtime concern**, owned by a **declared registry + a binding behavior**, never a compile-time `<component>` attribute. Two independent reasons, either sufficient:
   - **Transform constraint.** `<component>` is "the runtime twin of the Declarative Component adapter's **build-time AST transform**" ([`we:declarativeComponent.ts`](../blocks/renderers/component/declarativeComponent.ts); #792). It is *source* (like JSX), transformed away before runtime. A `scope=` on it is read at transform time against static source — but a scoped registry is a **runtime object** that doesn't exist at build, so the attribute can carry only static keywords; object-valued scope is structurally impossible there.
   - **Separation + generality.** Native scoping binds to **any shadow host**, not just components. "Resolve a registry and bind it" is orthogonal to "define a component" → its own home. A component-only attribute is *under-general* (can't scope a hand-written element).

**2. Model — declared registry + IDREF composition + binding behavior (option F, primary).** Registries become **first-class named declared elements** (`<script type="registry" id="…">`, mirroring the shipped `<script type="injector">`) that:
   - **associate by local DOM IDREF** (`…="checkout"`, mirroring `injector="id"`) — collision-safe (document-scoped ids), native idiom (`for`/`aria-labelledby`/`form`/`popovertarget`/`list`/`headers`), **not** a global namespace;
   - **compose by IDREF `extends` list** (`extends="parent design-system charts"`) — WE's own registry-extension (`extends: CustomElementRegistry[]`, [`we:webregistries/CustomElementRegistry.ts:41`](../plugs/webregistries/CustomElementRegistry.ts#L41)), not native.
   - A **`CustomAttribute` binding behavior** ([`we:webbehaviors/CustomAttribute.ts`](../plugs/webbehaviors/CustomAttribute.ts) — lifecycle + `target` + `InjectorRoot` already integrated) resolves the ref and performs the scoped `define`.

**3. Resolution at MOMENT 2 (declaration/registration), not the instance.** Three timing points: (1) transform/build — no objects; (2) **declaration/registration — registry objects exist, define not yet done ← the seam**; (3) instance — too late. The transform emits a **dom-less declaration node** (never mounted, renders nothing) carrying the scope ref; the binding behavior hosts on *that* and scoped-defines. Trigger is an **explicit registration scan** (`applyDeclarativeInjectors`-style), not the connect `MutationObserver` (dom-less nodes never connect). If the referenced registry isn't ready, the declaration sits **pending until the ref resolves** → ordering is **lazy-queue semantics, not a race**. (DSD/SSR sidesteps this entirely: the root's registry is parse-bound via `shadowrootcustomelementregistry` + `initialize()`.)

**4. E is the escape-hatch, not the primary.** `scope="{{ expr }}"` (webexpressions `{{ }}`, #792's unplugged twin) resolves a registry **object** against the author's *local binding scope* — used only to bridge a **raw foreign JS registry object** a lib exports without declaring it (`extends="parent {{ chartsReg }}"`). F handles everything else in pure HTML.

**5. Why F is load-bearing (not merely consistent).** It is the **only** option that gets **compose-multiple-foreign (matrix #5)** into pure HTML: the transform can't (no objects), imperative leaves HTML, E only relocates the JS, native has no definition-placement spelling at all. ~85%; residual = the foreign-object-bridge assumption (covered by F+E).

**6. Consumption side — settled native map-through.** Forwarding `shadowrootcustomelementregistry` / the `customElementRegistry` `attachShadow` option is mechanical (bucket-2, like `delegates-focus`/`clonable`). Global stays the default registry (most-permissive default). Not a fork.

**7. Tier placement (consistent with #279/#002/#271/#278).** The injector syntax spec ([`we:reports/2026-02-24-injector-syntax-spec.md`](../reports/2026-02-24-injector-syntax-spec.md)) **already manages registries** (`as` = replace, `in` = extend/merge; "WE uniquely combines hierarchical DI with registry management"). #279 (resolved 2026-06-10) capped the ceiling: the **keyword DSL is the single biggest lock-in surface — NOT built**, kept **Tier-3 documented-as-intended**; the shipped ceiling is Tier-1 (runtime API) + Tier-2 (TS types) + **Tier-1.5 (no-build `<script type="…">` declarative form, #278)**. So **F is the Tier-1.5 form for registries** (mirrors #278, within the shipped ceiling — *not* a new lock-in DSL); the keyword DSL (`in`/`as`/`from`) is the already-specced **Tier-3** end-game. Only lock = the `@domain` Protocol identity.

**8. Injector vs registry = two typed facades over one engine.** `InjectorRoot.extends: InjectorRoot[]` ∥ `CustomElementRegistry.extends: CustomElementRegistry[]`; both shadow-root-bound (`getRootNode()`), both ancestor-chain-resolved. Injector resolves **capability(`@domain`/Protocol)→impl**; registry resolves **tag→class**. Kept as **two readable facades sharing one resolution/extends machine** — not collapsed into one overloaded `<script>`, and not folded into `<component>` (injector-*provide* is a subtree-context act, same as registry binding; only injector-*consume*, a component's dependency contract, could ever touch the component surface — deferred, out of scope here).

### Red-team (inline, ~85%) — passed with two amendments
- *"The transform can emit a deferred hook from a `scope=` on `<component>`, so 'off component' is preference not necessity."* → **Amendment:** a component-side attribute is **not forbidden** — but allowed **only as sugar that desugars to the runtime declaration**, never as the home (the home stays runtime; scoping applies to any shadow host).
- *"F's `<script type="registry" extends>` is custom syntax — the lock-in #279 refused."* → **Amendment:** no — F is **Tier-1.5 (#278-shaped, no-build, data attributes)**, within the shipped ceiling; only the *keyword* DSL (`in`/`as`) is the Tier-3 surface #279 declined. F doesn't cross #279's line. No principle violated; consistent with #002/#271/#278/#279/#228/#242/#792.

### Native grounding (verified this turn, not inherited)
- Scoped Custom Element Registries **merged into the WHATWG standard** (whatwg/dom#1341, whatwg/html#10869), **shipped Chrome/Edge 146 + Safari** (2025), **Firefox in progress** ([bug 1874414](https://bugzilla.mozilla.org/show_bug.cgi?id=1874414)) — **2-of-3 engines, ~1 year old (a *new* standard, not mature).**
- `shadowrootcustomelementregistry` is a **real native** declarative DSD attribute (MDN [`CustomElementRegistry.initialize()`](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/initialize), [Chrome blog](https://developer.chrome.com/blog/scoped-registries)) — **boolean / presence-only** (sets the root's registry to `null`, bind later via `initialize()`); **cannot name a registry.** NOT WE-invented.
- Native binds a registry to a **shadow root only** (`attachShadow({ customElementRegistry })` / `registry.initialize(root)`); the document tree is always global — **no document-level scoping, by design.**
- **Definition-placement has no native declarative form** (`registry.define` is imperative-only) and likely never will. Native registries are **fresh/empty** — `extends` is WE's own extension.

### Carves & follow-ups (this ruling is the anchor; these are the open work)
- **[#900](/backlog/900-attribute-name-for-consumer-side-scoped-registry-association/)** `type:decision` — **the association attribute NAME** (working `scope=` is overloaded: CSS `@scope`, lexical/JS scope). Injector precedent `injector="id"` suggests **`registry="id"`**, which dissolves the overload. *#854 settled the model; #900 settles only the spelling.*
- **[#901](/backlog/901-build-the-runtime-scoped-registration-mechanism-declared-reg/)** `story` (size 8, blockedBy #900) — **build the mechanism**: Tier-1.5 declared-registry form + binding behavior + moment-2 scoped-define + lazy queue + consumption map-through. Reuses #228/#242/webregistries.
- **[#902](/backlog/902-reconcile-pre-existing-scope-presumptions-to-the-854-ruling-/)** `task` (blockedBy #900) — **reconcile presumptions**: #242 `RegistryScope.id?: string` → object ref; `we:component.njk:105/149` "Tier-2 `scope` attribute, global by default" → the runtime model (attribute, if any, = sugar only).

---

*The detailed exploration that produced this ruling follows below (usage-case matrix → injector precedent → transform constraint → moment-2 keystone → why-F-primary). The two original `<` Supported-by-default `>` facts — consumption-boolean map-through and global-default — are folded into the ruling above (§6).*

## Usage-case matrix — how a shadow subtree relates to a registry (living — update as we work)

Two orthogonal axes generate the cases: **Base** = what registry/registries this subtree layers on; **New defs** = what happens to component definitions made inside it. The key split for *declarability*: cases needing **no object reference** (fresh / isolated / inherit-default) take a pure **keyword/boolean** spelling; cases referencing a **specific** registry object (extend-this, a lib, a sibling) need the **`{{ expr }}`** object form (option E).

| # | Case | Base it layers on | New defs land | Needs object ref? | Proposed declarative spelling | Freq |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Inherit parent (global or scoped), consume-only | parent | none | no | *(no attribute — default)* | ★★★ default |
| 2 | Extend current + declare new locally | parent | into this scope | no¹ | keyword e.g. `scope="extend"` | ★★★ |
| 3 | Completely new / isolated registry | nothing | into this scope | no | keyword e.g. `scope="new"` | ★★ |
| 4 | Extend an external lib's registry | external | into this / none | **yes** | `scope="{{ libRegistry }}"` | ★★ |
| 5 | Compose multiple bases (parent + libs) | parent + N | into this scope | **yes** | `scope="{{ [a, b] }}"` (extends array) | ★★ micro-fe |
| 6 | Override a name from the base | parent | override (local wins) | no¹ | keyword + local re-`define` | ★ |
| 7 | Hard sandbox / deny-global (untrusted embed) | nothing (explicit) | into this scope | no | keyword e.g. `scope="isolated"` | ◦ defer-ok |
| 8 | Sibling-shared registry (N peers, one object) | shared object | into this scope | **yes** | `scope="{{ sharedRegistry }}"` | ◦ defer-ok |

¹ "Extend the *current* registry" needs no object ref because *current* is implicit (the parent/ambient one) — a keyword resolves it; only naming a *foreign* object (4/5/8) forces the expression. **Must-optimize default path: 1 (default) + 2 + 5.** 7/8 must be *expressible*, not optimized.

## Precedent: the `webinjectors` DSL already solved the parallel problem

`plugs/webinjectors/` is a **structurally identical mechanism** to scoped registries and ships a declarative spelling for exactly this fork — strong consistency pressure on #854:
- **Same composition principle.** [`we:InjectorRoot.ts:37`](../plugs/webinjectors/InjectorRoot.ts#L37) takes `extends?: InjectorRoot[]` — the same `extends: X[]` array as `new CustomElementRegistry({ extends: CustomElementRegistry[] })` ([`we:webregistries/CustomElementRegistry.ts:41`](../plugs/webregistries/CustomElementRegistry.ts#L41)). Both bound to shadow roots via `getRootNode()` ([`we:InjectorRoot.ts:75`](../plugs/webinjectors/InjectorRoot.ts#L75)), both walk a `parentInjector`/ancestor chain. Injectors and registries are the same subtree-scoped, extends-composed, shadow-bounded machine.
- **Two association forms already chosen** ([`we:declarativeInjector.ts`](../plugs/webinjectors/declarativeInjector.ts)): **implicit subtree inheritance** (a `<script type="injector">` installs on its parent element; descendants inherit via the chain — no attribute) and **explicit `injector="id"`** (bind by *local DOM id*).
- **The `injector="id"` is a local IDREF, not a global namespace.** It resolves against `<script id="…">` *in this document* (`result.byId.get(assoc)`), so it is collision-safe (document-scoped ids), declarative, object-carrying, and native idiom (`for`, `aria-labelledby`, `form`, `popovertarget`, `list`, `headers`). **This dissolves the "named id" objection against option A:** the unease was about a *global* string→registry table; a *local IDREF* is a different, platform-blessed thing the injector plug already ships.

### New options surfaced by the precedent

- **E — `scope="{{ expr }}"` (webexpressions object form).** The registry object resolves against the author's *local binding scope* via the `{{ }}` grammar (#792's unplugged twin). Fully declarative, object-valued, no global name, no separate `initialize()` line. Best when the registry already lives in a JS/expression context.
- **F — declare-in-markup + local IDREF, mirroring the injector DSL.** `<script type="registry" id="checkout">` (declares extends/defines) + `<component scope="checkout">` (IDREF association). Pure markup, no JS binding scope, no global namespace; one-to-one with `<script type="injector">` + `injector="id"`. Handles **sibling-shared (#8)** for free (N elements, one IDREF) and **extend-external (#4/5)** via the declared registry's own `extends`. Strongest consistency + native-IDREF-idiom case.
- E and F **compose**: F's declared `<script type="registry">` can use an expression for a *foreign* `extends` target, while association stays a clean IDREF.

**The fork has narrowed** from "string-vs-object" to **how to carry the object reference declaratively: E (expression) vs F (local IDREF) vs both-layered** — all three keep object identity and avoid the global namespace. Pending the author's call; consistency with the shipped injector DSL currently favours **F** (or F+E).

## The decisive constraint: `<component>` is a build-time transform, not a live element

`<component>` is **not a real element and will not become one** — [`we:declarativeComponent.ts`](../blocks/renderers/component/declarativeComponent.ts) is "the runtime twin of the Declarative Component adapter's **build-time AST transform**"; the runtime twin exists only for the demo + conformance suite (#792 fixed it as the compile-time path). `<component>` is *source* (like JSX) — it is transformed away before runtime. There is no live `<component>` with a lifecycle.

A `scope=` on `<component>` is therefore read **at transform time, against static source** — no runtime, no DOM, no live objects. So it can only carry what the transform resolves **statically**:
- **Keywords** (`new`/`isolated`/`extend` — cases 1/2/3/7) → transform-resolvable; the transform emits the registry construction. ✓
- **Object references** (E `{{ expr }}`, F IDREF, cases 4/5/8) → **not transform-resolvable** — the registry object doesn't exist at build. The transform could at best *emit deferred runtime-resolution code* (the "execution flexibility" lost).

Deeper: a **scoped registry is itself a runtime object** (created at runtime, bound to a root). So **scoped definition-placement is inherently runtime** — the transform can statically decide only *global vs. emit-a-deferred-scoped-define-hook*; it can never statically name a scoped target. Scoped definition-placement **cannot live in the compile-time `<component>` directive at all**.

### Conclusion this forces (emerging ruling, NOT yet ratified)

Registry-scoping does **not** belong on `<component>`:
- **`<component>`** (compile-time): carries at most **static keyword directives**, and arguably **no registry-scope spelling at all** — it's gone by runtime, so it structurally cannot host object-valued scope.
- **Runtime layer** (real, observer-driven, live-object-resolving) owns the object-valued cases that actually matter (extend-a-lib #4, compose-multiple #5, sibling-shared #8): the **`<script type="registry">` declaration** (mirrors `<script type="injector">`) + a **binding behavior** ([`CustomAttribute`](../plugs/webbehaviors/CustomAttribute.ts), which already has lifecycle + `target` + injector-chain integration) that resolves the ref (E/F) and binds via native `registry.initialize(shadowRoot)`.

This re-homes the decision **off `<component>`** — it dissolves the item's title premise ("`scope=` spelling *on* `<component>`"). The lifecycle: runtime declarative processing in WE is **per-root-node `MutationObserver`** (behaviors/injectors/expressions/contexts all use `#observers: Map<RootNode, MutationObserver>`), firing **at DOM injection**; the sole hard part on the pure-runtime path is **registry-before-define ordering** (DSD/SSR gets it free — the root's registry is parse-bound via `shadowrootcustomelementregistry` + `initialize()`).

### Keystone: resolve the binding on the *declaration* (moment 2), not the instance

Definition-placement has **three** timing points, not two:
1. **Transform time (build)** — static only; registry objects don't exist → can't get the registry.
2. **Declaration/registration time (runtime)** — the emitted code registers the component (`define(tag, cls, scope?)`); **registry objects exist** → *can* get the registry, and the define hasn't happened yet.
3. **Instance time (runtime)** — too late; the class is already defined.

Moment 2 is the seam. The transform emits **not a bare `define()` but a dom-less declaration node** (a `<component>`-shaped descriptor, never mounted, renders nothing) carrying the scope ref. A **registration-time behavior** hosts on *that declaration* (not the instance), resolves the registry object (E expression / F IDREF — both runtime-resolvable here), and performs the scoped `define(tag, cls, registry)`. This is the one host that is *runtime* (objects exist) yet *pre-instance* (define pending). It (a) keeps the behavior-decoupling — `<component>` stays scope-agnostic; (b) solves definition-placement, which neither the compile-time directive nor an instance-behavior can; (c) emits exactly native `registry.define`.

Two consequences, both acceptable:
- **Trigger is explicit, not the connection observer** — a dom-less node never connects, so the per-root `MutationObserver` won't fire; registration explicitly processes the declaration (the `applyDeclarativeInjectors`-style explicit scan, not connect-driven).
- **Ordering becomes queue semantics, not a race** — if the referenced registry isn't ready, the dom-less declaration sits **pending** until its scope ref resolves, then fires (lazy registration). The "registry-before-define" constraint turns into natural pending-queue behaviour.

**Resulting stack:** `<component>` (transform, scope-agnostic) → emits a dom-less declaration carrying the scope ref → registration behavior resolves the registry (E/F) + scoped-defines → instances upgrade against that registry. Scope lives entirely in the runtime declaration+behavior layer; `<component>` never holds it.

### Why F is primary, not just consistent: it uniquely solves compose-multiple-foreign (#5)

The composite case — *new + extend parent + merge a design-system registry + another lib's registry* (matrix #5) — is solved **declaratively by F alone**:
- **transform directive** — ✗ those bases are runtime objects, absent at build;
- **imperative `new CustomElementRegistry({ extends: [...] })`** — works but leaves HTML;
- **E `scope="{{ expr }}"`** — only relocates the JS (the foreign registries must already sit in a binding scope), doesn't remove it;
- **native** — no declarative definition-placement form at all (and `extends` is WE's own registry extension, not native);
- **F — declare a registry *outside* the component with an id, compose via an `extends` IDREF list, reference by id:** `<script type="registry" id="app" extends="parent design-system other-lib"></script>` + `<component scope="app">` — **fully declarative, foreign bases included.** ✓

F works because it makes registries (like injectors) **first-class named declared elements that reference each other by HTML id** — injector resolution-by-id generalized to `extends`-by-id-list. This is the payoff of "injectors and registries are the same machine."

**Honest catch (ecosystem dependency):** F stays fully declarative *only if the foreign bases are themselves reachable by id/handle* (the lib/design-system declares `<script type="registry" id="…">`). A lib exporting only a raw JS `CustomElementRegistry` object needs a **bridge** — F+E (a declared registry whose `extends` pulls that object via one expression) or the lib adopting the declared form.

**Reorders the options:** **F is primary / load-bearing** (the only in-HTML solver for #5); **E demotes to the raw-foreign-object escape-hatch.** The injector-vs-registry facade is a detail (same extends-machine); the load-bearing capability is *declarative IDREF composition*. Confidence ~85%; residual = the foreign-object-bridge assumption (covered by F+E).

## Fork 1 — the author-facing spelling of scoped registration

*Fork-existence:* the excluded branch is a **string-valued `scope="<id>"`** — it invents a string-keyed registry namespace the platform *deliberately refused* (the shipped declarative attribute is boolean-only; every library keys on an object), so native-first (a forced WE invariant) excludes it as the base mechanic. The remaining options are mutually-exclusive author surfaces, so this is a real either/or.

- **A — `scope="<id>"` string attribute + a WE-owned id→registry lookup table.** *(the item's original title spelling.)* **Pro:** human-readable, ergonomic, DSD-serializable as a plain string. **Con:** no native analog; WE owns lookup-table machinery the platform declined; reintroduces a global string namespace (the very thing scoping removes); breaks under native DSD round-trip (the native attribute carries no id); matches zero libraries.
- **B — native-aligned: a presence-only boolean marker (e.g. `scoped`) forwarding the native `shadowrootcustomelementregistry` / `customElementRegistry` path, with the registry *object* bound imperatively via the existing #242 `RegistryScope` / auto-define seam. — RECOMMENDED DEFAULT.** **Pro:** mirrors exactly what the platform shipped (boolean declarative + imperative `.initialize()`), what open-wc/Lit do (object via host), and what WE's own runtime already keys on (object refs); mints no new protocol; no invented string namespace. **Con:** the *which registry* binding is not expressible in markup alone — authors reach the #242 seam for that (acceptable: native made the same call).
- **C — an enclosing scope element/wrapper holding the registry object.** **Pro:** most lexically native (scope is structural, registry is an object held by the host — open-wc's exact model). **Con:** invents a new WE element for what `attachShadow({customElementRegistry})` + #242 already express; heavier surface. *File as opt-in sugar if ergonomics demand, layered on B.*
- **D — defer: no declarative scope spelling on `<component>` at all** (scoped registration stays purely imperative via #242). **Pro:** maximally faithful to native, which gives definition-placement no declarative form. **Con:** under-serves `<component>`'s declarative-everything goal when the consumption-side boolean *is* declaratively expressible (B captures that without over-reaching).

**Red-team note for the deciding turn.** The default reverses the item's title, so expect the skeptic pass to argue **A** on ergonomics ("a human-readable `scope="checkout"` reads better than wiring a registry object"). The defence: the platform and every shipping library refused exactly that, and a string scope silently rebuilds the global namespace scoping removes — but if WE deliberately wants the ergonomic handle, the principled form is **A-as-sugar over B** (an optional WE-only label resolving to the object), never A as the base mechanic. Also reconcile the `RegistryScope.id?: string` token (#242) and the `we:component.njk` Tier-2 `scope` line, both of which currently presume the excluded spelling.

## Concrete examples — what the author writes per option

**A — `scope="<id>"` string attribute (the excluded base mechanic).**
```html
<!-- definition placement: lands in a WE-named "checkout" registry -->
<component name="checkout-form" scope="checkout"> … </component>
```
```js
// WE must own + persist the id→object lookup the platform declined:
registryTable.set('checkout', new CustomElementRegistry());   // string namespace, reborn
```
Reads well, but the `"checkout"` handle has no native analog — a native DSD round-trip drops it
(the shipped attribute carries no id), and the string namespace is exactly what scoping removes.

**B — native-aligned boolean marker + imperative object binding (RECOMMENDED).**
```html
<!-- consumption side: settled native pass-through (boolean, no id) -->
<component name="checkout-form">
  <template shadowrootmode="open" shadowrootcustomelementregistry>
    <field-input></field-input>  <!-- resolves in the scoped registry, not global -->
  </template>
</component>
```
```js
// definition placement: bind the registry OBJECT via the #242 seam (no markup id)
const checkout = new CustomElementRegistry();
AutoDefineStrategy.define('checkout-form', CheckoutForm, { registry: checkout });
```
Mirrors what the platform shipped, what open-wc/Lit do (object via host), and what WE's runtime
already keys on. Binding *which* registry isn't in markup alone — native made the same call.

**C — enclosing scope element holding the registry object.**
```html
<scope-root .registry="${checkout}">
  <component name="checkout-form"> … </component>
</scope-root>
```
Most lexically native (scope is structural, registry is an object on the host) but invents a new WE
element for what `attachShadow({customElementRegistry})` + #242 already express. *Sugar over B, not base.*

**D — no declarative spelling at all** (scoped registration stays purely imperative via #242):
```js
AutoDefineStrategy.define('checkout-form', CheckoutForm, { registry: checkout });   // only this
```
Maximally faithful to native's "definition placement has no declarative form," but under-serves
`<component>`'s declarative-everything goal when the consumption boolean *is* expressible (B keeps it).
