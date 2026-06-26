---
kind: story
size: 5
parent: "1522"
status: open
locus: plateau-app
blockedBy: ["1791"]
dateOpened: "2026-06-23"
dateStarted: "2026-06-26"
tags: []
---

# Intent-conformance oracle for the explorer (declared-intent vs reality)

Folded from #1642 (intent/a11y conformance inspector — not a standalone inspector). The net-new delta over the explorer's existing oracles is the intent-vs-reality check: read the page's declared intents (density/motion/a11y level) and flag where the running page diverges from its own declaration. Rides the explorer's existing collector + judge + finding pipeline (`plateau:tools/explorer/oracles`); the generic-a11y portion is already delegated to genericInvariants/layoutOverflow + axe — do not rebuild. Blocked by #1791 (the declared-intent exposure + reality-measurement contract).

> **Pre-flight (batch-2026-06-26-1732-1696):** two corrections. (1) **Locus** was `frontierui` but the explorer lives in `plateau-app/tools/explorer/oracles` — re-pointed to `locus: plateau-app`. (2) The stated gate **#1689 does not expose these intents** — it delivered a conformance/visibility/validation *rule* registry (`plateau:src/dev-browser/declared-rules/`), not a density/motion/a11y-level *intent* exposure. No mechanism exposes a page's declared density/motion/a11y-level, and the per-dimension reality-measurement is undecided. Building the oracle requires inventing that contract — surfaced as decision **#1791** and re-pointed `blockedBy: ["1791"]`. Released unbuilt.
