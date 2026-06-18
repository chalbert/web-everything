---
type: decision
workItem: story
size: 3
status: open
locus: frontierui
relatedProject: webdocs
parent: "746"
dateOpened: "2026-06-18"
tags: [webdocs, block-explorer, adapters, polyglot]
---

# Decide how the FUI polyglot panel consumes WE-side artifacts (author-mode serve() source + conformance runner/verdict)

Surfaced claiming **#818** (author-mode emit) **and #913** (per-target conformance badges) in
batch-2026-06-18 — both are FUI polyglot-panel slices that consume **WE-side** artifacts the FUI workbench
has no import path to (no `webeverything` alias in FUI tsconfig/vite; the #700 cross-repo-impl boundary):

- **#818** renders idiomatic source via the transform core `serve(definition,{form})`
  (`we:blocks/renderers/module-service/moduleService.ts`).
- **#913** renders a pass/fail badge per target consuming the #891 behavioral wrapper-conformance **runner**
  (`we:wrapper-conformance/runner.ts` — its real home; the body's `fui:wrapper-conformance/runner.ts` is
  wrong) and the #506 cross-language gate **verdict** (`we:blocks/renderers/module-service/conformance`).

The polyglot panel is **FUI-owned** (`fui:workbench/mount.ts`, #753) and its consume-mode uses FUI's *own*
`genWrapper` (`fui:tools/gen-wrapper/genWrapper.ts`) — it imports no WE impl. So neither "render via
serve()" nor "badge from the runner/verdict" can be wired as the bodies assume. One placement mechanism
likely answers both: how does a FUI workbench surface reach WE-side transform/conformance output?

## The fork (one mechanism for both artifact types — source forms and conformance verdicts)

- **A — Data-emit channel (bold default).** WE emits its polyglot output as **committed data** the FUI
  workbench reads: `serve()` renders the source forms to a JSON/text artifact, and the #506/#891 gate
  emits a verdict JSON per block/target. The FUI panel consumes those data files — no cross-repo *code*
  import, honoring #700 (only data crosses the seam, never impl). Author-mode source can ALSO surface as a
  WE-side docs source-toggle (demo-workflow §4) that the panel mirrors. Likely the lightest path that fits
  "rides what already ships."
- **B — FUI ports the equivalents** (`serve()` forms + a conformance reader) into the workbench, as it did
  `genWrapper` for consume-mode. Self-contained but duplicates the WE transform/conformance logic in FUI —
  lock-in risk + divergence from WE's `ServeForm` set and golden vectors.
- **C — WE publishes consumables** (the #872 `@webeverything/contracts`-style package, or a published
  runner) the FUI workbench imports. Cleanest long-term but gated on the publish pipeline; heavier than
  the slices' "rides what already ships" framing.

Also re-confirm the **demand-gate** (#818's bold "build only after appetite for idiomatic source is shown")
at decision time — #818 is the slice whose appetite was never demonstrated.

**Blocks #818 and #913** (both `blockedBy: 954`). Sibling of #753/#912/#913 under #746.
