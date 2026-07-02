---
kind: decision
status: resolved
blockedBy: []
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-02"
codifiedIn: "docs/agent/block-standard.md#custom-node-recipes"
preparedDate: "2026-07-01"
relatedReport: reports/2026-07-01-custom-node-registry.md
tags: [standard-proposal, custom-nodes, node-kind, characterdata, webdirectives, webexpressions, expressions, native-first, decision]
---

# CustomNodeRegistry — declare node kinds like custom elements (`customNodes` : node recipes :: `customElements` : tags)

**Prepared, ready to ratify.** The question was never "can userland do this today" (it can't — the normal starting
point for a WE proposal, per the plug = proposed-missing-standard model) but **"is a node extensibility standard
worth proposing, and in what shape."** Verdict: **GO.** The shape is a **`customElements`-shaped registry**: you
`customNodes.define(class X extends CustomNode { … })` — static fields for config, methods for behavior — for a
node keyed by a **delimiter grammar** instead of a tag. It even reproduces the native syntax-bearing node kinds
(below), the proof it is well-formed. Grounded in a code read of the real FUI tree plus a standards-track +
framework prior-art survey published as the [`custom-node-registry`](/research/custom-node-registry/) topic (report
via `relatedReport`).

## The firewall — standard vs polyfill (the organizing rule)

The one discipline every earlier draft kept violating: **do not mix the standard with the polyfill**
(`we:docs/agent/platform-decisions.md` zero-impl rule — WE holds definitions, FUI holds impl).

- **Standard (declarative, observable, WE):** a node is declared by **what it observably is** — a class extending
  `CustomNode`, with static config and behavior methods. It never names a concrete host class or a walk.
- **Polyfill (FUI, swappable, *out* of the standard):** reads the config and materializes the node onto whatever
  native kind is closest *today*. When the platform ships real support the polyfill drops away and the class is
  **unchanged** — the test that this is a standard, not a polyfill in disguise.

Traps this closes: `carrier:'text'|'comment'` and "flow vs annotation" both name concrete nodes / miss that a
component is also flow; requiring literal `<!-- -->` to get an invisible node bakes a polyfill choice into the
definition; and auto-deriving the close (Fork 3) is fragile. The **host** — which native kind ends up in the tree —
is a *polyfill outcome*, never authored.

## The API — exactly like a custom element

You write, name, and configure the class the way you write a custom element: `extends CustomNode`, **static fields**
for config, **methods** (incl. the full lifecycle) for behavior, registered on the `customNodes` registry.

```ts
customNodes.define(class Portal extends CustomNode {
  static open  = '{@'                                  // FREE opening delimiter — the registration key
  static close = '}'                                   // closing delimiter — DECLARED (mirror is a convention, Fork 3)
  static rendered = false                              // a marker (no value/children): false = invisible directive
  static observedAttributes = ['target', 'disabled']   // exactly like a custom element

  upgrade()               { portalTo(this.attributes.target) }   // behavior
  connectedCallback()     { /* … */ }                            // + the full lifecycle,
  disconnectedCallback()  { /* … */ }                            //   like a custom element
  attributeChangedCallback(name, oldV, newV) { /* … */ }
})
```

**The static field you set declares the node's nature** (self-documenting, per-payload):

| static field | nature | values | example |
|---|---|---|---|
| `static value` | an **expression** (leaf) | `'shown'` (visible) · `'hidden'` (compute-no-emit) | `{{ price }}` / `{= track(x) }` |
| `static children` | a **region** (subtree) | `'inert'` (a template — instantiated) · `'live'` (rendered in place) | `{#each}…{/each}` / `{#ctx}…{/ctx}` |
| *(neither)* + `static rendered` | a **marker** (point) | `true` (include/outlet) · `false` (invisible directive) | `{> sidebar }` / `{@portal …}` |

Plus the grammar + params, always available: `static open` / `static close` (a region adds `static regionName` and
`static regionClose`), and `static observedAttributes`. Exactly one of `value`/`children` may be set; neither = a
marker. Behavior + lifecycle are methods.

- **`CustomNode` is the single base** every custom node extends, as `HTMLElement` is for custom elements. One
  identity — `node instanceof CustomNode` — plus your **named** class: `Portal.name === 'Portal'`, `node instanceof
  Portal` works, subclassable.
- **The host is a polyfill outcome, not authored** — the polyfill reads the config and materializes onto the nearest
  native kind, **never minting a new `nodeType`**: `value:'shown'`→Text · `value:'hidden'`→Comment ·
  `children:'inert'`→`<template>` · `children:'live'`→an element · marker→an element (rendered) or Comment (invisible).
  Which native node hosts it is FUI's call; the standard guarantees the `CustomNode` identity and the declared behavior.

## The native kinds, expressed in this API (the well-formedness proof)

If the API can reproduce the natives, it is complete — and it does, with the mirror convention (Fork 3) turning out
to be **exactly how HTML already works** (we extracted it from the platform, not invented it):

| native kind | `open` | nature (static) | `close` (mirror convention) | → host |
|---|---|---|---|---|
| Element `<section>…</section>` | `<section` | `children = 'live'` | `</section>` (name-echo) | Element |
| Template `<template>…</template>` | `<template` | `children = 'inert'` | `</template>` (name-echo) | HTMLTemplateElement |
| Void element `<img …>` | `<img` | marker, `rendered = true` | `>` | Element |
| Text `Hello` | *(none — raw)* | `value = 'shown'` | *(none)* | Text |
| Comment `<!--note-->` | `<!--` | `value = 'hidden'` | `-->` (reverse-mirror) | Comment |
| DocType `<!DOCTYPE html>` | `<!DOCTYPE` | *fields (native-only)* | `>` | DocumentType |

Two facts fall out: **(1)** the reverse-mirror / name-echo convention reproduces `<section>`→`</section>`,
`<!--`→`-->`, the void point `<img>`, and the `<template>` = `children:'inert'` mapping — native, not novel.
**(2)** *Text is the only kind with no opening grammar* — the raw baseline; a delimiter recipe (`{{`) *adds* an open
grammar to text to carve a custom node out of it. That is what "delimiter-keyed" means, and why `customNodes` owns
the delimiter surface while `customElements` owns the tag surface.

## The userland recipes

`customNodes` opens the delimiter-keyed surface (tag-keyed is `customElements`; the doctype a native singleton). One
row per nature × behavior:

| recipe | `open` | nature (static) | `attributes` | → host (polyfill) | example |
|---|---|---|---|---|---|
| expression | `{{` | `value='shown'` | opt | Text | `{{ price }}` |
| compute-no-emit | `{=` | `value='hidden'` | opt | Comment / stripped | `{= track(price) }` |
| region — template | `{#` | `children='inert'` | opt | `<template>` | `{#each items}…{/each}` |
| region — live | `{#` | `children='live'` | opt | an element | `{#ctx theme="dark"}…{/ctx}` |
| include / outlet | `{>` | marker, `rendered=true` | opt | element / fragment | `{> sidebar }` |
| directive | `{@` | marker, `rendered=false` | **✓** | Comment (invisible) | `{@portal target="#m" disabled}` |

`open` is free (declared `close`). **Invisibility is `rendered:false`, never a syntax** — a directive needs no
`<!--`. Authoring an invisible node with the comment grammar (`<!--@portal…-->`) buys only *native, zero-JS
invisibility* (a free delimiter flashes as text until the polyfill runs) — an authoring optimization, not a
definition rule (Risks).

## Framework coverage — does the recipe set span the prior art?

Mapping every construct the survey catalogued (Mustache, Handlebars, Vue, Angular, Liquid, Jinja, Blade, Svelte,
ERB, Razor) confirms the set is **complete for node-producing syntax**:

| framework need | examples | recipe |
|---|---|---|
| interpolation | `{{x}}`, Svelte `{x}`, ERB `<%=%>`, Razor `@()` | expression |
| unescaped/raw HTML out | `{{{x}}}`, Blade `{!!x!!}` | expression (distinct `open`) |
| conditional / loop block | `{{#if}}`, `{%for%}`, `{#each}`, `@if…@endif` | region — template |
| context provider / wrapper | framework contexts, live regions | region — live |
| partial / include | `{{>p}}`, `{%include%}`, `@include` | include marker |
| template comment | `{{!c}}`, `{#c#}`, `{{--c--}}`, `<%#%>` | compute-no-emit |
| directive (invisible + params) | comment behaviors, Vue block directives | directive (marker + `rendered:false` + attrs) |
| raw / verbatim region | `{%raw%}`, `@verbatim` | the mandatory escape-hatch (built-in) |

**Deliberately out of scope — not node kinds** (a different keying), stated so the standard does not over-claim:

| need | examples | why out of scope |
|---|---|---|
| **attribute-value interpolation** | `class="{{x}}"`, Vue `:class`, `[class]`, `nodes="[[t]]"` (`we:docs/agent/platform-decisions.md:1018-1019`) | an expression *inside an attribute value* — not a node (distinct from a node carrying its own `observedAttributes`) |
| **element/attribute directives** | Vue `v-model`, Angular `*ngIf`, Svelte `bind:`/`on:` | attribute-keyed *on an existing element* → the webdirectives *attribute* registry / #1986, not a delimiter node |

Attribute-value interpolation is the biggest framework feature `customNodes` does **not** own; it is a sibling
surface (an attribute-value expression standard) worth a separate item, not a gap in this one.

## Conformance — the errors `define()` throws

The standard is **normative about well-formedness**: an implementor builds the recipes above and **rejects malformed
classes with a typed error**:

- **both `static value` and `static children` set** → `AmbiguousPayloadError` (a node is an expression *or* a region,
  not both; a marker sets neither).
- **`static children` set without `static regionClose`** → `MissingRegionCloseError` (a region needs its terminating
  marker; `regionName` too if the close is name-echoed).
- **an authored attribute not in `static observedAttributes`** → **warn** and ignore (like Custom Elements'
  unobserved attributes).
- **two live recipes with colliding `static open`** → `DelimiterCollisionError` (the reserved-family policy —
  deferred to a child — defines *which* opens are legal; the collision error itself is normative here).
- **authoring an invisible grammar (`<!--…`) with a visible nature** (`value:'shown'` / a rendered marker) → **warn**
  (contradictory: a natively-invisible carrier that also asks to render — the config, not the syntax, is authoritative).

`close`/`regionClose` are *declared*, not derived (Fork 3), so setting them never throws. This table is the
conformance spine a spec-shaped write-up (epic #2079) turns into normative MUST/MUST-NOT prose.

## What this decides

1. **`customNodes`' ownable surface = the delimiter-keyed recipes above.** Tag-keyed (`customElements`) and the
   doctype singleton are framed, not re-owned — **Fork 2's scope, settled by enumeration.**
2. **The nature is declared by the static field set** (`value` / `children` / bare `rendered`); the host is a pure
   polyfill function of it; `open`/`close`/`attributes` never touch the host.
3. **Polyfill readiness:** the value/marker recipes ship today (`fui:plugs/webexpressions/CustomTextNodeParser.ts:39,45`,
   `fui:plugs/webdirectives/CustomComment.ts:27`); the `children` recipes use the `transform`→`<template>` path
   (`fui:blocks/view/ViewIfDirective.ts:147-163`, `fui:plugs/webdirectives/CustomTemplateType.ts:42`). **No host
   class name appears in the standard.**
4. **One caution, not a collision:** an invisible recipe (`value:'hidden'` / directive / `children:'live'`) authored
   with a *visible* delimiter flashes as literal text until the polyfill runs → prefer the comment grammar for
   pre-JS invisibility (Risks).
5. **The one non-polyfillable cell is outside this surface:** a user-defined **void custom element** (a tag-keyed
   marker) — the platform forbids autonomous void custom elements. A `customElements` gap, not a `customNodes`
   blocker (deferred).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1** — what a custom node *is* | **a class extending `CustomNode`, configured by static fields (like a custom element); the host is a polyfill outcome — never a new `nodeType`** | mint a new `nodeType`/`Node` subclass (*zero prior art, closed enum* — documented residual) | high |
| **Fork 2** — unification scope | **one registry over the delimiter-keyed surface; tag-keyed is `customElements`, the doctype a native singleton — framed, not re-owned** | one registry over all keyings · monolith · leave unrelated | high |
| **Fork 3** — the close grammar | **`open`/`close` are author-declared (auto-derivation is fragile); reverse-mirror + name-echo are a recommended convention, adopted as the WE house style for WE blocks** | auto-derive the close (authoritative — breaks on real grammars) · hard-fixed 2-char | high |

## Fork 1 — what a "custom node" is: a class extending `CustomNode`, like a custom element

A custom node does not introduce a `nodeType`; it is **a class extending `CustomNode`**, configured by static fields,
registered on `customNodes` — the Custom Elements shape, one keying over.

**New *subclass*, not a new *type* — the Custom Elements precedent, exactly.** In the DOM every node is a class
instance, so a custom node inherits one: **`CustomNode`** (as a custom element extends `HTMLElement`). Minting a
subclass is expected; minting a `nodeType` integer or a new base interface is not. Two identities the standard
guarantees:

- `node instanceof CustomNode` → **any** custom node — the single base, one test detects them all.
- `node instanceof Portal` → **this** kind — your **named** class (`Portal.name === 'Portal'`, subclassable).

Whether the node is *also* `instanceof Text`/`Comment` is a **polyfill outcome** (how it's materialized), not a
standard promise — the firewall keeps it out of the definition. The one hard invariant: **never a new `nodeType`**.

- **(a) A class extending `CustomNode`, static-configured; host materialized by the polyfill** *(default, high)* —
  polyfillable today (the recipes above), and the exact ergonomics of `class extends HTMLElement`.
- **(b) Mint a new `nodeType` — a direct `Node` subclass that is its own kind** — *Rejected (dominated):*
  `Node.nodeType` is a **closed integer enum** with pervasive `instanceof`/`switch` branching and **zero prior art**
  for a userland kind. (Distinct from (a): (a) subclasses `CustomNode` and materializes onto an *existing* kind; (b)
  would be a *new* kind.) Kept as a documented residual, not a live branch.

**Usage — the same shape for every nature; the static field declares it:**

```ts
// expression → value:'shown' → Text
customNodes.define(class Money extends CustomNode {
  static open = '{{'; static close = '}}'; static value = 'shown'
  upgrade() { this.textContent = formatCurrency(this.expression) }
})
// invisible directive → marker + rendered:false + attributes → Comment  (NO <!-- needed)
customNodes.define(class Portal extends CustomNode {
  static open = '{@'; static close = '}'; static rendered = false
  static observedAttributes = ['target', 'disabled']
  upgrade() { portalTo(this.attributes.target) }
})
// region template → children:'inert' → <template>
customNodes.define(class ForEach extends CustomNode {
  static open = '{#'; static close = '}'; static regionName = 'each'; static regionClose = '{/each}'
  static children = 'inert'
  upgrade() { this.instantiate(this.attributes.items) }
})
```
```html
<!-- author it — the declarative face: -->
<p>Total: {{ order.total }}</p>          <!-- Money: renders "$1,299.00" -->
{@portal target="#modal" disabled}       <!-- Portal: invisible directive carrying target + disabled -->
{#each items}<li>{{ item.name }}</li>{/each}   <!-- ForEach: inert template, instantiated per item -->
```

**Naming honesty (open sub-question).** Because the host is always an existing kind, "node-*kind* extensibility"
overclaims. The primitive is *a delimiter-keyed node-recipe registry*. **Recommendation: keep `CustomNodeRegistry`
/ `customNodes` (it mirrors `customElements` and reads in-grain), but make "declare a class by property, keyed by a
grammar" the spine and demote "node-kind extensibility" to the north-star aside.** (Alternative: rename to a
"directive/expression node registry" — rejected as less discoverable and losing the `customElements` echo.)

## Fork 2 — unification scope: the delimiter-keyed surface, by enumeration

The scope is not a judgment cut — the enumeration **settles** it. Delimiter-keyed recipes are exactly the surface no
shipped standard owns; tag-keyed is `customElements`, the doctype a native singleton. So one registry over that
surface.

- **(a) One `customNodes` registry over the delimiter-keyed surface; tag-keyed + doctype framed-not-owned**
  *(default, high)*.
- **(b/c/d) one registry over all keyings · one monolith · leave unrelated** — *Rejected:* (b) re-standardizes what
  `customElements`/`CustomTemplateType`/`CustomScriptType` already own; (c) couples divergent lifecycles for a win
  the differing walks negate; (d) leaves the standard no single surface to codify.

**Usage — one registry; tag-keyed stays with `customElements`:**

```ts
customNodes.define(class Expr extends CustomNode { static open='{{'; static close='}}'; static value='shown'; /* … */ })
customNodes.define(class Ctx  extends CustomNode { static open='{#'; static close='}'; static regionName='ctx';
                                                   static regionClose='{/ctx}'; static children='live'; /* … */ })
customElements.define('my-widget', MyWidget)   // tag-keyed → the framed sibling registry, not customNodes
```
```html
<my-widget>                       <!-- tag-keyed → customElements -->
  {#ctx theme="dark"}             <!-- children:'live' → element host -->
    <p>Hi {{ user.name }}</p>     <!-- value:'shown' → Text host -->
  {/ctx}
</my-widget>
```

**Honesty correction (carried from the skeptic):** #1986 filed `CustomTemplateType`/`CustomScriptType` as
*siblings* under `HTMLRegistry` — a **placement** fact, not evidence of an implementable supertype across all
keyings. The registry earns its unity because delimiter-keyed nodes share the one `extends CustomNode` shape, which
the attribute-keyed element registries do not. Do not cite the sibling filing as proof of a universal interface.

## Fork 3 — the close grammar: declared, with a mirror *convention*

**`static close` is author-declared, not auto-derived — automatic close formatting is a recipe for problems.** A
mechanical rule (reverse-mirror the `open`) looks elegant but is fragile: it must guess which part of `open` is a
**base delimiter** vs a **sigil**, and that guess breaks on real grammars. Explicit is safe and unsurprising. **But
the mirror is a good *convention*** worth recommending — and worth adopting as a **WE authoring standard** for WE's
own blocks/kinds (house-style consistency), just not a rule `customNodes` enforces on everyone.

A delimiter grammar has three describable parts (this folds in the sigil):

- **base delimiter** — the brackets that reverse-mirror cleanly: `{{`↔`}}`, `<%`↔`%>`, `(`↔`)`, `[[`↔`]]`.
- **sigil / mode-marker** — rides the open, **absent from the close**; selects a mode (Handlebars `#`/`/`/`!`/`>`,
  the `{{ }}`-vs-`{% %}` expression/statement split, a Razor `@`-prefix). This is *why* naive full-token mirroring
  fails: the sigil has no closing counterpart.
- **region name** — for a region, echoed on the close marker (`{{#each}}`↔`{{/each}}`).

**Coverage — why auto-derivation can't be the rule.** Reverse-mirror of the *base* covers most surveyed grammars
(`{{`↔`}}`, `{%`↔`%}`, `{#`↔`#}`, `<%`↔`%>`, `[(`↔`)]`, `{!!`↔`!!}`, `@*`↔`*@`). But it **cannot** be derived
mechanically for `<%=`↔`%>`, `{{!`↔`}}`, `{{>`↔`}}` (dropped sigil), `@{`↔`}`, `@(`↔`)` (dropped `@`-prefix), or
`@if`↔`@endif` (keyword blocks) — a deriver can't reliably separate base from sigil. So the surveyed prior art
itself proves auto-derivation unsafe; **declared closes replicate all of it.**

- **(a) author declares `static open`/`static close` (+ `regionClose`); reverse-mirror + name-echo are a recommended
  convention, adopted as the WE house style for WE blocks** *(default, high)* — safe, unsurprising, replicates every
  surveyed grammar; the convention keeps WE's own kinds consistent without constraining userland.
- **(b) auto-derive the close (reverse-mirror + name-echo), authoritative** — *Rejected:* the sigil ambiguity above
  breaks derivation on real grammars — "clever but fragile," a recipe for problems. Kept only as the *optional*
  convention/helper (`mirror(open)`), never the authority. (FUI's `closingIdentifier` is already `abstract` /
  author-set today — `fui:plugs/webexpressions/CustomTextNodeParser.ts:45` — so declared-close needs no change.)

**Usage — declare the pair; an irregular grammar is just a normal declaration (no special "override"):**

```ts
customNodes.define(class If extends CustomNode {
  static open = '@if('; static close = ')'; static regionName = 'if'; static regionClose = '@endif'  // Blade-style, non-mirror
  static children = 'inert'
  upgrade() { /* … */ }
})
```

## Supported by default (not forks)

- **Static fields + methods are the whole surface** — `open`/`close`/`value`/`children`/`rendered`/`regionName`/
  `regionClose`/`observedAttributes` are static config; `upgrade()` + lifecycle callbacks are behavior. `shape` and
  `host` are polyfill-derived; the walk/base-node are polyfill.
- **Invisibility is `rendered:false` / `value:'hidden'`, not a syntax** — a directive needs no `<!--`; author any
  `open`. The comment grammar is an *optional* pre-JS-invisibility optimization (Risks), never required.
- **`observedAttributes` ride the open marker** (`{@portal target="#m"}`) — the "name+behavior params" capability,
  exactly like a custom element. Distinct from attribute-value interpolation (out of scope, Framework coverage).
- **A page that registers no custom node does nothing** — unregistered delimiter syntax is inert (as an
  unregistered `<my-el>` is an inert unknown element). Opt-in, backward-compatible by construction.
- **A raw/verbatim escape hatch + delimiter-override is a mandatory conformance requirement** — every `{{`-engine
  ships one because `{{` collides when template layers stack. A stacking-safety property of any delimiter system.
- **The expression/statement two-family split** (`{{ }}` emit-value vs `{% %}` control-flow) is the near-universal
  in-grain default; adopt it, decided on its own merit.

## Risks (honest)

1. **Visible degradation of invisible recipes** (`value:'hidden'`, a directive, `children:'live'`) authored with a
   *visible* delimiter — `{@portal}` / `{#each}` flash as literal text until the polyfill runs, denting the
   "unregistered = inert" guarantee. **Mitigation (guidance): for pre-JS/SSR invisibility, author with the comment
   grammar** (`<!--@portal…-->`), which the browser hides natively. Free delimiters stay legal; the comment carrier
   is the no-flash option.
2. **Nesting** (`{#each}` in `{#each}`) needs a match stack — but name-echo is exactly the disambiguator (the same
   reason `</section>` carries a name). Real complexity, tool already in the grammar.
3. **Delimiter collision** across co-resident recipes → the reserved-family policy (deferred to a child, below).

## Deferred to children (out of scope here)

- **The comment-directive spec** (its concrete authored form + residue) — largely answered by Fork 1 (a directive =
  a marker/region + `rendered:false` + `observedAttributes`) and by #1989 downstream; file a child if a dedicated
  comment-directive standard is still wanted.
- **The concrete reserved-delimiter-family policy** — *which* opens are platform-reserved for userland (the
  Custom-Elements hyphen-rule analogue for delimiters) and the exact escape-hatch/override grammar.
- **Attribute-value interpolation** — the sibling standard for expressions inside an attribute value
  (`class="{{x}}"`); the biggest framework feature this standard does not own. File as its own item.
- **Void custom elements (tag-keyed marker, platform-forbidden).** The one non-polyfillable native cell — a
  user-defined void custom element. Out of `customNodes`' delimiter surface; note as a `customElements` gap.
- **Region hardening** — nesting/stack semantics and the visible-degradation guidance for `children` recipes.

## Statute-overlap (reconcile at codification)

This **generalizes** #1986's directive-registration mechanism: #1986's registries become *polyfill instances* —
`CustomCommentRegistry` polyfills the invisible recipes; `CustomTemplateType`/`CustomScriptType` are the tag/attr
keyings, framed-not-owned by `customNodes`. Codifies into a new `we:docs/agent/block-standard.md` node-recipe
section (or a `we:docs/agent/platform-decisions.md` anchor) that #1986 **nests under** — do not duplicate #1986's
rules; point them at the generalized frame. No rule *conflict* (a superset), but an unreconciled cross-reference to
fix when `codifiedIn` is set. #1986's own ruling (three concrete registries, **not** a parameterized god-registry)
is preserved as a *polyfill* decision — the standard-level contract is the declarative class, which says nothing
about how many registries FUI builds.

## Blocks / relationships

- **Blocks #1989** (directive residue marker grammar) — residue markers are the serialized wire-format of a region
  recipe, so Fork 3's declared close (mirror convention + name-echo region) and Fork 1's "host is an existing kind"
  settle the frame #1989's residue form sits in.
- **Generalizes #1986**; **parent frame** for the comment-directive standard-vs-polyfill question.
- **Cited as the shape template by #2079** (spec-shaped standards epic) — its conformance/error model is the pattern.
- Surfaced in the #1989 decision session (2026-07-01); see `we:reports/2026-07-01-custom-node-registry.md`.
