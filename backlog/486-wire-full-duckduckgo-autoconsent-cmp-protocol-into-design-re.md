---
kind: task
parent: "382"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: [design-reference, corpus, vision, remediation, autoconsent]
---

# Wire full DuckDuckGo autoconsent CMP protocol into design-refs remediation

design-refs dismissOverlays (the obstructed-verdict remediation in we:scripts/design-refs.mjs) currently does a best-effort heuristic: accept-consent labels, common close/dismiss buttons, and Escape, with an optional dynamic import of @duckduckgo/autoconsent that is not yet driven through its CMP message protocol. Add the dep (optional) and wire autoconsent's Playwright-native CMP opt-out so consent/cookie walls are dismissed by rule rather than by heuristic before the bounded re-shoot. Keep it an optional dynamic import (no hard dep; graceful fallback to the current heuristic when absent), preserving the no-extra-dep posture for offline/CI runs.
