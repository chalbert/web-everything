# Single-repo WE-docs build — how to distribute FUI's component-render tool

**Date:** 2026-07-09 · **Prep session:** `/prepare all` · grounds decision **#2158**.

## The question

WE's Eleventy build renders FUI components by **subprocess-exec** of FUI's component-render CLI at the sibling
path `we:../frontierui/dist/tools/component-render/cli.mjs` (`we:scripts/lib/component-render-build-hook.cjs:50`).
So a single-repo checkout of WE alone cannot build the docs, and the live deploy checks out + builds the FUI
sibling in CI (a `FUI_READ_TOKEN` PAT + a full FUI `build:tools` per deploy). How does WE get that tool without
the sibling checkout — so a fresh clone / GitHub Actions / **Cloudflare Workers Builds** (single-repo only) can
build?

## Grounding digest (verified)

- **The coupling is an exec, not an import — deliberately.** `we:scripts/lib/component-render-build-hook.cjs:18-22`:
  *"WHY a subprocess and not an import: … a WE→FUI code import is a banned backward DAG edge
  (constellation-placement). So WE orchestrates the FUI compute over a process boundary."* The CLI is a locked
  build-artifact at a fixed relative path (`we:scripts/lib/component-render-build-hook.cjs:46,:50`), a missing
  one is a hard error (`:78-81`), and a producer string is checked
  (`EXPECTED_PRODUCER = 'frontierui/component-render-build-harness/1'`, `:67,:91-96`). A `WE_FUI_ROOT` env
  override exists for lane clones (`:59-63`, #2178).
- **The boundary rule names build-time import as the ONE violation.** `{#we-fui-embed-boundary}` rule 6
  (`we:docs/agent/platform-decisions.md:224-226`): the WE-docs *website* is a free consumer that may render FUI
  and run WE runtimes; *"the one guard — … never a build-time `import '@frontierui'` into its build; that import
  would invert the direction (#700/#239) and is the only thing that actually violates the boundary."* So an
  exec'd vendored artifact is boundary-safe; a build-time import is not.
- **WE does NOT consume `@frontierui/*` as packages.** Zero `frontierui` entry in `we:package.json` /
  `we:package-lock.json`; no `we:node_modules/@frontierui`. They are **vite/tsconfig sibling-source aliases** to
  `../frontierui` (`we:vite.config.mts:270-274` — *"Release builds use the published package"* is aspirational;
  `we:tsconfig.json:18-24`). FUI publishes **nothing** to npm: `fui:package.json:5` `private:true`, no publish
  script; the `@frontierui` scope is held *"restricted until an explicit go"* (`we:docs/agent/platform-decisions.md:601-640`,
  #907). WE's own CI already checks out the FUI sibling for both the alias and the CLI
  (`we:.github/workflows/ci.yml:38-53`).
- **The built CLI is NOT self-contained (the load-bearing correction).** `fui:scripts/build-tools.mjs:56`
  bundles with `packages:'external'`; `fui:scripts/build-tools.mjs:34-39` keeps happy-dom (+ transitive CJS
  `iconv-lite`/`safer-buffer`) *out* of the bundle, *"resolved at runtime from FUI's own `node_modules`."* The
  emitted artifact confirms it — `fui:dist/tools/component-render/cli.mjs:4` is a bare
  `import { Window } from "happy-dom";`. (The *"bundles happy-dom IN"* comment at
  `fui:scripts/build-tools.mjs:15-16` is **stale/wrong**, contradicted by the code below it and the emitted
  bytes.) WE *happens* to carry `happy-dom: ^12.10.0` (`we:package.json:82`, same range as `fui:package.json:110`),
  so a vendored CLI would run — **but resolved against WE's lockfile, not FUI's.**
- **The #1867 reproducibility invariant attaches to FUI's lockfile.** `{#ssr-data-table-build-harness}`
  (`we:docs/agent/platform-decisions.md:1503-1505`, #1867) ratifies the artifact is *"invoked from within the
  FUI checkout against FUI's locked lockfile — reproducible."* Vendoring silently **retargets** that invariant
  to WE's lockfile: if WE's and FUI's happy-dom ever resolve differently, WE emits different SSR bytes than
  FUI's own harness tests assert (cross-repo render-skew — the exact thing the anchor prevents).
- **The "pin" today is not a version.** #1946/#2016 define "pin" as a *locked artifact at a fixed path + a
  producer string*, never a semver — so in practice WE builds against *"whatever `../frontierui` HEAD built."*
  Whatever mechanism #2158 picks must add a real version handle.

## Finding (post-skeptic, post-screen)

**Interim (now): vendor the prebuilt CLI into WE, execed as today, with a *runtime-dep* pin. End-state: npm
publish, when the `@frontierui` scope opens.** npm-publish is the only option that *dissolves* the happy-dom
coupling (a published `@frontierui/component-render` declares happy-dom as its own dependency, npm-resolved
reproducibly) — but it needs the held-scope governance "go" + a new publish pipeline, an external gate this
decision cannot clear. So the actionable default is a **vendored bridge**, but it must be pinned correctly: the
pin is the built artifact **+ the exact happy-dom / transitive versions + a WE-lockfile constraint matching
FUI's** (not a bare commit hash), and `codifiedIn` must **amend the #1867 anchor's "from within the FUI
checkout" clause** so statute and reality don't diverge. This *removes the FUI read from the deploy path* (a
fresh clone builds; the credential survives only in one scheduled sync job that regenerates the vendored
artifact + runs the existing `EXPECTED_PRODUCER` pin-check so a bad vendor fails loud) — it does not "drop the
PAT" outright.

Rejected: **sibling checkout** (status quo — the thing removed); **git submodule / GH-release-fetch** (still need
a private-repo read credential in CI, don't unlock Workers Builds); **committing FUI tool *source* and building
it in WE** (WE compiling FUI impl — a zero-impl / memory-rule-#6 violation). Boundary/zero-impl does *not* bar
the vendored *exec'd* artifact — it is a build cache, not WE-authored impl, and the process boundary is the
sanctioned mechanism — but the anchor should explicitly disclaim it.

- Skeptic: **SURVIVES-WITH-AMENDMENT** — the "self-contained artifact" premise was refuted
  (`fui:scripts/build-tools.mjs:56` + `fui:dist/tools/component-render/cli.mjs:4`); folded in the happy-dom pin,
  the #1867 amendment, the PAT re-wording, and naming npm-publish as the end-state.
- Screen: **CLEAR** — observable (repo layout + single-repo CI capability) and merit-bearing (build
  hermeticity / reproducibility, not prioritization).

## Net

Vendor a correctly-pinned prebuilt artifact now (interim), graduate to `@frontierui/component-render` npm-publish
when the scope opens (end-state). The version handle must lock the runtime deps, and the ruling amends #1867.
