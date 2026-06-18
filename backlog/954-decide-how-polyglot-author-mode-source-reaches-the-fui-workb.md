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

# Decide how polyglot author-mode source reaches the FUI workbench given serve() is WE-side

Surfaced claiming **#818** (author-mode emit foundation) in batch-2026-06-18. #818's scope is to render
idiomatic component source in the polyglot panel via the **existing transform core**
`serve(definition, {form})` (`we:blocks/renderers/module-service/moduleService.ts`). But the polyglot
panel is **FUI-owned** (`fui:workbench/mount.ts`, #753) and its consume-mode (#753) uses FUI's *own*
`genWrapper` (`fui:tools/gen-wrapper/genWrapper.ts`) — it does **not** import WE's `serve()`/`moduleService`
(WE block-renderer **impl**, which #700 ruled FUI must not cross-repo import). So "render via serve()" can't
be wired as the body assumes — it needs a placement call.

## The fork

- **A — Author-mode lives WE-side** as a docs source-toggle on the WE block pages (the demo-workflow §4
  source-toggle surface), consuming `serve()` in-repo; the FUI workbench links out / mirrors. Keeps `serve()`
  impl in WE; no cross-repo import. **(bold default)** — respects the #700/#809 boundary (workbench surface
  vs the transform impl) and reuses the WE-side source-toggle that already exists.
- **B — FUI ports a serve()-equivalent** into the workbench (like it did `genWrapper` for consume-mode), so
  author-mode is a FUI workbench tab beside consume-mode. Duplicates the transform forms in FUI (lock-in
  risk, divergence from WE's `ServeForm` set).
- **C — WE publishes `serve()` as a consumable** (the #872 `@webeverything/contracts`-style package, or a
  data emit of the served forms) the FUI workbench imports. Cleanest long-term but gated on the publish
  pipeline; heavier than the #818 "rides what already ships" framing.

Also re-confirm the **demand-gate** (#818's bold "build only after appetite for idiomatic source is shown")
at decision time — this is the slice whose appetite was never demonstrated.

**Blocks #818** (added `blockedBy: 954`). Sibling of #753/#912/#913 under #746.
