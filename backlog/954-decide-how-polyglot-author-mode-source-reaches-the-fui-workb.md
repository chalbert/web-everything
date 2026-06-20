---
kind: decision
size: 3
status: resolved
locus: frontierui
relatedProject: webdocs
relatedReport: reports/2026-06-18-954-polyglot-panel-we-artifact-consumption.md
parent: "746"
blockedBy: []
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-18"
tags: [webdocs, block-explorer, adapters, polyglot]
---

# Decide how the FUI polyglot panel consumes WE-side artifacts (author-mode serve() source + conformance runner/verdict)

> **RATIFIED 2026-06-18.** Both forks resolved as the prepared defaults — both are forced invariants
> (one branch each broken/impossible), grounding re-traced to the tree, red-team failed. Confidence ~90%
> each.
> - **Fork 1 (deterministic WE outputs — `serve()` source #818 + #506 verdict #913) = A, data-emit.**
>   WE runs `serve()` / the #506 gate at build time and **commits the output as JSON**; the FUI panel
>   reads it. Only rendered text + verdict + diagnostics cross the #700 seam. B (FUI ports `serve()`) is
>   broken — reverses #956=A, #707-forbidden, diverges from `FORMS`. C (publish a `@webeverything`
>   consumable) is the #872 end-state, premature here.
> - **Fork 2 (#891 behavioral badge) = vectors-as-data + runner-runs-FUI-side.** The WE-owned runner
>   (`we:wrapper-conformance/runner.ts`, pure DOM, imports no FUI) executes FUI-side against FUI's live
>   `WrapperSubject`; vectors cross as data. Pure data-emit is impossible (no WE-side verdict). Runner
>   packaging rides #872; the badge needs a mounted subject → downstream of #912.
>
> **Codified rule:** *deterministic WE outputs → data-emit (commit output, panel reads); verdicts that
> depend on FUI's live output → vectors-as-data + runner-runs-FUI-side. The standard/engine never leave
> WE; only outputs and standard-artifacts cross WE→FUI.*
>
> **Downstream:** #818 unblocked (Fork 1; still demand-gated). #913 split per bias-toward-separation —
> #913 keeps the cheap #506-verdict badge (unblocked); the behavioral badge moved to new **#967**
> (`blockedBy: [912, 954]`). Related new decision **#966** (parked) — home of a *hosted* compliance
> product.

> **Prepared 2026-06-18** ([report](../reports/2026-06-18-954-polyglot-panel-we-artifact-consumption.md)).
> Precondition [#956](/backlog/956-decide-module-service-serve-form-generation-placement-we-ref/) is
> **resolved = A** (`serve()` stays WE reference-runtime, unpublished) — so the cross-repo boundary is real
> and `blockedBy` is cleared. Prior-art is prior rulings (#700/#707/#872/#855/#891 + #956); no new
> `/research/` topic (*Why no research topic* in the report; same posture as #791/#855/#956). Both forks
> below trace to **forced invariants** — one branch each is broken or impossible — so the decision turn is
> a skeptic-checked ratify, not an open A/B.

Surfaced claiming **#818** (author-mode emit) **and #913** (per-target conformance badges) in
batch-2026-06-18 — both are FUI polyglot-panel slices that consume **WE-side** artifacts the FUI workbench
has no import path to (no `webeverything` alias in FUI tsconfig/vite; the #700/#707 cross-repo-impl boundary):

- **#818** renders idiomatic source via the transform core `serve(definition,{form})`
  ([`we:moduleService.ts:142`](../blocks/renderers/module-service/moduleService.ts#L142)).
- **#913** renders a pass/fail badge per target consuming the #891 behavioral wrapper-conformance **runner**
  ([`we:wrapper-conformance/runner.ts`](../wrapper-conformance/runner.ts) — its real home; the body's
  `fui:wrapper-conformance/runner.ts` is wrong) and the #506 cross-language gate **verdict**
  (`we:blocks/renderers/module-service/conformance/`).

The polyglot panel is **FUI-owned** (`fui:workbench/mount.ts`, #753) and its consume-mode uses FUI's *own*
`genWrapper` (`fui:tools/gen-wrapper/genWrapper.ts`) — it imports no WE impl.

## Grounding digest (traced to the tree)

- **`serve()` returns pure data, not code FUI can import.** `serve(definition,{form})`
  ([`we:moduleService.ts:142`](../blocks/renderers/module-service/moduleService.ts#L142)) returns
  `ServeResult{form,code,language,lossy,diagnostics}` ([`:67`](../blocks/renderers/module-service/moduleService.ts#L67))
  over the `FORMS` catalog ([`:51`](../blocks/renderers/module-service/moduleService.ts#L51)) that already
  drives the demo toggle. **#956 = A** keeps `serve()` a WE-internal, **unpublished** reference runtime →
  FUI cannot import it (#707). So the panel must consume its *output*.
- **The #506 gate already commits verdict data.** The dir `we:blocks/renderers/module-service/conformance/`
  commits a golden verdict (`we:blocks/renderers/module-service/conformance/golden.json`) plus its
  generator/runner/vector siblings — a WE-computable, already-committed verdict surface.
- **But #891's behavioral runner needs a live subject WE never sees.** `runVectors(subject, vectors)`
  ([`we:wrapper-conformance/runner.ts:163`](../wrapper-conformance/runner.ts#L163)) requires a
  `WrapperSubject` ([`:37`](../wrapper-conformance/runner.ts#L37)) — a *mounted* wrapper instance. Its
  header: "FUI owns the generator and implements one subject per framework." The behavioral verdict is a
  function of **FUI's own `genWrapper` output**, which WE never observes → **no WE-side verdict to emit**.

## The axis — two artifact natures, not one mechanism

The item asked for *one* placement mechanism for both artifact types. Tracing them apart shows two
**different natures**, so the genuine call is to *reject* "one channel for both":

- **Deterministic WE outputs** (`serve()` source forms · #506 verdict) — WE computes them from a
  `<component>` definition alone, no FUI input. Their nature is *committable data*.
- **FUI-dependent verdict** (#891 behavioral badge) — a function of FUI's live wrapper instance, which WE
  cannot see. Its nature is *vectors-out, run-in-FUI*.

## Recommended path at a glance

| Seam | **Default** | Excluded / broken branch |
| --- | --- | --- |
| Fork 1 — `serve()` source forms (#818) + #506 verdict (#913a) | **A — data-emit** (WE commits output + verdict JSON; panel reads) | B (FUI ports `serve()`) reverses #956 keeper, #707-blocked, diverges from `FORMS`; C (publish package) over-engineered + #872-gated |
| Fork 2 — #891 behavioral badge (#913b) | **Vectors cross as data; runner executes FUI-side** (packaging rides #872; gate on #912) | Pure data-emit is *impossible* (no WE-side verdict); full FUI fork-and-diverge breaks standard-artifact ownership |

## Fork 1 — deterministic WE outputs (source forms + #506 verdict) → the panel

*Fork-existence:* a **forced invariant**. The excluded branch (B — FUI ports `serve()` into the workbench,
as it ported `genWrapper`) is **broken**: #956 = A just ratified `serve()` as a WE-internal keeper, so
relocating it reverses that ruling, duplicates the WE transform/`FORMS` set (divergence from the golden
forms), and #707 forbids FUI re-importing the relocated copy. Data-emit is therefore *forced*, not merely
preferred.

- **A — Data-emit channel (default).** WE emits its polyglot output as **committed data** the FUI workbench
  reads. For **#818**: a per-block × form artifact `{code, language, lossy, diagnostics}`, produced by
  running `serve()` over each block's `<component>` definition at build time (an extension of the toggle
  `FORMS` already drives); the panel reads the JSON and renders author-mode tabs. For **#913 part 1**: a
  per-block/target verdict JSON committed alongside the #506
  `we:blocks/renderers/module-service/conformance/golden.json`; the panel reads it → badge.
  Only rendered text + diagnostics cross the seam, honoring #700. *Residual: the emit-artifact
  format/build-step is a small new seam — an impl detail, not a fork.*
- **B — FUI ports the equivalents** (`serve()` forms + a conformance reader) into the workbench.
  *Broken — see fork-existence above.*
- **C — WE publishes consumables** (the #872 `@webeverything/contracts`-style package, or a published
  `serve()` API) the workbench imports. *Cleanest long-term but #956 = A explicitly did not publish
  `serve()`/its output; heavier than the slices' "rides what already ships" framing and gated on the #872
  pipeline. Demote unless the decider judges the published end-state worth pulling forward.*

## Fork 2 — #891 behavioral conformance badge (#913 part 2) → the panel

*Fork-existence:* a **forced invariant** in the opposite direction. The excluded branch (pure data-emit,
i.e. WE emits the verdict) is **impossible** — WE never sees FUI's `genWrapper` output, so it cannot compute
the verdict. The two coherent halves (standard vectors vs FUI-side execution) genuinely cannot live on one
side.

- **Default — vectors cross as data; runner executes FUI-side.** Mirrors #891's own design intent: the
  **vectors** (`we:wrapper-conformance/vectors.ts`) cross as data (consistent with Fork 1); the **runner**
  (`we:wrapper-conformance/runner.ts`, a WE-owned standard artifact per #855 B2 — ~165 lines of pure DOM
  logic, imports no FUI) executes **FUI-side** against FUI's live `WrapperSubject`. The runner's packaging
  **rides #872** (published `@webeverything`-scoped consumable end-state; byte-replication the #694/#170
  interim) — this item only fixes *that the runner runs FUI-side*, not how it is packaged. The badge needs a
  **mounted** subject → it is **downstream of #912** (live-test sandbox); recommend adding `blockedBy: 912`
  to the #891-behavioral half of #913.
- **Excluded — full FUI fork-and-diverge** (FUI re-authors its own runner). Breaks the runner's
  standard-artifact ownership (#855 B2) and risks divergence from the WE golden vectors.

## Supported by default (not forks)

- **Demand-gate re-confirm (#818).** Keep #818 demand-gated — *build idiomatic-source author mode only after
  appetite is shown*. Independent of placement; #753 shipped consume-mode tabs, but whether
  *idiomatic-source* appetite is demonstrated is a decision-time user call. The Fork-1 data-emit foundation
  is cheap enough to ride the existing emit channel **when** appetite shows; do not build ahead of it.
- **#913 split.** Likely split the cheap #506-verdict badge (Fork 1) from the #912-gated behavioral badge
  (Fork 2) per bias-toward-separation — a slice call for the decision/build turn, not part of these rulings.

## On resolve (when ratified)

- `codifiedIn`: the data-emit-vs-FUI-execute split is a reusable boundary rule — *deterministic WE outputs →
  data-emit; verdicts that depend on FUI's live output → vectors-as-data + runner-runs-FUI-side.*
- Unblock #818 (Fork 1, still demand-gated) and #913 (split per above; add `blockedBy: 912` to its
  behavioral half); set `graduatedTo`.
