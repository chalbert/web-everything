---
kind: decision
parent: "1975"
status: open
dateOpened: "2026-06-30"
dateStarted: "2026-06-30"
preparedDate: "2026-06-30"
relatedReport: reports/2026-06-30-directive-authoring-forms.md
tags: [webdirectives, directive, composition, directive-form, block-standard]
---

# Directive form standard — the catalog-wide directive authoring form (off `is=`)

**Prepared, ready to ratify.** No catalog-wide directive-*form* rule exists yet; the two forks below are
grounded in a prior-art survey published as the [`directive-authoring-form`](/research/directive-authoring-form/)
research topic (session report linked via `relatedReport`) **and** a read of the real implementation tree —
each carries a **bold** recommended default already attacked by a skeptic pass. This is the catalog-wide
directive-form rule that #1977 / #1976 / #1978–#1981 must *apply* rather than each re-inventing; it blocks them.

> **Grounding correction baked in (the prep flip).** The original scaffold claimed built `if` / `for-each` /
> `switch` use the `CustomComment` **comment-boundary** form and recommended that form for *all* directives.
> Reading the tree refuted both: those three are `CustomAttribute` on a plain `<template>` (the
> Alpine/Vue/Angular form), already `is=`-free; the comment markers they emit are *runtime* trace markers, not
> the authored boundary; and `resource:loader` isn't built as a directive at all (only a programmatic block +
> a spec sketch). So **no built directive uses the comment-boundary authoring form** — the cold default was
> backwards. The defaults below flip to what shipped: attribute-on-`<template>`.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1** — single-region form | **attribute-on-plain-`<template>`** (`<template ns:name="opts">…</template>`) | comment-boundary `<!-- ns:name -->…<!-- /ns:name -->` | high |
| **Fork 2** — multi-region form | **nested region-`<template>`s inside one `<template ns:name>`** (switch's built form) | comment-boundary + sibling `<template slot>` | med-high |

*Above the forks sits one **forced invariant** (ratify, not weigh): `is=` is not minted as the directive-form
contract — see below. It is not in the glance table because there is no branch to pick.*

## Axis-framing

A directive's *form* is the markup vehicle carrying its **name + options + body**. Three things are settled
and three are not. The settled spine: **only inert-required content must live in a `<template>`** (it is the
only inert container the platform gives; "deferred content can't be a bare live child" is platform-forced) — a
directive with a **live** body (a context provider, a region transition) is *not* `<template>`-anchored at all;
behaviour-vs-directive is already ratified (#1963 / block-standard rule 6), and the comment *syntax* is a
configurable parser
(`fui:plugs/webdirectives/CustomCommentParser.ts:34`, the `ns:name` grammar). What's open is **which
`<template>`-anchored grammar is canonical**, decomposed along the one axis the research surfaced — **region
count** — plus the **`is=` reconciliation** that sits above both.

Real implementation tree (what the forks are grounded in):

- **Built single-region + multi-region control flow is `CustomAttribute`-on-`<template>`, `is=`-free.**
  `view:if` → `<template view:if="@state.loggedIn">…</template>` (`fui:blocks/view/ViewIfDirective.ts:31,46-62`);
  `view:switch` nests `<template case="x">` / `<template default>` inside one outer template
  (`fui:blocks/view/ViewSwitchDirective.ts:34,52-68,104-120`); `for-each` mirrors it
  (`fui:blocks/for-each/ForEachBehavior.ts:59`). Registered via `attributes.define(...)`
  (`fui:blocks/view/registerViewDirectives.ts:13-17`). Bodies are **inert** in `template.content`, stamped on
  connect (fail-closed); the directive emits `<!-- view-if:start -->`/`<!-- view-if:end -->` *runtime* markers.
- **The only `is=` directive is `portal`** — `CustomTemplateDirective` (`extends HTMLTemplateElement`,
  `fui:plugs/webdirectives/CustomTemplateDirective.ts:46-48`), registered `{ extends: 'template' }`
  (`fui:plugs/webportals/index.ts:54`; `fui:plugs/webportals/PortalDirective.ts:123`). This is the customized
  built-in #1963 ruled Safari-never / lower-compliance / never-load-bearing.
- **The comment-boundary + sibling-slot machinery exists** (`fui:plugs/webdirectives/CustomComment.ts:27-34`,
  `fui:plugs/webdirectives/multiTemplate.ts:19-23,30-74` scanning `<template slot>` between `<!-- ns:name -->`
  markers), used by the `resource:loader` **spec example** — but no built directive authors in it.

## Forced invariant (ratify — not a fork)

**`is=` is not minted as the directive-form contract; `portal` migrates off the customized built-in.**
Fork-existence: this is case (a), a forced invariant — the excluded branch ("mint `is=` as a *load-bearing*
directive form contract") is broken because `portal` is load-bearing projection infrastructure and #1963 ruled
`is=` customized built-ins **never load-bearing** (Safari-never, `we:docs/agent/block-standard.md:240`). Every
mainstream framework already routes around `is=` (prior-art Finding 1). So there is nothing to weigh.

**The precise framing (confirmed by the decision-owner): `is=` is accepted for authors, but WE does not mint it
as a first-class API contract.** Authors may still write `<template is="…">` in their own code — that's their
lower-compliance opt-in, and WE forbids nothing. What WE declines to do is **mint `is=` as a blessed,
first-level directive-form contract** the catalog is built to and that downstream proposals must target.
*Tolerating a mechanism* and *standardizing it as the contract* are different acts; this rules out only the
second.

**Citation-scope honesty (folded from the skeptic).** The authority for migrating `portal` is #1963's *"never
load-bearing"* clause — `portal` is load-bearing projection infrastructure, so it can't ride a
never-load-bearing mechanism. It is **not** "`is=` is forbidden": #1963 also ratified *"Nothing is forbidden —
compliance is a spectrum… `is=` customized built-ins are lower-compliance choices, not disallowed ones"*
(`we:docs/agent/block-standard.md:236-240`). So the rule this codifies — **"the minted directive-form contract
is `is=`-free; `is=` stays accepted-for-authors, just not a first-class WE contract"** — *composes with* #1963
rather than overriding it. (The original scaffold's "No `is=` anywhere" / "contradiction to resolve" wording
collided with that statute and has been struck.)

## Fork 1 — single-region directive form

**Fork-existence (genuine either/or):** options (a) and (b) are both coherent, fully `is=`-free authoring
grammars for the *same* single-region case, and they cannot both be *the canonical spelling* — #1975's six
proposals need one form to apply. (The composability probe fails to merge them: a comment-boundary and an
attribute on a template are different parse sites, not facades over one kernel.) The excluded-broken branches
are (c)/(d) below.

**Crux:** for a directive with one region (gate / iterate / defer / project a single subtree), is the name
carried by an **attribute on a plain `<template>`** or by a **comment boundary** wrapping the body?

- **(a) Attribute on a plain `<template>`** — `<template ns:name="opts">…</template>`, the directive is a
  `CustomAttribute`; the body is inert in `template.content`, stamped on connect. *(default)* Wins on three
  merit axes: **prior-art** — this is the universal runtime-HTML form (Alpine `<template x-if>`, Vue `<template
  v-if>`, Angular `*ngIf`→`<ng-template [ngIf]>`); the comment-boundary form has **zero** framework precedent.
  **Security/PE** — inert body is **fail-closed**: an auth-gated `if` never flashes its protected content; the
  comment-boundary live body renders pre-JS → **fail-open** (flash-of-unauthorized-content until JS removes
  it). SSR expands either form to live content + markers, so the PE baseline is met by SSR regardless — the
  live-body's only unique edge is exactly the fail-open path. **Single substrate** — it's what every built
  directive already uses (`fui:blocks/view/ViewIfDirective.ts:31`), so the catalog converges instead of
  forking.
- **(b) Comment-boundary** — `<!-- ns:name opts -->live body<!-- /ns:name -->`, a `CustomComment`. *Rejected
  as the single-region default:* no framework authors control flow as hand-written comment pairs (they are
  compiler output, e.g. Svelte `{#if}{/if}`); fail-open for gating directives; requires an open/close marker
  to hand-match. **Retained for one narrow role** (see *Supported by default*): bounding **live, in-place**
  content a `<template>` can't hold.
- **(c) `<template is="ns:name">`** customized built-in — *Rejected:* the forced invariant above (Safari-never,
  #1963 never-load-bearing; not minted as a contract).
- **(d) Autonomous custom-element boundary** (`<defer-directive>…</defer-directive>`) — *Rejected:* reintroduces
  a host node, defeating the zero-node property that makes a directive the right mechanism for region control
  (#1963).

```html
<!-- Fork 1 (a) — DEFAULT: attribute on a plain <template> (is=-free, fail-closed). -->
<template view:if="@state.loggedIn">
  <a href="/account">Account</a>
</template>

<!-- portal migrated off `is=` to the same form (was <template is="portal-directive">): -->
<portal-outlet id="modal-outlet"></portal-outlet>
<template portal target="modal-outlet">
  <div class="modal" role="dialog">Modal content</div>
</template>
```

**Skeptic:** SURVIVES (default flipped to (a) during prep). The skeptic *refuted the original scaffold's
comment-boundary default* — zero prior art + fail-open for auth gates + it would migrate the three working
directives off their shipped form — and confirmed attribute-on-`<template>` as correct on precedent,
fail-closed security, and zero migration. "Already built" is noted as code-reality, **not** used as a merit
argument (the not-a-prioritization rule). No statute overlap; #1963 is silent on the (a)-vs-(b) sub-choice
(neither uses `is=`).

## Fork 2 — multi-region directive form

**Fork-existence (genuine either/or):** for a directive with **N named regions** (switch branches; loading /
success / empty / error states; pending / then / catch), two `is=`-free grammars are *both built/spec'd* and
cannot both be canonical — `switch` ships form (a), the `resource:loader` spec sketches form (b). One must be
the blessed multi-region form (#1975's resource/async/error-boundary proposals need it). Not a config
dimension (it's a catalog-wide authoring convention, not a per-project knob) and not support-both (the whole
point is one form for the catalog).

**Crux:** where do the N region-`<template>`s live — **nested inside one attribute-bearing `<template>`**, or
**as siblings inside a comment boundary**?

- **(a) Nested region-`<template>`s inside one `<template ns:name>`** — `<template view:switch="@s.status">` with
  inner `<template case="…">` / `<template default>` children, selected by the directive (built:
  `fui:blocks/view/ViewSwitchDirective.ts:104-120`). *(default)* Wins on **uniformity** — it's the exact same
  substrate as Fork 1 (a): a directive is *always* an attribute on a `<template>`, single-region uses the body,
  multi-region uses nested region-templates. One grammar for the whole catalog. And it **matches the only built
  multi-region directive** (`switch`), so the migration burden lands on the *unbuilt* `resource:loader` spec,
  not on shipped code. The inner-region scan reuses `multiTemplate`'s slot/`case` semantics
  (`fui:plugs/webdirectives/multiTemplate.ts:19-23`) — just hosted inside the directive's own `<template>`
  rather than between comment markers.
- **(b) Comment-boundary + sibling `<template slot>`** — `<!-- ns:name -->` + sibling `<template slot="…">`,
  the `resource:loader` spec form (`CustomComment` + `multiTemplate`). *Rejected as default:* introduces a
  *second* outer grammar (comment boundary) alongside Fork 1 (a)'s attribute form for no compositional gain,
  and would migrate the built `switch` onto an unbuilt form to match a spec example. Coherent, so retained as a
  tolerated alternative, but not canonical.

```html
<!-- Fork 2 (a) — DEFAULT: nested region-templates inside one attribute-bearing <template>. -->
<template view:switch="@state.status">
  <template case="active"><span class="badge success">Active</span></template>
  <template case="pending"><span class="badge">Pending</span></template>
  <template default><span class="badge">Unknown</span></template>
</template>

<!-- A proposed multi-state directive (resource:loader) in the SAME form (migrated off the comment sketch): -->
<template resource:loader name="user-profile" src="/api/user">
  <template slot="loading"><skeleton-card></skeleton-card></template>
  <template slot="success"><user-card data-bind="data"></user-card></template>
  <template slot="empty"><p>No user found.</p></template>
  <template slot="error"><error-message data-bind="error"></error-message></template>
</template>
```

**Skeptic:** SURVIVES-WITH-AMENDMENT (default flipped to (a) during prep). The skeptic showed the original
comment-boundary default was backwards — it would migrate the one *built* multi-region directive (`switch`) to
match a spec example that *isn't built as a directive* — and that uniformity-with-Fork-1 is the stronger
principle, both pointing to nested region-templates. Amendment folded in: keep `multiTemplate`'s region-scan as
the inner mechanism; migrate the `resource:loader` *spec* onto this form. No statute overlap; #1963 silent.

## Supported by default (not decisions)

- **Live, in-place content → the comment-boundary form (Fork 1 (b)) is the tolerated vehicle.** The one thing
  attribute-on-`<template>` cannot do is bound content that must render **live** as-authored. Concrete consumer:
  a **context provider** (React `<Context.Provider value>`-style) — its children render live and it adds no
  node, so it is **not** `<template>`-anchored. Routing: it is a **behavior first**, not a directive — per
  behaviour-vs-directive (#1963 / block-standard rule 6) a context provider decorates a *connected* subtree
  root and controls no region, so the default is a `CustomAttribute` on an existing element
  (`<section context:provide="@theme">…live children…</section>`). Only when there is **no wrapper** and a
  zero-node scope over bare siblings is required does it become a *directive*, and then — live body — it takes
  the comment boundary `<!-- context:provide theme="@dark" -->live siblings<!-- /context:provide -->`, never
  attribute-on-`<template>`. (Context *semantics* — propagation/resolution — live in the Context Protocol
  #1968, not here; #1983 settles only the markup form. #1968 not re-grounded this session.) Same form serves a
  future region-transition / an error-boundary guarding already-live siblings. Built directives don't need it
  today (all are inert-stamp), so it stays a capability, not a recommendation.
- **No-body directives → structural annotation (Ⓐ).** A directive with no body of its own (metadata on a
  subtree, scope/provider, `snippet:render`) is a config element (`<script type="injector">`) or an attribute —
  no `<template>`, no boundary. Codified as the third form, no fork.
- **Comment syntax is a configurable parser.** `CustomCommentParserRegistry` lets a project swap the `ns:name`
  grammar (`fui:plugs/webdirectives/CustomCommentParser.ts:34`); this is already settled, not reopened here.
- **Runtime comment markers are not the authored directive.** The `<!-- view-if:start -->`/`<!-- view-if:end
  -->` markers a directive emits (and the SSR expansion markers) are **trace/boundary** markers for
  inspection/hydration; the `ns:name` colon grammar (`/^[\w-]+:[\w-]+$/`,
  `fui:plugs/webdirectives/CustomCommentParser.ts:34`) is the discriminator that keeps an authored
  comment-boundary directive distinct from a plain trace comment. Worth stating in the standard so the two are
  never conflated.

## Selection rule (the codified output)

| Body shape | Canonical form |
|---|---|
| 1 region, inert until stamped (gate / defer-content / project / iterate) | `<template ns:name="opts">…</template>` *(Fork 1 (a))* |
| **N named INERT regions**, one selected (branches / states) | `<template ns:name="opts">` + nested `<template case|slot="x">` *(Fork 2 (a))* |
| 1 region that renders **live, in place** | `<!-- ns:name -->live body<!-- /ns:name -->` *(Fork 1 (b))* |
| **MIXED** — a **live** primary region **+** an **inert** auxiliary (error-boundary: live guarded content + inert fallback; defer: live placeholder + inert content) | `<!-- ns:name -->live primary <template slot="aux">…</template><!-- /ns:name -->` — the comment boundary (Fork 1 (b)) **hosting a nested inert `<template>`**; composes the two forms, no fourth form |
| no body — metadata on a subtree | structural annotation (`<script type="injector">` / attribute) |

**Invariant (forms by body shape):** an **inert** body → `<template>`-anchored, directive name in a
`<template>` **attribute** (canonical); a **live** body → a `ns:name` **comment boundary** wrapping live
content (**no `<template>`** — e.g. a context provider); a **mixed** body → the comment boundary hosting nested
inert `<template>` auxiliaries; **no** body → structural annotation. A `<template>` appears **only** for inert
content; **no `is=`** is minted into any catalog directive.

**Directive-vs-behavior gate (the exclusion the trichotomy was missing).** These forms are for **directives** —
constructs that control a *region* (whether / how-many / when / where / in-what-form content exists, before or
around connection). A construct that *decorates or reactively updates a **connected** element* is a **behavior**,
**not** a directive, and takes **none** of these forms even when it looks like a no-body `Ⓐ` annotation — per
the ratified behaviour-vs-directive rule (#1963 / block-standard rule 6). Two recurring misroutes this gate
catches: a **context provider** (decorates a subtree's scope → `CustomAttribute`; see above), and **text /
attribute bindings** (`${}` interpolation = `CustomTextNode`; `:attr` = `resolveBinding`) — these are
**webexpressions / behaviors that update a live element**, never region directives, so they are out of this
standard's scope. "No region control" is the discriminator, not "no body."

---

## Context

### The contradiction this resolves (reworded)

WE's directives split across two outer forms today, and one is on deprecated ground:

| Built directive | Real mechanism | Outer form | Cross-browser? |
|---|---|---|---|
| `view:if`, `view:switch`, `for-each` | `CustomAttribute` on `<template>` | `<template ns:name="opts">` (+ nested region templates) | ✅ yes |
| `portal` (only) | **customized built-in** (`extends HTMLTemplateElement`, `{extends:'template'}`) | `<template is="portal-directive">` | ❌ **Safari never** |

Reconciliation: don't mint `is=` as the directive-form contract (forced invariant), migrate `portal` to the
attribute form, and codify the region-count selection rule into `we:docs/agent/block-standard.md` (directive
section). It composes with #1963 (the minted form is `is=`-free; `is=` stays accepted-for-authors) and with the
#1321 packaging governance (directives get a *uniform authoring surface* — an attribute on a `<template>` —
the directive-layer analog of blocks' uniform `<we-button>` surface).

### Classification (per-fork, recorded)

- **Layer:** authoring-form governance for the `webdirectives` plug → codified in
  `we:docs/agent/block-standard.md` (like the #1321 packaging rules), not a new block/intent/protocol.
- **Protocol vs intent dimension (Q2):** neither — a fixed authoring convention, no swappable-vendor story.
- **Fixed mechanic vs config dimension (Q4):** **fixed mechanic** — the standard picks one catalog-wide form;
  it is not a per-project knob with two legitimate end-states (the comment *parser* is the configurable part,
  already settled). So Forks 1/2 are genuine ratifiable forks, not config dimensions.
- **Most-permissive default (Q6):** the most cross-browser / least-lock-in form → `is=`-free; among `is=`-free,
  the one that works runtime + SSR and fails closed → attribute-on-`<template>`.

### The catalog in the chosen form (proposed + built, code only)

*Every directive in the ruled form, by body shape — inert → attribute-on-`<template>`; live → comment boundary;
mixed → comment boundary hosting a nested inert `<template>`; zero `is=`. ✅ built · 📋 spec'd · 🆕 #1975
proposal. (Namespaces follow the spec/#1975; the `view:`-vs-`control:` namespace question is a separate naming
concern, not this form decision.)*

```html
<template view:if="loggedIn"><a href="/account">Account</a></template>        <!-- ✅ -->
<template for-each="users" key="id"><div class="user-row" data-bind="name"></div></template>  <!-- ✅ -->
<template view:switch="status">                                               <!-- ✅ -->
  <template case="active"><span class="badge success">Active</span></template>
  <template default><span class="badge">Unknown</span></template>
</template>
<template portal target="modal-outlet"><div class="modal" role="dialog">…</div></template>   <!-- ✅ migrated off is= -->
<template resource:loader name="user-profile" src="/api/user">                 <!-- 📋 -->
  <template slot="loading"><skeleton-card></skeleton-card></template>
  <template slot="success"><user-card data-bind="data"></user-card></template>
  <template slot="error"><error-message data-bind="error"></error-message></template>
</template>
<!-- defer on="visible" prefetch="idle" -->                                   <!-- 🆕 #1977 — MIXED: live placeholder + inert content -->
  <div class="skeleton"></div>                              <!-- live placeholder, painted at once -->
  <template slot="content"><heavy-chart data="@sales"></heavy-chart></template>   <!-- inert until trigger -->
<!-- /defer -->
<template async value="@user">                                               <!-- 🆕 #1976 — all branches inert (data-gated) -->
  <template slot="pending"><spinner></spinner></template>
  <template slot="then"><user-card data-bind="value"></user-card></template>
  <template slot="catch"><error-message data-bind="error"></error-message></template>
</template>
<!-- error-boundary -->                                                       <!-- 🆕 #1978 — MIXED: live guarded content + inert fallback -->
  <risky-widget></risky-widget>                             <!-- live guarded content -->
  <template slot="fallback"><p>Something went wrong.</p></template>     <!-- inert fallback -->
<!-- /error-boundary -->
<template snippet:define name="row" params="item"><li data-bind="item.name"></li></template>  <!-- 🆕 #1980 — inert hold-for-reuse -->
<template content-security zone="trusted"><div data-bind="userHtml"></div></template>  <!-- 🆕 #1981 — inert: policy runs BEFORE admission (live-then-sanitize = security hole) -->
```

## Progress
- **Status:** prepared (`preparedDate` 2026-06-30) — released to `open`, ready to ratify.
- **Prep flip:** code-grounding refuted the scaffold's premise (built `if`/`switch`/`for-each` are
  `CustomAttribute`-on-`<template>`, not comment-form; only `portal` uses `is=`); both fork defaults flipped to
  the attribute-on-`<template>` form; the forced-invariant wording reworded to "`is=` accepted-for-authors, not
  minted as a first-class WE contract" so it composes with #1963's "nothing-forbidden" statute. Research
  published as [`directive-authoring-form`](/research/directive-authoring-form/).
- **Catalog audit (grounded vs #1976–#1981):** added the missing **directive-vs-behavior gate** (context
  providers + text/attr bindings are behaviors, not directives — out of scope); added the **mixed-liveness**
  form (live primary + nested inert auxiliary — error-boundary, defer) as a composition of Fork 1 (b) + an
  inert `<template>`, no fourth form; fixed catalog renderings (error-boundary, defer were wrongly all-inert).
  content-security/trusted/sanitize confirmed correctly **inert** (policy must run before admission). Noted
  but **not folded:** error-boundary's #1963-bar criterion-4 gap (no native migration target) → #1978's call.
- **Next (at ratification):** confirm the two fork defaults → codify the region-count selection rule + `is=`
  reconciliation into `we:docs/agent/block-standard.md` (directive section) → spin a `blockedBy` build child to
  migrate `portal` off `{extends:'template'}` → unblock #1977 / #1976 / #1978–#1981.
