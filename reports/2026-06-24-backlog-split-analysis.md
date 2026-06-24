# Backlog split analysis — #1684 emitter buildout (graduated from #1688)

**Date:** 2026-06-24
**Focus:** `/slice 1684` — materialize the emitter build slices graduated by the #1688 ratification.
**Verdict:** **could split — 6 new slices** added under the already-storied epic #1684 (no conversion needed).

## Context

#1684 (`kind: epic`, webrouting standard) is already a storied epic: its four decision children
(1685–1688) are **resolved**, and it carries build slices A–E (1725–1729) plus 1720 (runtime ingestion),
1721 (route-map projection schema), 1732 (route-config schema). The resolved #1688 ratified the **emitter
set + dynamic-route policy** and explicitly graduated its build "under #1684 via `/slice 1684`: the emitter
registry + four emitters as separately-prioritized build items, plus the Fork-1 param-source hook." **None
of the existing slices cover that** — slice E (1729) is route-format/url-as-state conformance, not emitter
output. So this run *adds* emitter slices; it does not re-slice the epic.

## Work-investigation pass (real tree)

- The kernel every emitter reads is the **serializable route-map projection** (#1685 ratified, schema =
  slice 1721): `routes[].path` derived from `RouteDefinition` (`we:blocks/router/types.ts:131`) by
  `parseRouteDefinitions()` (`we:blocks/router/types.ts:194`), dropping `pattern: URLPattern` and
  `template: HTMLTemplateElement`.
- Slice 1721 explicitly parks the **DOM→map builder**: *"the derived-map BUILDER is not this slice; it
  folds into the first consuming slice (#1688 sitemap)."* → the registry/builder slice (S1) below owns it.
- Each emitter is a **pure facade over `routes[].path`** producing one downstream artifact, so they are
  independent siblings, not a chain. Output formats are known standards (no invention): `sitemaps.org/0.9`,
  `<script type="speculationrules">` (`we:src/_data/blocks/router.json:192`), a hierarchical nav-tree
  (mirrors `@11ty/eleventy-navigation`), a prerender path-manifest.
- **Constellation homing:** WE holds the **derivation + conformance vectors** (the headless-DOM builder is a
  permitted author/validate derivation per `#single-authoring-sot-derived-projection`; 1721 already frames it
  that way). A browser-runtime emitter impl rides downstream to FUI on the contract — out of scope for these
  WE slices. Each slice's deliverable = derivation logic + conformance vectors (route-map input → expected
  artifact).
- Fork 2's composition (IA-tree realizes the Navigation Intent `structure` axis,
  `we:src/_data/blocks/router.json:146`) and Fork 1's exclude-by-default + opt-in param-source live in S3
  and S6 respectively.

## Could split — proposed slices (all under epic #1684, no conversion)

| # | Title | workItem / size | blockedBy | Batchable |
| --- | --- | --- | --- | --- |
| S1 | webrouting emitter registry + route-map builder | story / 3 | 1721, 1725 | after S1's deps land |
| S2 | webrouting sitemap.xml emitter (`sitemaps.org/0.9`) + vectors | task | S1 | ✓ |
| S3 | webrouting IA nav-tree emitter (realizes Navigation Intent `structure`) + vectors | task | S1 | ✓ |
| S4 | webrouting prerender manifest emitter + vectors | task | S1 | ✓ |
| S5 | webrouting Speculation-Rules emitter (`<script type=speculationrules>`) + vectors | task | S1 | ✓ |
| S6 | webrouting dynamic-route param-source hook + build-time skip notice | story / 2 | S1 | ✓ |

**DAG (flat — max independence):**

```
1721 (projection schema) ─┐
1725 (slice A skeleton)  ─┴─→ S1 registry+builder ─┬─→ S2 sitemap.xml emitter
                                                    ├─→ S3 IA nav-tree emitter
                                                    ├─→ S4 prerender emitter
                                                    ├─→ S5 Speculation-Rules emitter
                                                    └─→ S6 param-source hook  (consumed by S2 + S4)
```

S2–S6 are independent siblings off S1. S6's param-source hook **additively** enriches the concrete-URL
emitters (S2, S4) — they ship with exclude-by-default first (valid demoable state: static routes only), and
the hook is the opt-in enumeration capability layered on. So no hard S2←S6 edge; the hook is authorable
against S1 alone.

## Rubric check (all five hold)

1. **Size is volume, not a fork** — settled at the epic + #1688 ratification (support-all + both fork
   defaults). No buried fork; every policy is ratified and codified (`#faithful-derivation-exclude-not-fabricate`).
2. **≥2 nameable slices, real home each** — 6 slices; each a distinct emitter/mechanism with a concrete WE
   home (derivation + vectors under the webrouting standard). #1688 *mandated* the four emitters as separate items.
3. **Each slice ≤3 / task** — S1 story·3, S6 story·2, S2–S5 tasks.
4. **Clean DAG, real independence** — S2–S5 produce disjoint artifacts (different format/consumer); each
   independently deliverable off S1.
5. **Every slice leaves a valid demoable state** — S1 yields the registry + route-map (renders);
   each emitter adds one artifact independently; sitemap-with-static-routes is valid without S6.

## Could not split

None — all six pass. (The downstream FUI runtime impl of each emitter is out of scope here, not a
could-not-split: it rides the WE contract these slices define, filed under FUI when a consumer needs it.)

---
---

# Split analysis — #1391 dev-browser shell build (re-screen after blockers resolved)

**Focus:** `/slice 1391` — re-screen the dev-browser shell epic now that its three blockers resolved.
**Target:** [#1391](/backlog/1391-dev-browser-shell-build-chromium-shell-embedding-plateau-app/) — `kind: epic`, `status: open`, no children (unsliced epic).
**Verdict:** ✅ **Could split** — into 5 slices (1 foundational + 4 independent behind it). All three rubric failures from the [2026-06-22 analysis](reports/2026-06-22-1391-split-analysis.md) are now cleared.

## What changed since 2026-06-22 (why the verdict flips)

The prior run ruled **could-not-split** on three failures and named three unblocking actions. All three have since landed:

| Prior failure | Unblocking action named | Status now |
|---|---|---|
| Panel-embed fork buried in a slice (#141 Fork 4-A) | File as `type:decision` | [#1654](/backlog/1654-dev-browser-panel-embed-boundary-package-import-vs-iframe-we/) **resolved** → *direct package import / `mount*(el)`* |
| In-shell free/paid line buried (#141 commercial-license fork) | File as `type:decision` | [#1655](/backlog/1655-dev-browser-in-shell-free-paid-line-which-shell-capabilities/) **resolved** → *two orthogonal gates: commercial-use license + server-cost tier* |
| Sequencing predecessor (conformance-lit funnel MVP) unfiled | File the leading build | [#1656](/backlog/1656-conformance-lit-extension-funnel-mvp-chrome-devtools-panel-t/) **resolved** (graduated to `plateau:src/dev-browser/chrome-extension/`) |

The epic's `blockedBy: ["1654","1655","1656"]` is now fully cleared, and the funding/timing deferral it leaned on was already lifted by [#1590](/backlog/1590-dev-surface-monetization-bet-extensions-as-funnel-vs-dev-bro/) (resolved 2026-06-22: *build decoupled from release, pursue the full product now*). So #1391 is a fair, fork-free slice candidate today.

Two further dependencies the slices need are also resolved + implemented:
- **Conformance detection** — [#1673](/backlog/1673-conformance-lit-mvp-how-does-the-extension-detect-we-conform/) ratified *probe-first, tiered*, and [#1722](/backlog/1722-public-global-probe-marker-so-the-dev-browser-extension-can-/) shipped the concrete cross-world marker `window.__WE_DEVTOOLS_GLOBAL_HOOK__` (`fui:plugs/webregistries/declarativeRegistry.ts`) + the declarative `script[type="registry"]` probe (`we:plugs/webregistries/declarativeRegistry.ts:39`). So S1's conformance probe reuses a real marker, not a TODO.
- **Capability-manifest gate** — #141 Fork 1A ratified (*per-feature degrade*); S3 lights up against it, no open fork.

## Runtime-form correction (the prior "heavy forked Chromium" framing was too heavy)

#141 Fork 2 settled the runtime form as a **staged path**: extension/DevTools-panel first (= #1656, done) → **standalone dev browser on stock Chromium + CDP/extension APIs** (= this epic) → *Chromium fork only as a last resort, default to not forking* (`we:backlog/141-…md:94-100`). So #1391 is a **stock-Chromium desktop shell** (Electron/CEF-class — bundled, unforked Chromium with custom chrome), **not** a maintained Chromium fork. The Replay-precedent maintenance risk the 2026-06-22 report cited applies to the deferred stage-3 fork, not here. That materially lowers the foundational slice's weight: S1 is "wrap stock Chromium as a desktop shell + port the resolved conformance probe," not "build/maintain a browser engine."

**Residual (low-confidence, flagged not buried):** the S1 *packaging vehicle* (Electron vs CEF vs CDP-driven host). I read this as a **build detail with an Electron default**, not a live fork — the stock-Chrome-via-CDP-only branch is *flawed* (it cannot deliver the two chrome-level requirements #141 names: a full-screen "not WE-compatible" navigation takeover and a management UI *outside* the DevTools dock — neither is reachable from CDP/extension APIs over someone else's Chrome). By the fork-existence test, a flawed branch is not a real fork, so I haven't filed a decision card. If you read the vehicle as a genuine end-state fork, say so and I'll card it and point S1's `blockedBy` at it.

## Investigation — the real tree (`plateau:src/dev-browser/`)

- **No shell exists yet.** `plateau:src/dev-browser/` holds capability modules (`capture/`, `ide-bridge/`, `fault-injector/`, `intent-inspector/`, `variant-simulator/`, `credential-source/`, `declared-rules/`, `forge/`, `headed-surface/`, `pr-body/`) + the #1656 `chrome-extension/` chassis. There is **no** main-process / `BrowserWindow` / electron dep — S1 is a genuine from-scratch (but bounded) scaffold.
- **Panel mounts (S4 targets), citable:** `mountTechnicalConfigurator` (`plateau:src/technical-configurator/configurator.ts:639`), `mountIntentConfigurator` (`plateau:src/intent-configurator/configurator.ts:421`), `mountProfiles` (`plateau:src/profiles/profiles-page.ts:165`) — plain DOM mounts, no framework, same bundle (per #1654).
- **Conformance probe (S1/S3) targets:** `window.__WE_DEVTOOLS_GLOBAL_HOOK__` + `script[type="registry"]` (above).
- **Feature-lighting surface (S3):** the ~11 existing `dev-browser/*` capability modules are what the manifest gate lights up.

## Could split — proposed slices

| Slice | kind / size | Scope (one line) | Home | blockedBy |
|---|---|---|---|---|
| **S1** Shell scaffold + conformance probe on load | `story` · 5 | Stand up the stock-Chromium desktop shell (boots, loads a URL/BrowserView, probes `__WE_DEVTOOLS_GLOBAL_HOOK__` / `script[type="registry"]`); demoable: detects conformant vs non-conformant app | `plateau:src/dev-browser/shell/` (new) | — (foundational) |
| **S2** Navigation interception + "not WE-compatible" screen | `story` · 3 | Intercept top-level navigation; render the full-screen "this site isn't Web Everything-compatible" takeover when the probe says non-conformant | `plateau:src/dev-browser/shell/` | S1 |
| **S3** Conformance-gated feature lighting (capability-manifest gate, #141 Fork 1A) | `story` · 5 | Read the per-feature capability manifest; activate each existing `dev-browser/*` capability against the capability it needs (partial conformance first-class) | `plateau:src/dev-browser/shell/` | S1 |
| **S4** Panel embed via direct import (#1654) | `task` · 3 | Import + call `mountTechnicalConfigurator`/`mountIntentConfigurator`/`mountProfiles` in-process in the shell chrome | `plateau:src/dev-browser/shell/` | S1 |
| **S5** License-gating wiring (#1655 two-gate) | `task` · 3 | Gate-1 commercial-use license check (whole local browser) + Gate-2 server-cost-tier check; no per-capability flag table | `plateau:src/dev-browser/shell/` | S1 |

**DAG:** `S1 → {S2, S3, S4, S5}`. S1 is the single foundational slice; **4 slices proceed independently** once it lands (real independence, not a linear chain). Incremental delivery holds — each slice ships a valid demoable state on its own (shell boots → takeover screen → lit features → embedded panels → license gate).

**Batchable:** S2–S5 are all Tier-A/batchable once S1 resolves (each ≤5, real home, no buried fork). S1 is batchable now (no blockers).

**Rubric check (all five hold):**
1. *Volume not uncertainty* — every fork is resolved upstream (#1654/#1655/#1673/#141 Fork 1A); no slice carries an open call. The S1 packaging vehicle is a defaulted build detail, flagged above.
2. *≥2 nameable slices, real homes* — 5 slices, all homed in `plateau:src/dev-browser/shell/` with citable seams.
3. *Slices land small* — re-estimated 5/3/5/3/3; named files `file:line`-citable from the tree.
4. *Clean DAG, real independence* — acyclic; 4 independent behind S1.
5. *Every slice demoable* — each leaves a valid runnable shell state.

## Could not split

*(none — all rows split)*

## On approval

#1391 is already an epic with no children and no `size` (no conversion needed); refresh its digest to umbrella framing, keep `NNN`, then scaffold S1–S5 with `--parent=1391` and the `blockedBy` edges above; gate on `npm run check:standards`. Net flow: **+5** slices under #1391.

---

# Backlog split analysis — #1353 FUI demo re-host remainder

**Date:** 2026-06-24
**Focus:** `/slice 1353` — entered via `/resolve` (the gate flagged #1353 *all slices done*; scope-review failed). Check whether any of the four remainder families' FUI impl has cleared since the 2026-06-20 carve, making a re-host slice carvable now.
**Verdict:** **could NOT split — 0 carvable slices.** Every remainder family is still gated on a FUI impl that does not exist in the tree. Reconciliation: **declare the stall** on #1353 (file the four FUI-build prerequisites, re-point `blockedBy` + `childlessReason: blocked`).

## Context

#1353 (`kind: epic`, locus frontierui) re-hosts WE demo pages FUI-side so the consuming WE block-runtime families can be deleted (#1326 pattern: build FUI demo → iframe-swap WE page → delete WE family). The 2026-06-20 carve resolved S1–S3 (data-table / pagination / wizard-flow — FUI impl was already complete, only the demo page was missing) plus children #1378/#1379/#1382/#1383/#1494/#1521/#1531. All 10 children are now `resolved` → gate fires *all slices done*. The body's **"Remainder — could-not-split-here, gated on FUI build"** section lists four families whose FUI impl was *not* complete on 2026-06-20.

## Work-investigation pass (real tree, both repos)

The carve note said "re-`/slice` as each gap clears." None has cleared:

- **reorderable-list** — FUI `fui:blocks/renderers/reorderable-list/` now exists (`fui:blocks/renderers/reorderable-list/renderReorderableList.ts`, `fui:blocks/renderers/reorderable-list/reorderState.ts`, a unit test) but is **within-list only**: no cross-list twin (grep `crossList|sourceList|transfer` → 0 hits) and no fixtures dir. WE still owns the Tier-2 cross-list reference `we:blocks/renderers/reorderable-list/renderCrossListReorder.ts` + fixtures. The resolved #146/#151/#920 built the WE/contract side, not the FUI cross-list twin. → **gap NOT cleared**.
- **loader-background-handoff** — FUI `fui:blocks/resource-loader/` exists (`fui:blocks/resource-loader/ResourceLoader.ts`) but has **no `backgroundLoad`/handoff** (grep `background|handoff|referenceReceiver` → 0 hits) and no fixtures. WE still owns `we:blocks/resource-loader/backgroundHandoff.ts` + `we:blocks/resource-loader/handoffContract.ts` + the demo (`we:demos/loader-background-handoff-demo.html`). Resolved #152/#171/#172/#135 built the producer/contract side, not the FUI re-host impl. → **gap NOT cleared**.
- **component-adapter** — **no `fui:blocks/renderers/component/` dir at all.** 4 WE consumer demos (`we:demos/module-as-a-service-demo.ts`, `we:demos/mockup-to-standard-demo.ts`, `we:demos/code-upgrader-demo.ts`, `we:demos/component-adapter-demo.ts`). The cited deps #1286/#1289 are now **resolved but delivered other things** (FUI form-control blocks + graph-node viz) — a false edge ([[feedback_resolved_blocker_can_be_false_edge]]), not the component renderer. → **gap NOT cleared**.
- **bootstrap bundle (7 families + `stores`)** — single importer `we:plugs/bootstrap.ts` shared by 11 demos; **not per-family sliceable** (the body says so, the tree confirms one importer). Needs all 11 demos re-hosted + `we:plugs/bootstrap.ts` relocated, then a bulk delete. → its own **sub-epic**, no clean leaf slice.

## Could not split — per family (which rubric failed + unblocking action)

| Family | Rubric failure | Unblocking action |
|---|---|---|
| reorderable-list (cross-list) | (2)/(5) — no deliverable re-host slice; the FUI cross-list twin + fixtures don't exist | File FUI-build: port `we:blocks/renderers/reorderable-list/renderCrossListReorder.ts` + fixtures into `fui:blocks/renderers/reorderable-list/`; then re-`/slice` the re-host |
| loader-background-handoff | (2)/(5) — FUI `backgroundLoad`/handoff impl absent | File FUI-build: port `we:blocks/resource-loader/backgroundHandoff.ts` + `we:blocks/resource-loader/handoffContract.ts` into `fui:blocks/resource-loader/` + fixtures; then re-`/slice` |
| component-adapter | (2)/(5) — `fui:blocks/renderers/component/` does not exist; #1286/#1289 false edge | File FUI-build: create the FUI component renderer (4 consumers); then re-`/slice` |
| bootstrap bundle | (3) — not per-family sliceable (one shared importer) | File the bootstrap re-host **sub-epic** (11 demos + relocate `we:plugs/bootstrap.ts`) |

## Reconciliation of #1353 (the `/resolve` trigger)

No carvable slice today → #1353 is genuinely **stalled on FUI builds**, the #1167/#1210 *resolve-over-uncarved-scope* trap if closed. The gate's *all slices done* nudge (`we:scripts/check-standards.mjs:748`) is suppressed by either open children or `childlessReason ∈ {blocked,…}`. Honest fix — **declare the stall**:

1. File the four FUI-build prerequisites above as **open** items (`locus: frontierui`); the bootstrap one as `--workitem=epic`, the other three as stories.
2. Set #1353 `blockedBy: [those four]` + `childlessReason: blocked`, and de-bury the body — replace the four remainder bullets with pointers to the filed `#NNN`.

This stops the gate re-flagging it every run, makes #1353 read honestly as blocked on real open FUI work, and each prerequisite becomes a future `/slice 1353` trigger as it lands.

---

# Backlog split analysis — #1768 bootstrap-bundle sub-epic

**Date:** 2026-06-24
**Focus:** `/slice 1768` — carve the bootstrap re-host sub-epic filed earlier this session (seeded from #1353's "7 bootstrap families + `stores`, single importer, future sub-epic" framing).
**Verdict:** **could NOT split — stale premise.** The work-investigation pass shows #1768's framing (inherited from #1353) is wrong on four counts; the seams can't be drawn until #1768 is **re-scoped to the true residual**. No slices proposed.

## Work-investigation pass (real tree, both repos)

- **The plug relocation is already done.** #606 (*where do plugs live*) resolved → **FUI**; #1234 + #1046 (the WE→`@frontierui/plugs` repoint) resolved. WE has **no `plugs/` source dir** — it consumes `@frontierui/plugs`, and `we:vite.config.mts:16` resolves the bootstrap plug URL to FUI's `fui:plugs/`. `fui:plugs/bootstrap.ts` exists and wires all 7 families (`registerRouter`/`registerTransient`/`registerForEach`/`registerEventAttributes` + parsers). #1353's note "(#606 dropped stale — reopen)" is itself stale: #606 is resolved, not open.
- **FUI already has every family impl** — `fui:blocks/router`, `fui:blocks/navigation`, `fui:blocks/parsers`, `fui:blocks/text-nodes`, `fui:blocks/for-each`, `fui:blocks/transient`, `fui:blocks/attributes`, `fui:blocks/stores` all present. So "build the FUI impl" is not the gap.
- **`we:blocks/router` is WE-legit standard derivation, not a deletable bootstrap family** — it holds `we:blocks/router/route-emitters.ts`, `we:blocks/router/sitemap-emitter.ts`, `we:blocks/router/route-map.ts`, `we:blocks/router/url-state.ts` + `we:blocks/router/__fixtures__/` conformance vectors: the **#1684 webrouting** epic's WE-side material (same tree the #1684 section of this report covers). It must **stay** in WE.
- **`navigation` is already deleted** WE-side; the surviving `we:blocks/parsers`, `we:blocks/text-nodes`, `we:blocks/for-each`, `we:blocks/transient`, `we:blocks/stores` each carry a `we:src/_data/blocks/` standard **definition** WE keeps — only the runtime impl graduates to FUI.
- **3 demos import WE families directly** (`we:demos/declarative-spa.html`, `we:demos/declarative-spa-jsx.tsx`, `we:demos/declarative-spa-router.html`), not only via the FUI-resolved bootstrap — a live direct-import edge that any delete must clear.

## Could not split — condition + unblocking action

| Rubric condition | Why it fails | Unblocking action |
|---|---|---|
| (3)/(5) seams investigable, demoable | #1768's scope (relocate plug + bulk-delete 7 families) is stale — relocation done, `navigation` gone, `router` is WE-legit #1684, definitions stay. The true residual (delete only genuinely-graduated runtime, repoint 3 demos) isn't yet specified, so no slice boundary is citable | **Re-scope #1768 first** (foundational): drop the already-done plug relocation; enumerate per surviving family which files are *graduated runtime* (deletable, FUI now owns) vs *WE-legit standard definition/derivation* (stays — `router` wholesale per #1684); repoint the 3 `declarative-spa*` demos off the WE-local imports. Then re-`/slice 1768` against the corrected scope |

## Knock-on to #1353

#1768 is a `blockedBy` of #1353. Because its premise is stale (relocation already delivered, much of the "bundle" either WE-legit or already gone), the bootstrap strand of #1353 is **smaller and partly done** than the 2026-06-20 framing implied — revisit whether #1768 is still the right blocker, or whether the residual collapses to a narrow delete-and-repoint task once re-scoped.
