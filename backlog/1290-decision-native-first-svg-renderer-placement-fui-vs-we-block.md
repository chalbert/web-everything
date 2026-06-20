---
kind: decision
parent: "1004"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-20"
relatedReport: reports/2026-06-20-backlog-split-analysis.md
tags: [webcharts, constellation-placement, frontierui]
---

# Decision: native-first SVG renderer placement — FUI vs WE blocks/renderers/chart

Carved from #1004 (the split-analysis `DEC` row, `we:reports/2026-06-20-backlog-split-analysis.md:176`)
as "flag, don't pre-decide." Blocks the renderer build slice **#1292**. Where does the webcharts
**native-first SVG default renderer** live — FUI, or `we:blocks/renderers/chart/`?

> **Prep verdict (2026-06-20): the FUI-vs-WE fork has DISSOLVED into a forced invariant — FUI, ~95%.**
> The item was carved citing a "reference-renderer precedent (data-table / pagination /
> reorderable-list already live in WE)" that **#1282 retired the same day** (after this card was
> written). The WE branch is no longer a coherent alternative — it is **excluded by statute**. The
> deciding turn is a fast ratification + a citation, not a weighing of two homes. See *Standing test*
> below. No new `/research/` topic: this is a placement reconciliation over already-ratified internal
> statute (#1282 / #1018 / #1048), not greenfield design — the prior art is the constellation-placement
> rule and the webpositioning precedent, already documented; per *backlog-workflow.md → Fork-readiness
> pass* a decision over already-researched ground links the prior report (above) rather than minting a
> web survey.

## Grounding digest (verified against the tree, 2026-06-20)

- **Zero-implementation rule is now statute and is dispositive.** `#1282` (ratified 2026-06-20) +
  `#1246` rewrote `we:docs/agent/platform-decisions.md#constellation-placement` rule 1
  (`we:docs/agent/platform-decisions.md:72-95`): *"Code that **delivers a capability at runtime**
  (registry-dispatching, artifact-producing, a running handler — incl. `assert*`, constants, engines,
  **native-default strategies**) → **Frontier UI**. … **WE holds zero implementation — contract /
  protocol / interface only.** WE never hosts delivery runtime, **not even as a 'reference
  implementation.'** … crucially **no _new_ WE-resident delivery runtime may be added under any
  justification.**"* A native-first SVG renderer is precisely a **native-default strategy that delivers
  a capability at runtime** — rule 1 names that case and sends it to FUI.
- **The "reference-renderer precedent" the card leaned on is being EVACUATED, not extended.**
  `we:blocks/renderers/` today does contain runtime (`we:blocks/renderers/data-table/`,
  `we:blocks/renderers/pagination/`, `we:blocks/renderers/reorderable-list/`,
  `we:blocks/renderers/audit-timeline/renderAuditTimeline.ts`, …) — but that is exactly the WE-resident impl `#1282` ruled
  out and `#1245` (blocks) + `#1294` (logic runtimes) are relocating to FUI as **tracked debt**. Adding
  a brand-new `we:blocks/renderers/chart/` would be *adding* new WE delivery runtime — the one thing the
  rule's last clause forbids outright. So the precedent points FUI, not WE.
- **The exact-shape precedent already split this way.** webpositioning (same impl-swap family —
  `CustomPositioner` ⇄ `CustomChartRenderer`) ruled **contract → WE, runtime → FUI**:
  `we:positioning/contract.ts:1-19` is "the **pure-contract half** … fully **compile-erased** … The
  runtime half — the native CSS-anchor strategy, the JS fallback, the feature-detected resolver, and the
  `customPositioning` swap registry — is **impl and lives in FUI** (`fui:blocks/droplist/positioning/`);
  only the contract crosses the seam." The chart renderer is the same: the native-default SVG strategy is
  the runtime half → FUI.
- **The contract half is already settled and is NOT this decision.** `#1291` ("Contract→WE settled by
  #1018/#1048 — no fork in this slice") mints `CustomChartRenderer` / `ResolvedTheme` / `ChartHandle`
  types → `@webeverything`. This card governs **only the SVG default impl** (the runtime), which `#1292`
  builds.
- **The protocol's "ships with the standard" wording is the only thing pointing WE — and it does not
  mean "in the WE repo."** `we:src/_data/protocols/custom-chart-renderer.json:4` and
  `we:src/_includes/project-webcharts.njk:128-134` say *"the **native-first default** is an SVG renderer
  that **ships with the standard**."* Read against rule 1, "ships with the standard" = **the standard's
  blessed default impl** (FUI ships it as the canonical renderer behind the WE contract, so a chart draws
  with zero adapters) — *not* "lives inside the `@webeverything` source tree." This is the same sense in
  which webpositioning's native CSS-anchor strategy is "the default" yet lives in FUI. The wording needs
  a one-line reconciliation edit (below), not a placement fork.

## Axis-framing — the real axis closed by statute

The card framed the axis as **"FUI-canonical vs WE `blocks/renderers/chart/`."** That axis is **shut**:
`#1282` makes WE-resident delivery runtime a statute violation, and rule 1 explicitly routes
"native-default strategies" to FUI. What actually *remains* once FUI is forced is two **non-fork**
consequences — a doc-wording reconciliation and a FUI-internal home path — neither of which has a
coherent excluded branch, so neither is a `## Fork N`.

## Recommended ruling at a glance

| Question | Status | Ruling / default | Conf. |
|---|---|---|---|
| SVG default renderer home — FUI vs `we:blocks/renderers/chart/` | **forced invariant** (not a fork) | **FUI** — `we:` branch excluded by `#1282` / constellation-placement rule 1 (`native-default strategies → FUI`; `no _new_ WE-resident delivery runtime`) | ~95% |
| What does "ships with the standard" mean? | supported by default | FUI ships it as the **standard's canonical default impl** behind the WE contract; reconcile the protocol/spec wording (one-line edit) so it doesn't read as "in the WE repo" | ~90% |
| FUI home path for the renderer | deferred to `#1292` (FUI-internal) | standalone `fui:charts/` (no host block to co-locate under, unlike positioning's `fui:blocks/droplist/positioning/`) — recommendation, not a ratify item | ~70% |

*Supported by default (not forks):* contract/types → `@webeverything` (`#1291`, settled by `#1018`/`#1048`);
source arrow WE→FUI never inverts; the Vega/Plotly/ECharts adapters are FUI opt-in impls (already
implied by the protocol); the conformance demo (`#1293`) is a WE-**website** artifact that surfaces the
FUI renderer per `#we-fui-embed-boundary` (does not require a WE-resident copy).

## Standing test — is this even a fork? (No.)

Per *backlog-workflow.md → Standing test*, a real fork needs a coherent **excluded** branch. Here the
excluded branch — `we:blocks/renderers/chart/` — is **broken by statute, not merely worse**: adding a new
WE-resident SVG renderer directly violates `we:docs/agent/platform-decisions.md#constellation-placement`
rule 1's closing clause (*"no _new_ WE-resident delivery runtime may be added under any justification"*)
and rule 1's runtime→FUI routing of native-default strategies. A branch the architecture forbids is not
a coherent alternative, so this is a **forced invariant → ratify FUI**, authored here as a fast
ratification rather than a `## Fork N` with a pick (the #756 shape: when one branch is excluded, the call
is the invariant, not a weighing).

> Why it *looked* like a ~75% fork at carve time: the card predates awareness of `#1282`'s ratification
> (both dated 2026-06-20) and cited the now-evacuated WE reference renderers as live precedent. Prep's
> value here is catching that the ground shifted under the item between its creation and now — the lean
> hardens from ~75% to a ~95% forced invariant.

## Red-team note for the deciding turn

The steelman for WE placement is: *"the native-first default is so intrinsic to the standard that it
belongs with the contract as the canonical reference renderer."* That is **exactly the
'reference-implementation' justification `#1282` withdrew** — rule 1's lineage records #1078's
reference-impl tier as *"superseded by #1282."* So the steelman is dead on arrival post-`#1282`; the
deciding agent's skeptic pass should confirm only that (a) no *newer* decision has re-opened the
zero-impl rule, and (b) the FUI home path is genuinely #1292's call and not something this ratification
must pin. If both hold, ratify FUI and `codifiedIn: one-off` (or cite `#constellation-placement` rule 1
directly — this is an application of an existing rule, mints no new one).

## Ruling (ratified 2026-06-20)

**SVG native-first default renderer → Frontier UI.** Forced invariant, not a fork (~95%): the WE
branch (`we:blocks/renderers/chart/`) is **excluded by statute** — `#1282` / constellation-placement
rule 1 routes native-default strategies to FUI and forbids *any new* WE-resident delivery runtime. The
"reference-renderer precedent" the card was carved on was retired by `#1282` the same day, so the
steelman for WE placement is the exact reference-impl justification #1282 withdrew (rule 1 lineage:
*"#1078's reference-impl tier superseded by #1282"*). Red-team confirmed: no newer decision reopens
zero-impl; the FUI home path is `#1292`'s call. Same split as webpositioning (`CustomPositioner ⇄
CustomChartRenderer`): contract → WE, native strategy → FUI.

**Done on resolve:** reconciled the *"ships with the standard"* wording in
`we:src/_data/protocols/custom-chart-renderer.json` + `we:src/_includes/project-webcharts.njk` to "FUI
ships the canonical default impl behind the WE contract." Clears `#1292`'s `blockedBy: [1291, 1290]`.

`codifiedIn`: application of `#constellation-placement` rule 1 (mints no new rule).

## On resolve (for `/next decision`, not prep)

- Rule: **SVG native-first default renderer → FUI** (forced by `#1282` / constellation-placement rule 1).
- Reconcile the "ships with the standard" wording in `we:src/_data/protocols/custom-chart-renderer.json`
  + `we:src/_includes/project-webcharts.njk` to "FUI ships the canonical default impl behind the WE
  contract" (a small follow-on edit, can ride `#1292`).
- Unblocks `#1292` (its `blockedBy: ["1291","1290"]` clears on resolve).
- `codifiedIn`: cite `#constellation-placement` rule 1 (application of existing statute, no new rule) or
  `one-off`.
