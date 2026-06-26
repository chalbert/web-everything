---
kind: story
size: 5
parent: "1391"
status: open
locus: plateau-app
humanGate: { kind: setup, short: "Add Electron to plateau-app and launch/verify the desktop shell GUI boot from a session that can run a windowed app.", what: "Acceptance is 'the stock-Chromium desktop shell BOOTS and reports conformant vs non-conformant for the loaded app' — a desktop Electron/CEF GUI boot. Electron is NOT a plateau-app dependency (a ~100MB native add), src/dev-browser/shell/ does not exist, and a serial batch cannot launch or visually verify a windowed desktop app headlessly (vitest can't boot an Electron main process + BrowserView without a display). The WE-conformance probe marker (window.__WE_DEVTOOLS_GLOBAL_HOOK__ + declarative script[type=registry]) is real (fui:plugs/webregistries/declarativeRegistry.ts, #1673/#1722). Needs a focused session that owns a windowed environment: add Electron, scaffold the shell (main/preload/BrowserView), and boot-verify the GUI. The pure conformance-probe parsing could be carved as a headless-testable sub-slice if a build-now sliver is wanted." }
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
tags: []
---

# Dev-browser shell scaffold — stock-Chromium desktop shell + WE-conformance probe on load

Stand up the stock-Chromium desktop shell (Electron/CEF-class) for plateau:src/dev-browser/shell/ — boots, loads a target URL in a BrowserView, and probes WE-conformance on load via the resolved markers (window.__WE_DEVTOOLS_GLOBAL_HOOK__ from fui:plugs/webregistries/declarativeRegistry.ts + the declarative script[type=registry] form, per #1673/#1722). Foundational slice of #1391: demoable state = shell boots and reports conformant vs non-conformant for the loaded app. Packaging vehicle (Electron default) is a build detail, not a held fork.
