---
type: idea
workItem: story
size: 3
parent: "746"
status: open
blockedBy: ["753", "954"]
dateOpened: "2026-06-18"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, adapters, polyglot]
---

# Polyglot panel — per-target conformance badges from the deterministic gate

Block Explorer polyglot-panel slice (c), sibling of #753. Add a pass/fail conformance badge to each target tab, consuming the #891 behavioral wrapper-conformance runner (fui:wrapper-conformance/runner.ts) + the #506 cross-language gate verdict — proving fidelity per target, not just showing code. Home fui:workbench/. locus:frontierui.

> **Claimed in batch-2026-06-18, then re-blocked + released (NOT built).** Both artifacts this slice
> consumes live **WE-side**, not in FUI as the body states: the #891 runner is at
> `we:wrapper-conformance/runner.ts` (not `fui:wrapper-conformance/runner.ts`) and the #506 verdict at
> `we:blocks/renderers/module-service/conformance`. The FUI workbench has **no** `webeverything` import
> alias (#700 cross-repo-impl boundary), so the badge can't consume the runner/verdict as written. Same
> root fork as #818 → folded into **[#954](/backlog/954-decide-how-polyglot-author-mode-source-reaches-the-fui-workb/)**
> (`blockedBy: 954` added); option A (data-emit verdict JSON the panel reads) would unblock this cleanly.
