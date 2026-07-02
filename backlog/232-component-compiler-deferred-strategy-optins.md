---
kind: epic
parent: "125"
status: open
dateOpened: "2026-06-09"
dateStarted: "2026-07-02"
preparedDate: "2026-07-01"
tags: [component, adapters, compiler, build-tooling, strategy-axis, deferred, swc, tsc]
relatedReport: reports/2026-07-01-component-compiler-deferred-optins-standing-test.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Deferred `<component>` compiler strategy opt-ins (umbrella)

**Epic (re-typed 2026-06-22 — was mis-filed `kind: decision`; standing test re-run with prior-art
grounding 2026-07-01): no fork exists among the three carved opt-ins.** #127 settled the compiler's toolchain reach as
**configurable strategy axes** with native-first defaults (the
[component-dc](docs/agent/platform-decisions.md#component-dc) cluster); **#231** shipped the
top-2-per-axis baseline. Each opt-in below joins a **different** axis, is additive, and breaks
nothing — *support-all*, not branches of a fork. "Which to build / on what trigger" is pure
prioritisation, and a fork is never a prioritisation tool. The 2026-06-22 re-type asserted this;
the `/prepare` pass grounded it against shipping prior art
([/research/component-compiler-deferred-optins-standing-test/](/research/component-compiler-deferred-optins-standing-test/)):
the composability probe **passes** — Vue stacks the analogous three knobs simultaneously (`.vue`
SFC files + `@vitejs/plugin-vue`/unplugin toolchain integrations + `vue-tsc`), proving
source-surface, toolchain-depth, and `tsc`-support are independent composable axes, never an
either/or.

*Skeptic: SURVIVES-WITH-AMENDMENT — the throwaway skeptic's strongest attack ("the SWC plugin's
Rust re-implementation forks the single-kernel architecture; byte-identical output is an unratified
forced invariant") was defeated by
[surface-contract-not-computation](docs/agent/platform-decisions.md#surface-contract-not-computation)
(a second provider of the same lowering contract is a swappable strategy, not a fork branch; the
equivalence-bar question only materializes when a second kernel exists, and #1629's `maturityGated`
trigger already carries it); statute-overlap and citation-scope attacks failed (#127 names all three
deferrals verbatim; config-extends-platform-default composes with, not against, the axes). The
amendment folded in: the "nothing to ratify" claim is scoped to the three carved opt-ins, and the
arbitrary-string-scanning residual's standing-test outcome is no longer pre-classified — see
Residual scope below.*

*Screen: clear — fresh-context two-confusion screen (#2091), both subjects. (1) The support-all
verdict rules on consumer-visible axes (authoring surfaces / toolchain integrations / `tsc`
support), and the one internal question (Rust re-impl vs shared JS kernel) is correctly held on the
impl side of the boundary; under the free-build hypothetical no merit fork remains — supporting all
axes is strictly better, so "ruling + separately-prioritized builds" is the right dissolution, with
#1629's parking labelled as cost + demand trigger, not a fork branch. (2) The residual-scope
treatment is also clear: the match rule is boundary-observable (false-positive lowering changes
consumer output), a real merit question remains, and the item correctly defers the work, not the
ruling, by refusing to pre-classify the carve-time child.*

## Supported by default — the axis opt-ins (each additive, no breakage)

- **#1628 — `.component` dedicated-file surface** (source-surface axis) — **resolved 2026-06-27**.
  SFC-style file holding one `<component>`; Vue `.vue` / Svelte `.svelte` / Astro `.astro` prove a
  dedicated extension is an *additive* authoring surface, never forced. Shipped in
  `fui:compiler/src/component-transform/surfaces.ts` (opt-in, outside the native-first `['html']`
  default).
- **#1629 — per-bundler-native integration** (toolchain-depth axis) — **parked `maturityGated`**.
  Rust/WASM **SWC** plugin for Next/Turbopack. The survey validated the parking independently: an
  SWC WASM plugin runs inside SWC's Rust pipeline on the SWC AST, so the lowering must be
  re-implemented in Rust (it cannot wrap the shared JS `compile()` kernel) and carries a
  `swc_core` ABI-pinning maintenance tax — a **cost** finding, not a fork; un-gate trigger stays "a
  real heavy-SWC/Next/Turbopack `<component>` consumer".
- **#1630 — `tsc`-only custom-transformer** (`tsc`-support axis) — **resolved 2026-06-27**. Real
  `<component>` lowering for bundler-refusing projects. Survey delta folded in: vanilla `tsc` has
  no official transformer hook (microsoft/TypeScript#54276 unshipped), `ttypescript` is
  **deprecated** (TS < 5 only) — **`ts-patch` is the maintained path**, and the shipped
  `fui:compiler/src/component-transform/ts-transformer.ts` re-wraps the same shared `compile()`
  core.

## Residual scope (uncarved — carve as a child when picked up)

- **Arbitrary-string scanning** (source-surface axis): #231 kept the `.html`/tagged-template match
  rule statically analyzable (a bare JSX `<component>` outside an `` html`…` `` tag is intentionally
  unmatched) and deferred arbitrary-string scanning to this umbrella. Its *axis membership* is the
  same as the rest (additive, opt-in, breaks nothing at defaults) — but its **standing-test outcome
  is deliberately not pre-classified here**: no prior-art probe covered it, and shipping precedent
  uniformly *anchors* matching (extension / tag) precisely because unanchored scanning risks
  false-positive lowering of string *data* — an observable correctness question. So the carve-time
  child must run its own standing test and may legitimately be `kind: decision` on its
  match-rule/annotation design. It has no child item yet; scaffold one under this epic when picked
  up. This uncarved slice is why the epic stays open even though all carved children are terminal.

## Notes

- None of these block #231 — each is an additive opt-in on an axis #231 establishes.
- The config-surface question (a Technical Configurator domain that selects strategies, data-driven) lives in
  **#150** (the [project-protocol-bar](docs/agent/platform-decisions.md#project-protocol-bar) rule), not here.
- Sibling to #227 (the [config-extends-platform-default](docs/agent/platform-decisions.md#config-extends-platform-default) rule; auto-define strategy axis), which has its own deferred-strategy space.
- Prep session report:
  [we:reports/2026-07-01-component-compiler-deferred-optins-standing-test.md](reports/2026-07-01-component-compiler-deferred-optins-standing-test.md);
  prior integration report kept exposed via the children's `relatedReport`
  ([we:reports/2026-06-06-adapter-real-project-integration.md](reports/2026-06-06-adapter-real-project-integration.md)).
