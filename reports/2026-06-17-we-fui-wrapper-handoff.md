# WE→FUI wrapper-handoff mechanism — prior-art survey for decision #855

> Prep research for decision **#855** (the cross-repo seam blocking the polyglot adapter panel
> [#753](/backlog/753-polyglot-adapter-panel/), under Block Explorer epic [#746](/backlog/746-block-explorer-interactive-fui-block-workbench/)).
> #821 shipped a **WE**-owned consume-mode wrapper generator
> ([`scripts/gen-wrapper/genWrapper.mjs`](../scripts/gen-wrapper/genWrapper.mjs)): a pure
> `generateWrapper(declaration, target) => wrapperSourceString` over a block's Custom Elements
> Manifest. The panel that *displays + live-tests* that source is **FUI** (`locus: frontierui`, per the
> docs-rendering boundary). So *how the FUI panel obtains and live-tests the WE-generated wrapper source*
> is the open seam this report grounds.

## The question, restated against the tree

The item filed three options cold:

- **(A) build-time artifact handoff** — WE emits the wrappers to a published artifact the FUI panel reads.
- **(B) a generated bundle the `fuiDemo` iframe (#701) loads.**
- **(C) a sandbox runtime that generates on demand.**

Two facts from the tree shrink this before any survey:

1. **The generator is already a pure, importable, no-DOM/no-FUI function.**
   [`genWrapper.mjs:202`](../scripts/gen-wrapper/genWrapper.mjs) exports `generateWrapper(declaration,
   target)`; [`genWrapper.mjs:6`](../scripts/gen-wrapper/genWrapper.mjs) states the output "crosses the
   layer seam to the FUI Block Explorer panel (#753)." #821's CLI note is explicit that the FUI panel
   "does NOT need [the CLI] (it imports `generateWrapper` directly)"
   ([`cli.mjs:8`](../scripts/gen-wrapper/cli.mjs)). So the codebase was already authored toward FUI
   consuming the *generator*, not a file dump.
2. **Consume-mode output is a pure function of the CEM** — deterministic in `(declaration, target)` with
   no per-user input. The wrapper for `<we-button>`/React is byte-identical every time
   ([`genWrapper.mjs:69-139`](../scripts/gen-wrapper/genWrapper.mjs)). So "regenerate on demand" produces
   output that never varies — the freshness argument for (C) evaporates for consume mode (author-mode
   #818, with an emit-purpose IR, is the separate deferred case).

## Topic 1 — how shipping WC libraries distribute generated wrappers

**The dominant pattern is unambiguous and one-directional: wrappers are a *build-time artifact of the
source library*, published as a package the consumer reads. On-demand/runtime generation in the consumer
has no production precedent.**

| Tool | Generation locus | Reads the CEM? | Distribution | Build- or run-time |
|---|---|---|---|---|
| **Stencil output targets** (`@stencil/react-output-target`, `-vue`, `-angular`) | The **component library's** build (`stencil.config.ts`) | No — uses Stencil's internal component metadata | A **separately published npm package** (monorepo + Lerna publish is canonical) | Build-time codegen |
| **Lit Labs `@lit-labs/gen-wrapper-react`/`-vue`/`-angular`** | The **element library's** build, via `@lit-labs/cli` | **Yes** — consumes `custom-elements.json` (CEM from `gen-manifest`/cem-analyzer) | Published wrapper source/package | Build-time codegen |
| **`@lit/react` `createComponent`** | n/a — **runtime** wrapper, hand-wired per element, needs the element *class* | No | Imported at app render time | Runtime (not codegen) |

Takeaways that drive the call:

- **Only Lit's `gen-wrapper-*` is CEM-driven** — the exact shape of WE's #821 generator. It is the closest
  incumbent, and it generates at the **source library** build, then publishes.
- **No shipping tool generates wrappers on-demand in the consumer.** The only *runtime* mechanism
  (`@lit/react`) is hand-authored adaptation, not CEM-driven generation. A pure
  `(cem, target) => string` consumed across a repo boundary is off the beaten path on the *handoff*
  detail (fine for an explorer), so the precedent to borrow is the **"emit wrapper source string/file"**
  half — treat the wrapper as *source to compile*, not as an importable runtime component.
- Sources: Stencil [React docs](https://stenciljs.com/docs/react) / [output targets](https://stenciljs.com/docs/output-targets);
  Lit [React docs](https://lit.dev/docs/frameworks/react/) / [`gen-wrapper-react`](https://www.npmjs.com/package/@lit-labs/gen-wrapper-react) / [`gen-manifest`](https://www.npmjs.com/package/@lit-labs/gen-manifest).
  (`@stencil/react-output-target` is still pre-1.0 / `0.0.1-dev.*` as of mid-2025 — API not frozen.)

**This settles A vs C and dissolves B.** (A) build-time is the universal precedent; (C) on-demand has no
precedent *and* no benefit for deterministic consume-mode output; (B) "a bundle the iframe loads" is not a
distinct *mechanism* — it only describes *where the bundle physically sits*, an impl detail of whatever
build-time handoff is chosen.

## Topic 2 — in-browser live-test sandboxes (the FUI panel's render)

The live-test render is **FUI's** regardless of the handoff (the panel is `locus: frontierui`, embedded in
the WE block page via the existing #701 `fuiDemo` iframe). The sandbox *technology* is therefore a FUI impl
choice WE does not mandate; recorded here as non-binding guidance.

| Tech | In-browser bundling | React **+** Vue? | Weight / isolation | Source-string in? |
|---|---|---|---|---|
| **esm.sh + import maps** (`esm.sh/tsx`) | No bundler — per-module transform; serves `.tsx`/`.jsx`/`.vue` | **Both** (compiles Vue SFC) | Lightest; **plain iframe, no COOP/COEP** | Inlined; deps via import map |
| **Sandpack (classic bundler)** | In-browser Babel bundler | **Both** (React + Vue templates) | Moderate; iframe sandbox | **Yes** — `files` source map |
| **esbuild-wasm** | WASM `transform()` — single file, no multi-file bundle, **no Vue SFC** | JSX/TSX only | Lightest self-contained | One module at a time |
| **StackBlitz WebContainers / Sandpack-Nodebox** | Full Node-in-browser | Any (real Vite) | **Heaviest**; needs cross-origin isolation (COOP/COEP) to embed | Yes (overkill) |

Guidance: **esm.sh + import maps** is the lightest credible multi-framework path (React TSX *and* Vue SFC,
no cross-origin-isolation tax — important inside an embedded iframe); **Sandpack** is the turnkey
source-string-in middle ground; **esbuild-wasm** only if FUI commits to React-only; WebContainers is
overkill and pays a COOP/COEP embedding tax. Sources: [Sandpack](https://sandpack.codesandbox.io/docs/advanced-usage/client),
[esbuild-wasm](https://www.npmjs.com/package/esbuild-wasm), [WebContainers browser support](https://webcontainers.io/guides/browser-support),
[esm.sh](https://esm.sh/).

## What survives as a decision

After the survey the three filed options collapse to **one forced invariant + one genuine fork**:

- **Forced — build-time handoff (Option A), FUI-owned sandbox.** Universal prior art + deterministic
  consume-mode output reject (C); (B) is not a distinct mechanism. The live-test render is FUI's, embedded
  via #701; the sandbox tech is FUI impl (guidance: esm.sh/import-maps or Sandpack), not a WE fork.
- **The real fork — what crosses the WE→FUI boundary:**
  - **A1 — WE publishes the *derived wrapper artifact*.** WE runs `gen:wrapper`
    ([`cli.mjs`](../scripts/gen-wrapper/cli.mjs) → `generated/wrappers/<target>/<Name>.<ext>`) and publishes
    the wrapper source set as a versioned `@webeverything/*` artifact; FUI imports dumb strings. Matches the
    Stencil/Lit "publish a wrapper package" precedent. Con: a *third* published thing that is only a pure
    function of two already-published WE things (the CEM + the generator), re-published on every CEM change.
  - **A2 — WE publishes the *generator + CEM contract*; FUI derives at its own build.** WE packages
    `generateWrapper` as `@webeverything/gen-wrapper` (it is already a pure, no-DOM export) alongside the
    ratified CEM (#626, derived by [`gen-cem.mjs`](../scripts/gen-cem.mjs)); the FUI demo build calls it
    over the CEM to materialize wrappers into its own build. Single source of truth = generator + CEM (no
    third derived artifact, no stale-publish window). Matches the existing #821 authoring intent ("the FUI
    panel imports `generateWrapper` directly"). Con: WE codegen runs inside FUI's build (FUI imports +
    executes a WE tool) — slightly more moving parts in FUI; less faithful to the Stencil/Lit
    *generate-at-source* locus.

**Recommended default: A2** (med-high) — the generator already exists as a pure importable function the
codebase explicitly intends FUI to call; A2 keeps a single source of truth (generator + ratified CEM),
avoids versioning a derived artifact, and stays fresh by construction. **The residual is** prior-art
fidelity: Stencil/Lit generate at the *source* library and publish the wrapper (A1), so if WE later wants a
sole-generation execution site or a cacheable pre-built CDN artifact, A1 is added then — it is not excluded,
just not the consume-mode-probe default.

## Sequencing note (not a fork)

Today `blocks.json` carries no `tagName`, so the CEM emits 0 custom-element declarations and `gen:wrapper`
emits nothing ([`cli.mjs:35-41`](../scripts/gen-wrapper/cli.mjs)) — block-data enrichment is **#822**. So
the panel build (#753) is gated on **both** this handoff decision (#855) *and* #822; this decision only
settles the mechanism, it does not require #822 to be done first to ratify.
