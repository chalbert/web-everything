---
kind: decision
status: resolved
locus: webeverything
dateOpened: "2026-06-29"
dateStarted: "2026-06-29"
dateResolved: "2026-06-29"
graduatedTo: none
codifiedIn: "docs/agent/block-standard.md#composition-rubric"
preparedDate: "2026-06-29"
relatedReport: reports/2026-06-29-composition-framework-parity.md
tags: [webblocks, block-standard, composition, dom-less, framework-parity, adoption, decision]
---

# Composition rubric re-judged to framework-parity — strict per-case mechanism selection at a zero-compromise bar

WE already ships the composition **mechanisms** and a ratified per-*family* rule — but it has never been
consolidated into one strict **per-case** rubric, nor re-judged against a framework-parity bar. This decision
does that. It is **adoption-critical**: a native-first system that can't match framework composition DX never
wins first-level developer adoption, no matter how good its standards are.

**This card does not re-derive the mechanisms** (they're built — see Inputs). It (a) unifies the two existing
taxonomies into one matrix, (b) re-judges every cell against the bar below, and (c) emits *invent-case* child
items where nothing clears it.

## Two angles — dev freedom vs standard fixed/configurable (how to read this rubric)

The rubric serves **two distinct audiences**, and every ruling below lands in one of them:

1. **The app developer** (building a product on WE) → **maximum freedom**: the full **menu of mechanisms with
   pros/cons** (the case-indexed matrix + the case-independent mechanism catalog) so they pick what fits. The
   standard constrains only the *fixed floor*; everything else is the dev's call.
2. **The block standard** (`we:block-standard.md`) → must decide **what is FIXED vs what is CONFIGURABLE**:

| Tier | Covers |
|---|---|
| **FIXED — the standard forces it** | the 5-point bar (standing test) · the scoped budgeted-host-node spine · the per-layer native/plug partition + plug-to-direction (item 7) · **irreplaceable-native blocks MUST emit native** (input/pickers — form/chrome) · statute bars (no load-bearing `is=` / single-substrate floor; MaaS serves only platform-correct variants) |
| **CONFIGURABLE — per-project option (item 6), platform-correct variants only** | transient ↔ persistent light-DOM for **soft / replicable** blocks (badge/tag/card…, button/chip) · the leaf default (#1962) · which sanctioned variant the configurator / MaaS assembles |
| **FREEDOM — the dev's call (the menu)** | which mechanism per case, from the catalog + matrix with pros/cons; the standard only gates the FIXED floor |

The two angles compose: **dev-freedom = CONFIGURABLE + FREEDOM**, sitting on top of the non-negotiable **FIXED**
native-first floor. The matrix + mechanism catalog below *are* the dev-facing menu; the forks + *Supported by
default* rulings *are* the standard's fixed/configurable partition.

## The acceptance bar (every per-case solution must clear all five)

1. **Ergonomics ≥ frameworks** — authoring DX competitive with React/Vue/Svelte/Solid, not "good for web
   components."
2. **Zero compromise** — no breakage of **layout** (flex/grid direct-child), **CSS** (selector/cascade), or
   **accessibility** (AX tree + HTML content-model). See the cost enumeration in #1962.
3. **A no-compromise solution for *every* case** — an uncovered case is not allowed to stand; it becomes a
   build/invent item.
4. **Open to net-new mechanisms** — where no existing option clears the bar, **invent a plug** (proposed
   standard, per *Plug = Proposed Missing Standard*), don't settle for a compromised one. **Author it to the
   standards-track *direction* and design it to be deprecated + migrated** when the native standard ships — see
   *Supported by default* item 7.
5. **Authoring-surface-agnostic** — clean in **plain HTML** (declarative/SSR) **and JSX** (and other valid
   approaches: imperative DOM, templates). No mechanism may force a single authoring mode.

## Two taxonomies to reconcile (the reason this isn't already done)

- **§7 block families A/B/C** ([we:block-standard.md](../docs/agent/block-standard.md), ratified
  #1321/#1381/#1456/#1457) — covers only a *block's runtime shape* (transient → native vs persistent light-DOM
  vs shadow). ~80% confidence; chosen "by what the consumer needs," **never benchmarked to framework parity**.
- **`/research/dom-less-composition` A–I catalog** ([research topic](/research/dom-less-composition/)) — covers
  the *broader* composition surface (comment/virtual elements, fragments, `display:contents` providers,
  behaviors, mixins, portals, `is=`). A **catalog**, not a strict ratified per-case rule.

No single artifact spans both. An author choosing a mechanism for a *non-block* composition case today has a
catalog to read, not a rule to apply.

## The spine — the host node is the API surface, so it is a budgeted resource

The single principle the whole rubric hangs on (prep survey — [relatedReport](../reports/2026-06-29-composition-framework-parity.md)):
a framework component is a **function/object** in a virtual tree — only leaf elements reify as DOM, so 10 nested
providers cost **zero** nodes. A custom element is **defined as a DOM element**: `customElements.define` binds
behaviour to a *tag*, and a tag is a node with a box, an event-path slot, an AX entry, a `:host`. Slotting,
Shadow-DOM scoping, `connectedCallback` lifecycle, `ElementInternals` semantics, and focus are **all keyed off
that node** — you cannot have them and not have the node. So the platform charges per node *for a reason*, and
**no emerging standard removes it** (`display:contents` removes the box not the node; `moveBefore()` makes
reparenting non-destructive not free; DOM Parts is proposal-stage and addresses *content* regions, not CE hosts;
`ElementInternals` makes the node *worth* paying for).

Two claims must be kept apart here (skeptic pass-1): the **descriptive** one — *slot/shadow/AX/lifecycle are
keyed off the node* — is uncontestable. The **prescriptive** jump — *therefore budget the host node and parity
is a discipline, not a missing feature* — is **only true where a zero-node mechanism exists for the authoring
surface in use**, and that is **not** uniformly true:

- On **JS / JSX** surfaces, zero-node mechanisms exist (functional components, directives, mixins) → **budget
  the host node, achieve zero-node parity.** True.
- On the **declarative-HTML** surface, plain HTML has only *elements*, not functions → the best available is
  `display:contents` per layer, which is a **cheap node, not zero** (the box is gone but the node, event-path,
  AX entry, content-model position remain). For **deep structural nesting** this still breaks bar-criterion 2
  (see #1962's cost enumeration). So on declarative HTML, deep structural composition reaches only *cheap-node*
  composition — **an open gap, not parity** (Fork 2).

**Therefore the codified rule is scoped:** *budget the host node — pay it only for slot/shadow/AX-identity/
lifecycle, route everything else through a zero-node mechanism; this yields full parity on JS/JSX surfaces, and
cheap-node (not zero) composition on declarative HTML, where deep structural nesting remains an open invention.*
The unscoped "parity is a discipline, not a missing feature" would be **false in plain HTML** — the honest rule
names the surface.

## Recommended path at a glance

Verdict key: ✅ clears the bar · ◐ parity *pending* a named confirm · ⚠️ **unmet** (a real compromise/gap — becomes
a tracked item per bar-rule 3). *The verdicts match the [report](../reports/2026-06-29-composition-framework-parity.md)'s
honesty — no compromised cell is graded green.*

| Element | Verdict | Why |
|---|---|---|
| **The 5-point bar** (codify as the standing test) | **Supported by default — codify** *(criteria derived: rule 4 = Plug = Proposed Missing Standard, #95; rule 2's AX/content-model enum = #1962)* | The decision's core output. Its **first honest act is to mark the one case it fails** (10-in-HTML) — not to grade it passed. (Case 8 was re-judged *covered* — see Fork 1.) |
| **The budgeted-host-node principle** — **scoped** | **Supported by default — codify (JS/JSX zero-node; declarative-HTML cheap-node = open gap)** | Descriptive claim (node = API surface) uncontestable; prescriptive "discipline = parity" holds only where a zero-node mechanism exists for the surface. |
| **Cases 4/5, 7** (if/for/switch · behaviours) | ✅ **at parity today** | Comment-anchor directives (#1130) + mixins/`CustomAttribute` — zero-node, HTML + JSX, built. |
| **Cases 2** (grouped/reactive) | ◐ **parity *pending* the reactivity-primitive confirm** | The group-CE + form-associated-children split is ratified (#1456); ergonomic parity assumes a framework-grade signals/observed-property primitive — confirm WE's or file it. *Cites #1456, not re-deciding it.* |
| **Cases 3, 6, 9** (fragment · DI provider · portal) | ◐ **parity *pending* a named confirm** | Built (#1044 provider, `webportals`); riders: case 6 AX-tree across Chromium/Safari, case 9 `moveBefore` cross-browser fallback. |
| **Case 1** (real-element leaf) | **→ delegated to #1962** | Emit-to-native (transient) is *full* parity — what React/Svelte/Solid do. Mechanism choice is #1962's facet. |
| **Fork 1 — case 8** (`is=` / behaviour on an *existing* native element) | ✅ **RATIFIED (a) — covered, no uncovered need** (◐ owned-element residual on a converging watch); `is=` **not a WE mechanism** — documented dev opt-in (FUI polyfill) only | Not a standalone case: 6 sub-cases (matrix) — 8a→case 7, 8b→delegation, 8c→injector/transient, 8d→**out of scope**, 8e→PE, 8f→contrived. The only "missing" piece is **owned-element behavioural intrinsics beyond `ElementInternals`** (implicit-submit/focus/keyboard) — largely synthesizable today (`requestSubmit`), and a **converging standards-watch** (ElementInternals 2023 → ARIA reflection → `:state()`), **not a ⚠️ gap**. |
| **Fork 2 — case 10** (deep STRUCTURAL composition) | ⚠️ **UNMET in declarative HTML** — policy **(a)** budgeted-host discipline clears **JS/JSX**; declarative-HTML deep nesting reaches only cheap-node | Not "parity by discipline" unqualified: zero-node holds in JS/JSX; the declarative-HTML deep-nesting path is a **genuine open invention** (DOM Parts watch / generalize transient-to-comments). |

## Per-case → sub-case example matrix (every path documented)

*Each case is decomposed into its real sub-paths; every sub-path carries a **concrete example in the real
authoring syntax** (grounded in the cited FUI plug code — all six mechanisms are built and demo-proven) plus its
own verdict. Erring toward over-documentation per bar-rule 3: a path that resolves to "covered elsewhere" or "out
of scope" is **stated, not omitted**, so the rubric is exhaustive rather than a single blurred verdict.*

### Case 1 — real-element presentational leaf
- **1a — behaviour-free leaf → transient (emit-to-native).** ✅ **full parity** (what React/Svelte/Solid do).
  Mechanism choice delegated to **#1962**.
  ```html
  <we-button tone="primary">Buy</we-button>
  <!-- connectedCallback self-replaces → real <button>Buy</button>; attrs + children transferred.
       fui:blocks/transient/TransientElement.ts (resolveTag/decorate); fui:blocks/temporal/TemporalTransientElement.ts -->
  ```
- **1b — leaf needing owned form/AX identity, kept persistent.** ◐ form + AX via `attachInternals()`; native
  *behaviour* (focus ring, implicit submit) hand-wired.
  ```ts
  class WeToggle extends HTMLElement {
    static formAssociated = true;
    #i = this.attachInternals();
    connectedCallback() { this.#i.role = 'switch'; this.#i.ariaChecked = 'false'; }
  }
  ```

### Case 2 — grouped / reactive control
- **2a — grouped form control → persistent group CE + form-associated children.** ✅ **built** (#1456 Fork 1 →
  Mechanism B; persistent light-DOM group, children carry `value`).
  ```html
  <we-checkbox-group name="interests" label="Interests">
    <div value="web" label="Web Development" checked></div>
    <div value="ux"  label="UX Research"></div>
  </we-checkbox-group>
  <!-- fui:blocks/checkbox/CheckboxElements.ts:50-77 (.values composite property) -->
  ```
  ```ts
  // imperative — same group, JS surface:
  const g = new WeCheckboxGroup(); g.setAttribute('name', 'interests');
  g.append(Object.assign(document.createElement('div'), { /* value/label/checked */ }));
  g.values;  // composite, two-way-bindable
  ```
- **2b — reactive propagation (group value ⇄ children checked).** ◐ **pending** a framework-grade reactivity
  primitive (signals / observed properties) confirm — the DOM/form pieces are native; only the reactivity glue
  is the open confirm.

### Cases 4/5 — if / for / switch regions  ✅ (comment-anchor directives, **zero wrapper node**, #1130)
- **4 — if / switch → `ViewIf` / `ViewSwitch`** (comment markers, content shown/hidden between them):
  ```html
  <!-- control:if when="loggedIn" -->
    <a href="/account">Account</a>
  <!-- /control:if -->
  ```
- **5 — for → `ForEach`** (keyed reconciliation; siblings inserted between anchors, no wrapping element):
  ```html
  <ul>
    <!-- control:for-each items="members" -->
      <li class="member">${item.name}</li>
    <!-- /control:for-each -->
  </ul>
  <!-- fui:plugs/webdirectives/CustomComment.ts + CustomCommentParser.ts; demo: demos/webdirectives-virtual-elements-demo.ts -->
  ```
  ```ts
  // imperative — define + register the directive (JS surface):
  class ControlIf extends CustomComment { connectedCallback() { /* show region per options.when */ } }
  const reg = new CustomCommentRegistry(); reg.define('control:if', ControlIf); reg.upgrade(document.body);
  ```

### Case 3 — multi-root / fragment (no wrapper)
- **3a — JS/JSX compile-away.** ✅ function returns multiple siblings, no host emitted.
- **3b — declarative HTML → `:host{display:contents}`.** ◐ box dropped (layout/CSS recovered); residual AX
  caveat (regression mostly fixed Safari 16 / FF 62).

### Case 6 — context / DI provider, no layout impact  ✅
- **6a — `<script type="injector">` provider (zero *rendered* node).** ✅ **cleanest** — the `<script>` never
  renders, so there is **no box AND no AX entry** (it sidesteps the `display:contents` AX caveat entirely).
  ```html
  <section>
    <script type="injector" id="dateP">
      { "domain": "@date/core", "provide": { "name": "tiny-date" } }
    </script>
    <p>descendants resolve @date/core implicitly</p>
  </section>
  <div injector="dateP">explicit cross-DOM opt-in via attribute</div>
  <!-- fui:plugs/webinjectors/declarativeInjector.ts:30-98; demo: demos/declarative-injector-demo.html -->
  ```
  ```ts
  // imperative — same provider, JS surface:
  const root = new InjectorRoot(); root.attach(document); applyDeclarativeInjectors(root, document);
  const provided = InjectorRoot.getProviderOf(node, '@date/core');
  ```
- **6b — `display:contents` host where a live element ref is needed.** ◐ box gone; node/event/AX remain (benign
  for providers; AX fixed 2023 for non-interactive, residual is interactive-only) — the AX-tree confirm rider (#1044).
- **6c — Context Protocol (events) — the *zero-node* DI mechanism.** ✅ best — a bubbling `context-request` event
  answered by any existing ancestor, **no added node at all** (`@lit/context`-proven). WE's injector should align
  to it (item 7). CSS custom properties cover ambient string/typed context with zero node too.

### Case 7 — behavioural composition (N behaviours / 1 element)  ✅ (the HOC analog — full worked proof above)
- **7a — declarative (CustomAttribute behaviours):**
  ```html
  <we-button log trace validate="stock>0" analytics="cta:buy" affix="↗">Buy</we-button>
  ```
- **7b — programmatic (functional mixins, super-call AOP):**
  ```ts
  const Button = WithLog(WithTrace(WithValidate(WithAnalytics(WithAffix(HTMLElement)))));
  // 5 features, 1 node, 0 wrappers. fui:plugs/webbehaviors/CustomAttribute.ts:65-410
  ```

### Case 8 — behaviour on an *existing* native element (Fork 1) — **6 sub-cases; no uncovered need**
| Sub-case | Concrete example | Verdict / mechanism |
|---|---|---|
| **8a** element is yours / attributable | `<button validate log>` | ✅ → **case 7** (`CustomAttribute`) |
| **8b** untouchable markup, *cross-cutting* behaviour | CMS `<button>` + click analytics | ✅ → **ancestor delegation** (capture-phase listener, zero-node) |
| **8c** WE-conformant embed | a WE-built widget's element | ✅ → **injector / transient-replace** (case 1); it's no longer "foreign" |
| **8d** non-WE foreign widget, mutate internals | a vendor lib's internal `<button>` | **out of scope** — a boundary WE shouldn't cross |
| **8e** enhancement only, degradation acceptable | `<button is="we-fancy">` → plain `<button>` in Safari | ✅ **acceptable PE** (Fork 1a — demote, not forbid) |
| **8f** untouchable **+** un-replaceable **+** *element-intrinsic* | a foreign element must become a real **form-associated control** in place (the irreducible residual — submit itself is `requestSubmit`-synthesizable → 8b) | **contrived / no real need** — you'd emit (case 1) or delegate (8b). `is=` dead (Safari #97); `ElementInternals` is own-element-only **by construction** (no foreign trajectory). Not a gap WE owes a mechanism. |

### Case 9 — teleport / portal
- **9a — logical portal.** ✅ **built** — content projected to a remote outlet, logically attached at the
  declaration site (context + event retargeting preserved).
  ```html
  <portal-outlet id="modal-outlet"></portal-outlet>
  <div class="deeply-nested">
    <template is="portal-directive" target="modal-outlet">
      <div class="modal" role="dialog">Modal content</div>
    </template>
  </div>
  <!-- fui:plugs/webportals/PortalDirective.ts:100-247 + PortalOutlet.ts -->
  ```
  ```ts
  // imperative — same portal, JS surface:
  const portal = new PortalDirective({ children: modal });
  portal.setAttribute('target', 'modal-outlet'); document.body.append(portal);  // resolves to the outlet
  ```
- **9b — state-preserving reparent → `Node.moveBefore()`** (Chrome 133 / FF 144; **Safari unsupported → blocks
  Baseline**). ◐ needs a cross-browser fallback (feature-detect `'moveBefore' in Element.prototype`).

### Case 10 — deep STRUCTURAL composition (Fork 2)
- **10a — JS/JSX → function composition.** ✅ **zero host nodes** — exactly how frameworks compile structural
  layers away.
  ```jsx
  const App = withTheme(withLocale(withAuth(withRouter(/*…6 more…*/ Leaf))));  // only <Leaf/>'s DOM lands
  ```
- **10b — declarative HTML deep nesting → `display:contents` per layer.** ⚠️ **UNMET** — cheap node, **not**
  zero: box gone, but node/AX/content-model position remain, so deep nesting breaks bar-rule 2 (grid/flex
  direct-child, `:nth-child`, tree-walks) for the very case under judgment.
  ```html
  <we-theme  style="display:contents">
   <we-locale style="display:contents">
    <!-- …8 more layers… -->
        <leaf-grid-item/>   <!-- the only element that should reach the grid parent as a direct child -->
  </we-locale></we-theme>
  ```

## Component-*definition* surface — declarative vs imperative (composition *in* the definition, not just usage)

*The matrix above benchmarks composition at the **usage** site. bar-rule 5 (HTML + JSX) also applies to how a
component is **defined**. Both definition surfaces exist and are at parity — with the **same honest build-time
scope** as the budgeted-host-node spine.*

- **Imperative definition** ✅ — a class (`extends HTMLElement` / `TransientElement`, behaviours mixed in) or a
  functional factory. Composition-in-definition = the mixin chain / render function.
  ```ts
  class ButtonTransientElement extends TransientElement {
    resolveTag() { return this.hasAttribute('href') ? 'a' : 'button'; }
    decorate(el) { el.classList.add('we-button', `we-button--${variant}`); }
  }
  customElements.define('we-button', ButtonTransientElement);
  // fui:blocks/button/ButtonTransientElement.ts + registerButton.ts; functional form: blocks/button/Button.ts createButton()
  ```
- **Declarative definition** ✅ — the **build-time `<component>` form**, lowered to the imperative class by the
  Declarative Component Adapter (ratified; WE owns the contract + vectors, FUI owns the runtime lowering).
  ```html
  <component name="user-card" shadow="open">
    <style>:host{display:block}</style>
    <h3><slot name="title">Untitled</slot></h3>
    <slot></slot>
  </component>
  <!-- usage: --> <user-card><span slot="title">Ada</span><p>…</p></user-card>
  <!-- we:blocks/renderers/component/declarativeComponent.ts (+ __fixtures__/component-cases.ts) -->
  ```
  **Honest scope (parallels the spine):** this is **build-time** — `<component>` *compiles away* into the class
  above; it is **not** a *live-runtime* declarative custom-element definition. A runtime HTML
  component-definition primitive (HTML Modules / Template Instantiation) does **not** exist — proposal-stage,
  unshipped — so it is a **standards watch**, not a WE invention target. Definition parity = imperative
  class/factory **and** declarative build-time `<component>`; live-runtime declarative-definition is out of scope
  (the same posture as case 10's declarative-HTML deep nesting).

### Composition *within* a definition — the four sanctioned seams (#854 / #1795)
When a defined component composes others internally, the seam is **chosen, not ad-hoc**:

| Seam | Example | Verdict |
|---|---|---|
| **Slots** (declarative `<slot>` + imperative `HTMLSlotElement.assign()`) | `<slot name="title">` | ✅ built |
| **Decoration** (`CustomAttribute` on a child) | `<a route:link href="…">` | ✅ built |
| **Scoped-replace** (scoped registry swaps a sub-component) | `<scope registry="app-registry">…<a is="app-link">…` | ◐ **blocked on webregistries re-home (#901)** — cites, no new item |
| **Abstract-split** (distinct tags + tree-shakable traits) | userland convention | ✅ no WE primitive needed |

## Mechanism catalog — every composition *option* (definition × usage), case-independent

*The matrix above is **case-indexed** (which mechanism solves which case). This table is **mechanism-indexed** — the
full menu of options, each with how it is **defined** and how it is **used**, independent of case. Pick the row,
then the case matrix says where it applies. All are built unless flagged.*

| Mechanism | Definition (author the mechanism) | Usage (invoke it) |
|---|---|---|
| **Transient element** | `class X extends TransientElement { resolveTag(){return 'button'} decorate(el){…} }` → `define('we-button', X)` | `<we-button>Buy</we-button>` → self-erases to real `<button>` |
| **Persistent light-DOM CE** | `class X extends HTMLElement { static formAssociated=true; #i=this.attachInternals() }` | `<we-checkbox-group name="…">` — host node persists |
| **Shadow CE** | `class X extends HTMLElement { constructor(){ this.attachShadow({mode:'open'}) } }` + `::part` | `<we-foo>` styled via `::part()` |
| **CustomAttribute behaviour** | `class Log extends CustomAttribute { attachedCallback(){…} }` → `attrs.define('log', Log)` | `<button log trace validate="…">` — N behaviours, 0 wrappers |
| **Functional mixin** | `const Btn = WithLog(WithTrace(WithValidate(HTMLElement)))` | `define('we-btn', Btn)` / `new Btn()` |
| **Comment-anchor directive** | `class ControlIf extends CustomComment {…}` → `reg.define('control:if', ControlIf)` | `<!-- control:if when="x" -->…<!-- /control:if -->` (0 layout node) |
| **DI provider (injector)** | `<script type="injector">{ "domain":"@x", "provide":… }</script>` / `new InjectorRoot()` | descendants resolve implicitly; `injector="id"` cross-DOM opt-in |
| **Context Protocol** (WC-CG; align target for the injector) | listen for `context-request` on any ancestor | consumer fires bubbling `context-request` event — **zero added node**; `@lit/context`-proven, framework-agnostic |
| **CSS custom properties** (ambient context) | `--x: …` on any ancestor | `var(--x)` reads down the cascade — zero node; strings/typed-CSS only, one-directional |
| **Portal** | register `PortalDirective` + `PortalOutlet` | `<portal-outlet id="o">` + `<template is="portal-directive" target="o">` |
| **Declarative `<component>`** *(build-time)* | `<component name="user-card" shadow="open"><slot/></component>` → lowered to a class | `<user-card><span slot="title">…</span></user-card>` |
| **Slots** | `<slot name="title">` inside shadow/template | `<x slot="title">` + imperative `HTMLSlotElement.assign()` |
| **Scoped-replace** | a scoped custom-element registry | `<scope registry="app-registry">…<a is="app-link">` — ◐ **blocked #901** |
| **`is=` customized built-in** | — | **NOT a WE mechanism** (Fork 1 ratified) — every job dominated; documented **dev opt-in only**, FUI polyfill, explicit enable. Never a block. |
| **Fragment / `:host{display:contents}`** | `:host{display:contents}` on the CE | multi-root output, box erased (node/AX remain) |
| **`moveBefore()` reparent** | native DOM API (no definition) | `parent.moveBefore(node, ref)` — state-preserving — ◐ **Chrome 133 / FF 144; Safari ✗ (blocks Baseline) → fallback** |

**Choosing between the two enhancement mechanisms — behaviour vs directive (first-choice rule):**
**`CustomAttribute` (behaviour) is the first choice** — it decorates a *connected* element (zero node, composable,
cross-browser). A **comment-anchor directive is the exception**, used only for **pre-connection / region-level
control**: because a `CustomAttribute` attaches *after* its owner element exists and connects, it cannot gate
*whether* the element connects or *how many times* — only a directive operating on the region *before* upgrade can.

- **Behaviour (default):** decorate a connected element → `<input validate>`, `<button log analytics>`.
- **Directive (exception — pre-connection / structural):** the element must **not connect at all** when a condition
  is false (`ViewIf`), or must be **repeated** before connection (`ForEach`), or a region must be **transformed
  before its contents upgrade**. A `CustomAttribute` can't prevent/multiply its own element's connection — the
  element is already there. *(The dev guide must carry strong worked examples of exactly this distinction.)*

## Supported by default (forced / clear — not forks)

1. **The acceptance bar** (the five criteria above) — codified into `we:block-standard.md` as the standing test.
   Not a fork: it *is* the ruling the card exists to make. **Its criteria are derived, not novel** — rule 4 is
   *Plug = Proposed Missing Standard* ([we:platform-decisions.md](../docs/agent/platform-decisions.md), #95); rule
   2's layout/CSS/AX/content-model enumeration is #1962's cost analysis. **The bar's first act is to mark the one
   case it *fails* (10-in-HTML) — codifying the test and grading it already-passed are two different
   rulings; this card does only the former.** (Case 8 was re-judged *covered* — Fork 1.)
2. **The budgeted-host-node principle — *scoped*** (skeptic pass-1, Target B): the **descriptive** half (node =
   API surface; slot/shadow/AX/lifecycle keyed off it) is uncontestable and codified. The **prescriptive** half
   (*budget the host → parity*) is codified **scoped to the authoring surface**: full zero-node parity on
   JS/JSX; **cheap-node, not zero, on declarative HTML** (Fork 2's open gap). The broken alternative the bar
   forbids ("nest registered hosts for structural layers") pays all of #1962's layout/CSS/AX costs.
3. **Cases 4/5, 7 — at parity, ratify the assignment.** if/for/switch → comment-anchor directives
   (`CustomComment` #1130 → `ForEach`/`ViewIf`/`ViewSwitch`,
   [fui:plugs/webdirectives/CustomComment.ts](../../frontierui/plugs/webdirectives/CustomComment.ts)); behaviours
   → mixins + `CustomAttribute`. Zero-node, HTML + JSX, built.
   - **Worked proof — case 7, the non-UI / HOC-feature composition the React analog needs** (the part that *must*
     compose flat because the platform charges per node). A React HOC bundles three things that compose zero-node
     on the platform: **(i) props/attrs**, **(ii) content before/after**, **(iii) callback integration**
     (validate / trace / log). All three are **behavioural**, so none needs a wrapper — the wrapper-per-layer
     cost is *only* the **structural** case (Fork 2). Five features on one element, **zero wrappers**, both
     surfaces:
     ```html
     <!-- Declarative (CustomAttribute, fui:plugs/webbehaviors/) — 5 features, 1 element, 0 wrappers.
          After <we-button> transient-erases (case 1 / #1962) the attrs ride the real <button>. -->
     <we-button log trace validate="stock>0" analytics="cta:buy" affix="↗">Buy</we-button>
     ```
     ```ts
     // Programmatic (functional mixins) — same 5 features, 1 class, 1 node. super-call chaining = AOP before/after.
     const Button = WithLog(WithTrace(WithValidate(WithAnalytics(WithAffix(HTMLElement)))));
     // each layer: (i) props → ownerElement.dataset / observedAttributes; (ii) content → ownerElement.append()
     //   or ::before/::after (a SIBLING/child, never a wrapping parent); (iii) callback → capture-phase listener
     //   / super.connectedCallback() wrap. Grounded in CustomAttribute lifecycle (attachedCallback,
     //   attributeChangedCallback, ownerElement) — fui:plugs/webbehaviors/CustomAttribute.ts:65-410.
     ```
     The rejected alternative is the naive `<with-log><with-trace>…<button/></with-trace></with-log>` — **5 wrapper
     nodes** that break flex/grid direct-child, AX pairing, `:nth-child`, and `::part` chains (the #1962 cost
     enumeration). The full menu of zero-node options (mixins · custom-attributes · decorators · reactive
     controllers · ancestor event-delegation for truly cross-cutting log/trace · `::before`/`::after` &
     adjacent-DOM for content) and this worked example live in the
     [composition-viability survey](../reports/2026-06-29-transient-self-erasure-concept-viability.md) §3 and
     [/research/dom-less-composition](/research/dom-less-composition/). **Honest residual:** the *declarative*
     custom-attribute form is a **plug** (proposed standard, not shipped native) — the mechanism is at parity, but
     that layer's standards-track status is the one caveat, tracked under the plug corollary (#95/#1826).
4. **Case 2 (grouped/reactive) — parity *pending* a confirm, not clear.** The group-CE + form-associated-children
   split is **already ratified (#1456/#1457 — this card *cites*, not re-decides it)**; but ergonomic parity
   (bar-rule 1) assumes a framework-grade reactivity primitive (signals / observed properties). **Demote to
   pending** until WE's reactivity glue is confirmed framework-grade or filed as a build item.
5. **Cases 3, 6, 9 — parity *pending* a named confirm**, not clear: case 6 is **strongest via the Context
   Protocol** (zero-node, event-based — case 6c), with the `display:contents` host as the cheap-node fallback (AX
   fixed 2023 — FF 113 / Chrome 115 / Safari 17 — for non-interactive structural; residual is interactive-only,
   benign for providers; [fui:plugs/webinjectors/InjectorRoot.ts](../../frontierui/plugs/webinjectors/InjectorRoot.ts),
   #1044 — should align to the Context Protocol per item 7); case 9's `moveBefore()` (Chrome 133 / FF 144; Safari
   ✗ → blocks Baseline) needs a cross-browser fallback. Each rider is a child build item, not a green cell.
6. **Configurable variant selection — among platform-correct variants only.** Where two or more **platform-correct,
   single-substrate** mechanisms satisfy a case (leading example: case 1's *transient leaf* vs *persistent
   light-DOM*), the configurator / MaaS may expose the choice as a **per-project option** — the native-first
   mechanism as the **default**, the alternative **opt-in** (a project needing a persistent JS ref or framework
   property-binding selects light-DOM). This operationalizes §7's "by what the consumer needs" as an
   **assembly-time default-override**, not a reopening of §7. **Hard gate (Fork 1's `is=` bar, generalized):**
   configurable selection is permitted **only among platform-correct wirings** — a **substrate swap** (a
   load-bearing non-standard shim such as polyfilled `is=`) is **never** a configurable option, barred regardless
   of who selects it (the *plug-mode is consumer-side, never the served form* doctrine). The specific leaf-button
   default is **#1962's** call; this card states only the selection *rule*.
   - **Evidence — the shipped-transient audit (2026-06-29).** Of **15** transient blocks, **8 are hard-transient**
     (must be a real native control — `we-button`, `we-text-field`, `we-number-input`, `we-filter-chip`,
     `we-date/time/datetime-picker` — for form participation, implicit submit, native pickers, constraint
     validation that `ElementInternals` cannot give a wrapper): transient justified at the **high bar**. The other
     **7 are soft-transient** (presentational leaves — `we-badge`, `we-tag`, `we-section-card`, `we-auto-heading`,
     `we-meter`, `we-progress`, `we-card` — whose native element carries no required semantics a wrapper would
     break): transient is a **fine default but only at the low bar** — DOM-cleanliness preference, not a hard need.
     These soft-7 are precisely the item-6 *configurable-default* case (default transient, light-DOM a valid
     opt-in). **Finding: the original case over-argued transient at the high bar for the soft-7.** The per-block
     default / expose-the-option call is **#1962's** (case 1), not re-decided here.
   - **Refinement — the hard-8 itself splits by *replicability* (transient is a polyfill for "extend a native
     element in place", the dead `is=` capability).** Transient = author custom → resolve to native → enhancements
     ride as `CustomAttribute`s on the survivor; so it is WE's **polyfill for the absent extend-native capability**,
     and falls under item 7 (plug-to-direction, deprecation-ready). Within the hard-8: **irreplaceable-native** —
     `we-text-field`, `we-number-input`, `we-date/time/datetime-picker` — native picker chrome / IME / spinner /
     constraint-validation UI **cannot be reproduced** without reimplementing the UA, so transient is
     **load-bearing and ~permanent** (nothing to migrate to; being the element *is* native, short of a platform
     extend-native primitive). **Replicable-in-principle** — `we-button`, `we-filter-chip` — a persistent CE +
     `ElementInternals` + wired focus/keyboard/form could approximate, so transient is convenience here → closer to
     the item-6 configurable tier, deprecation-ready if extend-native ever ships. **Transient itself is *not* a
     standards proposal — it is a WE/FUI-original pattern**; the capability it polyfills (a custom element that
     inherits native behaviour) has a concrete standards-track candidate it should align to per item 7:
     **`ElementInternals.type`** ([whatwg/html#11061](https://github.com/whatwg/html/issues/11061), 2025 — the
     multi-vendor alternative to the Safari-dead `is=`). If `#11061` ships cross-browser, a *persistent* CE could
     inherit native behaviour in place and transient could deprecate **even for the hard blocks** (button, and
     potentially inputs/pickers if native chrome is inherited) — transient reads as "permanent" today only because
     `#11061` is early/unshipped.
7. **Transient and plug compose *per-layer* — and plugs are authored to the standards-track direction,
   deprecation-ready.** Decompose each capability per the native-first partition
   ([we:platform-decisions.md#native-first-baseline](../docs/agent/platform-decisions.md)): a layer **present** in
   a shippable browser → **native** (emit-to-native / transient — you do **not** plug what already ships; that
   would be a JS reimplementation, the native-first anti-pattern); a layer **absent** from every spec → **plug**,
   riding the transient survivor as a `CustomAttribute` (as the audit found — "behaviours ride CustomAttribute on
   the surviving native control"; #1807 plugged custom-state validation this way). The two are **per-layer
   composition, not rivals** — no transient block reaches back to native for an *absent* capability; the hard-8
   all consume *present* element-bound chrome (date-picker UI, spinner, IME, implicit submit, native focus). **Plug
   to the direction (migration-ready):** author each plug to align **as closely as possible to its standards-track
   candidate** so its contract mirrors the *anticipated* native surface (polyfill-surface-fidelity extended to the
   **future** surface) and it can be **deprecated and migrated to native when the standard ships** — DOM Parts
   (`ChildNodePart`) for case-10 declarative content regions · the ElementInternals/ARIA-reflection trajectory for
   case-8 owned-element semantics · the signals proposal for case-2 reactivity · the `moveBefore()` shape for
   case-9. Each plug/watch item **names its standards-track target + migration path**. (Extensible Web Manifesto:
   prototype in JS aligned to the proposal, standardize what wins, then retire the plug.)

## Considered & rejected by precedent

- **Customized built-ins (`is=`) as a *load-bearing foundation*** — foreclosed by Safari's *permanent* refusal
  ([WebKit #97](https://github.com/WebKit/standards-positions/issues/97)) **and** statute-barred by the
  native-first **single-substrate floor** ([we:platform-decisions.md](../docs/agent/platform-decisions.md)): a
  dual native-vs-shimmed contract isn't permitted. `is=` is usable only as progressive enhancement (Fork 1). Note
  this **demotes, not forbids** it — consistent with §7's "compliance is a spectrum, nothing is a hard blocker"
  (see *Statute reconciliation*).

## Fork 1 — case 8: behaviour on an *existing* native element with no wrapper

> **✅ RATIFIED (2026-06-29) — (a).** `is=` is **never a WE block mechanism** — every job is dominated (transient ·
> `CustomAttribute` · persistent light-DOM). WE **documents `is=` solely as an opt-in developer option, polyfilled
> in FUI, enabled by explicit dev choice** (lower-compliance, accepted-risk — §7 spectrum); `(b)` load-bearing `is=`
> is statute-barred (single-substrate floor). **Case 8 carries no ⚠️ and no child build item** — covered by case 7 /
> delegation / case-1 emit, foreign part out-of-scope; the owned-element behavioural residual is a standards-watch on
> **`ElementInternals.type`** ([whatwg/html#11061](https://github.com/whatwg/html/issues/11061)). Red-teamed across
> the session; default survives. *(`we:block-standard.md` edit + child-item scaffolding happen at whole-decision
> close, pending Fork 2.)*

*Fork-existence:* a real either/or — make `is=` load-bearing (with a polyfill) vs treat it as progressive
enhancement and meet the native-semantics need another way. They trade off (authoring ergonomics of
`<button is="…">` everywhere vs a permanent non-standard shim). The **excluded/broken** branch is "rely on
`is=` working cross-browser" — Safari will never ship it.

- **(a) — `is=` is progressive-enhancement-only; autonomous CE + `ElementInternals` for owned semantics.**
  *(default)* Never make `is=` load-bearing: where you own the element, emit an autonomous CE and grant native
  semantics via `formAssociated` + `attachInternals()` (`internals.role`, `setFormValue`) — Baseline since 2023,
  cross-browser; where a *real* native element is required, emit one (transient, case 1). `is=` may *enhance* a
  native element where present, degrading to the plain native element in Safari (still functional).
- **(b) — polyfill `is=` and make it load-bearing.** Restores `<button is="…">` ergonomics everywhere via a shim
  (`@ungap/custom-elements`-style). A permanent non-standard maintenance tax with upgrade-timing/SSR edge cases,
  on a feature the platform will never converge on. Acceptable as a *compat layer*, wrong as a foundation.

```js
// Fork 1 (a) — owned element: autonomous CE gets native semantics WITHOUT is=, cross-browser:
class WeToggle extends HTMLElement {
  static formAssociated = true;
  #internals = this.attachInternals();
  connectedCallback() { this.#internals.role = 'switch'; this.#internals.ariaChecked = 'false'; }
  // …focus/keyboard wired explicitly (the residual is= would have given for free)
}
// `is=` only as enhancement, never required: <button is="we-fancy"> → plain <button> in Safari, still works.
```

### Decision guide — `is=` vs transient vs the rest (when to use which, and when NOT)

The first split is **can you author the element** (write its tag), or is it **foreign** (CMS / third-party / another
lib's output)?

| Situation | Use | Why / when NOT |
|---|---|---|
| **You author it**, need a *real native element* + customization, behaviour is **load-bearing** | **transient** — `<we-button>` → real `<button>` | cross-browser, full native behaviour. The default for owned leaves. **Not `is=`** (Safari-dead → not load-bearing). |
| **You author it**, just need *behaviour* (no element-type change) | **`CustomAttribute`** — `<button validate log>` | zero node, rides any element. |
| **You author** your own element needing *form/AX identity* (not a native type) | **autonomous CE + `ElementInternals`** — `<we-toggle>` | `formAssociated` + `attachInternals()`; cross-browser. |
| **You author** a native element, want a **non-essential enhancement** | **`CustomAttribute`** — `<button we-fancy>` | **dominates `is=` even for PE** — in-place, cross-browser, single-substrate, any element, degrades. |
| **Foreign**, cross-cutting behaviour, can't touch markup | **ancestor delegation** | capture-phase listener; zero node. |
| **Foreign** but WE-conformant | **injector / transient-replace** | it's no longer "foreign" — WE mechanisms reach it. |
| **Foreign** non-WE widget internals | **out of scope** | a boundary WE shouldn't cross. |

**`is=` is *not a WE mechanism* — it appears in no row above, because each of its jobs is strictly dominated:**
load-bearing native output → **transient**; behaviour on an authored element (incl. optional PE) → **`CustomAttribute`**
(in-place, cross-browser, single-substrate, any element — beats `is=` on every axis); persistent live instance →
**persistent light-DOM (B)**; foreign in-place → dissolved (case 8). `is='s` only unique trait —
`element instanceof YourClass` with methods directly on the node — *is* the persistent-instance need, served by (B),
and unavailable cross-browser anyway. **Resolution:** WE **documents `is=` only as an opt-in developer option**, with
the **polyfill in FUI** (impl layer — never a WE standard artifact), **enabled by explicit dev choice**
(lower-compliance, accepted-risk — §7 spectrum). Never default, never recommended, never load-bearing in a WE block.
The clean line: **transient = author a custom tag that *becomes* native (1:1, 1:N, or polymorphic — the load-bearing
path); `is=` = a consumer-only opt-in WE never ships as a block mechanism.**

#### Why `is=` ≠ transient (the FAQ — "why doesn't WE just use `is=`?")

They are **semantically different mechanisms**, not "transient = `is=` minus Safari." Transient earns its place on
**capability + substrate-cleanliness**, with Safari merely the final nail:

| Axis | `is=` (even polyfilled) | transient |
|---|---|---|
| **Cardinality** | **1:1 only** — it *is* one native element | **1:1, 1:N, structural** — `<we-text-field>`→`<div><label><input></div>`, `<we-fragment>`→multi-root |
| **Tag** | **fixed** at definition (`extends HTMLButtonElement`) | **polymorphic** — `resolveTag()` picks `<button>` *or* `<a>` by `href` at runtime |
| **Substrate** | **non-standard global patch** (statute-barred as load-bearing) | **single-substrate clean** — autonomous CE + self-replace, all shipped |
| **Authoring** | `<button is="we-x">` — spooky attr, mixed | `<we-x>` — clean, uniform `we-*` namespace |
| **Identity / live ref** | **preserved** (same node, live instance) | **lost** (host erased; survivor = plain native + `CustomAttribute`) |
| **Safari** | dead | works |

The one axis `is=` wins — **persistent identity / live ref** — transient deliberately gives up, and WE serves *that*
need with **persistent light-DOM (B)** (#1456/#1962), not `is=`. So even in a world where Safari shipped `is=`,
transient would still be the better mechanism for any leaf that transforms structure or switches tag. **This
explanation is dev-facing FAQ material → author a guide (outcome-shape child item).**

**Default: Fork 1 (a) is the right *policy* — but case 8 stays ⚠️ UNMET, not "cleared" (skeptic).** `is=`-as-
load-bearing (b) is not merely worse, it is **statute-barred** by the native-first single-substrate floor (no
dual native-vs-shimmed contract), so (a) is the correct policy. But (a) does **not** make case 8 a green cell:
`ElementInternals` grants **role/form semantics, not native behaviour** (focus ring, implicit submit, label
click-through, keyboard activation — all hand-wired, per #1962), and it applies only to **your own** autonomous
element — for case 8's defining constraint (a native element you *don't own*, customized in place) it does not
apply at all, and the fallback ("emit a fresh element via transient") is **case 1, a different case**. So case 8
*as stated* has **no in-place zero-compromise solution** → it is a **tracked gap** (bar-rule 3), not a resolved
cell.

`Skeptic:` REFUTED-as-cleared → policy **(a)** stands (and (b) is statute-barred), but the **verdict flips to ⚠️
UNMET**: the summary table no longer grades case 8 green. Pass-1: choosing PE-only `is=` is the right *kind* of
call; the dodge was labelling the *outcome* resolved. Pass-3: `ElementInternals` was over-cited as "cross-browser
native semantics" — it delivers role/form, not behaviour, and not on foreign elements. Folded: **file the
behaviour-on-a-foreign-native-element gap** as a child item.

`Skeptic pass-2 (supersedes the "file a child item" conclusion):` the ⚠️ itself was over-stated. Decomposing case
8 into 8a–8f shows the foreign-in-place need **dissolves** — 8a→case 7, 8b→delegation (submit via
`requestSubmit`), 8c→injector/transient, 8d→out of scope, 8e→PE, 8f→contrived. The residual "missing" piece is
**owned-element behavioural intrinsics beyond `ElementInternals`**, which is largely synthesizable and on a clear
**converging standards-watch** (ElementInternals 2023 → ARIA reflection → `:state()`) — not a hard gap. **Folded
(final): no child build item, no ⚠️** — case 8 is covered, with the owned-element residual logged as a watch. See
the downgraded verdict above.

**Configurator / MaaS angle — build-time variant-selection operationalizes (a), it does *not* reopen (b).** A
project *can* select which component variant it assembles — MaaS serves *form × strategy* as independent params
targeting the registry ([#081](/backlog/081-module-as-a-service-provider/)). But this does **not** make `is=`
load-bearing, for a ratified reason: per
[maas-serves-self-contained-modules-only](../docs/agent/platform-decisions.md#maas-serves-self-contained-modules-only),
**plug-mode (the polyfill-carrying, global-patching posture) is a *consumer-side* axis, never the served form** —
MaaS serves only self-contained, platform-correct modules, and plugged/unplugged is not a member of the serve
catalog. So what the configurator controls is *which platform-correct wiring is hooked up* (autonomous CE +
`ElementInternals`), **gated to platform-conformance** — not free substrate choice. A load-bearing `is=` shim is a
global patch to the upgrade machinery = consumer-side plug-mode, **not** a MaaS-served variant; a project insisting
on it adds it out of band as an accepted-risk plug (§7 spectrum), which **does not move case 8 off ⚠️ UNMET** in
the standard. Net: MaaS *strengthens* (a) — it gives the demote-not-forbid path a clean home (serve the conformant
variant per project; the shim stays a consumer-side plug) without making `is=` load-bearing in any served contract.

**Verdict (downgraded) — case 8 is not a standalone unmet case; it decomposes into already-covered cases plus an
out-of-scope foreign part, and the only genuinely-missing piece is on a converging platform watch (see the matrix
above).** "Foreign native element" is six sub-cases (8a–8f). Five are **✅ covered or out of scope**: attributable →
case 7; untouchable-but-cross-cutting → ancestor delegation; WE-conformant embed → injector / transient-replace;
non-WE foreign widget → **out of scope** (a boundary WE shouldn't cross); enhancement-only → acceptable `is=` PE.
8f (the in-place foreign-element residual) is **contrived** — submit is `requestSubmit`-synthesizable (→ 8b) and a
real control you'd **emit** (case 1); the irreducible sliver (a *foreign* element becoming a real *form-associated*
control in place) has **no real need** and no platform path (`ElementInternals` is own-element-only **by
construction**, `is=` is Safari-dead #97).

**What `attachInternals()` is missing, and the trajectory.** On an element you **own**, `attachInternals()` already
grants form association (`setFormValue`/`setValidity`/constraint-validation/`labels`/submit participation), ARIA/role
reflection, and custom states (`:state()`). What it does **not** grant is the native *behaviours* — `:focus-visible`
defaults, **implicit** submit (an autonomous CE with `role=button` doesn't auto-submit; call `form.requestSubmit()`),
label click-through, Space/Enter activation — which are hand-wired today but **largely synthesizable** with existing
APIs. The platform direction is unmistakable for the *owned-element* reading (ElementInternals Baseline 2023 → ARIA
reflection → `:state()`, and now **`ElementInternals.type`** for native-behaviour inheritance —
[whatwg/html#11061](https://github.com/whatwg/html/issues/11061), 2025), so this residual is shrinking and is best
classed as a **◐ converging standards-watch, not a ⚠️ gap** — with the native-first-floor caveat that a standard does not grade a cell ✅ on a *future* primitive (the
same watch posture as DOM Parts for case 10). The one thing the trajectory will **never** serve — in-place
customization of a *foreign* element you don't own — is exactly the part with **no real need**. **Net: case 8 carries
no ⚠️ and no child build item** — covered cases named, owned-element residual on the ElementInternals/ARIA-reflection
watch. Policy **(a)** is unchanged.

## Fork 2 — case 10: deep STRUCTURAL composition (the contested case)

> **✅ RATIFIED (2026-06-29) — (a).** Structural layers go zero-node via **comment-anchor directives** (the structural
> mechanism — **not** transient, which is heavy-for-nothing with no native-element target; **not** invent-a-primitive
> (b), over-investment). Clears **JS/JSX** today; **declarative-HTML deep nesting is ⚠️ UNMET**, scoped to the
> *structural/layout* residual (providers are zero-node via the Context Protocol). The residual is the **uncarved
> "Phase 2: nested-directive lifecycle composition"** (case-10 child item) — foundation built (#1130/#1217), ~80%
> remains. Red-teamed across the session; default survives.

*Fork-existence:* a real either/or that the prep survey's two expert passes split on. Both branches are coherent
and trade off: a **discipline** (route structural layers through existing zero-node mechanisms) vs an
**invention** (a net-new primitive for HTML-declarative true-zero-node nesting). The **excluded/broken** branch
is "nest 10 registered custom-element hosts" — it pays all of #1962's layout/CSS/AX costs and fails the bar.

- **(a) — budgeted-host discipline: structural layers go zero-node.** *(default)* Codify: a structural /
  provider / boundary layer is authored as a **function/directive render** (JSX functional components #052;
  comment-anchor directives; mixins for behaviour) — zero nodes, exactly as frameworks compile structural layers
  away — or, where a host is unavoidable, `:host{display:contents}` (box-erased) + `moveBefore()` for
  relocation. A registered `customElements.define` host is **budgeted** to layers that genuinely need slot /
  shadow / AX-identity / lifecycle. Achievable today; matches React/Vue/Svelte/Solid (which all do exactly this).
  - **The structural mechanism is comment-anchor directives, NOT transient.** Transient's payoff is "become a real
    native element"; a structural layer has **no native-element target** — its job is to *vanish* — so transient is
    **heavy-for-nothing** here (it'd pay the upgrade-replace cost to emit nothing / a `<div>`). Comment-anchor
    directives (`CustomComment`) are the fit: a region bounded by anchors, **zero layout node**, no replace churn.
  - **Honest cost — nesting comment-directives needs *lifecycle composition*, which is the deferred "Phase 2".**
    Custom *elements* get lifecycle ordering free from the DOM; comment-anchor *regions* don't, so nesting them
    (`card-frame ⊃ grid-cell ⊃ ForEach ⊃ ViewIf`) requires a built ownership + update + teardown model.
    **Phase 1 is built** (`CustomComment` #1130; `ForEach`/`ViewIf`/`ViewSwitch` = one-time render + manual
    `refresh()` + region-boundary detection — #1217). **Phase 2 is ~80% unbuilt** and the real case-10 work:
    parent→child nesting/ownership, reactive cascade, keyed reconciliation, `moveBefore()` state-preserving moves
    (exists in reorderable-list/dockable, not wired into directives), SSR/hydration of comment regions, nesting
    tests. #1217/#042 acknowledge "Phase 2" but **no item carves it** → that *is* the case-10 child item.
- **(b) — invent a net-new primitive (plug).** A structural/controller construct that composes in JS and stamps
  only leaf DOM, giving HTML-*declarative* true-zero-node deep nesting (plain HTML has only elements, not
  functions, so the discipline's zero-node path is JSX/JS-only). The honest residual the pessimistic pass named.
  But: the zero-node mechanisms already exist for JS/JSX; the standards-track version (DOM Parts) is
  proposal-stage and content-region-only. Over-investment vs (a) unless an HTML-declarative deep-nesting need is
  concretely shown.

### Worked example — Fork 2 (a), the "10 wrapper layers" scenario decomposed by layer kind

The decisive move: **"10 nested layers" is not one kind of layer.** A framework wraps a leaf in (say) 8 HOC/provider
layers — ThemeProvider · LocaleProvider · AuthGuard · FeatureFlags · Analytics · ErrorBoundary · a **grid-cell** ·
a **card-frame**. Sorted by kind, only the last two are *structural*; the other six are context or behaviour, and
**all six collapse to zero node** under the budgeted-host discipline:

```jsx
// JS/JSX surface — function composition, parity with React HOCs. 0 host nodes; only the leaf's DOM lands.
const Tile = () => { const theme = useTheme(); const t = useLocale(); /* context, not DOM */ return <DashboardTile/>; };
const Provided = withErrorBoundary(withAnalytics(/* structural: */ inGridCell(inCardFrame(Tile))));
```

```html
<!-- Declarative-HTML surface — the SAME 8 layers, sorted by kind -->

<!-- (1) context/provider layers ×4  → Context Protocol / injector: ZERO added node, NOT nested as DOM -->
<script type="injector">{ "domain": "@theme",  "provide": { "mode": "dark" } }</script>
<script type="injector">{ "domain": "@locale", "provide": { "lang": "fr" } }</script>
<script type="injector">{ "domain": "@auth",   "provide": { "role": "admin" } }</script>
<script type="injector">{ "domain": "@flags",  "provide": { "beta": true } }</script>

<!-- (2) behavioural layers ×2  → CustomAttribute on the leaf: ZERO wrapper node -->
<!-- (3) structural layers ×2   → comment-anchor directives: ZERO *layout* node (WE CustomComment) -->
<!-- card-frame title="Revenue" -->
  <!-- grid-cell span="2" -->
    <dashboard-tile analytics="dash:tile" error-boundary></dashboard-tile>
  <!-- /grid-cell -->
<!-- /card-frame -->
<!-- dashboard-tile consumes @theme/@locale/@auth/@flags by firing context-request — no provider wrappers exist -->
```

**Result for the 8 layers:** **6 are genuinely zero-node** (4 context via Context Protocol/injector, 2 behaviour
via `CustomAttribute`) on *both* surfaces. The **2 structural** layers are the only ones that touch the residual —
and even those reach **zero-*layout*-node** in declarative HTML via comment-anchor directives (the DevX cost: visible
as comments; JSX erases it). The genuine ⚠️ UNMET is the narrow case where a structural layer must itself **be a
styled box / participate in grid** (so it can't be a comment and can't be `display:contents`) **and** the nesting is
deep — there, declarative HTML still falls back to cheap-node `display:contents`-per-layer.

**Default: Fork 2 (a) clears *JS/JSX only*; declarative-HTML deep nesting is ⚠️ UNMET — a genuine open
invention (skeptic-corrected).** On JS/JSX surfaces (a) reaches zero-node parity and is the right rule. But the
original "(a) discipline = parity today, not an invent-case" was the card's **central dodge**: it silently
restricted "parity" to JSX. On the **declarative-HTML** surface — which bar-rule 5 *requires* — plain HTML has
only elements, so deep structural nesting falls back to `display:contents`-per-layer = **cheap node, not zero**,
breaking bar-criterion 2 (content-model foster-parenting, AX-pairing, structural-selector and tree-walk shifts —
#1962) for the very case under judgment. So the honest split:

- **JS/JSX deep structural composition → (a), clears.** Function/directive render, zero-node, ratify.
- **Declarative-HTML deep structural composition → UNMET → (b)-flavoured open invention.** No zero-node path
  exists buildless today; the standards-track candidate (DOM Parts `ChildNodePart`) is proposal-stage/unshipped.
  This is a **real gap, not a closed cell** — file it: (i) confirm the actual declarative deep-nesting needs,
  (ii) if shown, **generalize the transient-to-comments bridge** (author a tag → becomes comment anchors → zero
  *layout* node) as the WE-side mechanism, and (iii) watch DOM Parts as the standards adopt-path. Do **not** ship
  "case 10 = parity by discipline" unqualified.

`Skeptic:` REFUTED (the central dodge) → split. Pass-0: "(a) parity today, not an invent-case" classified case 10
as solved by quietly scoping parity to JSX; the card's own text admits the HTML surface gets only a *cheap node*.
Pass-1: "use JSX functional components" as the parity answer for a **native-first** system whose surface is
declarative custom elements is retreating to the compiler — the thing native-first is defined against — so it
cannot be claimed as in-surface parity. Pass-3: "frameworks compile structural layers away, so WE should too"
over-reads compiled-surface prior art to license a *buildless declarative* default. Folded: JS/JSX clears;
declarative-HTML deep nesting is an **explicit UNMET gap** carried into `we:block-standard.md`, with the
transient-to-comments generalization as its candidate fix.

### Ecosystem & standards sweep (2026) — summary (full sourced detail in the linked report)

> Full landscape + sources: **[prep survey → ecosystem-sweep follow-up](../reports/2026-06-29-composition-framework-parity.md#ecosystem-sweep)**.

A community + standards sweep **validates the case-10 UNMET *and narrows it*:**

- **Runtime wrapper-free declarative-HTML *structural* composition is an ecosystem-wide gap.** True zero-node comes
  only from a **virtual tree** (React Fiber = no node) or **compile-away** (Astro / WebC / Svelte / JSX) — both
  build-time/JS. In **live HTML** the best is **comment-anchor *nodes*** (Lit/Svelte/Vue/Solid all use comment/text
  anchors — a node, not an element) = exactly WE's `CustomComment`; `display:contents` is the cheap-node fallback.
  No standard rescues it: **DOM Parts** is unshipped, template-scoped, CE-host-silent, and stalled; **DCE**
  materializes a host node.
- **The narrowing:** the "10 nested providers" example conflates *context* with *structure*. **Provider/context
  layers don't need DOM nesting at all** — the **Context Protocol** (bubbling `context-request`, any ancestor
  answers, **zero added node**, `@lit/context`-proven) and CSS custom properties carry context down the existing
  tree. So the genuine UNMET residual is only **structural / layout / boundary** layers.
- **Consequences (already folded above):** case 6 gains the **Context Protocol** as a zero-node DI mechanism and
  `webinjectors` (#1044) should **align to it** (item 7); case-10b's UNMET shrinks to structural layers only; and
  two factual corrections landed (`moveBefore` Chrome 133 / FF 144 / Safari✗; `display:contents` AX fixed 2023,
  interactive-only residual).

## Statute reconciliation with §7 (skeptic — required before ratification)

This card introduces a selection rule over the same turf §7 already governs; the precedence must be stated
([we:block-standard.md](../docs/agent/block-standard.md) §7, #1381/#1456/#1457):

1. **Two selection rules, ordered.** §7's rule picks a *block's runtime family* "by what its primary consumer
   needs" (A transient / B persistent / C shadow). This card's **budgeted-host-node** rule is the **higher
   standing test** of which it is the block-shape application: §7 stays the rule for *block runtime shape*, this
   card's bar + budget-rule govern the *broader composition surface* and license future mechanism choices. They
   are **different altitudes, not rivals** — but where they touch the same cell (a structural provider a consumer
   wants a live ref to), **the bar governs and §7's consumer-need is applied beneath it.** Stated, not implied.
2. **Bar vs §7's "compliance is a spectrum."** §7 item 2 holds that no-element/CSS-only and `is=` are
   "lower-compliance choices, **not disallowed** — a risk the author accepts." The bar **demotes `is=` out of WE
   entirely as a mechanism** (every job dominated — see the decision guide), but does **not** *forbid* it (that
   would contradict §7). The reconciled landing: **WE documents `is=` only as an opt-in developer option, polyfilled
   in FUI, enabled by explicit dev choice** (lower-compliance, accepted-risk) — *demote to documented consumer-opt-in,
   not prohibit*, and never a WE block mechanism.
3. **Cases 2 / grouped-control cite, not re-decide, #1456/#1457.** The group-CE + form-associated-children split
   is ratified statute; this card references it as an input and does not re-open it.

## Outcome shape (what ratifying this produces)

- A **single strict per-case rubric** in `we:block-standard.md` (consolidating §7 families with the dom-less
  catalog under the *scoped* budgeted-host-node spine), each case naming its mechanism **and its honest verdict
  (✅ / ◐ / ⚠️)** — including the one cell that does **not** clear (10-in-HTML); case 8 was re-judged *covered*.
- The **component-*definition* surface** codified alongside usage: imperative (class/factory + mixins) **and**
  declarative build-time `<component>` are at parity; live-runtime declarative-definition (HTML Modules /
  Template Instantiation) is a standards **watch**, not a gap. Plus the **four sanctioned composition-in-definition
  seams** (#854/#1795) — slots ✅, decoration ✅, scoped-replace ◐ (cites #901), abstract-split ✅.
- The **5-point bar** codified as the standing test for future mechanism choices, with the §7 precedence stated.
- **Child items for every ◐ / ⚠️ that is *buildable*** (gaps tracked, never graded green): (i) case 6 AX-tree
  confirm; (ii) case 9 `moveBefore` cross-browser fallback; (iii) reactivity-primitive parity confirm (cases
  2/4); (iv) **case 10 — declarative-HTML deep-structural-nesting = "Phase 2: nested-directive lifecycle
  composition"** (the structural mechanism is comment-anchor directives, **not** transient). Foundation built —
  `CustomComment` #1130, `ForEach`/`ViewIf`/`ViewSwitch` one-time + manual `refresh()` #1217; Phase 2 (~80%) is the
  build: parent→child nesting/ownership ordering · reactive cascade · keyed reconciliation · `moveBefore()`
  state-preserving moves · SSR/hydration of comment regions · nesting tests. Carves the **uncarved** Phase-2
  deferral in #1217/#042; the transient-style authoring tag is **optional DX sugar** (lowers to comments), not the
  substance; align to DOM Parts `ChildNodePart` for the migration path (item 7); (v) **`webinjectors` → Context-Protocol alignment** (case 6c — the
  zero-node DI direction, item 7); (vi) **dev-facing composition guide** — the mechanism menu + when-to-use, with **strong worked examples of directive-vs-behaviour**
  (behaviour is first-choice; directive only for pre-connection / region control) and the "**why not `is=`?**" /
  `is=`-vs-transient FAQ (these *will* be asked; explanations live in Fork 1's decision guide + comparison table +
  the catalog's behaviour-vs-directive rule — surface as a guide); (vii) **devtools for comment-anchor directives**
  — surface comment-directive regions in devtools (the visible-as-comment DevX gap that makes directives less
  ergonomic than elements).
- **Scaffolded children (2026-06-29):** **#1968** injector→Context-Protocol (carries case-6 zero-node DI; display:contents
  AX fallback) · **#1969** case-9 `moveBefore` fallback · **#1970** reactivity-primitive confirm (cases 2/4) ·
  **#1971** (epic) Phase-2 nested-directive lifecycle composition (case 10) · **#1972** dev-facing composition
  guide · **#1973** devtools for comment-anchor directives · **#1974** transient↔light-DOM configurable option for
  the soft-7 (blocked on #1962).
- **No uncovered need (no child item, no ⚠️):** **case 8** decomposes into already-covered cases (7 / delegation
  incl. `requestSubmit` / case-1 emit) plus an out-of-scope foreign part; 8f is contrived. Recorded in
  `we:block-standard.md` with those coverages named. The only genuinely-missing piece — **owned-element
  behavioural intrinsics beyond `ElementInternals`** — is logged as a **standards-watch** on the
  ElementInternals/ARIA-reflection trajectory (not graded ✅ on the future primitive; not a build item).

## Inputs & relationships

- **Inputs (built, ratified):** §7 families #1321/#1381/#1456/#1457 · `CustomComment` #1130 · view directives
  #1217 · `display:contents` provider #1044 · `webportals` · JSX strategy #052 ·
  [/research/dom-less-composition](/research/dom-less-composition/) · [/research/composition-framework-parity](/research/composition-framework-parity/).
- **Research (this session):** the framework-parity prep survey [relatedReport](../reports/2026-06-29-composition-framework-parity.md),
  with its [2026 declarative-HTML composition ecosystem sweep](../reports/2026-06-29-composition-framework-parity.md#ecosystem-sweep)
  follow-up (community + standards landscape + sources — the durable home for the sweep summarized under Fork 2).
- **Facet:** **#1962** (transient) is case 1's mechanism choice — prepared/resolved separately; the benchmark
  shows transient (emit-to-native) is *parity-competitive*, not a liability, for behaviour-free leaves.
- **Downstream:** the block-conversion epic **#1442** inherits whatever this ratifies.
- **No `blockedBy` on #1960/#1961** — those mitigations stand regardless.
