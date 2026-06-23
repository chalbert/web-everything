---
kind: decision
parent: "099"
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "docs/agent/platform-decisions.md#config-extends-platform-default"
preparedDate: "2026-06-23"
relatedReport: reports/2026-06-23-project-config-materialization-shape.md
relatedTo: ["798", "227", "080"]
crossRef: { url: /backlog/911-establish-platform-decisions-statute-layer-and-codifiedin-discipline/, label: "config-extends-platform-default statute (#911)" }
tags: [config, platform-default, flavors, project-config, separation, decision]
codifiedIn: docs/agent/platform-decisions.md#config-extends-platform-default
---

# Unified project-config surface vs per-dimension flavors — where config-extends-platform-default values live

## Digest

Spun out of [#798](/backlog/798-code-from-requirement-source-of-truth-requirement-only-codeg/) to settle the one end the
[config-extends-platform-default](/backlog/911-establish-platform-decisions-statute-layer-and-codifiedin-discipline/)
statute left open: dimension values (SoT-mode, auto-define, render-strategy, theme…) live in *"a project config
that extends a platform-default flavor"* — but **where do they physically materialize?** The card framed it as
a fork: **(a)** one unified rc-like project-config surface all dimensions inherit from vs **(b)** per-dimension
flavor configs that compose. **Prep reframes it: that a/b is a false fork — it conflates *storage* with
*discovery*.** Storage (a dimension's value + its `extends` chain) is the irreducible kernel and must be
**per-dimension and decoupled** (separation bias, the `CustomRegistry.extends` precedent, the flat-config
trend); discovery (the whole resolved config at one point) is a **derived view**, free either way and never a
second source of truth. **Recommended ruling: forced invariant — per-dimension flavor configs are the SoT; a
unified surface is supported only as a non-authoritative discovery view. Confidence: Med-High.** Grounded in
the [project-config materialization](/research/project-config-materialization-shape/) research topic.

**Discussion adds Fork 2 — the project author surface (the card's origin question, "one JSON config or
multiple?").** Fork 1 settles *SoT/ownership*; it does **not** dictate how many *files* the author edits —
**file-count ≠ schema-coupling.** Recommended: the project materializes config in **one project-config file
keyed per dimension** (the package-manifest precedent — each key its own schema/owner), with any dimension
**extractable to its own file** (opt-in). Single-file ergonomics, per-dimension SoT preserved. Confidence:
Med-High. See **Config flow** below for the file name and the end-to-end trace.

## Axis-framing

The real axis is **storage vs discovery**, and the statute already leans the storage answer. The statute
(we:docs/agent/platform-decisions.md#config-extends-platform-default, ~L806–814) names the precedent as
*"core `CustomRegistry` `extends`; the JSX render-strategy axis"* — i.e. **per-concern** registries each with
their own `extends`, not one god-registry with sections. The existing dimensions are already separate concerns:
auto-define ([#227](/backlog/227-auto-define-strategy-axis/)), render-strategy
([#080](/backlog/080-render-strategy-contract-decisions/)), SoT-mode
([#798](/backlog/798-code-from-requirement-source-of-truth-requirement-only-codeg/)), theme. WE's
`bias-toward-separation` puts the burden of proof on *combining* them into one artifact, and
`minimize-lock-in` refuses a project-facing format as a source of truth. Prior art seals it: the ecosystem has
migrated **away** from monolithic per-section rc files toward composable flat/array config (ESLint flat config,
Vite/Rollup plugin arrays, separate EditorConfig/Browserslist/Prettier) precisely because section-merging
coupled unrelated concerns. So "storage" resolves to per-dimension; the only thing a unified surface legitimately
buys — *discovery / project identity* — is a derived view a resolver produces by reading the per-dimension
configs.

### Recommended path at a glance

| Fork | Recommended ruling | Broken / excluded branch | Confidence |
|---|---|---|---|
| **1 · materialization** | **Forced invariant: per-dimension flavor configs are the SoT** (each its own `extends`-to-flavor chain — the `CustomRegistry.extends` shape generalized); a unified project-config surface is **supported by default** only as a *derived, non-authoritative discovery view* | A unified project-config **file as authoritative SoT** — couples schema/ownership/release of unrelated dimensions into a god-artifact; project-facing-format lock-in; contradicts the per-concern precedent + the flat-config trend | **Med-High** |
| **2 · author surface** | **Default: one project-config file keyed per dimension, any key extractable to its own file** (the package-manifest precedent; file-count ≠ schema-coupling — see **Config flow** for the name) | **One file with one *merged* schema** — the Fork-1 god-artifact restated at the file layer; and **forced-multiple** (less permissive — demoted to the opt-in *extract* path, not the default) | **Med-High** |

## Config flow — from the config file name

The project author's entry point is a **single project-config file at the repo root**, keyed per
dimension. Each key carries that dimension's value and its own `extends`-to-platform-flavor chain; the
file is only a shared *host* — never a merged schema (that's the rejected branch). Canonical name:

```ts
// webeverything.config.ts   (.js / .json also accepted)   — Layer 2, the author surface
export default defineConfig({
  theme:          extendsFlavor('@webeverything/flavor-base', { /* token overrides */ }),
  autoDefine:     { strategy: 'on-import' },        // overrides the flavor default 'explicit'
  renderStrategy: { /* … */ },
  codegenSoT:     { mode: 'requirement-only' },
})
```

Each key is its own independently-owned/versioned schema (the package-manifest precedent: `dependencies`,
`scripts`, `eslintConfig`, `browserslist` share one file, never one schema). **Any dimension extracts to
its own file** when it wants separate tooling/ownership (the Browserslist/Prettier precedent) — the inline
key becomes a pointer, and Fork 1's SoT is unchanged:

```ts
// webeverything.config.ts  — `theme` extracted; the rest stay inline
export default defineConfig({
  theme:      './theme.config.ts',           // now its own file/owner
  autoDefine: { strategy: 'on-import' },
})
```

End-to-end flow:

```
1 · Platform flavor (WE)        fully-defined, most-permissive/native-first value per dimension;
                                the core registry/tool itself stays DEFAULT-LESS.
        │  project `extends` the flavor
        ▼
2 · Project config              the author surface above — per-dimension overrides, one keyed file
   (webeverything.config.*)     (any key extractable). THIS is Fork 2.
        │  per-concern resolver: flavor ⊕ project override, INDEPENDENTLY per dimension
        ▼
3 · Resolved value (per dim.)   auto-define resolves without touching theme; no cross-dim merge.
        │
        ├─► 4 · Consumption      each running standard reads ITS resolved value
        │                        (CustomRegistry → resolved auto-define; codegen → resolved SoT-mode).
        │
        └─► 5 · Discovery view   optional aggregator (plateau-app locus) that READS the resolved
                                 per-dimension configs → whole project config at a glance.
                                 Non-authoritative; never written to; never a 2nd SoT.
```

The single file is the **Layer-2 author surface (Fork 2)**; the per-dimension **keys / extract-files are
the SoT (Fork 1)**; the resolved whole at step 5 is the **derived discovery view**. All three coexist
without conflict precisely because file-count, schema-ownership, and discovery are separate axes.

### Composition semantics — what `extends` means (grounded in the live precedent)

For the **open-set** dimensions the per-dimension config *is* a **`CustomRegistry` subclass** — a keyed set
of named members + an `extends` chain + an explicitly-set default (the live precedents:
[CustomAutoDefineRegistry](blocks/renderers/auto-define/CustomAutoDefineRegistry.ts#L47) and
[CustomRenderStrategyRegistry](blocks/renderers/jsx/render-strategy/CustomRenderStrategyRegistry.ts)).
**Scalar/mode** dimensions (codegen-SoT *mode*, theme *tokens*) have no open set to register, so they aren't
a registry-of-entries — they realize the **same `extends`-a-flavor chain** as a plain config object. The
generalizable kernel Fork 1 ratifies is therefore *"default-less core + a value that extends a platform
flavor through an ordered nearest-wins chain"*; a registry is **one realization** of it, not the kernel.
Layering: the **registry/resolver is the runtime**, the **Layer-2 file is data that feeds it** — the author
composes flavors as data, never hand-writes registry code (minimize-lock-in holds).

`extends` is **an array**, not a single parent — `new CustomAutoDefineRegistry({ extends: [flavor] })`. So it
is **both** an extension of a previous config *and* a composition of multiple bases:

```ts
theme: extendsFlavor(['@webeverything/flavor-base', '@acme/brand-flavor'], { /* local overrides */ })
//                     ┕ base                        ┕ overrides base   ┕ overrides both  (nearest-wins)
```

Resolution is **ordered nearest-wins lookup, NOT a destructive deep-merge** — the
[`defaultKey`](blocks/renderers/auto-define/CustomAutoDefineRegistry.ts#L72-L79) getter returns this scope's
own value, else walks the `extends` array and takes the first that declares one. No merged blob is ever
materialized; resolution stays lazy.

**Two different "merges" — only one is real:**

- **Within a dimension** — a value extends/overrides its own flavor chain (ordered nearest-wins). ✅ This is
  the "merge of multiple" — and it lives entirely *inside* one dimension.
- **Across dimensions** (theme + auto-define + render-strategy + codegen-SoT) — **no merge at all.** Keys
  never overlap; the discovery view (step 5) simply *collects* the independently-resolved per-dimension
  values side by side.

The type system enforces this: the chain is typed to one dimension's registries
(`CustomAutoDefineRegistry[]`), so a theme config **cannot** be put into auto-define's `extends`. Fork 1's
separation is therefore a **compiler invariant**, not a convention — which is exactly why one shared author
*file* (Fork 2) is safe.

### Consequences of the ruling (both fall out, not extra work)

- **Scoped to any section/fragment of an app.** The same `extends` chain that does platform→project nests
  **app→section→fragment**. The registry is injector-chain-resolvable with a per-scope
  [`setDefault`](blocks/renderers/auto-define/CustomAutoDefineRegistry.ts#L60-L65) and a nearest-config-wins
  [`defaultKey`](blocks/renderers/auto-define/CustomAutoDefineRegistry.ts#L72-L79) walk — a subtree gets a
  child config that `extends` its parent and overrides only what it needs; a fragment resolves its setting
  from the nearest scope up the chain (runtime DI). The Layer-2 file is the *root* scope; nested overrides
  ride the runtime injector chain. So technical settings are changeable per-fragment without touching the rest.
- **Build can tree-shake unused settings.** Because the core is **default-less** and strategies register only
  by explicit `.define()` (no first-registered-wins — the #243 rule,
  [lines 50-58](blocks/renderers/auto-define/CustomAutoDefineRegistry.ts#L50-L58)), the set a flavor pulls in
  is statically known: an unregistered strategy is never imported → dead code the bundler drops. Scalar/mode
  dimensions carry only the chosen value, and the derived discovery view is dev-only (stripped from prod).
  Per-dimension + explicit-registration is what makes this clean — a god-config blob would defeat it.
- **Filesystem-colocated scope discovery (an *enabled* build capability — marriage of Fork 2 + scoping).** A
  build/dev tool can walk the component tree, find a config file at any **component root**, and wire it as that
  subtree's injected scope override (`extends` the parent, nearest-wins) — the filesystem expressing the
  injector hierarchy instead of hand-wired providers (precedent: nested `tsconfig`/`.eslintrc` cascade, route-
  segment config, workspace nesting). **Constraints that keep it principled:** (1) a **default, overridable
  discovery behavior, never a mandated convention** — WE ships a default vocabulary enforced via webcompliance,
  it does not mandate conventions; the explicit runtime-DI path stays the kernel; (2) covers only the **static**
  tree — dynamically-mounted subtrees still resolve via the runtime injector chain, the two compose; (3) it is
  **build/tool work prioritized separately**, sitting alongside the discovery view — *not* a new fork, since the
  colocated file is plain data and resolution semantics are unchanged (zero lock-in).

## Fork 1 — where config-extends-platform-default values materialize

**Fork-existence justification:** the card's (a)-vs-(b) is **not a genuine either/or** — it conflates two
separable axes (storage vs discovery). Run straight, the **composability probe** shows the kernel is the
per-dimension config + its independent `extends`; option (a) merely adds a wrapper file and (b) a
manifest/resolver, so neither subsumes the other at the kernel — they are *not* mutually exclusive. What **is**
a real decision is the **forced invariant** hiding inside (a): the *strong* reading of (a) — a unified file as
the **authoritative storage source of truth** — is the **broken branch** (it re-couples the schema evolution,
ownership, and release cadence of semantically unrelated dimensions into one god-artifact, and makes a
project-facing file the SoT, the lock-in WE refuses). So this resolves to a ratify (storage = per-dimension)
plus a support-both (the unified *view*), not a weigh between (a) and (b).

**Crux:** the statute says values live in *"a project config that extends a platform-default flavor"* — the
singular "a project config" reads like (a), but the cited precedent (`CustomRegistry.extends`, render-strategy
axis) is **per-concern**. The crux is whether "a project config" means one *storage artifact* (broken — god
file) or one *resolved view* over per-dimension storage (correct). Prep rules the latter.

**Options:**

- **Storage — per-dimension flavor configs *(ratified invariant)*.** Each dimension stores its value and its
  own `extends`-to-platform-default chain independently, generalizing the `CustomRegistry.extends` precedent.
  **Merit:** honours `bias-toward-separation` (a new dimension slots in without touching another's schema or
  owner); no project-facing-format lock-in; matches the per-concern precedent and the live flat-config/plugin-
  array trend; decouples release cadence (theme vs codegen-SoT evolve independently).
- **Unified project-config surface — *supported by default, as a derived view only*.** A single point that
  shows the project's whole resolved config (an aggregator/resolver that *reads* the per-dimension configs).
  Fine to ship for ergonomics/discovery; **must never be a second source of truth.** Whether and when WE ships
  such a view, and at what granularity, is ordinary **build prioritization**, not a design fork.
- *Excluded:* **a unified config *file as the authoritative SoT*** — *Rejected.* Couples unrelated dimensions
  into one schema/ownership/git-object (merge-conflict + breaking-schema blast radius), and freezes a
  project-facing format as the SoT (lock-in). It also contradicts the statute's own cited per-concern precedent
  and the ecosystem's migration away from monolithic rc files.

**Ruling: per-dimension flavor configs are the source of truth (forced invariant); a unified project-config
surface is supported only as a derived, non-authoritative discovery view.** This is most-permissive +
separation-biased: storage stays decoupled and lock-in-free, while the convenience of one-glance discovery is
still available as a view a project (or tooling) opts into.

*Rejected:* a unified file as authoritative SoT (couples unrelated dimensions; lock-in; against precedent + trend).

**Skeptic:** REFUTED → **default flipped.** The card (and this prep's first-pass default) leaned toward (a) "a
single unified surface." A prep skeptic sub-agent refuted it on merit: (R1) "sections" is a fig leaf that
re-couples schema/ownership/evolution — the very thing separation protects — and contradicts the cited
*per-concern* `CustomRegistry.extends` precedent; (R2) the composability probe, run straight, shows the kernel
is per-dimension, so (a) does **not** subsume (b); (R3) the prior-art trend is *away* from monolithic rc files
(ESLint flat config, Vite plugin arrays); (R4) one surface manufactures a god-file / cadence-coupling hazard;
(R5) it's not a fork at all — storage must be per-dimension, discovery is a derived view. **Folded in:** the
default is now per-dimension storage (forced invariant) + unified-surface-as-view (support-both); the broken
branch is explicitly "unified file as authoritative SoT." Without this reframe, the as-written "(a) unified
surface" default is refuted.

## Fork 2 — project author surface (how many config files)

**This is the card's origin question** — #1662 was opened wondering *how a project configures these values:
one JSON config or multiple?* Fork 1 settles the **SoT/ownership** axis (per-dimension, decoupled); it does
**not** dictate how many *files* the author edits — **file-count ≠ schema-coupling.**

**Crux:** can a project keep per-dimension schema decoupling (Fork 1) while authoring in a single file? Yes
— the package manifest is the standing proof: one file, many top-level keys (`dependencies`, `scripts`,
`eslintConfig`, `browserslist`), each its own independently-owned schema, any key extractable to its own file
(`.eslintrc`, `.browserslistrc`). One *file* is not one *schema*; the Fork-1 hazard was schema/ownership
coupling, which a keyed single file does not incur.

**Options:**

- **One project-config file keyed per dimension, any key extractable *(recommended default)*.** A single
  root config (name in **Config flow**) with one key per dimension; inline is the low-friction default,
  splitting a dimension to its own file is the author's opt-in. **Merit:** `most-flexible-default`
  (most-permissive = one file; the restriction/split is the opt-in); package-manifest precedent; one-glance
  ergonomics with **zero schema coupling** because each key keeps its own schema/owner/validation.
- **Always multiple files, one per dimension.** The Browserslist/EditorConfig/Prettier shape. Legitimate,
  but forces N files on every project even when a dimension is a one-liner — strictly *less* permissive, so
  it is demoted to the opt-in (extract) path rather than made the default.
- *Excluded:* **one file with one *merged* schema** — *Rejected.* That is the Fork-1 broken branch
  (god-artifact schema/ownership/cadence coupling) re-stated at the file layer, and is out for the same
  reasons; a keyed single file is explicitly **not** this.

**Ruling: default to one root project-config file keyed per dimension, with any dimension extractable to its
own file.** Single-file ergonomics; per-dimension SoT (Fork 1) preserved because each key/extract-file keeps
its own schema and owner. This is `most-flexible-default` + `bias-toward-separation` held together: the file
is shared for convenience, the *schemas* stay separated.

**Confidence: Med-High.** Residual: the exact canonical filename and accepted extensions (`.ts`/`.js`/`.json`)
are a thin naming call folded into the eventual build, not a fork — **Config flow** proposes
`webeverything.config.*`.

## Context

- **Lineage:** residual of [#798](/backlog/798-code-from-requirement-source-of-truth-requirement-only-codeg/)'s
  ratification (the statute's open materialization end); sibling dimensions are #227 / #080 / #798 / theme.
  Governed by the [config-extends-platform-default](/backlog/911-establish-platform-decisions-statute-layer-and-codifiedin-discipline/)
  statute ([#911](/backlog/911-establish-platform-decisions-statute-layer-and-codifiedin-discipline/)).
- **Constellation:** `locus: plateau-app` for any materialized **view/aggregator** surface (a Technical
  Configurator-adjacent discovery tool); the per-dimension **storage** schemas ride each dimension's own build.
  No WE standard entity is minted — the config is project-facing data, not a protocol.
- **At ratification:** record **both** rulings; `codifiedIn` the statute (extend the
  config-extends-platform-default section with (1) the storage-vs-view materialization end and (2) the
  author-surface default — one root project-config file keyed per dimension, any key extractable). The
  unified-view *build* and the config-file *build* are separately prioritized, not triggered by this decision.
