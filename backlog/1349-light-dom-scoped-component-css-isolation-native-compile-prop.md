---
kind: decision
status: resolved
blockedBy: []
dateOpened: "2026-06-20"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-20"
relatedProject: webregistries
relatedReport: reports/2026-06-20-scoped-component-css-isolation.md
tags: [scoped-components, css-isolation, native-first, polyfill, proposal, webregistries]
---

# Light-DOM scoped-component CSS isolation: native-compile proposal + transform/polyfill impls

**Prepared 2026-06-20.** No design existed yet; the forks below are grounded in a prior-art survey of CSS
`@scope` / `<style scoped>` / scoped-CSS transforms / constructable stylesheets / scoped custom element
registries, **published as `/research/scoped-component-css-isolation/`** (session report:
`we:reports/2026-06-20-scoped-component-css-isolation.md`). Each fork carries a **bold** recommended
default. The survey reshaped the item: the five "open questions" it opened with collapse to **two genuine
forks** — the other three are *supported by default* (see below), and the survey added the decisive finding
that **the platform already has a live standards effort matching Layer 1** (csswg-drafts #11002
`@scope isolated`), which turns the "invent a proposal form" fork into "track the live work."

## Axis framing

The #854 scoped-component model has two halves; only **identity** isolation is built (same tag → different
impl per view: `we:plugs/webregistries/declarativeRegistry.ts:39,45`; `attachShadow({ customElementRegistry })`
patched at `we:plugs/webregistries/index.ts:88`). Its **style** isolation is implicit and unimplemented — a
grep of both repos returns **zero** CSS-isolation runtime (`adoptedStyleSheets`/`CSSStyleSheet`/`@scope`:
no hits). FUI blocks style themselves with ad-hoc global classes + `var(--…)` tokens
(`fui:blocks/button/Button.ts:114`, `fui:blocks/card/Card.ts:89`, `fui:blocks/badge/Badge.ts:78`); the
token-DI surface lives in `we:webtheme/tokens.ts:93`. The consumer's hard requirement is **self-styling** —
"a button must style itself without knowing its parent … forbids `.toolbar button[variant]` and
`@scope (.parent)`" (`we:backlog/1321:97-103`).

This item specifies the missing isolation mechanism as **one fixed contract** (self-referential rules +
token DI, system-delivered scope-keying — *not a fork*) realized by **one Layer-1 native-compile proposal**
and **two impl layers** (build-transform, runtime polyfill). The survey decomposed the concern into the
axes that actually carry a choice — **(1) which native proposal Layer 1 tracks** and **(2) where the
standard lives** — and showed the remaining three ("default strategy", "transform vs polyfill primacy",
"token-DI interplay") have no excluded branch, so they are *supported by default*, not decisions.

## Recommended path at a glance

| Fork | Options | Recommended default | Confidence |
|---|---|---|---|
| 1 — Layer-1 proposal form | (a) track csswg-drafts #11002 `@scope isolated` · (b) mint a bespoke WE form (`<style scoped>` revival / `style-isolation` property) | **(a)** track #11002 | ~80% |
| 2 — placement | (a) own plug (style-isolation standard) · (b) fold into webregistries | **(a)** own plug | ~70% |

## Fork 1 — what native primitive does the Layer-1 proposal track?

*Fork-existence:* genuine either/or — WE publishes **one** canonical Layer-1 aspirational form, and the two
branches are mutually exclusive *as that single canonical proposal* (you cannot have the canonical proposal
be both "the existing `@scope isolated` work" and "a new WE-minted property"). The excluded branch under (a)
is "mint our own form"; under (b) it is "defer to the platform's in-flight design." Both are coherent on
their face, so this is a real choice, not a support-both.

**Crux (grounded):** the gap is *shadow-grade isolation (block in-leak AND out-leak) of a light-DOM subtree
without a shadow root*. The survey found **no shipping native primitive** for it — `@scope` (Baseline Dec
2025) is **out-scoping only** (an external `button {}` still matches inside a scope; inherited props leak
through the donut) — **but** it found one live standards effort that targets exactly this:
**csswg-drafts [#11002](https://github.com/w3c/csswg-drafts/issues/11002) `@scope isolated`** (an `isolate`
keyword blocking the inbound cascade; open, no spec text). `@scope` is already self-rootable (prelude-less
`@scope {}` scopes to the `<style>`'s parent), so it honors self-styling.

- **(a) Track csswg #11002 `@scope isolated` (recommended, ~80%).** Frame Layer 1 as *conformance to /
  tracking of* the live `@scope isolated` proposal — WE's contract is "what `@scope isolated` will
  guarantee," and the L2/L3 impls are conformant polyfills of it (dropped when it ships). This is the
  native-first + minimize-divergence move: don't fork the platform when the platform is already building
  the thing. Grounded in: the #11002 thread, the `@scope` self-root capability, and the dead-ends below.
- **(b) Mint a bespoke WE form — revived `<style scoped>` or a `style-isolation: scoped` property.**
  *Rejected.* `<style scoped>` was Firefox-only and **removed ~2016** for lack of vendor interest (revival
  thread #3547 is considered superseded by `@scope`); a `style-isolation` property **collides** with the
  existing CSS `isolation` property (stacking contexts) and duplicates #11002's in-flight design. Minting a
  competing form maximizes divergence for no interop gain.

*Red-team note for the deciding turn:* the strongest attack on (a) is timing — #11002 has **no spec text**
and may stall or change shape, so "tracking" a moving target is risky. The default answer: WE's Layer-1
*contract* (the in+out isolation guarantee) is stable regardless of the eventual syntax; tracking #11002
means citing it as the seam and shaping the contract to its semantics, **not** blocking on it — the L2/L3
impls ship today either way. The residual ~20% is that #11002 could be abandoned, in which case WE's
contract becomes a genuine standalone proposal (a graceful fallback, not a re-decision). Flag this fork for
the decider's skeptic sub-pass.

## Fork 2 — where does the standard live?

*Fork-existence:* genuine either/or — the standard has **one** home; own-plug and fold-into-webregistries
are mutually exclusive placements. The excluded branch under (a) is "co-locate with identity isolation";
under (b) it is "give style isolation its own composable home." Both are coherent (there's a real cohesion
argument for (b)), so this is a real choice.

- **(a) Own plug — a style-isolation standard (recommended, ~70%).** Style isolation **recurs independently**
  of identity isolation (a light-DOM component can want isolated styles with no scoped registry at all) and
  of tokens (`webtheme` is the DI surface it *consumes*, not the same concern). The standing
  separate-and-decouple bias puts the burden of proof on combining; a concept that recurs without its
  neighbour earns its own home. Grounded in: `we:plugs/webregistries/` (identity only — no style code) and
  `we:webtheme/tokens.ts:93` (tokens are a separate plug it reads). **Default plug name:**
  **`webisolation`** (the contract is *style isolation*; reads cleanly alongside `webregistries`/`webtheme`
  and names the guarantee, not a mechanism — unlike `webstyles`, which collides with `webtheme`'s token
  styling). Name is a sub-decision, low-stakes — see below.
- **(b) Fold into webregistries.** *Coherent counter, not recommended.* webregistries **is** the
  scoped-component system and this completes its other half, so co-location maximizes cohesion of "the
  scoped-component story." Rejected because it couples a reusable style concern to the identity registry it
  doesn't depend on — a light-DOM component wanting isolated styles would then have to pull in the registry
  plug. (Folding into `webtheme` is a non-starter: theme is token DI, isolation is cascade boundary — two
  different concerns.)

*Sub-decision (name, if (a)):* **`webisolation`** default; alternatives `webscope` (pairs with the `@scope`
primitive it polyfills) / `webstyles` (rejected — collides with `webtheme`). Low-stakes; the deciding turn
can ratify or rename in one line.

*Red-team note:* the strongest attack on (a) is that style isolation and identity isolation are *always*
used together in the #854 model, so the "recurs independently" claim is thin in practice. The default
answer: they compose but don't *depend* — the Layer-1 contract is meaningful for any light-DOM component,
and #854 already imports plugs it composes rather than absorbing them. Residual ~30% is genuine cohesion
preference; flag for the skeptic sub-pass.

---

## Ruling — ratified 2026-06-21

Both forks ratified at their prepared defaults; all three pass-0 dissolutions stand (support-both, no excluded branch). The red-team landed on neither default.

- **Fork 1 → (a) track csswg-drafts #11002 `@scope isolated` (~80%).** Layer 1 is framed as *conformance to / tracking of* the live `@scope isolated` work — WE's contract is the stable in+out isolation guarantee; #11002 is cited as the seam, **not** blocked on (no spec text yet, L2/L3 impls ship regardless). Bespoke forms (`<style scoped>`, a `style-isolation` property) rejected as max-divergence/zero-interop. Residual ~20%: #11002 is abandoned → WE's contract gracefully becomes a standalone proposal (a fallback, not a re-decision).
- **Fork 2 → (a) own plug, named `webisolation` (~70%).** Style isolation recurs independently of identity isolation (a light-DOM component can want isolated styles with no scoped registry) and consumes `webtheme` tokens rather than being them; separate-and-decouple bias + #854's compose-don't-absorb precedent carry it over folding into webregistries. Name `webisolation` (names the *guarantee*, impl-swappable) over `webscope` (pairs with the `@scope` mechanism). Residual ~30%: genuine cohesion preference for folding.

**Graduation — build chain spun out** (composition order, `blockedBy` chain):
- #1362 — webisolation contract + Layer-1 proposal doc (blockedBy #1349)
- #1363 — L2 build-transform impl (blockedBy #1362)
- #1364 — L3 runtime polyfill (blockedBy #1363)
- #1365 — isolation-strategy (S1/S2) platform-config schema (blockedBy #1364)
- #1366 — plateau Configurator card for S1/S2 (blockedBy #1365)

## Context

### The contract (fixed invariant, not a fork)

A scoped component's styling is **self-contained**: self-referential rules (`[variant]` /
`:host([variant])`) + **token DI** (custom properties read source-blind), **never** ancestor-coupled. The
**system** — not the author — delivers per-scope isolation; any scope-keying is machine-generated
(self-styling, #1321 requirement 3). Every impl below conforms to this one contract. This is a **ratify**
(forced invariant), not a weigh.

### Supported by default (dissolved on pass-0 — not decisions)

These three opened as "forks" but have no excluded branch — each is a *both-are-legitimate* dimension, so
WE supports both and the only knob is a flavor/ordering default:

1. **Strategy S1 vs S2.** Both are conformant impls of the Layer-1 contract:
   - **S1 — unique-class light DOM** (transform/polyfill keys CSS to a unique scope class): native a11y
     **free**, no shadow, total inter-view isolation, **not** immune to external hostile CSS.
   - **S2 — shadow-per-component** (`:host([variant])` in a shadow root): immune to everything, at the
     cost of re-forwarding native `<button>` form/label participation via **ElementInternals**.
   Both give total inter-view isolation + per-view override; they differ only on external-CSS immunity vs
   native-a11y-free. This is a **behavioral, per-deployment** dimension → **Configurator-selected**, with a
   **flavor default of S1** (the native-first floor; restriction is the author's opt-in). *Soft /
   revisitable* per the monetization-grade treatment (tune with data; the structural partition — "strategy
   is a deployment dimension, not a WE mandate" — is firm, the specific default is provisional).
2. **Transform (L2) vs polyfill (L3) primacy.** Both ship as conformant impls. Default **transform-primary**
   (zero-runtime, SSR-trivial, native a11y intact — vanilla-extract/CSS-Modules pattern), **polyfill the
   fallback** for no-build-step / dynamically-scoped cases (runtime unique-class + constructable
   `adoptedStyleSheets`, Baseline since Mar 2023). No excluded branch — a build/ordering default, not a pick.
3. **Token-DI interplay.** *Confirmed invariant:* custom properties **inherit across the shadow boundary**,
   so even S2 keeps token DI. No fork — a verification that resolved green.

### At graduation

Per the prepared-fork-shape rules, ratification spins out:
- A **Technical Configurator** card for the **isolation strategy** (S1/S2) — a per-deployment platform value
  (plateau-app; add a domain via seed + provider entry). The platform-config **schema** ships with the
  standard; the Configurator UI is its own card.
- Build slices via a `blockedBy` chain in composition order: the contract + Layer-1 proposal doc → the L2
  transform → the L3 polyfill → the Configurator schema.

### Cross-references

- #854 — the scoped-registry (identity isolation) this completes the styling half of.
- #1321 — the button-variant consumer that surfaced this; `blockedBy` this item.
- #1318 — the ratified `variant` axis the consumer packages.
- csswg-drafts #11002 — the live `@scope isolated` standards effort Fork 1(a) tracks.
