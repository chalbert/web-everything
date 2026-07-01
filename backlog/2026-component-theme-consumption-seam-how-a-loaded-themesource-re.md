---
kind: decision
status: open
dateOpened: "2026-07-01"
tags: []
---

# Component theme-consumption seam: how a loaded ThemeSource re-themes live FUI components

#2017 pre-flight surfaced this. The manifest to ThemeSource loader can be built, but its acceptance (loading material-like visibly re-themes a live we-card + we-badge) is unmeetable because NO FUI component consumes the theme runtime: grep finds zero consumers of resolveTheme/getRootTheme/ThemeSource outside fui:plugs/webtheme/ itself. The card/badge read a hand-authored site vocabulary (color-border, color-surface-card, radius-md, shadow-sm custom props), not the legacy family emit (token-color-star from fui:plugs/webtheme/emitCss.ts) nor the DTCG compile names. So injecting a ThemeSource paints token-star props that no component reads. Decide the projection-vocabulary contract (does ThemeSource project to the components current color/radius names, or do block CSS migrate onto var token-star?) and the block-CSS migration path. NOTE a lossy DTCG-to-wb-star precedent already exists for the workbench ONLY (#930-A, fui:workbench/manifestBridge.ts); this decides the REAL component seam, not the demo stage.
