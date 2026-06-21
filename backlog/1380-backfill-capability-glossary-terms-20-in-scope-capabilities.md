---
kind: story
size: 3
parent: "1327"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/semantics/popover.json"
tags: []
---

# Backfill capability glossary terms (~20 in-scope capabilities)

Slice A3 of #1327. The #1343 ratification's premise that capabilities are 'already 0-gap (21/21)' was a measurement error — the #1371 coverage gate finds only 1/21 capability labels match a glossary term (20 missing: Popover API, Dialog, Anchor Positioning, contentEditable, Sanitizer API, Invoker Commands, showPicker(), …). Capabilities ARE in the required wholesale set per #1343, so author a we:src/_data/semantics/<slug>.json { term, definition, usage } for each missing capability concept. Sibling of A1 (#1369 intents) / A2 (#1370 protocols). Warn-level gate already live (#1371).

## Progress (2026-06-21, batch-2026-06-21-1385-1392)

Actual count was **19** missing (not ~20): `declarative-shadow-dom` and `dialog` already had matching
glossary terms, so 19/21 needed backfill. Authored one `we:src/_data/semantics/<slug>.json` per missing
capability, with each `term` set to exactly the capability's `label` so the #1371 conceptKey match
(lowercase + kind-suffix strip) resolves:

- css-anchor-positioning, contenteditable, cross-root-aria, custom-state, customizable-select, details,
  details-name, dialog-closedby, editcontext, face, field-sizing, cap-hidden-until-found, highlight-api,
  invokers, popover, request-submit, sanitizer-api, showpicker, user-pseudos.
- Two slugs (`css-anchor-positioning`, `cap-hidden-until-found`) avoid a filename collision: a
  `we:src/_data/semantics/anchor-positioning.json` already exists for the *protocol* concept "Anchor
  Positioning" and `we:src/_data/semantics/hidden-until-found.json` for the attribute form
  `hidden="until-found"` — distinct
  concepts from the capability labels "CSS Anchor Positioning" / "Hidden Until Found", so new files.
- Definitions are plain-prose platform descriptions; `usage` ties each to its capabilityMatrix native-first
  resolution + fallback. **Capability glossary coverage warnings: 19 → 0; gate green (0 errors).**
