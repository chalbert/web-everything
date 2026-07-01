# Component theme-consumption seam — projection-vocabulary contract & block-CSS migration (#2026)

**Date:** 2026-07-01 · **Kind:** decision prep (no ruling made) · **Item:** `we:backlog/2026-*.md`
**Research topic:** `/research/theme-projection-vocabulary-contract/`

## The problem, grounded

`#2017`'s manifest→`ThemeSource` loader can be built, but its acceptance — *loading a
material-like theme visibly re-themes a live `we-card` + `we-badge`* — is unmeetable, because
**no FUI component consumes the theme runtime.** `grep` for `resolveTheme` / `getRootTheme` /
`ThemeSource` finds zero consumers outside `fui:plugs/webtheme/` itself.

Three vocabularies that do not meet:

| Layer | Vocabulary | Evidence |
|---|---|---|
| FUI runtime **emit** | family-**prefixed** `--token-<family>-<name>` (e.g. `--token-color-border`) | `fui:plugs/webtheme/emitCss.ts:26-30` (`tokenVarName`); `applyTokenVars` sets them on a live element at `:79` |
| FUI card **read** | un-prefixed **semantic** `--color-border`, `--color-surface-card`, `--radius-md`, `--shadow-sm`, `--color-border-light`, `--color-text-secondary` | `fui:blocks/card/Card.ts:90-100` (`CARD_CSS`) |
| FUI badge **read** | **none** — hardcoded hex per tone | `fui:blocks/badge/Badge.ts:87-91` |

So a runtime-injected `ThemeSource` paints `--token-color-*` that no component reads; the card
keeps its literal fallbacks; the badge never moves.

## The headline finding — this is NOT a greenfield vocabulary fork

Two settled facts collapse most of the apparent decision:

1. **The projected vocabulary is already ratified.** `#1886 Fork 2`
   (`we:docs/agent/platform-decisions.md`, the tokenized-base ruling, lines ~1582-1589) blessed
   the FUI card reading `var(--color-border)` / `var(--radius-md)` / `var(--color-surface-card)`
   as *"the tokenized neutral surface, reskinnable by setting tokens."* And
   `we:src/css/style.css`'s own header (lines 1-8) records that every
   `--color-*`/`--radius-*`/`--shadow-*`/`--font-*` site var is now **emitted JS-first from the
   injector** (#1813, ruled #1824), not hand-authored. The *projected names* — semantic
   `--<family>-<name>` — are fixed. `#tokens-js-first` fixes the *canonical* names as
   `--token-*`, the one-way projection.

2. **The semantic-alias bridge already exists and is ratified — but build-only.** `#1824 Fork 2a`
   ships `we:scripts/lib/token-css.mjs`, which emits **both** the canonical `--token-*` resolved
   block **and** a `--<family>-*` alias block (`--color-border: var(--token-color-border)`)
   generated from `we:src/_data/weSiteTheme.js` `LEGACY_ALIASES` (lines 62-82). It is inlined
   pre-paint into the WE-site `<head>` (`we:src/_layouts/base.njk`, `#we-token-css`). **But it runs
   at WE-site build time only.** FUI's runtime `applyTokenVars` (`fui:plugs/webtheme/emitCss.ts:79`)
   paints just `--token-*`, so the alias block does not exist at runtime — a runtime-injected
   `ThemeSource` can't re-theme a live component.

**Consequence for the fork structure:** the item names two questions —
(i) *projection-vocabulary contract* and (ii) *block-CSS migration path*. Grounding shows (i) is
**already answered by statute** for *which names to project* (semantic `--<family>-*`, aliased to
canonical `--token-*`). What remains genuinely open is *where the alias projection runs* (build vs
runtime) and *the badge's zero-consumer migration*. See the item body for the fork classification.

## The three untokened card props — a real coverage gap

`--color-surface-card`, `--color-border-light`, `--color-text-secondary` (read by
`fui:blocks/card/Card.ts:92,95,99-100`) are **absent** from both `LEGACY_ALIASES`
(`we:src/_data/weSiteTheme.js:62-82`) and `defaultTheme` (`fui:plugs/webtheme/defaultTheme.ts:17-27`).
They only ever hit their literal fallbacks — no theme moves them today. Any "re-theme the card"
acceptance must either add these to the token model or migrate the card CSS onto tokened props
(`--color-surface`, `--color-border`).

## The badge is a separate concern

The badge reads **zero** custom properties (`fui:blocks/badge/Badge.ts:87-91`, hardcoded hex).
Re-theming it is a **component-CSS migration** (tokenize its tones onto `--color-*` or the
`--tone-*` palette from `#tone-meta-contract`), not a vocabulary choice. It does not participate in
the vocabulary fork.

## Prior art — the two-tier semantic→component alias is unanimous

| System | Canonical / primitive tier | Component-read / semantic tier |
|---|---|---|
| W3C DTCG | resolved token names (format-only) | downstream CSS transform names it — tool's call |
| Style Dictionary | primitive refs | flat semantic `--color-border`, `--size-radius-medium` |
| Material Web | `--md-sys-color-*` (system) | `--md-<comp>-*` (per-component) |
| Shoelace | `--sl-color-*-500` (scale) | semantic aliases over the scale |
| Adobe Spectrum | `--spectrum-global-*` | `--spectrum-alias-*` / component tokens |

Every mature system ships an explicit semantic-alias tier the components read, aliased onto a
canonical resolved family. WE's `--token-*` (canonical) + `--<family>-*` (semantic alias) is
exactly this shape — the only question is *runtime emit vs build-only emit*. The `#751`/#930
DTCG→`--wb-*` mapping (`fui:workbench/manifestBridge.ts:1-40`, "ruled by #930-A" — a backlog
decision, **not** a platform-decisions anchor) is the *same alias step* but
**workbench-demo-scoped** (its `--wb-*` names never cross the WE boundary), so it does not decide
the real component seam.

## Owning statute (standard-layer grounding)

- `#tokens-js-first` — injector is the runtime SoT; `--token-*` is the one-way JS→CSS projection.
- `#1886 Fork 2` — the semantic `--<family>-*` is the ratified reskinnable base the card reads.
- `#1824 Fork 2a` — the `--<family>-*`↔`--token-*` alias bridge is ratified (build transport today).
- `#config-extends-platform-default` — token *values* are a project config extending the platform default.

No ungrounded mapping: every projected name traces to `#tokens-js-first` + `#1886`; the alias
mechanism traces to `#1824`.

## Skeptic pass — flipped Fork 1's default

A throwaway skeptic sub-agent was run against the recommended defaults (classification / merit /
statute-overlap / citation-scope). It **refuted the original Fork 1 default (b) "lift the alias
projection into FUI runtime emit"** on three tree-grounded axes, and the default was flipped to
**(c) defer the runtime alias / fix the coverage gap first**:

- **Citation-scope (REFUTED).** `#1824` is *explicitly* build-transport / website-local —
  `we:scripts/lib/token-css.mjs`'s own header calls it "the build transport… website-local, no
  general-standard change… does not touch FUI's `emitTokenCss` shape… a precedent pattern, not
  statute." `#1886 Fork 2` is the build-cascade base. Neither ruling reaches the runtime
  `applyTokenVars` inline-style path — so (b) mints *unratified* scope, it is not "already
  statute-fixed."
- **Merit (REFUTED as premature).** Nothing consumes the runtime path: `applyTokenVars` is only
  re-exported (`fui:plugs/webtheme/index.ts:18`); no card/badge flow calls it against a scoped
  subtree. So (b) chases a consumer that does not exist (the "knob ahead of a consumer"
  anti-pattern) and doubles the inline custom-property count per paint, while the *actual* blocker —
  the three untokened card props absent from `LEGACY_ALIASES` and `defaultTheme` — sits untouched.
  (var-to-var aliasing itself *does* resolve via `el.style.setProperty`, so (b) is not broken, just
  scope-creep.)
- **Statute-overlap (SURVIVES-WITH-AMENDMENT).** `#tokens-js-first`'s "CSS vars are never
  hand-authored in parallel / single source" rule bites (b): the alias tier is a *second*
  projection, tolerated build-side by `#1824` but promoted to the platform runtime by (b). If a
  runtime alias is ever built, it must derive from the one `LEGACY_ALIASES` source, never be
  hand-authored in the emitter.
- **Classification (SURVIVES-WITH-AMENDMENT).** The vocabulary-fork *dissolution* holds (the
  projected names are statute-fixed). The amendment is the default flip above, redirecting the work
  to the coverage gap.

The `#930-A` label in the item prompt is the `#751`/#930 workbench-manifest **backlog decision**
(`fui:workbench/manifestBridge.ts:2`), not a platform-decisions statute anchor — workbench-demo
scoped, does not reach this seam. Fork 2's `--tone-*` default was uncontested and **survives**.
