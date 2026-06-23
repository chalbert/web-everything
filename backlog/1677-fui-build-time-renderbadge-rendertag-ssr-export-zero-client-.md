---
kind: story
size: 3
locus: frontierui
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: a published, build-time-consumable @frontierui/blocks package (FUI-impl sibling of #872/#907 contract distribution)"
dateOpened: "2026-06-23"
tags: [fui, badge, tag-intent, ssr, dogfood]
---

# FUI build-time renderBadge()/renderTag() SSR export — zero-client-JS static board rendering

End-state enhancement from #1621's ruling: once a runnable @frontierui/blocks package publishes, FUI exports a build-time renderBadge(config) and renderTag(config) returning HTML strings the 11ty docs build calls directly — zero client JS, zero FOUC, FUI still renders the markup (true dogfood), coupling to a function contract not classes. The genuinely-best path for a static server-rendered board, vs the interim runtime transient-CE + cross-origin import #1621 ratified. Held **maturityGated**: it needs a build-time FUI dependency that doesn't exist yet (no FUI-blocks-publish item — the impl sibling of #872/#907's contract distribution); building now is impossible. Covers badge + we-tag (#1669) surfaces.
