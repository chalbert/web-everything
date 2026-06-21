---
kind: decision
status: resolved
blockedBy: ["1349"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/block-standard.md#packaging-governance-1321"
preparedDate: "2026-06-20"
relatedProject: webintents
relatedReport: reports/2026-06-20-1321-fui-variant-surface-packaging.md
tags: [reproduction, variant, packaging, native-first, frontierui, encapsulation]
---

# Variant component surface and per-variant loading (one polymorphic block vs per-variant elements)

Surfaced by #1318. WE ratified the `variant` axis as an intent contract rendered via a plain attribute
(we:button[variant]) consumed by CSS. This item decides how FUI's button block **packages** that — and,
after discussion, what (if any) WE-contract guarantees the packaging must honor. WE holds **only the
variant contract** (no packaging default — see *WE holds no default*); packaging is FUI-locus.
locus: frontierui.

> **STATUS (2026-06-21): UNBLOCKED — #1349 resolved; the central fork is DISSOLVED.** #1349 ratified the
> scoped-component CSS-isolation contract (own plug `webisolation`; self-referential rules + token DI;
> S1 light-DOM unique-class vs S2 shadow-per-component = **support-both** Configurator dimension, **flavor
> default S1**). **That settles #1321's old live fork for it:** the "#2 vs #3 / enforced-vs-in-practice"
> question is no longer #1321's to make — WE supports both strategies and defaults to S1 (native-first
> light DOM). #1321 now ratifies purely as a **consumer** of that contract.
>
> **What #1349 took off #1321's plate:** the CSS-isolation mechanism, the S1/S2 strategy choice, the
> enforced-vs-in-practice question, and the old #1–#5 options table. **The sections below are retained as
> the analysis that produced the #1349 carve** — supporting context, not a live competing decision.
>
> **#1321's own remaining (ratifiable) scope** — a button-variant *consumer* of #1349:
> - **Variant surface = the #1349 contract applied to the button:** self-referential attribute
>   (`[variant]` / `:host([variant])`) + **token DI** (`var(--btn-bg, …)`), isolated by whichever strategy
>   the deployment selects (#1349 default S1). Never ancestor-coupled.
> - **Element granularity:** *one* element/surface, variant as the open-numbered attribute; **never**
>   per-variant tags (settled — #4 a niche opt-in).
> - **Behavior inventory:** the button needs **no element for behavior reasons** (busy/icon/toggle/async
>   all land in native/CSS/CustomAttribute; the (d) cases are composites = separate blocks).
> - **Attribute naming:** **settled upstream** — #1318 codified bare `variant`
>   (`we:docs/agent/platform-decisions.md#open-numbered-variants`). Under S1 the hook is `[variant]` on the
>   native button; under S2 it is `:host([variant])`. No naming decision owed here.
> - **DI / no-conflict invariant** (candidate, ~85%): model "variant consumed via named-token injection,
>   no component base-style collision" as a WE-contract invariant on the variant consumption model —
>   testable in conformance. (See live-fork section; this is the one genuine residual to ratify.)

## Ratified ruling — 2026-06-21

> **RATIFIED.** This item ratifies the **general block-packaging ruling** below (codified in
> `we:docs/agent/block-standard.md#packaging-governance-1321`). The button's concrete **mechanism pick**
> (which of the three runtime-shape families A/B/C), the **`we-button` default-tag** confirmation, and the
> **block-model conversion program** (5/75 blocks are elements today, #841) are **deferred to
> [#1381](/backlog/1381-button-packaging-pick-runtime-shape-mechanism-transient-vs-p/)** (blockedBy this
> item). The general ruling stands without the button pick — clean separation. Confidence ~90% on the
> general layer; the button mechanism is genuinely still open (transient leads, limits to weigh).

**The axis of the standard is uniformity of *usage*, not a fixed isolation mechanism.** What has significant
value — and what the block standard fixes — is that **every block is a custom element** (`<we-button
variant>`), consumed identically across the catalog. Whether a given block isolates via **shadow or light
DOM is an impl choice driven by its use case**, sitting *behind* that uniform element surface.

**Firm — uniform *authoring* surface.** Every block is authored the same way — one element spelling
(`<fui-button variant>`) across the catalog; a consumer learns one usage model. Uniformity binds the
**authoring** surface, **not** the runtime DOM shape: the element may *persist* (autonomous custom element)
or *self-erase to a native element* (`TransientElement` — see *Wrapper-less runtime shape* below). Both keep
the authoring surface uniform.

**Nothing is forbidden — compliance is a spectrum, not a gate.** WE mandates nothing
(*support-all-coherent*, *minimize-lock-in*). A block that deviates from the conformant shape is **not
prohibited** — it **forgoes specific compliance guarantees**, and the consequence is that an integration
relying on those guarantees may break. Deviation is never a hard blocker; it's a compliance/integration risk
the author accepts. So every "not conformant" below means *misses a guarantee*, **not** *disallowed*.

**Conformant shape vs the no-element / CSS-only pattern.** The conformant block shape is a custom element;
the **no-element CSS-only pattern** (ship a stylesheet, author hangs classes on a bare native element —
today's `fui:blocks/button/Button.ts` factory) **misses usage-uniformity compliance** (`<button class=…>`
instead of a block element), so integrations expecting a block element may not bind to it. Not prohibited —
a project may use it and accept that. *(This is what "CSS-only … not part of any block standard" meant — the
**no-element** pattern misses compliance, not light DOM itself.)*

**Isolation mechanism — per-block impl choice; encapsulation is available in *both* light DOM and shadow:**
- **Light DOM + webisolation (recommended).** A custom element owns a **real light-DOM `<button>`**.
  Encapsulation (in-leak blocked) comes from the **#1349 `webisolation` contract** — `@scope isolated`
  (csswg #11002) once baseline, a CSS-in-JS / unique-class keying transform until then. Because the real
  button stays in the light tree it participates in forms/a11y **natively — no `ElementInternals`** — and
  theming is direct (no `::part`). **Best fit for most blocks, form controls especially:** native semantics
  free *and* encapsulated.
- **Shadow** for the narrower cases wanting a **true runtime DOM boundary** (hide internal structure from
  `querySelector`; immunity even to hostile/unknown CSS before `@scope isolated` is baseline). Cost: the
  real control is hidden behind the boundary, so the *host* must be form-associated via `formAssociated` +
  `ElementInternals` and internals re-exposed via `::part`. **`ElementInternals` is a *shadow* cost** — it
  exists *because* the control is behind the boundary; light DOM never pays it.
- Both sit behind the same `<fui-button>` usage surface — this **keeps #1349's support-both**.

**`is="fui-button"` (customized built-in).** Possible (Safari declined it → needs a polyfill), but a
**light-DOM autonomous element wrapping a real `<button>` reaches the same native semantics more robustly**,
without betting on a feature the platform isn't shipping — so it's not the recommended shape. Per *nothing is
forbidden*, a project may still use it (and accept the Safari-without-polyfill integration risk).

**Other #1321 sub-calls:**
- *Element granularity* — one element, never per-variant tags. (Settled.)
- *Behavior inventory* — no behavior case forces an element; the element exists for the uniform usage
  surface / isolation, not behavior. (Settled.)
- *Attribute surface* — bare `variant` (#1318): `[variant]` on the light-DOM impl, `:host([variant])` on the
  shadow impl. The naming sub-fork dissolves either way.
- *DI / token invariant* — variant consumed via named-token injection, source-blind; holds under both
  mechanisms (custom props inherit across the shadow boundary). The *no-conflict* guarantee is enforced by
  the boundary under shadow and by `webisolation` under light DOM; only a block that opts out of both falls
  back to cooperative discipline.

**Relationship to #1349 (no amend needed).** #1349's support-both (shadow vs light DOM) **stands** — this
ruling keeps both; it adds (a) the *usage* surface is a uniform custom element and (b) the choice is a
**per-block impl call by use case**, not only a per-deployment Configurator knob. The `webisolation`
contract + L2/L3 impls (#1362–#1364) are unaffected; the #1365/#1366 Configurator knob may narrow (FUI picks
per block; the deployment-wide knob is less central) — confirm at ratification.

**Downstream consequence (prioritization, not a fork).** Every block becoming a custom element reverses
FUI's current grain — only 5 of 75 blocks register as elements today (#841); the rest are light-DOM
factories (`fui:blocks/button/Button.ts` has *zero* custom element). Ratifying implies a **block-model
conversion program** (factories → custom elements; mechanism chosen per block). Sizable, separately
prioritized; not a reason to reject the ruling (fork-is-not-a-prioritization-tool).

**Confidence ~80%.** Residual ~20%: a per-block mechanism mix could dilute *felt* uniformity if
undisciplined (mitigated — the usage surface is identical regardless), and the conversion program is large.

## Grounding digest

Full survey: **we:reports/2026-06-20-1321-fui-variant-surface-packaging.md** · research topic
`/research/fui-variant-surface-packaging/`. This is an **FUI impl call** (the variant *contract* is WE's;
the *packaging* is FUI's); WE never imports/renders FUI block code (docs-rendering boundary). *Caveat: the
report + the benchmark digest below predate the **no-conflict / encapsulation requirement** that reopened
this fork; they lean native-first on **behavior** grounds only and do not weigh encapsulation.*

- **The convergent benchmark shape is one element, variant as an attribute** — Shoelace
  `<sl-button variant>`, Adobe Spectrum `<sp-button variant treatment>`, Fluent UI WC
  `<fluent-button appearance>`, Carbon `<cds-button kind>`. **shadcn** ships the most native-first shape: a
  real `<button>` with a class computed from a `variant` prop (`buttonVariants({variant})`).
- **Material Web is the lone per-variant-tag outlier** (`<md-filled-button>`/`<md-text-button>`/…); its
  only rationale is tree-shaking per-variant *modules* — weak for WE/FUI because the variant axis is
  **behavior-free CSS** (no per-variant module to shake), and a tag-per-value is a *closed* namespace, the
  opposite of the ratified *open-numbered attribute* (#1318).
- **The open-numbered statute** — we:docs/agent/platform-decisions.md:588-589: "Surface is a plain
  attribute consumed by CSS (`button[variant]`) — no wrapper required, because a behavior-free axis needs
  none." *(This settles the variant **axis** needs no element for **behavior**; it does **not** speak to
  the encapsulation/conflict requirement.)*
- **Native `<button>` gives keyboard/focus/`disabled`/form participation free; a wrapper must re-forward
  it** (forms need `formAssociated` + `ElementInternals`).
- **FUI's elements are sparse + bare-kebab, no `fui-` prefix** (5 of 75 blocks register as elements;
  #841), so "no element, styled native `<button>`" fits the grain — *but see the encapsulation fork*.

## WE holds no default — contract only

**Correction to the prepared framing:** WE does **not** ship a packaging default, and the item must not say
"WE/FUI ship default values." Packaging is `locus: frontierui`; *WE = contracts only*. So:

- **WE's only artifact here is the variant contract** — the CSS-consumed `variant` attribute (#1318). No
  packaging default, no packaging opinion below that line.
- **WE may still *endorse* a recommended conformant shape** (what this item's options table marks) without
  *mandating* it — endorsement ≠ default ≠ mandate. A non-endorsed option that meets the invariants stays
  *allowed*; a *rejected* option fails a hard invariant.
- **A default, if one exists at all, is an FUI-reference-flavor (impl) concern** — and even then it is not
  a deliberated pick but "the most-flexible value" by *config-extends-platform-default* +
  *most-flexible-default*. FUI's call, not WE's.
- **The Technical Configurator tool itself stays default-less** (it computes a fit from declared
  constraints). Modelling packaging as an actual Configurator domain (seed + provider entry in plateau-app)
  is a **follow-up build**, its own item — not this ruling.

## The hard requirements (candidate WE-contract invariants)

Two requirements surfaced that bind **every** packaging option, rather than selecting among them. They are
distinct and must not be conflated:

1. **DI / pure decoupling.** Variant treatment is consumed by **dependency injection at the CSS layer**:
   the button **declares a need with a fallback** (`var(--btn-ghost-bg, transparent)`) and the **context
   provides** (`.toolbar { --btn-ghost-bg: … }`). The button never couples to where it sits; the
   environment injects. This is what cleanly solves *"same `variant` attr, different styling in two page
   regions"* — via tokens, not ancestor-coupled selectors (separation bias). Named custom properties are
   the **single named lock**; everything else decoupled (*minimize-lock-in*).
2. **No conflict between components.** No component's styling may collide with another's (no leakage, no
   specificity wars, no accidental override).
3. **Self-styling (parent-independent).** A button must style itself **without knowing its parent** — its
   appearance is a function of its own attributes (`[variant]` / `:host([variant])`) + **injected tokens
   read source-blind** (`var(--btn-bg, default)`), never of *where it sits*. This **forbids**
   ancestor-coupled mechanisms for variant styling: contextual/descendant selectors
   (`.toolbar button[variant]`) and `@scope (.parent){…}` (scoping to a parent root *is* knowing the parent
   — so `@scope` drops out of #2's toolbox). Per-region re-theming stays allowed, **only via tokens (DI)**,
   never via context selectors.

**Requirements 1 & 2 are opposites in the right sense:** DI is *intentional, named* injection (a closed API
— no collision possible); conflict is *accidental* overlap. An option can satisfy both at once, and
**custom properties inherit across the shadow boundary**, so DI survives every option — including the
Shadow-DOM ones (#3/#4 in the options table below).

**Requirement 3 has a weak and a strong reading — this is what splits #2 vs #3:**
- *Weak* — the button's authored **rules** don't reference the parent → **both** #2-disciplined and #3
  satisfy it.
- *Strong* — the button's **rendered appearance** is a pure function of its own state + injected tokens
  *regardless of environment* → **only #3 guarantees it.** In #2 the rules can be parent-blind, yet the
  rendered result is still at the mercy of the ambient global cascade (in-leak) — so the look *does* change
  with where you drop it. Read *strong*, requirement 3 **is** enforced-encapsulation from the button's
  point of view → #3.

**Candidate elevation (~85%, pending ratification):** model "DI + no-conflict, consumed via named-token
injection" as a **WE-contract invariant** on the variant consumption model — testable in conformance ("set
a token in an ancestor → variant restyles; no component base styles collide"). This gives the #1318
contract more than "an attribute exists": a **decoupling/anti-conflict guarantee**. Residual: whether
mandating custom-property DI over-specifies the contract vs minimize-lock-in.

## CSS scoping — what's achievable without JS, and what it does / doesn't give

The light-DOM options style a native `<button>` via the `variant` attribute. Key fact (confirmed):
**CSS-only via the attribute provides *no encapsulation by itself*** — `button[variant="ghost"]` is a
global attribute selector in the global cascade; any scoping is opt-in via *separate* mechanisms. What
those give, with current support:

| Mechanism (no JS) | Gives | Does NOT give | Support (June 2026) |
|---|---|---|---|
| attribute/class selector | a styling hook | any scoping/isolation | universal |
| `:where()` | zero-specificity base (consumers override freely) | a boundary | Baseline widely available |
| `@layer` | deterministic cascade order; component-vs-component resolved by layer, not accident | a boundary | **Baseline widely available** (Sept 2024, ~96%) |
| `@scope` | subtree-limited selectors (donut/proximity) | a boundary (outside CSS still reaches in) | **Baseline newly available** (Dec 2025; Chrome 118+/Safari 17.4+/FF 146+) — needs fallback |
| **Shadow DOM** (custom element, needs JS) | **enforced encapsulation** — a real runtime boundary; outside CSS can't reach in except via inherited custom props | (costs native a11y-for-free; must re-expose via `::part`) | widely available |

**The decisive distinction:** `@layer`/`@scope`/`:where()` give **cooperative** conflict-avoidance
(discipline), **not** an enforced boundary. **Only Shadow DOM *enforces* encapsulation.** "Leaking" cuts
both ways: *out-leak* (this component's rules hit others) is handled cooperatively; *in-leak* (outside CSS
reaches this button) is **stopped only by a boundary**.

## All packaging options × WE endorsement

WE **endorses** = the recommended conformant shape · **allowed** = meets the invariants but isn't the
recommendation · **rejected** = fails a hard invariant (no-conflict, or unsupported). Endorsement of #2 vs
#3 is **conditional on the one open question** below.

| # | Option | Variant CSS applied via | Encapsulation | Native a11y/form | JS | DI ok | **WE stance** |
|---|---|---|---|---|---|---|---|
| 1 | **Unscoped global CSS** — `<button variant>` + global `[variant]{}` | global attribute selector | **none** (leaks in **and** out) | ✅ free | none | ✅ | **❌ Rejected** — fails no-conflict; bare-name collision risk |
| 2 | **Disciplined light DOM** — `[variant]`/`[data-variant]` + `@layer`+`@scope`+`:where` + lint gate | scoped attribute selector | **cooperative** (out-leak controlled; **in-leak not prevented**) | ✅ free | none (build/lint) | ✅ | **✅ Endorsed *iff* "in-practice"** · ⚠️ allowed-not-floor if "enforced" |
| 3 | **Single custom element + Shadow DOM** — `<fui-button variant>` over a real `<button>` | `:host([variant])` in shadow stylesheet | **enforced** (real boundary) | ⚠️ must re-forward (`formAssociated`/`ElementInternals`) | required | ✅ (props inherit across boundary) | **✅ Endorsed *iff* "enforced"** · ⚠️ allowed-not-floor if "in-practice" |
| 4 | **Per-variant custom elements** — `<ghost-button>`, `<fill-button>` (Material Web) | the tag itself | enforced, but **closed namespace** | ⚠️ re-forward | required | ✅ | **⚠️ Allowed opt-in, never endorsed** — closed namespace, breaks dynamic binding, opposes open-numbered #1318 |
| 5 | **Customized built-in** — `is="fui-button"` (subclass `HTMLButtonElement`) | `[variant]` on the subclass | none (light DOM) | ✅ free | required | ✅ | **❌ Rejected** — no WebKit/Safari support; can't be a floor |

## The live fork — DISSOLVED by #1349 (retained as context)

> **This section is no longer a live #1321 decision.** #1349 ruled S1 (≈old #2, disciplined light DOM) vs
> S2 (≈old #3, shadow-per-component) is a **support-both** deployment dimension, Configurator-selected,
> **flavor default S1** — so WE neither rejects #2 nor mandates #3. The "enforced vs in-practice" question
> below was answered *both* (each is a conformant impl of the one isolation contract; the deployment picks
> via the Configurator). #1321 inherits that: the button rides whichever strategy the deployment selects,
> default light-DOM S1. The text below is the original framing that fed the #1349 carve.

The no-conflict requirement rejects **#1** and **#5** and forces a real choice between **#2** and **#3**.
Everything reduces to one question:

> **Is the hard requirement *enforced encapsulation*, or *no-conflict-in-practice*?**
> - *Enforced encapsulation* (a runtime boundary; immunity even to hostile/unknown CSS, no in-leak) →
>   **#3 (Shadow-DOM custom element) becomes WE's endorsed floor**, reversing the prepared native-first
>   lean, eyes open to the cost (JS, a11y re-forward, harder per-region theming, `::part` re-export).
> - *No-conflict-in-practice* (your own known components don't collide) → **#2 (disciplined light DOM)** is
>   endorsed — native-first, CSS-only, a11y free; only the *unscoped* #1 is rejected.

**Current read (~80%): enforced → #3.** The strongest signal is the **self-styling principle**
(requirement 3): "a button should not have to know its parent to style itself," read *strong* (rendered
appearance environment-independent), is satisfiable only by the shadow boundary. Combined with the
no-conflict stance and the distribution analysis (#3 carries its own complete styling, parent-independent
by construction), this points to #3. **Residual:** the reversal trades away native a11y-for-free and the
no-JS/SSR-simple property; #2's cooperative model ships conflict-free at scale. **Needs the user's explicit
confirmation of the *strong* reading before #3 is locked and ratified** — not banked on inference.

*Why namespacing doesn't rescue #1:* renaming the hook (`data-variant`) fixes only *name collision* with
native attributes — a **different conflict class** from leaking. A global `[data-variant]` selector leaks
exactly as much as `[variant]`. So #1 is out regardless of name; the encapsulated way to "apply CSS via an
attribute" is `:host([variant])` inside #3.

## Attribute naming (sub-fork — live only if #2 wins)

The WE/FUI custom-attribute rule **requires a hyphen** (or `:` namespace): `CustomAttributeRegistry.define()`
throws otherwise — *"must contain a hyphen … to avoid colliding with standard HTML attributes"*
(fui:plugs/webbehaviors/CustomAttributeRegistry.ts:188-196; enforced, tests + #1120/#1333). **But that rule
governs *registered behaviors*** (JS attributes upgraded by the registry). `variant` is **behavior-free
CSS** — never `define()`-d — so it does not mechanically trip the rule; bare `<button variant>` is
*technically allowed*.

**The tension is real anyway:** the rule's *rationale* (avoid native-attribute collision) applies to any
bare attribute, and #1318 mints `variant` bare (we:docs/agent/platform-decisions.md:616). So:

- **A — CSS styling-hooks are exempt** → keep bare `variant` (matches the statute; small standing
  native-collision risk).
- **B — extend anti-collision uniformly** → namespace the hook: `data-variant` (the only *formally*
  collision-proof author namespace, CSS-targetable) or hyphenated `ui-variant` (satisfies the rule's
  letter). **This revisits #1318's bare-`variant` choice** — not decidable unilaterally here.

Lean **B (~70%)** given no-conflict is a hard requirement; `data-variant` is the platform-sanctioned form.
**Only live under #2** — under #3 the variant is a host attribute styled `:host([variant])`, with far less
collision exposure, and the sub-fork mostly dissolves.

## Settled / not in contention

- **Element granularity** — *one* element/surface, variant as the open-numbered attribute; **never
  per-variant tags as primary** (#4 stays a niche opt-in). Holds whether #2 or #3 wins.
- **Per-variant *loading*** — non-issue: the variant axis is CSS-only, so there is no per-variant *module*
  to lazy-load; "load only what's needed" is ordinary CSS bundling (a build optimization, not architecture).
- **Autocomplete / typing of `variant`** — delivered by the CEM/types over the WE-owned custom-element
  contract (#822), independent of which option ships.

## Button behavior inventory — does any case earn an element *for behavior reasons*?

**Scope note:** this answers the *behavior* axis — "does the button accrue enough non-variant runtime
behavior to need an element?" — and the answer is **no**. It is **orthogonal to the encapsulation fork**:
even with zero behavior need, *enforced encapsulation* alone could still mandate #3. Keep both axes
distinct.

Survey of Shoelace, Adobe Spectrum WC, Fluent UI WC, Carbon WC, Material Web, GitHub Primer, MUI, Ant, and
native `<button>` + Open UI/WHATWG. Classification: **(a) NATIVE** = platform `<button>` does it free ·
**(b) CSS/ATTR** = pure styling / CSS-consumed attribute · **(c) LIGHT BEHAVIOR** = small JS attachable to
a native button via a `CustomAttribute` (no element owned) · **(d) NEEDS ELEMENT/SHADOW**.

### (a) NATIVE — free from the platform, no element, no JS

Focus & tab order · Enter/Space activation · `disabled` · `type=submit/reset/button` · form identity
(`name`/`value`) · per-button form overrides (`formaction`/`formmethod`/…) · `form=` association ·
`autofocus` · `formmethod=dialog` · `popovertarget`/`popovertargetaction` · **`command`/`commandfor`
(Invoker Commands — cross-browser Baseline since Dec 2025)** · `accesskey`.

> **Decisive platform shift:** `command`/`commandfor` + `popovertarget` make **dialog/menu/popover
> *triggering* native** — the historical #1 reason to wrap a button is gone (zero JS).

### (b) CSS/ATTR — a CSS-consumed attribute on the native button, no element

`variant`/kind/appearance (#1318) · `size` · outline/treatment · pill/round · circle/shape ·
ghost/transparent/static-color · full-width/block · elevation · expressive/condensed layout · caret ▾
glyph. *(Trivially reachable in **light DOM**; under Shadow DOM (#3) each must be re-exported as a `::part`.)*

### (c) LIGHT BEHAVIOR — a `CustomAttribute` attached to the native button (no element owned)

- **Busy / loading / pending** — spinner inject + `aria-busy` + width-lock + delay-debounce (anti-flash) +
  SR announcement. *Half the surveyed WC systems don't even ship this* → a native-first differentiator.
- **Async / pending click** — await the handler's promise, hold busy until it settles.
- **Toggle / pressed (single button)** — flip `aria-pressed` on click (native ARIA, ~3 lines).
- **Ripple**, **debounce/throttle**, **confirm-before**, **copy-to-clipboard**, **counter/badge**,
  **tooltip pairing** — all attachable without owning the element.
- **Icons** — leading/trailing/icon-only is `<svg>` + text markup + flex CSS on the native button. Only the
  slotted-icon-API-with-`::part`-theming version is (d).

### (d) NEEDS ELEMENT/SHADOW — every one is a *composite*, a separate block (not the button)

- **Split button** · **menu button** (trigger now native; the surface + roving nav is the composite) ·
  **button/segmented/toggle group** with selection model + roving tabindex + group ARIA (*MUI & Material
  both punt on roving here — a native-first WE win*) · **toggle-with-slotted-icon-swap** · **compound /
  two-line button**.
- **`href` polymorphism in ONE element** — avoidable native-first: ship a styled native `<a>` + `<button>`
  over one CSS/attribute layer (Spectrum is migrating this way). Demotes (d) → (b).
- **`::part` theming / encapsulated internal structure** — the structural reason to reach for shadow DOM
  *(this overlaps the encapsulation fork: it is exactly #3's cost/benefit)*.

### In-tree fact that kills the "behavior integration cost" objection

`CustomAttribute` is mature, proven, first-class in FUI: full lifecycle, `formAssociated` + form callbacks,
`activationSurface` (inert-aware), `activationWhen: 'visible'` (IntersectionObserver lazy-load)
(fui:plugs/webbehaviors/CustomAttribute.ts). ~24 FUI blocks attach behavior this way;
fui:blocks/droplist/Clearable.ts is the exact shape. The current fui:blocks/button/Button.ts is **already**
a native-`<button>`/`<a>` factory doing variant + icon + toggle + href with **zero custom element**. So
behavior integration is not new machinery. *(The `is="fui-button"` middle path is #5 above — ruled out, no
WebKit/Safari support.)*

### Conclusion (behavior axis only)

No single-button case reaches (d) for **behavior** reasons — busy, icon, toggle, async all land in
(a)/(b)/(c); the (d) cases are composites = separate blocks. **But this does not decide packaging** — the
encapsulation fork can still mandate #3 independent of behavior.

## For the deciding agent (red-team flags)

- **The encapsulation fork is the high-leverage call**, not the behavior axis. The decisive input is the
  user's **enforced-vs-in-practice** answer (#2 vs #3). Red-team both directions: (i) if *enforced*, press
  whether the button block genuinely faces hostile/unknown host CSS, or whether that's over-engineering vs
  the cooperative model that ships at scale; (ii) if *in-practice*, press whether a lint/build gate truly
  prevents conflict in a large multi-team codebase without a runtime boundary.
- **DI-decoupling-as-WE-contract-invariant (~85%)** — red-team whether mandating custom-property DI
  over-specifies the contract (minimize-lock-in) vs earns a real testable conformance guarantee.
- **Attribute naming (A vs B)** — only matters if #2 wins; B revisits #1318, so route it there rather than
  deciding it inside this item.
- **Element granularity is settled** (#4 never primary) — low residual.
- **Composites scope** — confirm split/menu/group/compound are out of scope (separate blocks); if this
  item rules for the whole button *family*, the framing changes.
