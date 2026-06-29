---
kind: decision
status: open
dateOpened: "2026-06-28"
dateStarted: "2026-06-29"
preparedDate: "2026-06-29"
relatedReport: reports/2026-06-28-app-authored-custom-intents-meta-schema-registry.md
relatedProject: webintents
tags: [intents, placement, constellation, custom-intents, build-substrate]
---

> **Retyped story·5 → decision (2026-06-29, batch-2026-06-29d pre-flight).** Body carried an unresolved
> placement fork — does product-intent resolution live in the **FUI build** vs the **plateau-app build**
> (#1913's "FUI/product" is ambiguous). That's a design call, not batchable build work, so it leaves the
> Tier-A pool until ratified. Decide the placement first; the substrate build then becomes a clean story.

# FUI/product intent-resolution substrate — build-time custom-intent catalog assembly + resolver invocation seam

## Digest

#1913 ratified the custom-intent seam and split its placement: *meta-schema definition + `validateIntent`
extension → WE; manifest glob-loader + runtime register-API → **FUI/product***. The follow-up build #1930
(product-manifest glob-loader) is `blockedBy` this item because **"FUI/product" was never disambiguated**:
the build-time substrate that assembles the standard intent catalog and **invokes the resolver** — the thing
a product manifest feeds into — exists in **neither** FrontierUI nor plateau-app today (verified: zero
intent-resolution references in either). This decides **where that reusable substrate is authored and
owned** — an FUI build-tool module products import, or plateau-app's own build. The resolver *itself* is
**not** in scope: #776 settled it as WE-resident standard logic. Gates #1930 (→ closes the custom-intent
seam #1913 opened).

## Grounding

- **Resolver home is settled — WE, not in play here.** `we:webtraits/intentProfileResolver.ts:1-80`
  (`resolveTraits`/`bundlePlan`) is a *pure, dependency-free build-time function* the #776 ruling placed
  WE-resident as **standard logic** ("the Plateau Technical Configurator and the FUI build are *consumers*
  of this resolver, not its home — standard logic → WE", `backlog/776:22`). Not named in the #1294/#1078
  WE→FUI relocation debt. So this decision touches only the **consumer substrate** that calls it, never the
  resolver's home.
- **The WE seam being "mirrored."** WE's own catalog-assembly is `loadIntents()` —
  `we:scripts/lib/intents-loader.cjs:17` `readdirSync('src/_data/intents/*.json')` — invoked by WE's build
  at `we:src/_data/intents.js:15`, `we:scripts/check-standards.mjs:124`, `we:scripts/gen-inventory.mjs:43`.
  #1913 says the product substrate "mirrors `src/_data/intents/`" — but that glob+invoke pipeline is
  **WE-internal**; no *product-facing* equivalent exists.
- **Governing statute — two anchors, two jobs.** (i) The FUI-vs-product cut is governed *by name* by
  `we:docs/agent/platform-decisions.md#devtools-placement` rule 2 (`:282`): *"Build-time implementation
  transform / reference-impl generator (codegen, CSS lowering, **bundler plugins**, serve-time impl) →
  **stays FUI**."* The substrate is a Vite/bundler plugin → FUI by-name. Its sibling rule 3 (`:284`) routes
  the *operator-facing* surface (**configurators**, dev-panels) → **Plateau** — so plateau-app's existing
  intent-*configurator* (`plateau-app:src/intent-configurator/`) is correctly Plateau, and the build
  *substrate* is correctly FUI; **they are different things on different sides**, which is exactly why the
  substrate is not "just part of the configurator." (ii) `#constellation-placement` rule 1 (`:70-106`, *"WE
  holds zero implementation … no _new_ WE-resident delivery runtime may be added"*) + **#1771** (`:89-95`,
  *"a generator that runs an implementation over WE's own artifacts → FUI"*) discriminate only the **WE
  boundary** — they exclude branch (c) (a new WE-resident substrate); being WE-vs-FUI rules they do *not* by
  themselves pick FUI over plateau. The FUI-over-plateau call rests on rule 2 + the precedent +
  impl-lives-once, below. *(Citation-scope correction folded in from the prep skeptic — rule 1/#1771 were
  initially over-cited as the FUI-vs-product authority; that repeats #1913's own over-extension, so rule 2
  is now primary.)*
- **FUI already owns this exact shape of thing** — `fui:tools/trait-enforcer/vite-plugin.ts:44-61` is a
  build-time tool that globs a catalog, **imports a WE-resident contract sibling-relative** (pre-#872:
  `import … from '../../../webeverything/tools/trait-enforcer/traitManifestContract'`, "the allowed FUI→WE
  direction #700/#239 … becomes the `@webeverything/…` package import when #872 publishes it"), and emits a
  `virtual:trait-manifest`. Plus the `fui:tools/data-table-build/cli.ts` → `dist/tools/…` bundling pattern
  (`fui:scripts/build-tools.mjs`) and the `fui:src/_data/adapters.js:1-50` readdir-glob loader. FUI is the
  established home for *build-time tools that run a WE-defined mechanic over a globbed catalog*.
- **plateau-app consumes FUI by source-aliasing, not by running FUI's build.** It path-aliases
  `@frontierui/*` into FUI source (`plateau-app:vite.config.mts:301-387`, no npm dep), already globs the WE
  catalog directly in *runtime* source (`plateau-app:src/intent-configurator/configurator.ts:20-22`
  `import.meta.glob('…/webeverything/src/_data/intents/*.json')`), and imports FUI's runtime `@frontierui/config`
  resolver (`plateau-app:src/project-config-discovery/discovery.ts`). It has **no `_data/` dir and no
  on-disk product manifest** — custom values live in `localStorage` only (`plateau-app:src/intent-configurator/configurator.ts:78-105`,
  `@vendor/name` token). So a product manifest + its build wiring is genuinely new on the plateau side too.

## The axis

There is exactly **one** placement axis. The resolver (standard logic) is WE; the standard catalog is WE
(`src/_data/intents/`); the *product's own* custom-intent manifest is product data → plateau-app (forced —
not a fork, below). What is undecided is the **reusable build-time substrate in the middle**: the
"assemble {standard catalog + product manifest} → invoke the WE resolver → emit the resolved
catalog/bundle-plan" pipeline. Its candidate homes — FUI build-tool module vs plateau-app build — are the
fork. A third candidate (a *new WE-resident* shared tool) is excluded up front by
`#constellation-placement` rule 1 (no new WE impl), which is what *makes* this a real fork rather than a
free choice.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1 — substrate home** | **(a)** FUI build-tool module (`fui:tools/intent-resolver/`), products import + wire it | (b) plateau-app authors the substrate inline in its own build | High |

## Fork 1 — where the reusable product-intent-resolution substrate lives

*Why it's a fork (case a — flawed branch excluded, **and** case b — the survivors can't co-own):* the
broken branch is a **new WE-resident substrate** — forbidden by `#constellation-placement` rule 1 ("WE
holds zero implementation … no _new_ WE-resident delivery runtime may be added", `:74`/`:105`); a substrate
that *runs* the resolver is impl by #1771 (`:89`), so WE is excluded by forced invariant. That leaves two
*coherent* homes — FUI vs plateau-app — which **genuinely cannot co-own**: the assemble+invoke pipeline has
a single canonical authoring home, and a second copy is precisely the cross-product divergence surface the
constellation exists to prevent. So a live choice remains between the two survivors.

- **(a) FUI build-tool module — `fui:tools/intent-resolver/`, imported and wired by each product.** FUI
  authors a reusable build-time substrate (a Vite plugin / Node module) that assembles the standard catalog
  (imported from WE) plus a product's manifest glob, invokes the WE resolver, and emits the resolved
  catalog as a virtual module; plateau-app imports it into its own `vite.config.mts` and supplies only its
  manifest dir + custom intents. **← default.** *Why it wins:* (1) **statute (by-name)** — the substrate is
  a bundler plugin, which `#devtools-placement` rule 2 routes to **FUI**, while its operator-facing
  *configurator* sibling (rule 3) is the part that is Plateau; (2) **impl-lives-once** — a second product
  gets the substrate for free instead of re-authoring it; (3) **precedent** — `fui:tools/trait-enforcer/vite-plugin.ts` is the
  direct structural twin (intent→trait is to trait-enforcer as catalog→bundle is to this), already proving
  the FUI-build-tool-imports-WE-contract-sibling-relative pattern that #872 will later package.
- **(b) plateau-app authors the substrate inline** in its own `tools/intent-resolver/` + `vite.config.mts`,
  importing only the bare resolver from WE; FUI stays runtime-components-only. **Coherent but inferior:**
  it routes reusable build-engine impl *into the product* (contra rule 1), and the moment a second product
  needs custom intents the assemble+invoke seam is re-authored — the exact "build it in the product, extract
  to the shared layer later" pattern that produced the ~8 subsystems of WE-resident relocation debt #1294 is
  now paying down. "plateau-app is the validation ground" is satisfied *without* owning the impl: under (a)
  plateau-app still wires + dogfoods the substrate (supplies the manifest, runs the build, hits the bugs) —
  dogfooding is *consuming* the capability, not *owning* its reusable code.
- **(c) ~~new WE-resident shared tool~~** — **excluded/broken**: `#constellation-placement` rule 1 forbids
  any new WE-resident delivery runtime; a substrate that runs the resolver is impl (#1771), not the
  declarative-check carve-out.

**Code shape (default = (a)).** The substrate mirrors the trait-enforcer plugin's structure — glob a
catalog, import the WE mechanic sibling-relative, emit a virtual module:

```ts
// fui:tools/intent-resolver/vite-plugin.ts  (NEW — twin of tools/trait-enforcer/vite-plugin.ts)
import { readdirSync, readFileSync } from 'fs';
import type { Plugin } from 'vite';
// sibling-relative (config-load is pre-alias) — the allowed FUI→WE direction (#700/#239);
// becomes `@webeverything/intent-profile-resolver` when #872 publishes the runnable seam.
import { bundlePlan, type IntentProfile } from '../../../webeverything/webtraits/intentProfileResolver';
import { loadIntents } from '../../../webeverything/scripts/lib/intents-loader.cjs';

/** Assemble {standard catalog + the product's owner:intent manifest} and resolve, at build time. */
export function intentResolver(opts: { manifestDir: string; profile: IntentProfile }): Plugin {
  const VIRTUAL = 'virtual:product-intents';
  return {
    name: 'fui:intent-resolver',
    resolveId: (id) => (id === VIRTUAL ? '\0' + VIRTUAL : null),
    load(id) {
      if (id !== '\0' + VIRTUAL) return;
      const standard = loadIntents();                                  // WE catalog
      const custom = readdirSync(opts.manifestDir)                     // product owner:intent customs
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(`${opts.manifestDir}/${f}`, 'utf8')));
      const plan = bundlePlan(opts.profile, /* trait candidates from [...standard, ...custom] */ []);
      return `export const intents = ${JSON.stringify([...standard, ...custom])};
              export const plan = ${JSON.stringify(plan)};`;
    },
  };
}

// plateau-app:vite.config.mts  — product imports + wires it, supplies only its manifest + profile
import { intentResolver } from '../frontierui/tools/intent-resolver/vite-plugin';
export default defineConfig({
  plugins: [/* …existing… */ intentResolver({ manifestDir: './src/_data/intents', profile: activeProfile })],
});
```

Under (b) that whole plugin body would instead live in `plateau-app:tools/intent-resolver/` — same code, but
owned by the product and unavailable to any sibling product without a copy.

**Skeptic:** SURVIVES (default holds; two amendments folded in from a throwaway refute-only sub-agent run
this prep). Attacked on four axes. **(0) Classification** — SURVIVES: a genuine *placement* fork, not
mechanical — plateau-app's existing direct catalog globs (`plateau-app:src/intent-configurator/configurator.ts:20`)
make "the substrate is product glue → Plateau" a *coherent* reading, so no rule auto-classifies it; the
reusable-engine-vs-product-glue judgment is the fork. Not a config dimension (one canonical home, not a
per-deployment knob); not support-both (FUI-core + plateau-wires-it *is* option (a), not co-ownership).
**(1) Merit** — SURVIVES: the consumption-model attack ("plateau can't consume an FUI build plugin — it
doesn't run FUI's build") fails — a Vite plugin is an importable Node module plateau runs in *its own*
build (it already source-aliases + sibling-imports FUI); and "dogfood in the product, extract later" is
refuted because dogfooding = consuming (which (a) preserves) and "extract later" is the documented genesis
of the #1294 relocation debt. **(2) Statute-overlap** — SURVIVES-WITH-AMENDMENT: no collision, but the
skeptic surfaced a *more on-point same-turf anchor the draft had missed* — `#devtools-placement` rule 2
(bundler plugin → FUI by-name); **folded in as primary authority** (Grounding + codification). **(3)
Citation-scope** — SURVIVES-WITH-AMENDMENT: rule 1 + #1771 were over-cited as the FUI-vs-product authority,
but both are WE-vs-FUI rules — they only exclude branch (c); **demoted to "excludes WE" and the
FUI-over-plateau call re-based on rule 2 + precedent + impl-lives-once** (the same citation-scope
over-extension #1913 itself got burned by, #1932).

## Supported by default (not decisions)

Forced by existing statute or settled upstream — recorded so the decider spends no judgment on them:

- **Resolver home = WE** (#776, standard logic) — out of scope here; the substrate *imports* it.
- **Standard intent catalog = WE** `src/_data/intents/` (#1145 one-file-per-intent).
- **Product custom-intent manifest = plateau-app product data.** Forced: product-owned data → the product
  (`#constellation-placement` "a served … product → Plateau"); #1913 already calls it the *product*
  manifest. The product authors its `owner:intent` customs (#1913 Fork 1); the substrate (wherever it lands)
  globs them. No fork — there is no coherent branch where a product's own intents live anywhere but the
  product.
- **Build-time declarative registration, not a runtime register-API.** #1913 settled the seam as the
  build-time glob; the runtime register-API is the separately-prioritized demand-gated follow-up #1931. Not
  reopened here.
- **How the substrate imports the WE resolver = the #872 distribution seam.** Interim sibling-relative
  byte-import (the sanctioned FUI→WE pre-#872 path, `#constellation-placement` rule 3 "byte-replication is
  the interim"; trait-enforcer precedent `:44-61`); becomes the `@webeverything/…` type-only-plus-runnable
  package import when #872 lands. The runnable-vs-type-only distribution of WE standard logic is **#872's**
  call, not this item's.

## Statute composition (codifiedIn draft)

On ratification, codify as a disambiguation note on `#custom-intents-namespace-by-ownership` cross-linking
`#devtools-placement` (primary) and `#constellation-placement`: *the reusable build-time intent-resolution
substrate — assemble the standard catalog + invoke the #776 WE resolver — is a **bundler plugin → FUI** per
`#devtools-placement` rule 2 (`fui:tools/intent-resolver/`, the structural twin of `fui:tools/trait-enforcer/`);
the product's operator-facing intent-configurator is the part that is Plateau (rule 3). The product
(plateau-app) supplies only its `owner:intent` manifest (product data) and wires the FUI substrate into its
own build. A new WE-resident substrate is excluded (`#constellation-placement` rule 1 + #1771 — WE holds
zero impl).* This **composes** rather than colliding: `#devtools-placement` rule 2 already governs this turf
by-name, `#constellation-placement` rule 1/#1771 only fence off the WE branch, and the note fills the single
ambiguity #1913's "FUI/product" left (FUI = the substrate; product = the manifest + configurator).

## Lineage

Surfaced 2026-06-28 (batch-2026-06-28-parallel pre-flight) when #1930 verified the FUI substrate absent and
filed this as its `blockedBy` prerequisite. Retyped story·5 → decision 2026-06-29 (the body carried an
undecided FUI-build-vs-plateau-build placement fork — not batchable build work). Prepared 2026-06-29
(`/prepare all`): grounded against the resolver (#776/WE), the WE assembly seam (`we:scripts/lib/intents-loader.cjs`), the
`#constellation-placement`+#1771 statute, and both downstream build maps (FUI `tools/trait-enforcer` twin;
plateau-app source-alias consumption model); single placement fork classified, default authored to the
trait-enforcer precedent, and skeptic-attacked on all four axes (no flip). Prior art is #1913's survey
([/research/app-authored-custom-intents-meta-schema-registry/](/research/app-authored-custom-intents-meta-schema-registry/),
`relatedReport`) — no new web survey (this is internal placement over already-researched ground).
