---
type: idea
workItem: story
size: 3
parent: "1091"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webcontexts: SSR declarative script-type-context serialize/reconstruct conformance

Wire we:plugs/webcontexts/CustomContextRegistry.ts:119-140 to read the script JSON body as a context initial value (currently dropped at :125) + a conformance fixture proving reconstruction per spec we:src/_includes/project-webcontexts.njk:222-247. Reconstruction/hydration conformance only — NOT an SSR engine (spec is spec-only, :262). Demo: integration test, serialized <script type=context> JSON reconstructs the context value after upgrade().
