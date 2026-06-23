---
kind: story
size: 5
parent: "1522"
status: open
locus: frontierui
blockedBy: ["1689"]
dateOpened: "2026-06-23"
tags: []
---

# Intent-conformance oracle for the explorer (declared-intent vs reality)

Folded from #1642 (intent/a11y conformance inspector — not a standalone inspector). The net-new delta over the explorer's existing oracles is the intent-vs-reality check: read the page's declared intents (density/motion/a11y level) and flag where the running page diverges from its own declaration. Rides the explorer's existing collector + judge + finding pipeline (fui:tools/explorer/oracles); the generic-a11y portion is already delegated to genericInvariants/layoutOverflow + axe — do not rebuild. Gated on declared-intent exposure (the #1689 declared-rule/intent registry family).
