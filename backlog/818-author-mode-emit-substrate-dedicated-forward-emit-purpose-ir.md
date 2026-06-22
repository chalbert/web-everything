---
kind: story
size: 3
status: resolved
parent: "746"
locus: frontierui
relatedProject: webdocs
blockedBy: []
relatedReport: reports/2026-06-18-backlog-split-analysis.md
dateOpened: "2026-06-16"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:src/_data/authorModeSource.json + fui:workbench/authorMode.ts"
tags: [webdocs, adapters, polyglot, generation, component-emit]
---

> **UN-PARKED 2026-06-22 (→ `status: open`).** The appetite-half of the gate is now met: the maintainer
> explicitly called for building the data-emit **foundation** (the forms `serve()` already emits —
> `declarative | wc-class | html | jsx | functional`). Scope held to the groundable foundation only —
> the genuinely-new idiomatic **Vue/Svelte/Angular** emitters and the Option-C emit-IR (#939) stay
> deferred; they ride later cases, not this item.
>
> _Prior park (2026-06-18 batch pre-flight): demand-gated on "appetite for idiomatic source", now shown._


> **Claimed in batch-2026-06-18, then re-blocked + released (NOT built).** The "rides what already ships"
> re-scope missed a placement seam: this slice renders source via WE's `serve()` core
> (`we:blocks/renderers/module-service/moduleService.ts`), but the polyglot panel is FUI-owned
> (`fui:workbench/mount.ts`) and #753's consume-mode uses FUI's own `genWrapper`, never importing WE's
> `serve()`/`moduleService` (the #700 cross-repo-impl boundary). So "render via serve()" can't be wired as
> written — it needs a placement call ([constellation-placement](docs/agent/platform-decisions.md#constellation-placement)). Filed **[#954](/backlog/954-decide-how-polyglot-author-mode-source-reaches-the-fui-workb/)**
> (`type: decision`, `blockedBy: 954` added; also set the missing `locus: frontierui` to match its #746
> siblings). The bold demand-gate (appetite for idiomatic source) is also unresolved and folded into #954.
>
> **#954 ratified 2026-06-18 — Fork 1 = A (data-emit); `blockedBy` cleared.** Placement resolved: WE
> runs `serve()` at build time and **commits the per-block × form output** (`{code, language, lossy,
> diagnostics}`) as JSON; the FUI panel reads that data and renders author-mode tabs (only rendered
> text + diagnostics cross the #700 seam — FUI never imports `serve()`/`moduleService`). The emit
> artifact format/build-step is a small new seam (impl detail, not a fork). **Still DEMAND-GATED** —
> build the idiomatic-source author mode only after appetite is shown; the data-emit foundation is cheap
> enough to ride the existing emit channel *when* it is.

# Author-mode emit foundation — wire an output-tabs author mode onto the existing `serve(){form}` forms over the declarative `<component>` subset

Author mode for the polyglot panel (#753): show idiomatic native component **source** for the current block, starting with the forms the transform core **already emits** — the browser member of the ratified #463 [forward-generation-adapters](docs/agent/platform-decisions.md#forward-generation-adapters) family (#506-gated). Per #811's ruling (the [we-fui-embed-boundary](docs/agent/platform-decisions.md#we-fui-embed-boundary) rule), **start subset-first, not with a new IR**. **DEMAND-GATED**: build only after #753's consume-mode (CEM-wrapper) probe ships *and* appetite for idiomatic source is shown.

> **Re-scoped `story·13` → `story·3` foundation on 2026-06-18 (`/split 818`, report [we:reports/2026-06-18-backlog-split-analysis.md](../reports/2026-06-18-backlog-split-analysis.md)).** Could-not-split: the work the item existed for — idiomatic **Vue/Svelte/Angular** source — has no code to ground a slice against (the body's own "wall"), while the React-ish/native forms are already one `serve(definition,{form})` call away. So this item is **re-scoped to the groundable foundation**; the per-framework emitters become batchable slices *after* this lands and reveals their seams. The deferred Option-C emit-IR fork is de-buried to **[#939](/backlog/939-dedicated-forward-emit-ir-option-c-design-a-neutral-webevery/)** (parked `type: decision`).

## Scope (this item — the foundation)

Wire a new **author-mode / output-tabs** surface that, for the current block's declarative `<component>` definition, renders idiomatic source via the **existing transform core** — `serve(definition, { form })` ([we:moduleService.ts:142](../blocks/renderers/module-service/moduleService.ts#L142)) over the already-supported `ServeForm` set (`declarative | wc-class | html | jsx | functional`, [we:moduleService.ts:33](../blocks/renderers/module-service/moduleService.ts#L33)), fed from the round-trip subset (`ComponentIR` → `generateComponentSource`, [we:upgraderEngine.ts:135](../blocks/renderers/upgrader/upgraderEngine.ts#L135)). Add **"flag, don't fake"** subset-boundary detection: when a block falls outside the round-trip subset, surface the gap rather than emitting wrong source. No new IR, no new framework serializers here — this rides what already ships.

## What this foundation unlocks (not in scope here)

- **Per-framework idiomatic emitters** — idiomatic **Vue / Svelte / Angular** source (the genuinely-new targets with no code today). Each becomes its own batchable slice *once this foundation + its accumulated cases expose the real seams* (where flat-declarative stops stretching per framework). File them as siblings under #746 then, not now.
- **Dedicated emit IR (Option C)** — the Phase-2 design call, **de-buried to [#939](/backlog/939-dedicated-forward-emit-ir-option-c-design-a-neutral-webevery/)** (parked, `blockedBy: 818`): made with the cases this foundation accumulates, never guessed.

## Resolution (2026-06-22, batch-2026-06-22-764-1602)

Landed the foundation across both repos per the #954 ruling (data-emit):

- **WE build-emit half** — `we:blocks/renderers/module-service/authorModeSource.ts` projects `serve()` over
  the canonical `componentCases` × the `ServeForm` set, emitting `{code, language, lossy, diagnostics}` per
  case×form. `we:scripts/gen-author-mode-source.mjs` (`npm run gen:author-mode-source`) commits it to
  `we:src/_data/authorModeSource.json`, guarded by a drift test (`we:blocks/__tests__/unit/renderers/authorModeSource.test.ts`)
  — the same generate-and-freeze idiom as the MaaS golden vectors. "Flag, don't fake" rides `serve()`'s own
  `lossy`/`diagnostics`.
- **FUI consume half** — `fui:workbench/authorMode.ts` renders the output-tabs panel from an `AuthorModeSource`
  a `WorkbenchBlock` declares; `fui:workbench/mount.ts` mounts it as the sibling of the consume-mode Polyglot
  panel. Only rendered text + diagnostics cross the #700 seam (FUI never imports `serve()`).
- **Residual → [#1618](/backlog/1618-wire-the-we-author-mode-source-artifact-into-the-live-fui-wo/)** (`blockedBy: 818`):
  the WE→FUI **transport** (sync the committed artifact into the live registry) + **attachment** (the lone
  workbench block `auto-complete` is imperative — no declarative `<component>` definition carries `authorSource`
  live yet). Both are wiring, no fork.
