---
type: issue
workItem: task
status: open
dateOpened: "2026-06-18"
tags: []
---

# composesBehaviors block-protocol field + x-webeverything projection + trait-manifest resolution assertion

Fork 2 of #933. Add a composesBehaviors field to the block manifest (we:src/_data/blocks/<id>.json) recording the WE traits a block CONSUMES — distinct from the traits it PROVIDES. Project it into CEM x-webeverything beside the existing composesIntents/traits fields (we:scripts/gen-cem.mjs:188), and assert each entry resolves against the trait manifest we:src/_data/traits.json. Name mirrors the existing composesIntents; composesTraits is rejected (The Map collision, we:src/_data/traits.json:29). Gives the #933 gate's declaration arm a precise signal.
