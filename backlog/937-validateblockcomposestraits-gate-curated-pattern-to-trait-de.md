---
type: issue
workItem: task
status: resolved
blockedBy: ["936"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
tags: []
---

# validateBlockComposesTraits gate — curated pattern-to-trait deny-list, warn-first

Fork 1 of #933. Add a check:standards gate validateBlockComposesTraits beside validateBlockImplConformance (we:scripts/check-standards-rules.mjs:1234), reusing the implPresent:null->skip cross-repo precedent. Two arms: (i) assert a block's declared composesBehaviors (#936) resolve against we:src/_data/traits.json; (ii) a curated source-pattern->required-trait deny-list over FUI source — seed rules: click/keydown on an aria-expanded head -> must compose nav:section; roving-tabindex wiring -> nav:list. Warn-first, escalating to ERROR once the deny-list is curated and false-positive-free (#840/#844/#477 precedent). Targets the hand-rolls at fui:blocks/disclosure-nav/DisclosureNav.ts:123,140 and fui:blocks/sectioned-nav/SectionedNav.ts:73,87. Open-ended addEventListener sniffing rejected; static (not rendered/axe) gate.

## Progress (batch-2026-06-18) — resolved

- **Arm (i) already shipped via #936**, not re-implemented. #936 §3b in
  [we:scripts/check-standards.mjs](../scripts/check-standards.mjs) already asserts declared
  `composesBehaviors` resolve against the de-facto behavior registry (the union of provided
  `traits[].name`; `we:src/_data/traits.json` is prose, not a flat list). Duplicating it here would just
  collide — so #937 delivers **arm (ii)** as the new named gate the card asks for.
- **Arm (ii) — `validateBlockComposesTraits`** added in
  [we:scripts/check-standards-rules.mjs](../scripts/check-standards-rules.mjs) (sibling of
  `validateBlockImplConformance`, same `source:null → skip` cross-repo precedent). The deny-list is
  **curated by block id** (`COMPOSE_DENY_LIST`), NOT an open `addEventListener` sniff (the framing the
  card rejects) — so it cannot false-positive on an unrelated block (e.g. the behavior's own provider
  impl). A rule's `signature` is an AND of regexes; a target silences a finding the intended way — by
  actually **composing** the behavior (declaring it in `composesBehaviors`), which is the migration
  #944/#934 perform.
- **Seed rules:** `disclosure-aria-expanded` → `nav:section` (applies to `disclosure-nav`,
  `sectioned-nav`); `roving-tabindex` → `nav:list` (seeded, no curated target yet — one-line to add).
- **Gather** in [we:scripts/check-standards.mjs](../scripts/check-standards.mjs) §8d concatenates the
  curated targets' FUI impl-dir `*.ts` so the multi-file signature sees the whole surface; detect-or-skip
  when `../frontierui` is absent (mirrors §8c).
- **Warn-first.** `COMPOSE_TRAITS_ENFORCED = false`; flips to ERROR once curated + false-positive-free
  (#840/#844/#477 precedent). Live gate now warns `disclosure-nav` + `sectioned-nav` (the two named
  hand-rolls), zero errors.
- **Tests** — 6 cases in
  [we:scripts/__tests__/check-standards-rules.test.mjs](../scripts/__tests__/check-standards-rules.test.mjs)
  (warn-on-hand-roll, clears-when-composed, `{name}` form, out-of-allow-list never sniffed, partial
  signature no-fire, source-null skip). Full suite green (154).
- Gate green for this changeset (the one repo-locus ERROR is in concurrent sessions' committed
  #938/#943 files — out of my changeset, stepped over per the batch scoped-stop rule).
