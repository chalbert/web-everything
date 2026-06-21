---
kind: decision
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
codifiedIn: "docs/agent/platform-decisions.md#standard-consumability"
preparedDate: "2026-06-21"
relatedProject: webisolation
tags: [webisolation, css-isolation, frontierui, native-first, minimize-lock-in, build-transform]
---

# webisolation L2: authoring source-of-truth (the standard `@scope` form) + the lowering seam

Decides the L2 build-transform's two undefined pieces: the **authoring source of truth** FUI blocks write,
and the **lowering seam** that compiles it to run in today's browsers — distributed *bundler-agnostically*
(build / serve / runtime; rspack/webpack/vite/…) so any implementer can adopt the scoped-CSS standard with
their own toolchain. #1349 ratified the *contract* (scoped-CSS is a standard; Layer 1 tracks `@scope
isolated`) + that L2 is transform-primary, but not L2's input or host (surfaced in the #1363 pre-flight,
batch-2026-06-20).

**Reframed 2026-06-21.** Native-first forces the authoring SoT to be the *standard form itself*, not a
tooling format — so the earlier framing ("pick CSS Modules vs vanilla-extract as the authoring format")
was **mis-layered**: those are *lowering engines*, not authoring formats. See *Corrected layering* below;
the superseded framing is kept only as marked audit.

## Corrected layering — three layers, do not conflate

- **Standard / contract (Layer 1, settled #1349):** what scoped CSS *means* — self-styling, selector-out
  isolation, token-DI; native target `@scope isolated` (#11002).
- **Authoring source of truth:** what an FUI block author *writes*. **Native-first forces this to be the
  standard form** (`@scope`-based CSS) — write to the platform, not to a tool. A removable adapter makes it
  run today; when the native form ships, the adapter drops and the authored CSS is unchanged. This is
  minimize-lock-in / graceful-degradation applied to the *authoring* layer, not just runtime.
- **Impl / lowering (L2 build-transform, L3 runtime):** the *make-it-work-in-today's-browser* adapters.
  CSS Modules / vanilla-extract / PostCSS live **here**, as candidate lowering *engines* — never as the
  authoring SoT. The S1 (unique-class) / S2 (shadow) strategy choice is the **already-settled Configurator
  dimension** (#1349/#1365/#1366) exposed to the consumer — i.e. the "more than one valid way we make
  available."

**Why the old framing was wrong (superseded audit, do not re-adopt):** the prior Fork 1 offered "co-located
CSS module (CSS Modules / vanilla-extract)" *as the authoring format*. That promotes an impl mechanism to
the source of truth and locks authors into a tooling convention that is **not** the standard — so when
`@scope isolated` ships you'd still author CSS Modules, never the native form. ~~Fork 1 = pick the authoring
tooling (CSS Modules vs vanilla-extract)~~ → **the authoring SoT is forced to the standard `@scope` form;
tooling engines belong to the lowering seam (Fork 2).**

## Scope — published impl/tooling, contract already settled

Not a WE-standards ruling (the standard part is done). The contract is ratified #1349 and homed #1362
(`we:src/_data/projects/webisolation.json`); the L2 build (#1363) is `locus: frontierui`. But the lowering
is **not FUI-private build config** — it is a *published, bundler-agnostic distribution* that **other
implementers** can adopt to consume the scoped-CSS standard with **their own toolchain** (see Fork 2).
Judged by native-first / minimize-lock-in / minimize-divergence.

L2/S1 delivers **selector-out isolation only**: a machine-generated unique scope class, total inter-view
isolation, zero-runtime, SSR-trivial. **CSS variables stay a shared inherited channel by design**
(token-DI). **In-leak protection is S2/shadow** (a Configurator opt-in), not L2.

## Ground truth (verified 2026-06-21 against `../frontierui`)

- Blocks today author CSS as an exported template string keyed to a `BASE_CLASS` constant — e.g.
  `fui:blocks/button/Button.ts:50` `const BASE_CLASS = 'fui-button'`, `BUTTON_CSS = \`.${BASE_CLASS}{…}\``;
  same in `card`, `badge`, `radio`, `checkbox`, `text-field`, `number-input`, `app-shell`. This is an
  *unratified habit* — it is **not the standard form** and **not statically lowerable** (the `${BASE_CLASS}`
  interpolation needs JS evaluation). The reframe replaces it with the standard `@scope` form regardless.
- Base `@scope {}` is **Baseline (Dec 2025)** and **self-rootable** (prelude-less `@scope {}` scopes to the
  `<style>`'s parent) — but **out-scoping only** (an external `button{}` still matches inside; inherited
  props leak). That out-only behavior **matches L2/S1's guarantee exactly.**
- `@scope isolated` (#11002), the in+out form, has **no spec text yet** (open proposal).
- Token-DI is plain CSS custom properties (`var(--radius-md)`; `we:webtheme/tokens.ts` `cssVarName`).
- No css-modules / vanilla-extract / postcss dependency in `fui:package.json`; Vite ships CSS handling
  built-in.
- Lowering-engine precedent `fui:tools/trait-enforcer/` = pure transform functions + thin per-bundler shims
  over a WE-resident contract — bespoke *only because* trait manifests have no off-the-shelf equivalent.

## Supported by default (not decisions)

- **Authoring SoT = the standard `@scope` form** — forced by native-first; not a fork.
- **Both impl strategies available to the consumer** — S1 (unique-class transform) + S2 (shadow), the
  #1349/#1365/#1366 Configurator dimension. Already settled; this is the "more than one valid way."
- **Token-DI stays the inherited `var(--…)` channel** — shared by design, not isolated.

## Fork 1 — which standard `@scope` form does FUI author *today*?

*Fork-existence:* genuine either/or — FUI commits to **one** canonical authored form, and authoring base
`@scope {}` vs minting a provisional `isolated` syntax cannot both be that single canonical SoT.

- **(a) base `@scope {}` today** (recommended, ~80%) — it is Baseline, self-rooting, and **out-scoping
  only, which is exactly what L2/S1 guarantees**. The L2 transform lowers it to a unique scope class for
  total inter-view isolation (and for browsers without `@scope`); nothing is authored against unspecced
  syntax. The lowering drops when native `@scope` coverage suffices.
- (b) mint a provisional `isolated` syntax ahead of #11002 — *Rejected (revisit on spec).* Invents ahead of
  an unspecced platform proposal (maximize-divergence), and L2/S1 only delivers out-isolation anyway, so a
  provisional `isolated` would have **no L2 impl to back its in-isolation semantics** (that is S2/shadow).
  Revisit when #11002 gains spec text.

**Recommendation: (a), ~80%.** Residual: base `@scope` self-roots off the `<style>`'s DOM position, so the
lowering must synthesize the scope (a generated class on the component root) rather than rely on inline
`<style>` placement — an impl detail for #1363, not a blocker.

## Fork 2 — the lowering seam (engine + timing + bundler distribution)

**Lowering timing is set by how the component is consumed — there is no single valid timing**, so the seam
must serve all three:
- **Static npm package** → the consumer's **build-time** (their bundler's PostCSS step — rspack/webpack/
  vite/…). Zero runtime cost.
- **MaaS (module-as-a-service)** → **serve-time**: the server runs the *same* transform when serving the
  module — build-time *logic* executed per serve. Better than in-browser for MaaS (server controls
  delivery; no FOUC, SSR-fine).
- **No-build / dynamic CSS** → **runtime** in-browser — the **L3 polyfill (#1364)**: at mount, generate the
  unique class, rewrite the stylesheet's rules to it via CSSOM / `adoptedStyleSheets`, add the class to the
  root. Viable, at a runtime/FOUC cost; not SSR-trivial. So the answer to "build-time only?" is **no.**

**The seam is a *distributable* one — built for other implementers, not just FUI.** The scoped-CSS standard
(webisolation) must be adoptable by *any* implementer with *their own* toolchain. Two hard constraints:
- **No bundler lock-in — rspack/webpack/esbuild as first-class as Vite.** A project must consume **FUI's
  uncompiled source with rspack** (or webpack/esbuild), *without Vite*. Vite is one adapter among peers.
- **Uncompiled-source consumption.** FUI ships its blocks' CSS in the authored `@scope` form (Fork 1 (a));
  the consumer's bundler runs the lowering. Nothing forces a pre-compiled FUI bundle or a specific tool.

*Axis hygiene:* three orthogonal axes, all "more than one way exposed to the consumer" — **timing**
(build / serve / runtime) ⟂ **isolation strength** (S1 unique-class / S2 shadow, #1365/#1366 Configurator) ⟂
**bundler** (vite / rspack / webpack / esbuild / rollup). Don't conflate.

**The decisive consequence — one pure, bundler-agnostic core + a published adapter family.** The lowering
core is a pure transform (`CSS in → scoped CSS + class map out`); around it ship **thin per-bundler
adapters (vite, rspack, webpack, esbuild, rollup)** + a serve-time entry + the L3 runtime wrapper. This is
the trait-enforcer distribution shape exactly (`fui:tools/trait-enforcer/` already ships vite/esbuild/
rollup/webpack/parcel shims over one pure core). It is what lets MaaS serve-time and L3 (#1364) reuse the
core instead of forking a second transform, and what lets a non-FUI implementer wire their own bundler.

*Fork-existence:* either/or on the core engine — a bundler-locked engine and a bundler-agnostic one cannot
both be the canonical core.

- **(a) a PostCSS-based pure core + a published per-bundler adapter family** (recommended, ~80%) — PostCSS
  runs under every bundler's pipeline (rspack/webpack/esbuild/vite/rollup) **and** server-side **and** in
  the browser, so one core powers all bundlers and all three timings. Either an off-the-shelf PostCSS
  `@scope`→unique-class plugin or a thin FUI-authored one (still "adopt the mechanism," not a bespoke
  bundler plugin). Satisfies the no-Vite-lock-in + uncompiled-source + other-implementer constraints
  directly.
- (b) Vite's built-in CSS Modules / any bundler-locked engine **as the core** — *Rejected.* Locks consumers
  to Vite, fails the rspack/uncompiled-source requirement, and can't be reused at serve/runtime. Allowed
  only as the *Vite adapter* wrapping the PostCSS core.
- (c) a bespoke from-scratch plugin / standalone codegen — *Rejected.* Reinvents CSS-scoping machinery and
  is usually bundler-locked.

**Placement (per impl-is-not-a-standard, #855, npm-scope):** the **contract + conformance vectors are WE**
(webisolation, settled) — that is what other implementers conform to. The **reference transform + adapter
family is published impl/tooling (FUI-owned, zero-lock-in)** — a tool implementers *may* adopt, never
`@webeverything`. The contract crosses the seam; the tool does not (the #855 generator precedent). Locus
stays `frontierui`, but as a *published, bundler-agnostic distribution*, not FUI-private build config.

**Recommendation: (a), ~80%.** *Which* bundler adapters ship first is prioritization (separately scheduled,
like the trait-enforcer set), not a merit fork — the end-state is the full family. Residual: off-the-shelf
PostCSS `@scope` plugin vs a thin FUI-authored one (~70% on PostCSS specifically; the
bundler-agnostic-pure-core ruling is firmer, ~85%). Earlier lean (Vite built-in CSS Modules) is superseded
— the static-npm / MaaS / no-build / rspack spread demands bundler-portability, which PostCSS has and a
bundler-locked engine does not.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — authored `@scope` form | **(a) base `@scope {}` today** (out-only, matches L2/S1) | (b) mint a provisional `isolated` | ~80% |
| 2 — lowering seam | **(a) bundler-agnostic PostCSS core + published per-bundler adapter family** (vite/rspack/webpack/…, + serve + runtime) | (b) any bundler-locked core | ~80% |

## Red-team

- *Attack on Fork 1 (a):* base `@scope` is out-only — it doesn't honor the contract's in-isolation.
  **Doesn't land** — L2/S1 is *defined* as out-only; in-isolation is S2/shadow. Authoring base `@scope`
  matches L2's actual guarantee; the in-form is deferred to when it is both specced and needed (S2).
- *Attack on Fork 2 (a):* is a full per-bundler adapter family overkill — why not just Vite?
  **Doesn't land** — the requirement is explicit: a project must consume FUI's uncompiled source with
  **rspack, without Vite**, and other implementers adopt the standard with their own toolchain. Cross-bundler
  is the *requirement*, not YAGNI; the pure PostCSS core makes the adapters thin. (Which adapters ship first
  is prioritization, not scope.)
- *Principle check:* native-first ✓ (author to the standard), minimize-lock-in ✓ (the impl is a removable
  adapter), impl-is-not-a-standard ✓ (all FUI impl; the contract lives in webisolation). The reframe
  *strengthens* all three versus the old tooling-format framing.

## Recommended ruling (reframed 2026-06-21 — PENDING RATIFICATION)

- **Authoring SoT = the standard `@scope` form** (forced, native-first) — supersedes the old "pick a
  CSS-Module / vanilla-extract authoring format" framing.
- **Fork 1 (a)** — author base `@scope {}` today (out-only, matches L2/S1) · ~80%
- **Fork 2 (a)** — a pure bundler-agnostic PostCSS core + a published per-bundler adapter family
  (vite/rspack/webpack/esbuild/rollup) + serve-time + L3 runtime, so any implementer consumes FUI's
  uncompiled source with their own bundler (rspack, no Vite); contract + conformance stay WE, the tool is
  FUI-owned and zero-lock-in · ~80%
- **Impl-strategy availability** (S1 unique-class / S2 shadow) = the existing #1365/#1366 Configurator
  dimension, not re-decided here.

The reusable doctrine this instance produced is **codified** as the standing rule
`#standard-consumability` in `we:docs/agent/platform-decisions.md` (the statute layer, #911) — author to the
standard's own form; ship one pure agnostic transform core + removable per-bundler/timing adapters; only the
contract+conformance is the lock. On ratification: record the ruling, `resolve` #1377 with
`--codified-to` pointing at the `#standard-consumability` anchor, and unblock #1363.
