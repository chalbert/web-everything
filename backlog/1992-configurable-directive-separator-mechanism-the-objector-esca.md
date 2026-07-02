---
kind: decision
status: open
dateOpened: "2026-06-30"
dateStarted: "2026-07-02"
preparedDate: "2026-07-02"
relatedReport: reports/2026-07-02-configurable-attr-naming-scheme.md
tags: [naming, colon-namespace, config, webdirectives, attribute-naming, decision]
---

# Configurable directive-separator mechanism (the objector escape hatch + migration bridge)

Designs the MECHANISM #1987 deferred here: the app-level knob that remaps WE's behaviour/event
attribute-name spelling (the objector escape hatch + the `enh-*` migration bridge). Default stays colon;
the knob is opt-in. The prep reframes the knob from a *separator char* to a *naming-scheme config
dimension* (Fork 1), pins the canonical-identity contract (Fork 2), the flavor-exclusivity rule (Fork 3),
and the value's scope (Fork 4); surface-scope and layer-placement are statute-settled, not forks. Prior-art
survey: [`configurable-attr-naming-scheme`](/research/configurable-attr-naming-scheme/) (report via
`relatedReport`).

## Grounding digest

**The ratified posture (the contract this mechanism must serve).**
`we:docs/agent/platform-decisions.md#attribute-name-colon-namespacing` (#1987, ratified 2026-06-30; amended
by #1991, 2026-07-01) rules: behaviour/event attribute names are colon-namespaced *when in a family*
(`on:*`, `view:*`, `nav:*`, `droplist:*`, `route:*`, `grid:*`); family-less behaviours stay bare
single-hyphen (`type-ahead`); the separator is "intended to be **app-configurable** (the reconciliation
bridge to the eventual ratified spelling — mechanism deferred to #1992)"; if a hyphen form is ever adopted
it is **`enh-*`, never `we-*`**; and configurability is "the objector escape hatch + migration capability,
**not an author knob**" (#1987 Fork 1 closing section — the excluded thing is *per-author* spelling choice).

**Stale-premise reconciliation (#1991 — the old blocker is gone, in status and in substance).** The prior
grounding note encoded `blockedBy` #1991 on the premise that #1991 would migrate the bare-hyphen attrs
*into* the colon namespace, making the name surface uniformly colon first. #1991 resolved 2026-07-01 with
the **opposite** ruling: colon is *family-only*; `type-ahead`, `focus-delegation`, `navigation-guard` stay
bare. So "remap the separator" was never going to be defined char-wise over the whole surface — which is
evidence *for* the scheme framing (Fork 1), not a blocker. Blocker removed.

**The three directive surfaces have deliberately different, ratified separator policies** (per-surface, not
uniform — `we:docs/agent/platform-decisions.md:773-774`):

- Behaviour/event attribute **names** — colon-or-hyphen accepted at define time
  (`fui:plugs/webbehaviors/CustomAttributeRegistry.ts:178-185`, the `#assertValidName` guard); matched by a
  literal name→definition lookup (`fui:plugs/webbehaviors/CustomAttributeRegistry.ts:308-309` `#update` →
  `getDefinition(attributeName)`; `:463-464` `attr.localName` → `getDefinition`). **This lookup seam is the
  natural remap choke-point** — names are registered canonically (`fui:blocks/view/registerViewDirectives.ts`,
  `fui:blocks/attributes/on-event/OnEventAttribute.ts:277-295`) and compared as strings at exactly these sites.
- Comment-directive **names** — grammar-locked to colon `namespace:name`
  (`fui:plugs/webdirectives/CustomCommentParser.ts:34`, the `DIRECTIVE_NAME` regex). Comment-directive
  *option keys* have no colon surface at all (`OPTION_RE` is `[A-Za-z_][\w-]*`,
  `fui:plugs/webdirectives/CustomCommentParser.ts:38`) — nothing to remap there; dispatched event *types*
  are likewise not behaviour attr names and sit outside the knob.
- `<template type=>` **values** — colon **rejected** (`fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts:79-87`);
  bare core / `owner-kind` hyphen third-party (#1987 Fork 2).

**WE already owns the exact config surface this knob belongs to.** `we:config/defineConfig.ts:90-101`
(`WebEverythingConfig`) is an **open-set, one-key-per-dimension** author surface (`theme`, `autoDefine`,
`renderStrategy`, `codegenSoT`, `[dimension: string]`), contract-only in WE (zero impl, #1282), with
platform-default flavor **ids** declared as data (`we:config/platformDefaults.ts:38`,
`PLATFORM_FLAVOR_DEFAULTS`) and the resolver factories living in FUI — ratified by #1662/#1702 and codified
at `we:docs/agent/platform-decisions.md#config-extends-platform-default`. A new dimension key requires no
schema change. Two #1702 details are load-bearing below: config values are **data** (a `.json` form is
conceptually accepted — `we:config/defineConfig.ts:12`), and a **bare string dimension entry is a
`DimensionPointer`** (an extracted-file path — `we:config/defineConfig.ts:37`), so a flavor is spelled via
the `extendsFlavor(…)` descriptor, never a bare string.

**Prior art (survey: [`configurable-attr-naming-scheme`](/research/configurable-attr-naming-scheme/)).**
The knob has real precedent in every attribute-directive framework generation, and the precedents split
exactly along this item's forks: **Vue 0.x** shipped a configurable directive prefix (`Vue.config.prefix`)
and **removed it in 1.0** (vuejs/vue#2415 — a configurable *published-code* spelling forks the component
ecosystem and docs); **Alpine.js** kept one (`Alpine.prefix('data-x-')`) — exclusive, app-global, and
projection-shaped (plugins register bare directive names; the prefix changes only the DOM spelling), with a
known lesson: the `@`/shorthand sugar breaks under a custom prefix, i.e. a partial (non-total) remap leaves
orphan spellings; **AngularJS** normalized additively (`ng-bind` ≡ `ng:bind` ≡ `ng_bind` ≡ `data-ng-bind` ≡
`x-ng-bind` — five live spellings per name), a surface Angular 2's rewrite dropped (context evidence, not by
itself a verdict on additive); **htmx** accepts a fixed dual `hx-*`/`data-hx-*` as a *standing* contract
(HTML-validity motivated); **Vue 2/3 `delimiters`** is the surviving exclusive-swap knob. The WE design
inherits the Vue-removal lesson (published code must never contain the app spelling → Fork 2) and the
Alpine lesson (a scheme must be a total mapping over its surface → Fork 1); htmx's standing dualism is the
strongest case *for* additive and is answered in Fork 3 on per-author-variance grounds, not by denying its
coherence.

## Axis-framing

The item's scope line named three axes — *where the knob lives*, *how deep it reaches*, and *the migration
path*. Prep dissolves the first and most of the third into settled statute (below), and splits "how deep"
into the genuinely open contract questions: **what kind of value the knob takes** (Fork 1), **what identity
the remap preserves across the API surface** (Fork 2), **whether a flavor's mapping is single-valued —
exclusive — or set-valued — additive** (Fork 3), and **what scope the value binds at** (app-pinned vs
subtree-nestable — Fork 4, promoted from a footnote by the prep skeptic). All four are observable across
the WE↔FUI boundary (config value-space, the `define()`/callback contract, DOM matching behaviour, and
where a config value may legally attach); the *inside* of the remap (define-time key transform vs
lookup-time normalization at `fui:plugs/webbehaviors/CustomAttributeRegistry.ts:309,464`, and the reverse
index the dev diagnostic needs) is FUI's black box and deliberately not ruled.

## Settled by precedent (not forks)

- **The default spelling: colon, knob opt-in** — ratified #1987 Fork 1
  (`we:docs/agent/platform-decisions.md#attribute-name-colon-namespacing`). The platform-default flavor is
  "no remap"; nothing to ratify here.
- **Surface scope: behaviour/event attribute NAMES only.** Comment-directive names are colon grammar-locked
  on a surface with no native-collision risk (`fui:plugs/webdirectives/CustomCommentParser.ts:34`;
  reaffirmed #1987 "settled by precedent"); comment option keys have no colon surface (`:38`); dispatched
  event types are not attr names; `<template type=>` values reject colon by ratified guard
  (`fui:plugs/webdirectives/CustomTemplateTypeRegistry.ts:79-87`, #1987 Fork 2); native-aligned bare attrs
  and `data-*` are the preserved native surface. The knob does not span the three surfaces because the
  statute rules them per-surface (`we:docs/agent/platform-decisions.md:773-774`); it reaches exactly the
  behaviour/event attr-name surface (~30 family names + the 3 family-less bare names, whose image is
  defined per scheme — Fork 1). **Applied-residue markers are untouched by the same scope exclusion:**
  #1989 ratified *no separate residue sigil* — applied residue IS the authored comment open/close grammar
  (`<!-- ns:name -->` … `<!-- /ns:name -->`), so residue lives on the comment surface, outside the knob.
- **Layer placement: contract in `we:config/`, resolver in FUI** — a new open-set dimension key on
  `WebEverythingConfig` (`we:config/defineConfig.ts:90-101`), flavor-id union open (`string`) at the WE
  layer, platform-default id declared in `we:config/platformDefaults.ts`, resolver factory FUI-side — the
  exact #1662/#1702 shape every existing dimension already follows
  (`we:docs/agent/platform-decisions.md#config-extends-platform-default`). Zero WE impl (#1282).
- **The migration path's endpoint names** — if hyphen ever wins it is `enh-*`, never `we-*` (ratified
  #1987, amendment 3). The migration *event* itself (WG ratifies a spelling → WE flips the platform-default
  flavor in a major version; objecting apps pin the old flavor) is a posture note, not ratifiable now — the
  target spec is unshipped (WICG/webcomponents#1029, whatwg/html#2271; don't-chase-a-draft).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1** — knob value-space | **naming-scheme flavor dimension** (`attrNaming`; default `colon-namespace`; normative flavor-validity rules) | bare separator-char knob (`':'`→`'-'`) | high (forced invariant — both alternatives broken) |
| **Fork 2** — remap identity | **canonical-everywhere projection** — canonical colon identity in every API/callback; spelled DOM name via explicit accessor; scheme applies only where DOM text meets the registry | respell the registry keyspace per scheme | high (forced invariant) |
| **Fork 3** — flavor exclusivity | **single-valued flavors (exclusive)** — one live spelling per name; canonical inert under a remap (dev diagnostic; silent in prod) | set-valued flavors (additive normalization) | med-high |
| **Fork 4** — value scope | **app-pinned** — the `attrNaming` chain terminates at app scope (explicit scoped amendment to the config statute) | subtree-nestable per the general dimension rule | med-high |

## Fork 1 — knob value-space: separator-char config vs naming-scheme flavor dimension

**Fork-existence:** a **forced invariant** (standing-test case (a)) — the char knob is not a rival contract
but a strict subset of the scheme kernel (any char swap is expressible as a trivial flavor — the
composability probe lands as subsumption), and taken *as the contract* it is broken against ratified
purpose; the free-mapper alternative is broken against the ratified config-is-data contract. Kept as a fork
section because both excluded shapes have live prior art (Vue `delimiters` is char-shaped; a mapper is the
"just let me pass a function" ask) and the surviving branch carries real sub-choices.

Crux: #1987's only concretely named future target beyond colon is **`enh-*`** — a *prefix + word-joining*
scheme transform (`nav:list` → `enh-nav-list`), structurally **not** a char swap. And after #1991, the
family-less names have no separator at all, so a char knob is *undefined* over part of the very surface it
governs.

- **(a) separator-char knob** (`attrSeparator: ':' | '-' | '_' | '.'`) — *Rejected (subsumed, and broken as
  the contract):* it cannot express `enh-*` — the one ratified bridge target — so it fails the mechanism's
  ratified *purpose* (#1987: the same remap "is the bridge to whatever spelling the WG eventually
  ratifies"); it is undefined on family-less names (no separator to swap, per #1991); and everything it
  *can* express is a trivial flavor under (b).
- **(b) naming-scheme flavor dimension** *(recommended default)*: a new open-set dimension key
  `attrNaming` on `WebEverythingConfig`, holding a flavor id via the `extendsFlavor(…)` descriptor (a bare
  string is a `DimensionPointer` per #1702 — `we:config/defineConfig.ts:37` — so the flavor spelling uses
  the descriptor, no amendment to the pointer rule). **Normative flavor-validity rules (the actual core of
  the ruling — conformance requirements the FUI resolver validates over the registered name set, NOT
  properties an id magically grants):** a flavor's mapping over the behaviour/event attr-name surface must
  be **(i) total** (family members *and* family-less names each have a defined image — the Alpine
  orphan-spelling lesson), **(ii) injective** (no two canonical names may share an image — e.g. a
  smash-join must not collapse a hypothetical `type:ahead` and the family-less `type-ahead` into one
  spelling), and **(iii) native-namespace-safe** (every image must itself pass the custom-attribute name
  guard — contain `-` or `:` and never equal a native attribute name; a naive smash scheme mapping
  `on:click` → `onclick` would hand the browser an executable inline event handler — see Statute-overlap,
  the name-guard extension). Fork 3 adds **(iv) single-valued**. Platform default `colon-namespace`
  (identity: family colon per #1987, family-less bare per #1991). Named reserved flavor `enh-prefix`,
  **pinned now, unconditionally**: family names `enh-` + **hyphen-join** (`nav:list` → `enh-nav-list` —
  hyphen-join, not native smash, because smash-join breaks validity rules (ii)/(iii) and WICG#1029's floated
  forms are hyphenated); family-less names **stay bare** (`type-ahead` stays `type-ahead`) — if a shipped
  WG author-attr rule ever demands prefixing *all* author attrs, that is a **successor flavor id**, not a
  mutation of `enh-prefix` (a flavor whose mapping depends on an unshipped spec detail would not be total).
- **(c) free mapper function** (`(canonical: string) => string`) — *Rejected on placement, with the
  capability honestly preserved one layer down:* a function value cannot live in the WE **data** contract
  (`.json`-survivable config, `we:config/defineConfig.ts:12`, ratified #1662/#1702) — but the *capability*
  of an arbitrary mapping is deliberately kept: the flavor-id union is **open (`string`)**, so a project
  registers a custom flavor factory in the FUI resolver (which IS a mapper function — placed where impl
  lives, subject to the validity rules above, and named by a greppable id in config).

**Default: (b) — the `attrNaming` naming-scheme dimension with normative flavor-validity rules.**
Sub-decisions (bold defaults, cheap overrides at ratify): dimension key **`attrNaming`**; platform-default
flavor id **`colon-namespace`**; reserved bridge flavor id **`enh-prefix`** (pinned as above).
**Shipped-flavor set: the platform ships `colon-namespace` only and reserves `enh-prefix`;** an objector
scheme (e.g. a `hyphen` flavor spelling `nav:list` → `nav-list`) is **not platform-shipped** — it is
project-registered via the open flavor set, so the platform never hands out a collision-unsafe spelling as
a first-class choice while the escape hatch stays fully open.

```ts
// webeverything.config.ts — the objector app (one choice per app; Fork 4: app-pinned)
import { defineConfig, extendsFlavor } from '@webeverything/config';

export default defineConfig({
  // key omitted → the platform default flavor 'colon-namespace'  (<div nav:list on:click="save">)
  attrNaming: extendsFlavor('hyphen'),     // project-REGISTERED flavor: <div nav-list on-click="save">
  // attrNaming: extendsFlavor('enh-prefix'), // reserved bridge flavor: <div enh-nav-list enh-on-click="save">;
  //                                          // family-less stays bare: type-ahead
  // NB: attrNaming: 'hyphen' would be a DimensionPointer (a file path), per #1702 — hence the descriptor.
});
```

`Skeptic: SURVIVES-WITH-AMENDMENT — two skeptic passes. Classification attack landed (char knob is
subsumed by the scheme kernel / both alternatives excluded by ratified contracts → relabeled forced
invariant; the live content is the sub-choices). "Total by construction" was refuted — totality,
injectivity, and the native-namespace image guard are now NORMATIVE validity rules the resolver enforces,
not id-shape properties. The config example was contract-invalid (bare string = DimensionPointer per #1702)
— fixed to extendsFlavor(…). enh-prefix's join rule was stated both ways and its family-less image was
conditional on an unshipped WG detail — pinned (hyphen-join; family-less bare; successor id for any
all-attrs rule). The mapper rejection was reframed honestly as a placement ruling (capability preserved as
FUI-registered flavors). Shipped-flavor set added as a sub-decision (platform ships colon-namespace only).`

`Screen: clear — the value-space IS the config surface (consumer-observable); the impl seam (define-time vs
lookup-time transform) is explicitly black-boxed; both exclusions are correctness/contract grounds, not
effort.`

## Fork 2 — remap identity: canonical-everywhere projection vs respelled registry keyspace

**Fork-existence:** a **forced invariant** — only one branch survives contact with the catalog contract
(the steelman of (b), scheme-aware define helpers, collapses observationally into (a) with a different
internal seam, which is FUI's black box); kept as a fork section because the exclusion needs its ratified
reason on record. No shipped prior art exists for a respelled keyspace (Alpine, the nearest candidate, is
itself projection-shaped: plugins register bare names, the prefix changes only the DOM spelling).

Crux: names are registered canonically by published blocks
(`fui:blocks/view/registerViewDirectives.ts`, `fui:blocks/attributes/on-event/OnEventAttribute.ts:277-295`)
and matched by literal lookup (`fui:plugs/webbehaviors/CustomAttributeRegistry.ts:308-309,463-464`). Vue
removed its prefix knob precisely because a spelling that leaks into *published code and docs* forks the
ecosystem per prefix (vuejs/vue#2415).

- **(a) canonical-everywhere projection** *(recommended default)*: the canonical colon name is the identity
  in **every API plane** — `customAttributes.define('nav:list', …)`, the catalog, docs, conformance
  vectors, error messages, `observedAttributes` entries, **and callback parameters**:
  `attributeChangedCallback(name, …)` receives the **canonical** name under any scheme, with the spelled
  DOM name available via an explicit accessor on the instance (FUI names it — e.g. `this.domAttributeName`).
  This closes the relocated-Vue-defect the first draft carried: a published block testing
  `name === 'nav:list'` in its callback must not silently miss under an app scheme — the projection is
  total over the API surface, not just over `define()`. The scheme applies **only at the DOM↔registry
  boundary** (the `getDefinition` seam resolves the app-spelled attribute to the canonical definition;
  define-time key projection vs lookup-time normalization is FUI's black box). Published blocks are written
  once against canonical and run unmodified under any app scheme. Observable residue, stated honestly:
  **the escape hatch is DOM-spelling-only** — the objector who configured `hyphen` still sees colon in
  comment directives (grammar-locked), in `define()` calls, in WE docs and error messages; the knob
  de-colons their *markup*, not their world. That is the accepted price of an unforked ecosystem, and it is
  exactly the #1987 posture (the hatch answers "colons are awful *to author*"; it does not re-spell the
  standard).
- **(b) respelled keyspace** — *Rejected as broken:* if the scheme respells registry keys, every published
  block's `define('nav:list')` misses under a non-default scheme, so all third-party blocks would need to
  be scheme-aware or re-registered per app — the ecosystem fork that killed Vue's knob, baked into the
  contract. Its one real merit (a single name plane: DOM, devtools, and introspection agree) does not
  survive the catalog cost. No coherent catalog survives it.

**Default: (a), canonical in every API plane, spelled name via explicit accessor.**

```ts
// A published block — written once, canonical spelling, runs under ANY app scheme:
customAttributes.define('nav:list', NavListAttribute);

class NavListAttribute extends CustomAttribute {
  attributeChangedCallback(name: string, oldV: string | null, newV: string | null) {
    // name === 'nav:list'  — canonical under EVERY app scheme (this is the ruling)
    // this.domAttributeName === 'nav-list' under attrNaming 'hyphen' (explicit accessor, FUI names it)
  }
}
```

`Skeptic: SURVIVES-WITH-AMENDMENT — two passes. Reclassified to forced invariant (the steelman respelled
keyspace collapses into (a); the "Alpine demonstrates (b)" attribution was wrong — Alpine is projection —
and was struck). The first draft's sub-default (callback receives the SPELLED name) was REFUTED as the Vue
defect relocated from define() to the callback — flipped to canonical-everywhere with an explicit
spelled-name accessor; observedAttributes pinned canonical. The DOM-only-hatch residual is stated as the
accepted price. The false #1989 citation (a canonical residue "sigil" — #1989 actually ratified NO separate
sigil) was rewritten to the comment-surface scope exclusion. The registry-name-guard collision the first
draft waved off as "no collision" is now reconciled via the guard-over-images extension (Statute-overlap).`

`Screen: clear — callback/define()/observedAttributes spellings are the registry API contract (observable);
the projection's internal seam stays FUI's black box; the respelled-keyspace cost is permanent
composability/lock-in, not sequencing.`

## Fork 3 — flavor exclusivity: single-valued (exclusive) vs set-valued (additive) mappings

**Fork-existence:** a genuine either/or, stated at the right level: nothing ratified anywhere says a
flavor's mapping is single-valued — htmx's `hx-*`/`data-hx-*` dual and AngularJS normalization are
precisely **set-valued flavors**, expressible inside the very dimension Fork 1 creates — so without this
ruling, Forks 1+2 under-determine the mechanism (a future `colon+hyphen` dual flavor would satisfy both
while gutting the single-convention posture). One flavor contract cannot be both single- and set-valued;
both branches have shipped standing prior art (Vue `delimiters`/Alpine exclusive; htmx additive).

- **(a) single-valued flavors — exclusive matching** *(recommended default)*: flavor-validity rule (iv) —
  **each canonical name maps to exactly one live DOM spelling**; under a remapped flavor the canonical
  spelling stops matching. **Production behavior is part of the ruling:** a canonical-spelled straggler is
  **silently inert in production** and raises a **dev-mode diagnostic** ("canonical spelling `nav:list`
  found but app attrNaming is `hyphen`; expected `nav-list`") — the diagnostic's trigger set is "canonical
  spellings of registered names"; the reverse index that needs is FUI's black box. The load-bearing merit
  rationale (codify this form): **additive matching re-opens per-author spelling variance inside the app**
  — with both spellings live, each author picks per usage, which is precisely the choice #1987 excluded
  ("not an author knob"); "one choice per app" governs the config value, but per-author variance is what
  the exclusion actually protects, and only single-valuedness makes it hold in the markup. Exclusive also
  keeps the app's surface greppable (one spelling per name). **Accepted cost, on record:** WE's own
  docs/catalog examples spell canonical (Fork 2(a)), so a copy-pasted doc example — or a vendored
  canonical-spelled HTML partial — is inert in a remapped app's production build until respelled; the dev
  diagnostic exists exactly to catch this, and the cost lands only on apps that opted into a remap.
- **(b) set-valued flavors — additive normalization** (AngularJS-style: `ng-bind` ≡ `ng:bind` ≡
  `data-ng-bind` …) — *Rejected as a standing contract:* every name gains N live spellings; tooling, docs,
  and grep must know all images; and it re-opens the per-author variance #1987 excluded. htmx's standing
  dual shows additive is coherent as a product choice — the exclusion here is on the ratified-posture
  merit, not coherence. **Reserved, not built:** if a real colon→`enh-*` migration event ever runs, a
  *transitional* dual-match mode (a reserved mode on the dimension, e.g. flavor + `transitional: true`,
  shipped only with the migration tooling/codemod) is the sanctioned way to run additive for the migration
  window without violating this standing contract out-of-band.

**Default: (a) — single-valued flavors; silent-inert in prod; dev-mode straggler diagnostic; transitional
dual-match reserved for a real migration event.**

**Most-permissive-default statute, confronted:** `config-extends-platform-default` rules "the default is
the most-permissive value, restriction as the author's opt-in" — that governs the dimension's **default
value**, which here is `colon-namespace` identity (no remap, nothing restricted); single-valuedness is a
**validity rule of the mechanism**, not a value of the dimension, and it only bites inside a flavor the
app already opted into. A ratifier applying most-permissive cold to flip this fork would be stretching a
value-default clause to govern mechanism validity (the #1932 citation-scope failure).

**#1991 back-compat aliases, reconciled:** #1991's graduation note ships "back-compat aliases for any name
that actually changes" (`droplist-anchor` ≡ `droplist:anchor`) — two live spellings per renamed name, in
the canonical flavor. This ruling **fences those aliases as transitional rename-migration state** (they are
scheduled for removal with the rename story, not standing contract), so Fork 3 does not outlaw a ratified
sibling; and the alias/scheme interaction (under a `hyphen` flavor the image `droplist-anchor` is
byte-identical to the legacy alias) is exactly why the aliases must retire rather than stand.

```html
<!-- attrNaming: extendsFlavor('hyphen') -->
<ul nav-list>…</ul>        <!-- ✓ activates nav:list -->
<ul nav:list>…</ul>        <!-- ✗ inert — dev mode warns; production: silently inert (ratified here) -->
```

`Skeptic: SURVIVES-WITH-AMENDMENT — two passes. The strongest attacks: (1) classification re-route
(additive is a legitimate standing end-state per htmx ⇒ config dimension, not a fork) — beaten by
regrounding the exclusion on per-author variance, which #1987 actually excludes, rather than stretching
"one choice per app" to matcher behavior; (2) exclusivity was a fork wearing the wrong clothes — restated
as flavor-validity rule (iv) single-valuedness, closing the dual-flavor loophole that would have satisfied
Forks 1+2 while gutting the posture. Amendments folded: production silent-inert ratified explicitly (dev
warn only); docs-examples/vendored-partials inert cost recorded as accepted; most-permissive-default
statute line confronted (it governs the value default, not mechanism validity); #1991's back-compat aliases
fenced as transitional so this ruling doesn't contradict a ratified sibling; the Angular-2 citation
softened to context; transitional dual-match reserved as the sanctioned migration mode.`

`Screen: clear — exclusive-vs-additive is directly observable in markup (`nav:list` activates or sits
inert); opposing permanent correctness/UX consequences, a genuine either/or (htmx is a coherent rival);
the transitional dual-match clause is a scoped exception, not a deferred half.`

## Fork 4 — value scope: app-pinned vs subtree-nestable (promoted from the statute-overlap footnote)

**Fork-existence:** a genuine either/or the two statutes leave genuinely open —
`we:docs/agent/platform-decisions.md#config-extends-platform-default` ratifies that a dimension's chain
"nests platform→project→app→fragment, so settings scope to any subtree (runtime DI)", while #1987 excludes
an *author* knob; a **subtree-scoped value set by the app owner** (a micro-frontend embedding a
differently-objecting fragment; a vendored canonical-spelled island under an objector app) is not
per-author markup choice under #1987's text, so neither statute settles whether `attrNaming` may nest below
app scope. The value may bind at exactly one deepest legal scope; both answers are coherent.

- **(a) app-pinned** *(recommended default)*: the `attrNaming` chain terminates at **app scope** — no
  fragment/subtree override. Merit: a subtree with its own spelling puts two live spellings in one
  document, which is Fork 3's per-author-variance failure re-opened *intra-document* (the island's boundary
  is invisible in the markup; a reader or linter cannot tell which spelling governs an element without
  walking the config tree, and the matcher would need scope-aware resolution); and the genuine subtree use
  cases — a legacy island mid-migration, a vendored canonical partial — are served by Fork 3's reserved
  *transitional* dual-match mode and by respelling at intake, both scoped to events rather than a standing
  mixed-scheme document.
- **(b) subtree-nestable** (the general dimension rule) — *Rejected:* honors the config statute uniformly
  and serves the embedding cases directly, but institutionalizes standing mixed-scheme documents — the
  teachability/greppability loss of additive matching in spatial form — and makes the governing spelling of
  any element a runtime DI question. The island cases are transitional by nature; a standing contract
  should not be shaped by them.

**Default: (a) app-pinned.** Codification is an **explicit amendment clause on
`config-extends-platform-default`** — "a surface statute may pin a dimension's chain depth; `attrNaming`
(this item) pins at app scope" — a new ruling this item makes, not a precedence inference; `attrNaming`
becomes the config system's first non-nestable dimension and the statute gains the general clause.

`Skeptic: (promoted BY the prep skeptics from a "reconciled" footnote — the original prep had pinned app
scope via an unratified "narrower, later statute wins" meta-rule and mislabeled the tension resolved; both
passes flagged it.) The default was derived under attack: the steelman for (b) (subtree nesting is the
ratified general rule; #1987 only excludes per-AUTHOR choice; the micro-frontend/vendored-island cases are
real) is answered on merit — intra-document spelling variance re-opens the Fork 3 failure spatially, and
the island cases route to the reserved transitional mode / intake respelling. Codified as an explicit
statute amendment clause, not a silent carve-out. SURVIVES in that form.`

`Screen: clear — where a config value may legally attach is part of the observable config contract; the
merit difference (standing mixed-scheme documents vs foreclosed embedding cases) survives the cost-strip;
nothing proposes building nesting "later", so no prioritization in costume.`

## Statute-overlap (reconciled)

- **`registry-name-guard` (`we:docs/agent/platform-decisions.md:757-775`) — a real collision, reconciled by
  extending the guard.** The statute's test is "guard the namespace you share with the host"; today
  `#assertValidName` (`fui:plugs/webbehaviors/CustomAttributeRegistry.ts:178-185`) runs at define time over
  the **canonical** name — but under Fork 2(a) the string that actually enters the host-shared HTML
  attribute namespace is the **flavor image**. The mechanism therefore **extends the guard to flavor
  images** (Fork 1 validity rule (iii)): every image must contain `-` or `:` and must not equal a native
  attribute name (the `on:click`→`onclick` inline-handler landmine). The guard extension is part of what
  ratifying this item codifies.
- **`config-extends-platform-default`** (`we:docs/agent/platform-decisions.md:1446`) — three touchpoints:
  (i) the **subtree-nesting clause** vs #1987's not-an-author-knob posture is *not* resolvable by reading
  one statute as narrower — it is **Fork 4's explicit ruling** (app-pinned via a named amendment clause);
  (ii) the **most-permissive-default clause** governs the dimension's default *value* (`colon-namespace`,
  untouched), not the mechanism's validity rules — confronted in Fork 3; (iii) the **flavors/data shape**
  is the authority *for* Fork 1(b) and the pointer rule is why examples use `extendsFlavor(…)`.
- **`attribute-name-colon-namespacing`** (`we:docs/agent/platform-decisions.md:2401`) — this item is that
  anchor's own deferral ("mechanism deferred to #1992"); the ruling here amends nothing in it and should be
  codified as a mechanism subsection or cross-referenced sibling anchor, keeping default-colon, family-only,
  `enh-*`-never-`we-*` intact. #1991's back-compat-alias graduation note is fenced as transitional by Fork
  3's reconciliation.

## Relationships

- **Parent posture:** #1987 (resolved — ratified the configurability posture, deferred this mechanism);
  amended by #1991 (resolved — family-only colon; reconciled above, old `blockedBy` premise dissolved; its
  back-compat aliases fenced as transitional by Fork 3).
- **Siblings:** #1989 (resolved — **no** separate residue sigil; applied residue is the comment open/close
  grammar, so it sits on the comment surface, outside this knob's scope); #1983 (directive form — the
  `type=` surface untouched here).
- **Graduates to (on ratification):** a build story — WE: add the `attrNaming` dimension key + platform
  flavor id (contract only); FUI: the resolver flavor factory with the validity-rule validation
  (total/injective/native-safe/single-valued), the projection at the `CustomAttributeRegistry` lookup seam,
  the canonical-callback + spelled-name accessor contract, the flavor-image name-guard extension, and the
  dev-mode straggler diagnostic.
