---
kind: decision
size: 5
status: open
dateOpened: "2026-07-02"
preparedDate: "2026-07-09"
tags: [deploy, ci, fui, build, cross-repo]
---

# Package FUI component-render so the WE site builds single-repo (drop the cross-repo CI checkout)

> **Prep note (2026-07-09, `/prepare all`).** No `/research/` topic — this ratifies a distribution mechanism
> over shipped constellation build tooling. A hostile skeptic pass **corrected the framing**: the end-state
> direction (FUI ships the tool, WE consumes it single-repo) survives, but every *supporting* claim in the
> earlier draft was refuted or amended. Folded: (1) Option B is **dominated on merit, not statute-broken** — the
> `{#zero-impl}`/#6 citation was a mis-cite; (2) a **cheaper option D (git-dependency)** the draft never weighed
> delivers the same wins without a publish pipeline; (3) the **credential is swapped, not dropped**, and
> **happy-dom lands in WE either way**; (4) the real statute anchor is **#1946** (`we:docs/agent/platform-decisions.md:1498-1508`,
> which this decision *amends*), plus an **embed-boundary collision** (`@frontierui/*` never in WE `node_modules`)
> the draft never cited; (5) Fork 2 (source vs bundle) is **FUI-internal packaging**, demoted out of a fork.

## Grounding digest

- **The shell-out to package.** WE's `build:docs` (Eleventy) invokes the FUI CLI via
  `execFileSync('node', [cliPath])` in `we:scripts/lib/component-render-build-hook.cjs:84`; the path is built at
  `we:scripts/lib/component-render-build-hook.cjs:76` from `FUI_CLI_RELATIVE`
  (`we:scripts/lib/component-render-build-hook.cjs:46`) → the FUI sibling build output
  `fui:dist/tools/component-render/cli.mjs`, with a `WE_FUI_ROOT` override
  (`we:scripts/lib/component-render-build-hook.cjs:59-63`). **A second CLI moves too:** the data-table tool,
  `we:scripts/lib/data-table-build-hook.cjs:35` → `fui:dist/tools/data-table-build/cli.mjs`.
- **The "existing `@frontierui/*` npm line" does not exist as published packages.** WE's `we:package.json` has
  **zero** `@frontierui/*` deps (`we:package.json:97-101`); the specifiers resolve via a tsconfig path alias to
  sibling source (`we:tsconfig.json:18-19`, `@frontierui/plugs` → `fui:plugs/index.ts`), a vitest alias
  (`we:vitest.config.ts:132,134`), and a runtime CDN import — never a registry install. FUI is `"private": true`
  (`fui:package.json:5`), `@frontierui/blocks` is `"private": true` (`fui:blocks/package.json:6`), and there is
  no `publishConfig`/`npm publish`/registry auth anywhere. So "publish under the existing line" is **new
  pipeline**, not reuse.
- **#1946 is the ratified anchor this decision amends, and it makes the happy-dom fact load-bearing.**
  `we:docs/agent/platform-decisions.md:1498-1508` (#1946) ratified: FUI's `build:tools` esbuild-bundles the CLI
  to a fixed path, and **`node_modules` deps stay external (happy-dom's CJS transitive deps can't be
  ESM-bundled), so the artifact is invoked from within the FUI checkout against FUI's locked lockfile**, with WE
  resolving a fixed relative path (no version probe) and FUI's `build:tools` running before WE's `build:docs`.
  This decision **amends #1946**: "invoked from within the FUI checkout" → "resolved from WE's `node_modules`."
  The happy-dom externality is not incidental — it is why the current design keeps the artifact in FUI's
  checkout, and any consuming option must satisfy `happy-dom` in WE's `node_modules`.
- **B is dominated on merit, NOT statute-broken (mis-cite corrected).** `{#zero-impl}`/#6 governs the *source
  arrow* (WE→FUI, `we:docs/agent/platform-decisions.md:96`) and *canonical home* — not physical presence at
  build time. Under *every* option (A/B/C/D **and the status quo**) WE runs FUI's generator at its own build
  (`we:scripts/lib/component-render-build-hook.cjs:84`) — sanctioned since #1946 — so zero-impl does not
  distinguish B from the rest; #1771 (`we:docs/agent/platform-decisions.md:102-109`, "a generator that runs an
  impl … is impl → FUI") cuts equally against all of them, and the doc explicitly sanctions committed cross-seam
  bytes as the interim ("byte-replication is the interim", `we:docs/agent/platform-decisions.md:142`). What
  actually sinks B is engineering: the `packages:'external'` bundle (`fui:scripts/build-tools.mjs:56`) won't run
  without `happy-dom` in WE anyway, plus re-vendor-on-every-FUI-change toil (staleness caught only by the
  runtime producer-pin, `we:scripts/lib/component-render-build-hook.cjs:91`). B is a **dominated tradeoff**, not
  an invariant-broken branch.
- **Embed-boundary collision the draft missed.** `we:docs/agent/platform-decisions.md:200` (#1246/#697) rules
  `@frontierui/*` **never in WE `node_modules`**. A package literally named `@frontierui/component-render` in
  WE's `node_modules` walks into that scope. The rule's turf is *runtime block imports* (the Vite alias); a
  build-time exec'd CLI subprocess is plausibly a carve-out — but this decision must **either name the package
  outside `@frontierui/*` or amend the embed-boundary rule**, and cite it. (Neither the draft nor #872 does.)
- **#872 is a *different* flow — not the authority.** #872 is **WE-publishes-TYPE-ONLY, FUI→WE arrow**
  (`we:backlog/872-*.md`). This decision is **FUI-publishes-IMPL, WE→FUI arrow** — opposite payload and arrow.
  #872 is at most a rhyme ("a package crosses the seam"); the FUI→WE build-tool-consumable flow needs its **own**
  statute basis, which this decision sets.
- **The deploy steps a solution deletes.** `we:.github/workflows/deploy.yml:33-38` (the FUI checkout +
  `FUI_READ_TOKEN`) and `:48-53` (`build:tools`). But the **credential is swapped, not dropped**: a consuming
  option replaces `FUI_READ_TOKEN` with a git-read token (D) or a registry `NPM_TOKEN` (A). And **`happy-dom`
  (→ iconv-lite/safer-buffer) lands in WE's `node_modules` either way** — a heavy tree into a 3-dep repo
  (`we:package.json:97-101`), an honest cost of the whole approach.

## Axis-framing

The live axis is **how WE's build-time dependency on FUI's component-render + data-table CLIs is *delivered*** so
a single-repo checkout can build the docs. Running the fork-existence test: this is an **ordinary multi-option
build-distribution decision**, not a statute-forced fork — no branch is *broken* by an invariant (the earlier
"B breaks zero-impl" framing was a mis-cite); the branches (ship-a-consumable, vendor, fetch, or keep the
status-quo sibling checkout) are mutually-exclusive delivery mechanisms weighed on merit + cost. The honest
merit line: **A/D (FUI ships a consumable WE installs) beat the status-quo sibling checkout on *operational*
grounds** — single-repo build, unblocks Cloudflare native Workers Builds, lockfile/SHA pin — while B/C are
*dominated* by the happy-dom/staleness costs. The value is architectural-operational (a cleaner build topology),
not a broken build (status quo deploys green today via #1137's workaround). Which layer: this is FUI *impl* WE
consumes, so the end-state is FUI ships / WE installs. Fork 1 turns on a code-level shape (package manifest +
build-hook resolution), so it carries a code example. Fork 2 (source vs bundle) is FUI-internal packaging —
demoted to a support-both constraint below.

## Recommended path at a glance

| Fork | Question | Recommended default (post-skeptic) | Alternatives |
| --- | --- | --- | --- |
| 1 | How is the component-render (+ data-table) CLI delivered to WE's build? | **FUI ships the tool as a consumable package WE installs; the build hook resolves it from `node_modules`.** Beats the status-quo sibling checkout on operational grounds (single-repo build, Workers Builds, lockfile pin). | **status-quo sibling checkout** (works today; couples the build cross-repo — the incumbent A/D improve on operationally, not on correctness) · **(B) vendor the built CLI** (dominated — happy-dom trap + re-vendor toil; *not* statute-broken) · **(C) fetch at build** (dominated — network + still needs publish + happy-dom) |
| 1-sub | Delivery channel for "FUI ships a consumable" | **(D) git-dependency — WE installs FUI at a pinned SHA/tag via a git-read token; drops the registry + publish workflow while keeping single-repo resolution + a lockfile/SHA pin.** | **(A) private registry** (GitHub Packages + `NPM_TOKEN` + a publish workflow) — pick only if a registry is independently wanted; strictly more infra than D for the same WE-facing win |

**Supported by default (not a fork):**
- **Fork 2 (source vs bundle) is FUI-internal packaging.** WE's consumption is identical either way
  (`require.resolve(...)` + exec); the only WE-facing contract is **"the installed package runs self-contained
  after `npm ci`."** FUI satisfies it by shipping source **or** bundle-and-declare-`happy-dom` (the earlier
  draft's "bundle is broken" rejected only bundle-*without*-declaring happy-dom — a strawman). FUI's call; not a
  ratifiable fork. `happy-dom` lands in WE `node_modules` under both — an unavoidable cost of the approach, not a
  discriminator.
- **The pin resolves for free.** A pinned SHA/tag (D) or a locked dep (A) in `we:package-lock.json` *is* the
  declared-version pin `npm ci` reproduces — closing the `we:scripts/lib/data-table-build-hook.cjs:32` "no
  version probe" gap regardless of channel.
- **Both CLIs move together** (component-render + data-table, `we:scripts/lib/data-table-build-hook.cjs:35`).

## Fork 1 — How the CLI is delivered to WE's build

**Fork exists because** the delivery mechanisms are mutually-exclusive (WE resolves the CLI from a `node_modules`
package, a committed file, a fetched file, or the sibling checkout — one wins) and they differ on real merit
(single-repo build + pin vs cross-repo coupling vs vendor toil). No branch is invariant-*broken* — this is a
weighing, and the winner is "FUI ships a consumable WE installs," which beats the incumbent on operational
grounds and dominates B/C on cost.

- **FUI ships a consumable package WE installs (default).** WE depends on the tool (both harnesses); the build
  hooks resolve it from `node_modules` instead of the FUI sibling path
  (`we:scripts/lib/component-render-build-hook.cjs:76`). Deletes the sibling checkout + `build:tools` from
  `we:.github/workflows/deploy.yml:33-38,48-53`, gives a single-repo build (unblocks Workers Builds), and a
  lockfile/SHA pin. **Honest caveats:** the credential is *swapped* (git-read token or registry `NPM_TOKEN`),
  not dropped; `happy-dom` still lands in WE's `node_modules`; and the package must be named/carved to satisfy
  the embed-boundary rule (`we:docs/agent/platform-decisions.md:200`).
  - **Sub-fork — channel: (D) git-dependency (default) vs (A) private registry.** D installs FUI at a pinned
    SHA/tag with a git-read token — same WE-facing win (node_modules resolution + pin), **no registry, no
    publish workflow**. It still needs FUI shaped so the tool is a resolvable package (FUI root/`blocks` are
    `"private": true`, and npm git-deps install the repo-root package — so a standalone-package or subdir shaping
    is required either way). A (private registry) is strictly more infra for the same win — choose it only if a
    registry is independently on the roadmap.
- **Status-quo sibling checkout (incumbent — operationally worse, not broken).** Keep
  `we:.github/workflows/deploy.yml:33-38`. Deploys green today (#1137). Its cost is the cross-repo coupling this
  card exists to remove (a second-repo PAT, per-deploy FUI build, no single-repo build) — an operational
  deficit, not a correctness one. The default beats it on those operational grounds; name it honestly rather
  than pretend it's broken.
- **(B) vendor the built CLI (dominated).** Commit the bundle into WE. The `packages:'external'` bundle
  (`fui:scripts/build-tools.mjs:56`) won't run without `happy-dom` in WE anyway, and it adds re-vendor-on-change
  toil (staleness caught only by the producer-pin, `we:scripts/lib/component-render-build-hook.cjs:91`).
  Dominated — **but not statute-broken** (byte-replication is a sanctioned interim,
  `we:docs/agent/platform-decisions.md:142`).
- **(C) fetch the artifact at build (dominated).** Network dependency + still needs FUI to publish + still needs
  `happy-dom` locally. Strictly dominated by D.

Package + resolution shape under the default (D + FUI-internal source/bundle; keyed to the real hook):

```jsonc
// FUI: shape the tool as a resolvable package (un-privated / standalone), pinned by SHA or tag.
{ "name": "@fui-tools/component-render",           // named OUTSIDE @frontierui/* to clear the embed-boundary rule
  "bin": { "component-render": "./dist/cli.mjs", "data-table-build": "./dist/data-table-cli.mjs" },
  "dependencies": { "happy-dom": "^15.0.0" } }     // declared → npm ci resolves it (source OR bundle-and-declare)
```
```js
// we:package.json — (D) git-dependency pinned at a SHA (the pin the current build lacks):
//   "dependencies": { "@fui-tools/component-render": "github:chalbert/frontierui-component-render#<sha>" }
// we:scripts/lib/component-render-build-hook.cjs — resolve from node_modules, not the sibling path (:76):
const cliPath = require.resolve('@fui-tools/component-render/dist/cli.mjs'); // was: the FUI sibling build output
// (B/C dominated) — a vendored/fetched CLI still needs happy-dom in WE node_modules per build-tools.mjs:56.
```

**Skeptic:** REFUTED-then-corrected (hostile 4-axis attack). **(0) Classification — REFUTED:** "B broken by
`{#zero-impl}`/#6" was a mis-cite (zero-impl governs the source arrow/home, not build-time presence; #1771 +
`:142` show A/D/status-quo all run the FUI generator too) — B demoted to *dominated*, and the fork reframed as an
ordinary weighing, not statute-forced. **(1) Merit — SURVIVES-WITH-AMENDMENT:** the missing **option D
(git-dependency)** was added as the cheaper default (A's wins without a publish pipeline); the "drop the
credential" claim was corrected to *swap*, and the happy-dom bloat counted as a real cost of A/D. **(2)
Statute-overlap — REFUTED→reconciled:** the real anchor is **#1946** (`we:docs/agent/platform-decisions.md:1498-1508`,
amended here), plus the **embed-boundary** collision (`:200`) now cited with a carve-out/rename requirement; the
#872 mis-citation (opposite arrow + payload) was removed. **(3) Citation-scope — REFUTED→fixed:** #872 no longer
cited as authority; this decision sets the FUI→WE consumable-tool basis itself.

**Screen:** flagged(prio)+flagged(impl) → fixed. The fresh-context screen found (Fork 1) A-over-status-quo is
*operational*, not merit — folded by adding the status-quo branch and framing the win as operational; and
(Fork 2) source-vs-bundle is FUI-internal packaging invisible to WE — folded by demoting Fork 2 to a
support-both constraint ("runs self-contained after `npm ci`"). Only B's exclusion carries a (dominated-tradeoff)
merit note; nothing is laundered through #872.

## Done when (unchanged from the original)

`npm ci && npm run build:docs` succeeds in a fresh single-repo checkout of `we:` (no `../frontierui` present),
and `we:.github/workflows/deploy.yml` drops the FUI checkout + `FUI_READ_TOKEN`.

---

Relates #1137 (the auto-deploy workaround this removes), #1946 (the pinned-artifact-from-FUI-checkout rule this
*amends*, `we:docs/agent/platform-decisions.md:1498-1508`), #2016 (the component-render harness it distributes),
#872 (a *different* WE→consumers type-only flow — a rhyme, not the authority). Ratifying = pick the channel (D
git-dep default / A registry), settle the embed-boundary package name, then file the FUI package-shaping story +
the WE hook-repoint story.
