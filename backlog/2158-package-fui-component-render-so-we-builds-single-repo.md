---
kind: decision
size: 5
status: open
dateOpened: "2026-07-02"
preparedDate: "2026-07-09"
relatedReport: reports/2026-07-09-single-repo-docs-build-fui-tool-distribution.md
tags: [deploy, ci, fui, build, cross-repo, decision]
---

# Package FUI component-render so the WE site builds single-repo (drop the cross-repo CI checkout)

## Context

WE's Eleventy `build:docs` renders FUI components by **subprocess-exec** of FUI's component-render CLI at
`we:../frontierui/dist/tools/component-render/cli.mjs` (`we:scripts/lib/component-render-build-hook.cjs:50`) —
deliberately an exec, not an import. So a single-repo checkout of WE **cannot build the docs**; the live deploy
(#1137) checks out + builds the FUI sibling with a `FUI_READ_TOKEN` PAT + a full FUI `build:tools` per deploy,
which also rules out Cloudflare's single-repo **Workers Builds**. Decide the distribution mechanism.

> **Prep note (2026-07-09, `/prepare all`).** Grounded by research topic
> [`single-repo-docs-build-fui-tool-distribution`](/research/single-repo-docs-build-fui-tool-distribution/)
> (report [we:reports/2026-07-09-single-repo-docs-build-fui-tool-distribution.md](../reports/2026-07-09-single-repo-docs-build-fui-tool-distribution.md)).
> The survey **corrected the item's premise**: WE does *not* consume `@frontierui/*` as packages (they are
> sibling-source aliases; FUI publishes nothing to npm, scope held), and the built CLI is **not
> self-contained** — it `import`s happy-dom at runtime, so vendoring must also pin the runtime deps and
> reconciles against the #1867 reproducibility anchor. Prepared default: **vendor a correctly-pinned artifact
> now (interim); npm-publish is the coupling-dissolving end-state, gated on the held `@frontierui`-scope go.**

## Grounding digest

- **Exec, not import — and that's the boundary line.** `we:scripts/lib/component-render-build-hook.cjs:18-22`:
  *"a WE→FUI code import is a banned backward DAG edge … So WE orchestrates the FUI compute over a process
  boundary."* `{#we-fui-embed-boundary}` rule 6 (`we:docs/agent/platform-decisions.md:224-226`) names a
  build-time `import '@frontierui'` as *"the only thing that actually violates the boundary."* An exec'd
  vendored artifact is boundary-safe.
- **No `@frontierui/*` package pipeline exists.** Zero `frontierui` dep in `we:package.json`; the aliases are
  vite/tsconfig sibling-source (`we:vite.config.mts:270-274`, `we:tsconfig.json:18-24`). FUI is
  `fui:package.json:5` `private:true`; the `@frontierui` scope is *"restricted until an explicit go"*
  (`we:docs/agent/platform-decisions.md:601-640`, #907). WE's CI already checks out the FUI sibling
  (`we:.github/workflows/ci.yml:38-53`).
- **The built CLI is NOT self-contained.** `fui:scripts/build-tools.mjs:56` bundles `packages:'external'`;
  `fui:dist/tools/component-render/cli.mjs:4` is a bare `import { Window } from "happy-dom";` resolved at
  runtime. WE carries `happy-dom: ^12.10.0` (`we:package.json:82`, same range as `fui:package.json:110`), so a
  vendored CLI runs — but against **WE's lockfile, not FUI's**.
- **#1867 reproducibility attaches to FUI's lockfile.** `{#ssr-data-table-build-harness}`
  (`we:docs/agent/platform-decisions.md:1503-1505`): the artifact is *"invoked from within the FUI checkout
  against FUI's locked lockfile — reproducible."* Vendoring retargets that to WE's lockfile → cross-repo SSR
  render-skew unless the runtime deps are pinned too.
- **Today's "pin" is not a version.** #1946/#2016 = a locked artifact at a fixed path + the producer string
  `frontierui/component-render-build-harness/1`, never a semver — WE builds against *"whatever `../frontierui`
  HEAD built."*

## Axis-framing

Two live axes: (Fork 1) **the distribution mechanism** — how WE gets the tool without the sibling checkout; and
(Fork 2) **what the version pin must capture** — the item flags "build against a declared FUI version, not
whatever sibling is on disk" as real. Fork 1 is a **real fork** (three physically different repo/CI end-states;
they cannot coexist). Fork 2 is a **real fork** because the naive pin (a commit hash) is *broken* — it does not
lock the runtime deps the #1867 invariant depends on. Which layer: this is a **WE-website build-infra** decision
(the website is a free FUI consumer, boundary rule 6), not a WE-standard placement — the 7-question layer pass
is N/A. Both forks turn on concrete build wiring, so each carries a code example.

## Recommended path at a glance

| Fork | Question | Recommended default (post-skeptic) | Main alternative (excluded) |
| --- | --- | --- | --- |
| 1 | How does WE get the component-render tool single-repo? | **(b) Vendor the prebuilt CLI into WE (interim), execed as today; graduate to (a) npm-publish as the end-state when the `@frontierui` scope opens.** | **(a) npm-publish `@frontierui/component-render`** (the coupling-dissolving end-state — blocked on the held-scope go + a new pipeline) · **(c) keep the sibling checkout** (status quo — the thing removed) |
| 2 | What does the FUI version pin capture? | **The built artifact + the exact happy-dom / transitive (`iconv-lite`/`safer-buffer`) versions + a WE-lockfile constraint matching FUI's; `codifiedIn` amends the #1867 "from within the FUI checkout" clause.** | A bare FUI commit hash / `we:fui.pin.json` alone (broken — leaves the runtime deps unlocked, re-opening render-skew) |

## Fork 1 — The distribution mechanism

**Fork exists because** the three mechanisms leave *physically different* repo + CI end-states that cannot
coexist — a published package, a committed artifact, or a required sibling source tree — and the *flawed*
branch (keep the sibling checkout) is broken against the item's own "done when" (single-repo build, no PAT in
deploy, Workers Builds).

- **(b) Vendor the prebuilt CLI into WE — interim default.** Commit the `build:tools` output (the CLI) at a
  fixed WE path, consumed via the **existing subprocess exec** (boundary-safe — a build cache, not WE-authored
  impl), with the Fork-2 pin. A scheduled **sync job** regenerates it (the one place a FUI read remains — not
  every deploy) and runs the existing `EXPECTED_PRODUCER` pin-check so a bad vendor fails loud. This *removes
  the FUI read from the deploy path* — a fresh clone builds, and single-repo Workers Builds unlock. (Not "drops
  the PAT" outright — it survives in the sync job.)
- **(a) npm-publish `@frontierui/component-render` — the end-state.** A published package declares happy-dom as
  its *own* dependency, so npm resolves it reproducibly — this is the only option that **dissolves** the
  happy-dom coupling (Fork 2). But it needs the held-scope governance "go" + a new publish pipeline, an external
  gate this decision cannot clear, and a private-scope package still needs a registry-read credential unless
  published public (which the scope posture forbids). **Named as the graduation target**, not the now-answer.
- **(c) Keep the sibling checkout — rejected (status quo).** The `FUI_READ_TOKEN` + per-deploy FUI `build:tools`
  the item exists to remove; blocks Workers Builds; a fresh WE clone can't build.

```yaml
# (b default) — deploy.yml drops the FUI checkout + PAT + build:tools; WE builds from its own vendored CLI:
#   - run: npm ci && npm run build:docs          # resolves we:vendor/frontierui/component-render/cli.mjs
# A separate scheduled sync job (the only FUI read left) regenerates the vendored artifact:
#   - run: node we:scripts/sync-fui-render-tool.mjs  # clone FUI@pin, build:tools, copy cli.mjs, write the pin,
#                                                    # assert EXPECTED_PRODUCER — fail loud on drift
```

**Skeptic:** SURVIVES-WITH-AMENDMENT (hostile refutation, four axes). **(0) Classification:** a real
near-term-mechanism fork; npm-publish is the right *kind* of end-state but gated externally, so a vendored
bridge is legitimate — not a config-dimension, not already-settled. **(1) Merit:** the *"self-contained
CLI"* premise was **refuted** (`fui:scripts/build-tools.mjs:56` `packages:'external'`;
`fui:dist/tools/component-render/cli.mjs:4` imports happy-dom) — folded into Fork 2. Boundary/zero-impl does
*not* land (exec, not import; a build cache). **(2) Statute-overlap:** vendoring **collides with the #1867
anchor** (`:1503-1505` "from within the FUI checkout against FUI's locked lockfile") → `codifiedIn` must *amend*
that clause, not just add one (Fork 2). **(3) Citation-scope:** the boundary rule authorizes the exec'd
artifact; #907's scope-hold authorizes deferring (a), not blocking the interim. "Drops the PAT" re-worded to
"removes it from the deploy path." **Screen:** clear (fresh-context two-confusion). (1) Contract-visible — repo
layout + single-repo CI capability flip between branches. (2) Merit remains free-of-cost — build
hermeticity/reproducibility (a network read + live cross-repo source vs an in-tree artifact) is a
correctness-of-build property, not prioritization.

## Fork 2 — What the version pin captures

**Fork exists because** the intuitive pin — a FUI commit hash / a `we:fui.pin.json` — is *broken*: the built CLI
imports happy-dom at runtime (Fork-1 finding), so a pin that locks only the artifact leaves the **runtime deps**
free, and the #1867 reproducibility invariant (which today rests on *FUI's* lockfile) silently moves to WE's.
Two coherent pins cannot both be *the* pin.

- **(default) Lock the runtime deps too.** The pin = the built artifact **+ the exact happy-dom + transitive
  (`iconv-lite`/`safer-buffer`) versions + a WE-lockfile constraint matching FUI's**, and `codifiedIn` amends
  the #1867 anchor's *"from within the FUI checkout"* clause to *"against a WE lockfile pinned to match FUI's
  for the harness runtime deps."* This preserves reproducibility across the vendored boundary.
- **(excluded) Bare commit hash / `we:fui.pin.json` alone.** Records *which FUI built the CLI* but not *what it
  runs against* — re-opens cross-repo SSR render-skew the moment WE's and FUI's happy-dom resolve differently.
  Dominated.

**Skeptic:** SURVIVES (this fork *is* the folded-in amendment from Fork 1's refutation — the pin must lock the
runtime deps or the #1867 invariant breaks; no further attack survives once the deps are pinned). **Screen:**
clear — contract-visible (the pin's content is what a future FUI bump validates against) and merit-bearing
(reproducibility), not prioritization.

## Downstream

Ratifying (b)+(Fork 2): add `we:vendor/frontierui/component-render/` (the CLI) + a pin manifest locking
happy-dom/transitives, point `we:scripts/lib/component-render-build-hook.cjs` at the vendored path (keep the
`EXPECTED_PRODUCER` check), add `we:scripts/sync-fui-render-tool.mjs` (scheduled), drop the FUI checkout + PAT +
`build:tools` from `we:.github/workflows/deploy.yml`, constrain `we:package.json` happy-dom to FUI's exact
version, and **amend the #1867 anchor** in `we:docs/agent/platform-decisions.md`. File `@frontierui`-npm-publish
as a follow-up graduation item gated on the scope-go. Relates #1137 (workaround removed), #2016 (tool),
#1946/#1867 (pin/reproducibility).

---

Prep research:
[we:reports/2026-07-09-single-repo-docs-build-fui-tool-distribution.md](../reports/2026-07-09-single-repo-docs-build-fui-tool-distribution.md);
research topic [`single-repo-docs-build-fui-tool-distribution`](/research/single-repo-docs-build-fui-tool-distribution/).
