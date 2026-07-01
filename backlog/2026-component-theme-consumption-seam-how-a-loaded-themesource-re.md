---
kind: decision
status: resolved
preparedDate: "2026-07-01"
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#semantic-alias-co-emit"
tags: [theme, design-tokens, css-custom-properties, fui-boundary, standards-position, decision]
relatedReport: reports/2026-07-01-2026-theme-consumption-seam.md
---

# Component theme-consumption seam: how a loaded ThemeSource re-themes live FUI components

**RULING (2026-07-01): Fork 1 = (b′) — the FUI injector co-emits the semantic-alias tier alongside
canonical `--token-*` at *every* themed scope (`:root` or component host), single-sourced from a
FUI-owned `LEGACY_ALIASES`. Fork 2 = (a) — badge tones bind to the `--tone-*` severity palette.**
Resolved on merit, not timing: the semantic role set is the *component contract* [#1886 Fork 2] made FUI
components read, so its owner (FUI) emits it wherever it themes. The canonical-fallback alternative (b″)
was rejected — it would demote the semantic tier to an app-optional override, reopening #1886, which
nothing paid for. Codified as [semantic-alias-co-emit](../docs/agent/platform-decisions.md#semantic-alias-co-emit).
Follow-on builds (below) are `blockedBy` this decision; F-iso / F-slot are deferred future merit forks.

`#2017` pre-flight surfaced this. The manifest→`ThemeSource` loader can be built, but its acceptance
(loading a material-like theme *visibly re-themes a live `we-card` + `we-badge`*) is unmeetable:
`grep` finds **zero** consumers of `resolveTheme`/`getRootTheme`/`ThemeSource` outside
`fui:plugs/webtheme/` itself. Three vocabularies don't meet — FUI **emits** family-prefixed
`--token-<family>-<name>` (`fui:plugs/webtheme/emitCss.ts:26-30`, `applyTokenVars` at `:79`); the card
**reads** un-prefixed semantic `--color-border` / `--color-surface-card` / `--radius-md` / `--shadow-sm`
(`fui:blocks/card/Card.ts:90-100`); the badge reads **nothing** — hardcoded hex per tone
(`fui:blocks/badge/Badge.ts:87-91`). So a runtime-injected `ThemeSource` paints `--token-color-*` that
no component reads. This item decides **which layer owns emitting the semantic-alias tier** (Fork 1) and
**the badge theming target** (Fork 2); the projection vocabulary itself is statute-settled (below). Full grounding +
prior-art survey: `we:reports/2026-07-01-2026-theme-consumption-seam.md` and
`/research/theme-projection-vocabulary-contract/`.

## Grounding digest

The apparent "which vocabulary?" fork is **mostly already answered by statute**:

- The **projected names are ratified.** `#1886 Fork 2` (`we:docs/agent/platform-decisions.md`, the
  tokenized-base ruling ~L1582-1589) blessed the card reading `var(--color-border)` / `var(--radius-md)` /
  `var(--color-surface-card)` as the reskinnable base; `#tokens-js-first` fixes the canonical spelling as
  the one-way `--token-*` projection off the injector SoT.
- The **semantic-alias bridge already exists and is ratified** — `#1824 Fork 2a` ships
  `we:scripts/lib/token-css.mjs`, which emits **both** the `--token-*` resolved block **and** a
  `--<family>-*` alias block (`--color-border: var(--token-color-border)`) from
  `we:src/_data/weSiteTheme.js` `LEGACY_ALIASES` (L62-82), inlined pre-paint into the WE-site `<head>`
  (`we:src/_layouts/base.njk`, `#we-token-css`). **But that alias emit runs at WE-site *build* time
  only** — FUI's runtime `applyTokenVars` paints just `--token-*`, so a runtime-injected `ThemeSource`
  can't re-theme a live component.
- **Coverage gap:** `--color-surface-card`, `--color-border-light`, `--color-text-secondary` (read at
  `fui:blocks/card/Card.ts:92,95,99-100`) are absent from both `LEGACY_ALIASES` and
  `defaultTheme` (`fui:plugs/webtheme/defaultTheme.ts:17-27`) — they only ever hit literal fallbacks.
- **Alias placement is scope-bound (verified in-browser).** `var()` substitutes at the element that
  *declares* the alias, using that element's canonical value — so a `:root`-only alias computes
  `--color-border` against `:root`'s `--token-*` and inherits that fixed value down; a lower,
  component-scoped `--token-*` override is **not** picked up. Proof (Chromium `getComputedStyle`): with
  `:root { --token-color-border: red; --color-border: var(--token-color-border) }`, a child that sets
  only `--token-color-border: blue` still renders **red**; a child that *also* re-declares the alias
  renders its own colour (green). **Consequence:** wherever a theme lands the `--token-*` block, the
  alias block must be **co-emitted at that same scope**. Build-time `:root` alias serves page-wide
  theming only; per-component runtime theming structurally requires a runtime per-scope alias co-emit.
- **Prior art unanimous:** every mature token system ships a two-tier canonical→semantic-alias step
  (Style Dictionary flat `--color-border`; Material `--md-sys-color-*` + `--md-<comp>-*`; Shoelace/Spectrum
  alias tiers). WE's `--token-*` (canonical) + `--<family>-*` (semantic alias) *is* that shape. The
  `#751`/#930 DTCG→`--wb-*` mapping (`fui:workbench/manifestBridge.ts:2`, "ruled by #930-A" — a backlog
  decision, not a platform-decisions anchor) is the same alias step but **workbench-demo scoped** (its
  `--wb-*` names never cross the WE boundary) — it does **not** decide this real component seam.

## Standing test — what is actually a fork

Decomposed into concerns:

1. **Which vocabulary a `ThemeSource` projects to** — **NOT a fork.** The projected names are
   statute-fixed (semantic `--<family>-*` per `#1886`, aliased to canonical `--token-*` per `#1824`).
   "Migrate all component CSS onto `var(--token-*)` and rename every read" is a *rejected* branch, not a
   coequal one — it discards the `#1886`-ratified card spelling and churns 600+ call sites. Dissolved.
2. **Where the semantic-alias tier lives — which layer owns emitting it (Fork 1)** — **genuine merit
   fork.** The proof (above) makes scope-matched placement a platform *fact*: whatever themes a scope
   must place the semantic tier at that scope, `:root` or component host alike. What is *not* settled by
   fact is **which layer owns that placement** — the FUI injector emitting the alias alongside canonical
   at every themed scope, vs a component reading a canonical-fallback so the alias stays an optional
   app-layer override. Decided by principle (component-contract ownership vs platform/app layering),
   **not** by whether a per-component consumer is scheduled. "Build-only vs runtime, defer until a
   consumer exists" was a *timing* framing and is discarded.
3. **How the badge (zero custom-prop reader) gets themed** — **genuine fork (Fork 2)**, but a
   *component-CSS migration* question (which token family its tones bind to), not a vocabulary question.
4. **The three untokened card props** — **not a fork:** a coverage gap with one obvious fix (add to the
   token model, or migrate the card CSS onto tokened props). Support-both is meaningless here. Recorded
   as follow-on build scope, not a ratifiable branch.

## Recommended path at a glance

| Concern | Classification | Recommended default |
|---|---|---|
| Projection vocabulary | statute-settled (not a fork) | Semantic `--<family>-*` aliased to canonical `--token-*` (`#1886`/`#1824`) |
| **Fork 1 — alias-tier ownership** | real merit fork | **(b′) FUI injector co-emits alias + canonical at every themed scope** (single-sourced `LEGACY_ALIASES`, FUI-owned) — the semantic tier is part of the `#1886` component contract, so its owner emits it. Alt **(b″)** components read canonical-fallback, alias optional/app-owned. **(a)** canonical-only reads rejected (discards role-remap) |
| **Fork 2 — badge theming** | real fork (component-CSS migration) | **(a) Tokenize badge tones onto the `--tone-*` palette** (`#tone-meta-contract`), so a `ThemeSource` moves it |
| Coverage gap (a real blocker for `#2017` acceptance) | not a fork (build scope) | Add `surface-card`/`border-light`/`text-secondary` to `defaultTheme` + the alias map (or migrate card CSS onto `--color-surface`/`--color-border`) |

## Standard vs impl boundary (this fork is impl-only)

The **WE standard** is unchanged by either branch and takes native CSS-variable shape: a themeable
element reads semantic custom properties; **a theme is custom-property declarations set on a scope
root**; per-component = the component's own host is the scope. Custom properties inherit through the
shadow boundary *and* into (slotted or plain) light-DOM descendants, so subtree-scoped theming is the
platform primitive — no new API, and light-DOM leaves (`#2028`) theme identically to shadow components.
(Neither DOM model isolates custom properties; shadow DOM encapsulates *rules*, not inherited vars — the
only non-inherit lever is a global `@property { inherits: false }` registration.) Fork 1 therefore
decides **only the FUI emit mechanism** (which layer emits the `--token-*` + alias block, and where),
never the standard.

## Fork 1 — which layer owns emitting the semantic-alias tier

**Merit fork, not a timing call.** The proof settles the *mechanics* — scope-matched placement is
mandatory because `var()` substitutes at the declaring element, so the alias tier must exist at every
scope a theme targets (a `:root`-only alias can never forward a component-scoped `--token-*`). What
principle must decide is **who places it**. Three coherent end-states; support-both is impossible (a
component reads one way, a scope emits one way):

- **(b′) The FUI injector co-emits alias + canonical at every themed scope. ← default.** `applyTokenVars`
  (`fui:plugs/webtheme/emitCss.ts:79`) writes `--token-<family>-<name>` **and** the `--<family>-<name>`
  alias tier onto whatever scope element it themes (`:root` or a component host), both **derived from the
  single `LEGACY_ALIASES` source** (`we:src/_data/weSiteTheme.js`), never hand-authored in the emitter
  (`#tokens-js-first` no-parallel-projection). **Principle: the semantic tier is part of the component
  contract.** `#1886 Fork 2` ratified FUI components reading `var(--color-border)` — the reskinnable
  surface *is* the semantic role set. FUI therefore cannot ship components whose theming depends on some
  external layer emitting the alias; the owner of the contract (FUI) owns emitting it, at every scope it
  themes. The alias map moves into `fui:plugs/webtheme/` so build + runtime share one source (a mechanical
  `--token-<f>-<n>` ⇒ `--<f>-<n>` convention would mis-map non-mechanical names like `--color-bg`,
  `--font-sans`). Cost accepted: two custom-property tiers per themed scope.
- **(b″) Components read a canonical fallback (`var(--color-border, var(--token-color-border))`); the
  platform emits canonical only; the alias tier is an optional app-layer override.** *Principle offered:*
  clean layering — platform = canonical single-source, semantic role vocabulary = application concern
  (the shape `#1824` gestured at with its "website-local alias"). Per-component theming still works: the
  fallback `var(--token-*)` substitutes at the component, picking up the scoped override. *Rejected on
  merit:* it demotes the semantic tier from *contract* to *optional nicety* — the default build then has
  **no role-indirection** (`--color-border` == its canonical value until an app opts in), so a stock FUI
  component loses the `#1886` reskin layer unless an app re-supplies it. That contradicts `#1886`, which
  made the semantic read the *contract*, not an override. It also edits every component read to add the
  fallback. Coherent, but it wins only if we reclassify the semantic tier as app-owned — which `#1886`
  already declined.
- **(a) Migrate every component read to `var(--token-*)`; no semantic tier.** *Rejected:* discards
  role-remap entirely (the two-tier system's whole point), overturns the `#1886` card spelling, and churns
  the `--<family>-*` call sites the `#1824` header deferred. Not coequal.

**Default: (b′)** — resolved by *component-contract ownership*: the semantic role set is what `#1886` made
FUI components read, so FUI owns emitting it wherever it themes. This is a **new platform-runtime ruling**,
not an extension of `#1824` (which is website-build transport and disclaims touching FUI's emit shape) —
justified by the contract principle, independent of any scheduled consumer. `#tokens-js-first`'s
single-source rule is *satisfied*, not violated, as long as the runtime alias derives from the one
`LEGACY_ALIASES` (it constrains *how* (b′) is done, and rules out a hand-authored parallel map).

**Red-team (the live merit challenge):** (b″)'s layering argument is the real opponent — "platform emits
canonical, semantics are app vocabulary" is a defensible architecture, and it avoids coupling the FUI
injector to the full semantic map. It loses only because `#1886` already located the semantic read *inside*
the component contract; overturning that (to make the alias app-optional) is the burden (b″) would have to
carry, and nothing in the discussion pays it. If the user holds that the semantic tier *should* be
app-owned, (b″) becomes the merit winner and `#1886`'s contract scope is what we'd re-open — that is the
one question worth pressing before ratifying.

(The `#930-A` reference is the `#751`/#930 workbench-manifest decision — `fui:workbench/manifestBridge.ts:2`
— a backlog ruling, **not** a platform-decisions anchor; workbench-demo scoped, does not reach this seam.)

## Fork 2 — how the badge (zero custom-prop reader) gets themed

**Fork-existence justification:** the badge reads **no** custom properties — every tone is a hardcoded
hex triple (`fui:blocks/badge/Badge.ts:87-91`). No emit-locus change reaches it; it must be *migrated* to
read a token family. Which family is a real either/or: the tones (`neutral`/`info`/`success`/`warning`/`error`)
map either to the severity `--tone-*` palette or to raw `--color-*`, and these are different owned models
(`#tone-meta-contract`'s palette-membership test vs plain color tokens) — a component can't read both as its
tone source.

- **(a) Bind badge tones to the `--tone-*` severity palette** (`#tone-meta-contract`,
  `we:docs/agent/platform-decisions.md` ~L1470-1480) — the tones *are* a severity family
  (`neutral·danger·success·warning·info`), which is exactly that palette's membership. **← default.**
  A `ThemeSource` that sets `--tone-*` then re-themes the badge; the shared palette is the DRY layer the
  ruling exists for.
- **(b)** Bind badge tones to raw `--color-*` semantic tokens (`--color-success`, …). *Rejected:* the badge
  tones are a *severity family* that `#tone-meta-contract` already owns; routing them through raw color
  tokens recreates the per-surface hardcoding the palette ruling replaced, and drops the icon/shape metadata
  the tone contract carries.

**Default: (a)** — it lands the badge on the already-ratified severity palette rather than a parallel color
binding, matching how `#categorical-taxonomy`/`#tone-meta-contract` intend cross-surface tone reuse.

Skeptic: **SURVIVES.** The skeptic's fire was on Fork 1's alias-tier ownership, not the badge target; the
`--tone-*` binding is uncontested and traces cleanly to `#tone-meta-contract`'s severity-family membership
(`neutral·danger·success·warning·info`). One caveat: this is a *component-CSS migration* whose theming
only becomes observable once the `--tone-*` values are set on a themed scope — under (b′) that is the FUI
injector's scope-matched co-emit, same path as the card.

## Follow-on build scope (not forks — recorded so the ruling yields agent-ready items)

Under the ruling (Fork 1 = (b′), Fork 2 = (a)), the ruling yields these builds (listed order is execution
sequencing, not a merit ranking): (1) **relocate `LEGACY_ALIASES` into `fui:plugs/webtheme/` and co-emit
the alias tier in `applyTokenVars`** — the scope-matched emit that (b′) rules, and what makes theming at
*any* scope (root or component) work; (2) **close the three untokened card props** — add
`surface-card`/`border-light`/`text-secondary` to `defaultTheme` (`fui:plugs/webtheme/defaultTheme.ts`) +
the single alias source; (3) badge tone→`--tone-*` migration (Fork 2(a)); (4) `#2017`'s loader acceptance
then holds — a manifest `ThemeSource` themes the live `we-card` + `we-badge` once its values reach a scope
element as `--token-*` + the co-emitted alias block. All are `blockedBy` this decision.

## Deferred future capabilities (user-flagged "for later" — not decided here)

Two per-component theming knobs surfaced in discussion, both presupposing scope-level emit ((b′)). Each is
its own future **merit fork**, recorded now so it isn't lost; **not** ratified by this item:

- **F-iso — full theme isolation for a component.** Let a component opt out of the ambient page theme
  entirely (start from a known baseline, ignore inherited `--token-*`/`--<family>-*`). CSS has **no
  wildcard reset** — `all: unset/revert` explicitly excludes custom properties — so "isolate" means
  either (i) the injector re-declares the *complete* token+alias set on the component root (overwrites
  every covered name; uncovered names still leak), or (ii) the covered properties are registered
  `@property { inherits: false }` globally (a token-model-wide change, not per-instance). Fork: which
  mechanism, and is "isolation" a per-instance flag or a component-type trait.
- **F-slot — per-slot theme inheritance control.** For a shadow component, control whether **slotted
  (consumer) light-DOM content** renders under the **component's** theme or the **consumer's** theme —
  **configurable per named slot.** Mechanism: slotted content inherits custom properties through the flat
  tree (its parent is the `<slot>`), so the component *can* force its own theme onto slotted content by
  declaring the token+alias block **on the `<slot>` element**, or *pass through* to the consumer's ambient
  theme by declaring nothing. The knob is per-`<slot>`: emit-on-slot ⇒ component theme wins; leave bare ⇒
  consumer theme flows in. Fork: the authoring surface for that per-slot choice (a slot attribute? a
  manifest field?) and its default (pass-through vs component-owned).

Each is its own future merit fork (F-iso: which isolation mechanism is principled; F-slot: the per-slot
authoring surface + its default). File as `blockedBy` this decision once their forks are framed.
