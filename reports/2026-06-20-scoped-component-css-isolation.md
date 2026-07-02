# Light-DOM scoped-component CSS isolation — native-compile proposal + transform/polyfill impls

**Date:** 2026-06-20 · **Item:** #1349 · **Locus:** cross-cutting (scoped-component system) · **Feeds:**
#1321 (button variant packaging) · **Research topic:** `/research/scoped-component-css-isolation/`

> **Status: prepared.** Prior-art survey done; the forks are reshaped to Definition of Ready (2 genuine
> forks + a supported-by-default list). The survey's biggest result: the platform already has a live
> standards effort matching Layer 1 exactly (csswg #11002 `@scope isolated`), which collapses the
> "invent a proposal form" framing into "track the live work."

## The gap

The #854 scoped-component system isolates component **identity** per view (scoped registry: same tag →
different impl per scope) but **not its styles**. A grep of `we:` + `fui:` found **zero** runtime
CSS-isolation impl (no `adoptedStyleSheets`, no constructable stylesheets, no unique-class/scope-keying
engine); existing blocks (`fui:blocks/card/Card.ts:89`, `fui:blocks/button/Button.ts:114`,
`fui:blocks/badge/Badge.ts:78`) only use ad-hoc global classes + `var(--…)` token fallbacks. So per-view
style isolation in light DOM is **implicit and unimplemented** — surfaced by #1321.

Concrete grounding (real tree):
- Identity isolation **is** built — `REGISTRY_SCRIPT_TYPE`/`REGISTRY_ASSOC_ATTR` at
  `we:plugs/webregistries/declarativeRegistry.ts:39,45`; `attachShadow({ customElementRegistry })` patched
  at `we:plugs/webregistries/index.ts:88`.
- Style isolation is **not** — `adoptedStyleSheets`/`CSSStyleSheet`/`replaceSync`/`@scope` return **no
  runtime hits** in either repo.
- The token-DI surface exists separately — `cssVarName()` at `we:webtheme/tokens.ts:93` (`['radius','md']`
  → `--radius-md`); platform default tokens at `we:webtheme/defaultTokens.ts`.
- The consumer's self-styling requirement — `we:backlog/1321:97-103` ("a button must style itself without
  knowing its parent … forbids `.toolbar button[variant]` and `@scope (.parent)`").

## The contract (invariant across impls)

Scoped-component styling is **self-contained**: self-referential rules (`[variant]` / `:host([variant])`)
+ **token DI** (custom properties, source-blind), never ancestor-coupled. The **system** delivers per-scope
isolation; scope-keying is machine-generated, not authored (self-styling). This is **fixed**, not a fork.

## Layer 1 — web-native compile proposal (survey result)

**The aspirational standard:** shadow-grade isolation (in **and** out) of a light-DOM subtree without a
shadow root, preserving native `<button>` a11y/form.

**Survey finding — there is no native primitive today, but there IS a live standards effort that matches.**

- **`@scope` (Baseline Dec 2025) is out-scoping only.** It limits where *your* selectors match ("donut
  scoping") but does **not** block external rules from leaking in — an external `button {}` still matches
  inside a scope, and inherited properties (color, font) leak through the donut hole.
  [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@scope) ·
  [Chrome](https://developer.chrome.com/docs/css-ui/at-scope). It **is** self-rootable: a prelude-less
  `@scope {}` in a `<style>` scopes to that style's parent element (no ancestor selector required).
- **`@scope isolated` — csswg-drafts [#11002](https://github.com/w3c/csswg-drafts/issues/11002)** (Bramus,
  Oct 2024, css-cascade-6/7). Proposes an `isolate` keyword — `@scope isolated (root) to (limit) {…}` —
  that **blocks the inbound cascade** ("two trees styled individually"). This is *exactly* the Layer-1
  goal. **Open, no spec text yet.** This is the seam WE should track.
- **Lineage (rejected for our purpose):** `<style scoped>` was Firefox-only and **removed ~2016** for lack
  of vendor interest ([caniuse](https://caniuse.com/style-scoped),
  [Bugzilla 1291515](https://bugzilla.mozilla.org/show_bug.cgi?id=1291515)); its revival thread
  [#3547](https://github.com/w3c/csswg-drafts/issues/3547) is considered superseded by `@scope`. The
  foundational light-DOM-scope proposal is [#5809](https://github.com/w3c/csswg-drafts/issues/5809).
- **Name to avoid:** the CSS `isolation` property is unrelated (it only creates a stacking context for
  `mix-blend-mode`). A bespoke `style-isolation` property would collide conceptually with it.

**Conclusion:** Layer 1 should be framed as *conformance to / tracking of #11002 `@scope isolated`*, not a
WE-minted competing form. That is the native-first + minimize-divergence move.

## Layer 2 — transform (build-time) — survey result

The build-time CSS-in-JS / CSS-Modules family is **unanimous** on the pattern:
- **vanilla-extract** — zero-runtime; its style modules are evaluated at build, none of that code ships,
  hashed class names emitted as plain strings
  ([repo](https://github.com/vanilla-extract-css/vanilla-extract)). Closest match to our target.
- **CSS Modules** — local names compiled to globally-unique hashed names; SSR-trivial via
  `exportOnlyLocals` ([css-modules](https://github.com/css-modules/css-modules)).
- **styled-components / Emotion** — hash a unique class, but the hashing is finalized at **runtime**;
  needs a Babel/SWC plugin for deterministic SSR ids. Not zero-runtime.
- **Lit `static styles`** — the contrast case: scoping comes from **shadow DOM**, not a class rewrite (a
  runtime DOM boundary) ([lit.dev](https://lit.dev/docs/components/styles/)).
- **Vue SFC `<style scoped>`** — the attribute-hash variant: PostCSS adds `[data-v-xxxx]` to each element
  and rewrites selectors; **outbound only**, does not block inbound
  ([vue-loader](https://vue-loader.vuejs.org/guide/scoped-css.html)).

**Pattern (confirmed):** hash a unique class per scope, rewrite the scope's self-referential selectors to
it, emit static CSS — zero runtime, SSR-trivial, native a11y intact. All scope **outbound only**; none
block inbound (only shadow DOM does).

## Layer 3 — polyfill (runtime) — survey result

- **Constructable `adoptedStyleSheets`** — Baseline since **Mar 2023**; `new CSSStyleSheet()` +
  `.replaceSync()`, applied to **both `Document` (light DOM) and `ShadowRoot`**
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets)). The runtime
  analogue of vanilla-extract's build-time hashing — generate a unique scope class, push a sheet keyed to
  it onto `document.adoptedStyleSheets`, apply the class to the subtree. Outbound-only (no shadow).
- **Shadow-per-component (S2)** — native in+out isolation *today* (`attachShadow`), already honored by the
  #854 registry. **Cost:** a native `<button>` wrapped in a shadow root **loses form participation and
  label association** — IDs are shadow-scoped, a light-DOM `<label for>` can't reach in, implicit form
  submission breaks; you must re-forward via **ElementInternals** (`static formAssociated`,
  `attachInternals()`) ([css-tricks](https://css-tricks.com/creating-custom-form-controls-with-elementinternals/),
  [hjorthhansen](https://www.hjorthhansen.dev/shadow-dom-and-forms/)). This is the central S1-vs-S2
  tension.
- **Scoped custom element registries** — graduated WICG → WHATWG HTML; native default **Chrome 146 stable
  Mar 2026 + Safari 26, no Firefox**; polyfill `@webcomponents/scoped-custom-element-registry`
  ([Chrome](https://developer.chrome.com/blog/scoped-registries)). Very fresh — lean on the polyfill for
  any baseline claim.

## Two strategies (the enforced-vs-in-practice axis — supported by default, not a fork)

| Strategy | Mechanism | Native a11y | Shadow | Immune to external hostile CSS | Inter-view isolation |
|---|---|---|---|---|---|
| **S1 — unique-class light DOM** | transform (L2) / polyfill (L3) keys CSS to a unique scope class | free | no | no | total |
| **S2 — shadow-per-component** | `:host([variant])` in a shadow root | re-forward (ElementInternals) | yes | yes | total |

Both: total inter-view isolation + per-view override; differ only on external-CSS immunity vs
native-a11y-free — a per-deployment strategy choice, both conformant to Layer 1. **This is not a fork** (no
excluded branch); it is a Configurator dimension with a flavor default (S1, the native-first floor).

## Classification (per-fork pass)

- **Layer:** WE standard concern — a **contract** (the Layer-1 isolation guarantee) + conformant impls. Not
  a runnable block; not a UX intent dimension. The isolation guarantee is the kind of thing many impls can
  satisfy, but there is **no swappable-vendor interop story** → the contract is a *conformance spec*, not a
  reach-for-a-Protocol case (minimize-lock-in).
- **Fixed mechanic vs dimension:** the **contract** is a fixed invariant; the **strategy** (S1/S2) and the
  **impl layer** (transform/polyfill) are legitimate-both-end-states → **dimensions** (Configurator-selected
  per deployment), not picks.
- **DI-injectable:** the strategy is a **behavioral** dimension → resolvable via the platform-config /
  Configurator channel, not hardcoded on the component.
- **Most-permissive default:** S1 (a11y-free native-first floor) as the flavor default; S2 is the author's
  opt-in for hostile-host immunity. Transform primary (zero-runtime), polyfill the fallback.
- **Separate-and-decouple bias:** style isolation recurs independently of identity isolation (webregistries)
  and of tokens (webtheme) → **own plug** (Fork 2 default); burden of proof is on folding it in.

## Forks at Definition of Ready

| Fork | Options | Recommended default | Confidence |
|---|---|---|---|
| 1 — Layer-1 proposal form | (a) track csswg #11002 `@scope isolated` · (b) mint a bespoke WE form | **(a)** track #11002 | ~80% |
| 2 — placement | (a) own plug · (b) fold into webregistries | **(a)** own plug | ~70% |

**Supported by default (dissolved on pass-0, not decisions):**
1. **Strategy S1/S2** — both conformant impls; Configurator-selected; flavor default S1 (soft/revisitable).
2. **Transform vs polyfill primacy** — both ship; transform primary, polyfill fallback.
3. **Token-DI interplay** — confirmed invariant: custom properties inherit across the shadow boundary, so
   both strategies keep token DI. No excluded branch.

## Cross-references

- #854 — scoped registry (identity isolation) this completes.
- #1321 — the button-variant consumer; `blockedBy` #1349.
- #1318 — the ratified `variant` axis the consumer packages.
