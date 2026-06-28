---
kind: story
size: 3
parent: "1391"
status: open
locus: plateau-app
blockedBy: ["1753"]
dateOpened: "2026-06-24"
tags: []
---

# Dev-browser shell — navigation interception + "not WE-compatible" takeover screen

Intercept top-level navigation in the shell and, when the on-load conformance probe (S1/#1753) reports a non-conformant target, render the full-screen "this site isn't Web Everything-compatible" takeover (#141: a chrome-level capability an extension can't reach). Home plateau:src/dev-browser/shell/. Demoable: navigating to a non-WE URL shows the takeover; a conformant app loads normally.
