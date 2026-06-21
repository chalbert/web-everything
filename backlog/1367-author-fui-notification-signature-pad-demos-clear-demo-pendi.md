---
kind: story
size: 3
locus: frontierui
status: open
dateOpened: "2026-06-21"
tags: [frontierui, demos, blocks]
---

# author FUI notification + signature-pad demos (clear DEMO_PENDING from #1361)

#1361 registered `notification` + `signature-pad` in `fui:src/_data/blocks.json` to clear the #784
catalog-completeness red, but their self-bootstrapping demos are not yet authored, so both ids sit on the
`DEMO_PENDING` allowlist in `fui:scripts/check-standards.mjs` (#972/#973). Author a `fui:demos/` page for
each — a `<notification-region>` show/dismiss demo (severity-mapped live-region + paused auto-timeout) and
a `<signature-pad>` typed-name + opt-in canvas demo — wire each entry's `demoFile`, browser-verify on
:3001, then remove the two ids from `DEMO_PENDING` so the every-block-has-a-demo invariant (#973) holds
empty again.
