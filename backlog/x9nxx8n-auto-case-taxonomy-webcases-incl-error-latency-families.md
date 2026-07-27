---
kind: story
size: 8
parent: "2676"
status: open
dateOpened: "2026-07-27"
tags: []
---

# Auto case-taxonomy → webcases, incl. error + latency families

The tool should enumerate a screen's FULL case space with a completeness-critic (not just happy-path) — including ERROR and LATENCY/loading families that get ignored — assign referenceable case codes, and graduate them to a plateau-app:*.webcases.ts registry + conformance test (the #797 / #2553 pattern, mirroring the planned card-taxonomy webcases registry that #2553 will produce).

Operator requirement: "use the web-case lens — plan for integration into webcases, same rigor identifying all variation and use cases, maybe even error and latency states." Each case gets a UC-style code (e.g. a per-screen prefix so codes never collide across screens), an assert-grammar line, and a rendered? flag, hardened by a conformance test. Sibling to #2553 (card-state conformance spec).

Captured from the **feature-tracking-screen** design session — a capability the design-studio tool (#2676) should productize, drawn from methodology we ran by hand. Decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d
