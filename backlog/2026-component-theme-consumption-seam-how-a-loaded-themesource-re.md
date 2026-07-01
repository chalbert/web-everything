---
kind: decision
status: active
preparedDate: "2026-07-01"
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: []
relatedReport: reports/2026-07-01-2026-theme-consumption-seam.md
---

# Component theme-consumption seam: how a loaded ThemeSource re-themes live FUI components

`#2017` pre-flight surfaced this. The manifest→`ThemeSource` loader can be built, but its acceptance
(loading a material-like theme *visibly re-themes a live `we-card` + `we-badge`*) is unmeetable:
`grep` finds **zero** consumers of `resolveTheme`/`getRootTheme`/`ThemeSource` outside
`fui:plugs/webtheme/` itself. Three vocabularies don't meet — FUI **emits** family-prefixed
`--token-<family>-<name>` (`fui:plugs/webtheme/emitCss.ts:26-30`, `applyTokenVars` at `:79`); the card
**reads** un-prefixed semantic `--color-border` / `--color-surface-card` / `--radius-md` / `--shadow-sm`
(`fui:blocks/card/Card.ts:90-100`); the badge reads **nothing** — hardcoded hex per tone
(`fui:blocks/badge/Badge.ts:87-91`). So a runtime-injected `ThemeSource` paints `--token-color-*` that
no component reads. This item decides the projection-vocabulary contract and the block-CSS migration
path. Full grounding + prior-art survey: `we:reports/2026-07-01-2026-theme-consumption-seam.md` and
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
2. **Where the semantic-alias projection runs (build-only vs runtime)** — **genuine fork (Fork 1).** The
   ratified alias bridge is build-time transport; a runtime `ThemeSource` needs the same aliases emitted
   at runtime. Two coherent implementations exist; only one can be the platform default emit path.
3. **How the badge (zero custom-prop reader) gets themed** — **genuine fork (Fork 2)**, but a
   *component-CSS migration* question (which token family its tones bind to), not a vocabulary question.
4. **The three untokened card props** — **not a fork:** a coverage gap with one obvious fix (add to the
   token model, or migrate the card CSS onto tokened props). Support-both is meaningless here. Recorded
   as follow-on build scope, not a ratifiable branch.

## Recommended path at a glance

| Concern | Classification | Recommended default |
|---|---|---|
| Projection vocabulary | statute-settled (not a fork) | Semantic `--<family>-*` aliased to canonical `--token-*` (`#1886`/`#1824`) |
| **Fork 1 — alias emit locus** | real fork | **(c) Keep the alias build-only for now; defer runtime-alias emit until a live runtime-`ThemeSource` consumer exists.** Fix the coverage gap first (below) — that, not emit locus, is what blocks `#2017` |
| **Fork 2 — badge theming** | real fork (component-CSS migration) | **(a) Tokenize badge tones onto the `--tone-*` palette** (`#tone-meta-contract`), so a `ThemeSource` moves it |
| Coverage gap (the real blocker) | not a fork (build scope) | Add `surface-card`/`border-light`/`text-secondary` to `defaultTheme` + the alias map (or migrate card CSS onto `--color-surface`/`--color-border`) |

## Fork 1 — where the semantic-alias projection runs (build-only vs runtime emit)

**Fork-existence justification:** the branches genuinely cannot coexist as *the* platform emit path —
the ratified alias bridge lives **only** in the WE-site build (`we:scripts/lib/token-css.mjs`), so a
runtime-injected `ThemeSource` (`fui:plugs/webtheme/emitCss.ts:79` `applyTokenVars`) paints `--token-*`
alone and no component with `var(--color-border)` reads updates. Something must emit the alias tier at
runtime, or every component read must change. These are mutually exclusive end-states for one emit path.

Crux: `#1886 Fork 2` (card reads `var(--color-border)`) + `#1824` (the alias bridge) were both ratified
against the **build-time `:root` cascade** — `#1824`'s own transport header scopes it "website-local, no
general-standard change… does **not** touch FUI's `emitTokenCss` shape" and calls it "a precedent pattern,
not statute." Neither ruling extends to the **runtime `applyTokenVars` inline-style** path, which today
emits only `--token-*` (`fui:plugs/webtheme/emitCss.ts:71-80`). **And there is no live consumer of that
runtime path:** `applyTokenVars` is only re-exported (`fui:plugs/webtheme/index.ts:18`); nothing in the
card/badge flow calls it against a scoped subtree, and `#1824` labels it "the runtime FOUC path."

- **(a)** Leave the alias emit build-only; **migrate every component CSS onto `var(--token-*)`** (rename
  `--color-border`→`--token-color-border` etc.). *Rejected:* discards the `#1886`-ratified card spelling,
  churns the 600+ `--<family>-*` call sites the `#1824` header explicitly deferred, and re-opens a settled
  ruling.
- **(b)** Lift the alias projection into FUI's runtime `emitCss`/`applyTokenVars` now — emit **both**
  `--token-<family>-<name>` **and** the `--<family>-<name>` alias tier from the one `ThemeSource`. *Rejected
  (was the pre-skeptic default):* this **mints unratified scope** — it promotes a website-scoped build bridge
  (`#1824`, explicitly "does not touch FUI's emit shape") into the *platform runtime* emit, chasing a
  runtime-`ThemeSource` consumer **that does not exist in code** (the "add a knob ahead of a consumer"
  anti-pattern), and doubles the inline custom-property count per paint. It also delivers only *partial*
  theming while the three untokened card props stay on literal fallbacks.
- **(c) Keep the alias build-only; defer the runtime-alias emit until a real runtime-`ThemeSource` consumer
  exists — and fix the coverage gap first.** The `#2017` acceptance is blocked by the *missing token rows*
  (`--color-surface-card` etc.), not by emit locus: once those rows exist and the card is themed through the
  build cascade (or a demo that sets `--token-*` + the alias block on a scope root), the acceptance is
  meetable without minting a platform-runtime alias emit. If/when a genuine runtime-injected-scope consumer
  is filed, the runtime alias emit is a *separately-filed* capability — and even then the alias **must derive
  from the one `LEGACY_ALIASES` source**, never be hand-authored in the emitter (the `#tokens-js-first`
  no-parallel-projection rule). **← default.**

**Default: (c)** — support-both-by-deferral. The build alias path stays as ratified; the runtime alias path
is not built ahead of a consumer. This respects `#1824`'s explicit "not statute / does not touch FUI emit"
scope and `#tokens-js-first`'s single-source rule, and redirects the real work to the coverage gap that
actually blocks `#2017`. (Technical aside: var-to-var aliasing `--color-border: var(--token-color-border)`
*does* resolve whether set in a `:root` block or via `el.style.setProperty` — so (b) is not *broken*, just
premature scope-creep.)

Sub-decision (only if a runtime consumer later un-gates (b)): the alias map is **FUI-owned** — move
`LEGACY_ALIASES` into `fui:plugs/webtheme/` so build + runtime share one source; a pure naming convention
(`--token-<f>-<n>` ⇒ `--<f>-<n>`) would mis-map the non-mechanical names (`--color-bg`, `--font-sans`).

Skeptic: **SURVIVES-WITH-AMENDMENT → default flipped (b)→(c).** The skeptic refuted (b) on three grounds,
all traced to the tree: `#1824` is *explicitly* build-transport / website-local and disclaims touching FUI's
emit shape (so (b) is unratified scope-creep, not "already statute-fixed"); nothing calls `applyTokenVars`
against a live scope (`fui:plugs/webtheme/index.ts:18` re-export only — no consumer); and the actual blocker
is the coverage gap, not emit locus. Vocabulary-fork *dissolution* survived. (The `#930-A` reference is the
`#751`/#930 workbench-manifest decision — `fui:workbench/manifestBridge.ts:2` — a backlog ruling, **not** a
platform-decisions anchor; it is workbench-demo scoped and does not reach this seam either way.)

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

Skeptic: **SURVIVES.** The skeptic's fire was on Fork 1's emit locus, not the badge target; the
`--tone-*` binding is uncontested and traces cleanly to `#tone-meta-contract`'s severity-family membership
(`neutral·danger·success·warning·info`). One inherited caveat: like Fork 1, this is a *component-CSS
migration* whose theming only becomes observable once the `--tone-*` values are actually set (build cascade
or a scope root) — so it is build scope gated on the same "themed through the cascade" path as the card, not
on a runtime-`ThemeSource` emit.

## Follow-on build scope (not forks — recorded so the ruling yields agent-ready items)

Under the flipped defaults (Fork 1 = (c) defer runtime alias, Fork 2 = (a) tone palette), the builds chain
**coverage-gap-first**: (1) **close the three untokened card props** — add `surface-card`/`border-light`/
`text-secondary` to `defaultTheme` (`fui:plugs/webtheme/defaultTheme.ts`) + the alias map (`LEGACY_ALIASES`,
`we:src/_data/weSiteTheme.js`); (2) badge tone→`--tone-*` migration (Fork 2(a)); (3) then `#2017`'s loader
acceptance becomes meetable *through the build/cascade path* — a manifest `ThemeSource` themes the live
`we-card` + `we-badge` once its values reach a scope root as `--token-*` + the alias block. The **runtime
alias emit** (former Fork 1(b)) is **not** in this chain — it is a *separately-filed* capability, opened only
if/when a genuine runtime-injected-scope consumer of `applyTokenVars` is filed. These are `blockedBy` this
decision.
