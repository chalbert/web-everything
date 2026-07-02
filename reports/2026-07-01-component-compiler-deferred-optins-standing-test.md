# Deferred `<component>` compiler opt-ins — standing-test re-run + prior-art grounding (#232 prep)

**Session:** `/prepare 232` (2026-07-01). **Verdict up front:** the standing test holds — **no fork
exists among the three carved opt-ins**. All three are
**support-all, additive opt-ins on orthogonal strategy axes** over the one shared lowering kernel.
(The uncarved arbitrary-string-scanning residual was **not probed** by this survey — its child
re-runs the standing test at carve time and may legitimately be a real decision.)
The composability probe **passes** against shipping prior art. The item stays `kind: epic` (re-typed
from `decision` 2026-06-22 — that re-type was correct); the prep contribution is the prior-art
grounding the 2026-06-22 assertion never had, plus two concrete deltas folded into the item.

## What was tested

#232 collects the opt-ins deferred out of #231 (which shipped the top-2-per-axis baseline of the
#127 "configurable strategy axes" ruling — the
[component-dc](../docs/agent/platform-decisions.md#component-dc) cluster). Three carved children,
one uncarved residual:

| Concern | Axis | Child | State |
|---|---|---|---|
| `.component` dedicated-file SFC surface | source-surface | #1628 | resolved 2026-06-27 — `fui:compiler/src/component-transform/surfaces.ts` |
| Rust/WASM SWC plugin (Next/Turbopack) | toolchain-depth | #1629 | parked `maturityGated` (no heavy-SWC consumer to validate against) |
| `ts-patch`/`ttypescript` transformer | `tsc`-support | #1630 | resolved 2026-06-27 — `fui:compiler/src/component-transform/ts-transformer.ts` |
| arbitrary-string scanning | source-surface | — | uncarved (named in #231 as "deferred to #232"; no child yet) |

The fork-existence question: is any pair of these mutually exclusive (a genuine either/or), or is
any single one a forced invariant with a broken alternative? If neither, there is no decision here.

## Prior-art survey findings (web, 2026-07-01)

**A — SFC dedicated-file surfaces are additive, never forced.** Vue states SFCs are optional — one
authoring form among plain-JS objects, inline templates, and render functions ("Vue can still be
used via plain JavaScript without a build step"); Astro renders `.astro` files alongside
React/Vue/Svelte island components; Svelte's `.svelte` is a compiler input surface, not a
replacement of the component model. A dedicated extension coexists with other surfaces atop one
compile pipeline. Sources: <https://vuejs.org/guide/scaling-up/sfc.html>,
<https://vuejs.org/api/sfc-spec>, <https://docs.astro.build/en/basics/astro-components/>.

**B — SWC WASM plugins run inside the Rust pipeline and cannot reuse a JS kernel.** An SWC
ecmascript plugin implements Rust `VisitMut` over the SWC AST (host serializes the AST to the WASM
runtime and back), so the `<component>` lowering would have to be **re-implemented in Rust** — it
cannot wrap the shared JS `compile()` core the way every other integration does. Plugins have
historically been ABI-pinned to `swc_core` versions (eased post-`@swc/core` v1.15.0 via CBOR +
`Unknown` enum arms, but only for plugins on `swc_core >= 47`), and Turbopack + SWC-plugin
integration remains rough (WASM fallback bindings don't support Turbopack). Sources:
<https://swc.rs/docs/plugin/ecmascript/getting-started>,
<https://swc.rs/docs/plugin/ecmascript/compatibility>,
<https://blog.swc.rs/2025-11-4-wasm-backward-compatibility>,
<https://nextjs.org/docs/architecture/nextjs-compiler>. This is a **cost/maturity finding, not a
fork**: enabling the SWC path excludes nothing; it duplicates the kernel's behaviour at a deeper
integration point. It squarely validates #1629's `maturityGated` parking (build-now-yields-worse
with no consumer to prove byte-identity against).

**C — vanilla `tsc` has no custom-transformer hook; ts-patch is the maintained filler.**
TypeScript's transformer API is programmatic-only; `tsconfig` `plugins` feeds only the language
service, and the official transformer-plugin proposal (microsoft/TypeScript#54276) is unshipped. So
the gap #1630 fills is real and only third-party-fillable. **Delta:** `ttypescript` is deprecated
(TS < 5 only); **ts-patch** is the maintained successor and does real emit-time source lowering —
the shipped `fui:compiler/src/component-transform/ts-transformer.ts` re-wraps the same shared
`compile()` core (no kernel re-implementation). Sources: <https://github.com/nonara/ts-patch>,
<https://github.com/cevek/ttypescript>, <https://github.com/microsoft/TypeScript/issues/54276>.

**D — the three axes are independent, stacked knobs in shipping ecosystems.** Vue runs all three
simultaneously: `.vue` files (source surface) + `@vitejs/plugin-vue`/`unplugin` integrations
(toolchain depth) + `vue-tsc` (tsc-side support). Never exclusive. Sources:
<https://vuejs.org/guide/scaling-up/tooling.html>, <https://www.npmjs.com/package/vue-tsc>,
<https://www.npmjs.com/package/@vitejs/plugin-vue>.

## Standing-test outcome (per concern)

- **All four concerns → support-all.** Each joins a different axis (or, for arbitrary-string
  scanning, widens the source-surface axis) of the #127 strategy-axes contract; each is opt-in and
  additive; the composability probe passes by construction *and* by shipping precedent (Vue stacks
  the analogous three). No pair is mutually exclusive; no alternative is broken. **Zero `## Fork N`
  sections; zero validation gates** (nothing here asks "do we commit to X" — #127 already committed
  the axes; the children exist; "which to build when" is burndown ordering, which a fork never
  decides).
- **The one residue the survey surfaced is cost/sequencing on the SWC path** (Rust re-impl + ABI
  upkeep) — prioritization input, not a fork branch, and already correctly encoded as #1629's
  `maturityGated` trigger rather than as a decision.
- **Bookkeeping delta folded into the item:** (1) `ts-patch`, not `ttypescript`, is the live
  toolname (deprecation noted; #1630 shipped compatible with both); (2) the **arbitrary-string
  scanning** residual was #232 scope living only in #231's prose — now named in #232's own body as
  an uncarved slice to be scaffolded when picked up (the epic stays open partly for it).

## Adversarial passes

- **Pass-4 skeptic** (throwaway sub-agent, prompted only to refute) — **SURVIVES-WITH-AMENDMENT.**
  Strongest attack: "the SWC plugin's Rust re-implementation forks the single-kernel architecture,
  and byte-identical output is an unratified forced invariant." Defeated by the
  *surface-contract-not-computation* statute (a second provider of the same lowering contract is a
  swappable strategy, not a fork branch; the equivalence-bar question only materializes when a
  second kernel exists, and #1629's `maturityGated` trigger already carries it). Statute-overlap and
  citation-scope attacks failed (#127 names all three deferrals verbatim;
  *config-extends-platform-default* composes with the axes, doesn't compete). **Landed amendment:**
  the "nothing to ratify" claim had to be scoped to the three *carved* opt-ins — the
  arbitrary-string-scanning residual's "not a decision" pre-classification was ungrounded (no
  prior-art probe covered it; shipping precedent uniformly *anchors* matching for
  false-positive-lowering correctness reasons), so the item now says the carve-time child must
  re-run the standing test and may legitimately be `kind: decision`. Folded in before stamping.
- **Pass-5 two-confusion screen** (separate fresh-context agent, #2091) — **clear on both
  subjects.** The support-all verdict rules on consumer-visible axes (Q1: no impl concern on the
  standard side; the Rust-vs-JS-kernel question is correctly held impl-side) and dissolves to
  "ruling + separately-prioritized builds" with no prioritization in decision costume (Q2). The
  residual-scope treatment is likewise clear: match-rule correctness is boundary-observable, and the
  item defers the work, not the ruling.

## Artifacts

- Research topic: `/research/component-compiler-deferred-optins-standing-test/`
  (`we:src/_data/researchTopics/component-compiler-deferred-optins-standing-test.json` +
  `we:src/_includes/research-descriptions/component-compiler-deferred-optins-standing-test.njk`).
- Item rewritten in place: `we:backlog/232-component-compiler-deferred-strategy-optins.md`
  (`preparedDate: 2026-07-01`; released `preparing → open`).
- Prior report kept exposed via the children's `relatedReport`
  (`we:reports/2026-06-06-adapter-real-project-integration.md` — #1628/#1629/#1630 all point at it).
