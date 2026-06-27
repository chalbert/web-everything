---
kind: task
status: open
locus: frontierui
dateOpened: "2026-06-27"
tags: [gate, check-standards, webrouting, transient, "783", "843"]
---

# #783 Check 2 should count register*(tag=) defaults + #843 override names as on-disk registrations (FUI gate)

FUI. The `#783` Check-2 *reverse* ("phantom name") gate in `fui:scripts/check-standards.mjs` (`walkDefines`
→ `diskNames`) only recognizes literal `customElements.define('x')` / `attributes.define('x')` as an on-disk
registration. But `#843` override pretty-names + custom-attr names (`auto-heading`, `app-view`, `app:link`,
`on:click`) are registered **only** via parameterized `register*(tag = 'we-…')` with the pretty name passed
by consumers — they have no on-disk literal, so they appear on disk **only in JSDoc `* …define('x')`
examples**. The reverse check currently passes solely because `walkDefines` counts those JSDoc-block lines
(a coincidence, left in place deliberately — see the comment there). Replace that with real accounting:
collect `register*(tag = '…')` defaults into `diskNames`, and treat a `fui:src/_data/blocks.json`
`registeredName` as satisfied when its block declares a parameterized register fn (override names need no
literal). Then the `walkDefines` collector can drop the JSDoc-counting and skip `* …` example lines too.
Surfaced fixing the post-#1777 FUI gate red (the upgrader-relocation fixture/comment false positives).
