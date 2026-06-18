---
type: issue
workItem: task
status: open
blockedBy: ["936"]
dateOpened: "2026-06-18"
tags: []
---

# validateBlockComposesTraits gate — curated pattern-to-trait deny-list, warn-first

Fork 1 of #933. Add a check:standards gate validateBlockComposesTraits beside validateBlockImplConformance (we:scripts/check-standards-rules.mjs:1234), reusing the implPresent:null->skip cross-repo precedent. Two arms: (i) assert a block's declared composesBehaviors (#936) resolve against we:src/_data/traits.json; (ii) a curated source-pattern->required-trait deny-list over FUI source — seed rules: click/keydown on an aria-expanded head -> must compose nav:section; roving-tabindex wiring -> nav:list. Warn-first, escalating to ERROR once the deny-list is curated and false-positive-free (#840/#844/#477 precedent). Targets the hand-rolls at fui:blocks/disclosure-nav/DisclosureNav.ts:123,140 and fui:blocks/sectioned-nav/SectionedNav.ts:73,87. Open-ended addEventListener sniffing rejected; static (not rendered/axe) gate.
