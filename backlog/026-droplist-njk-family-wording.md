---
type: issue
status: resolved
dateOpened: '2026-06-02'
dateClosed: '2026-06-03'
tags:
  - docs
  - droplist
  - terminology
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
crossRef:
  url: /blocks/droplist/
  label: droplist block page
---

# Fix droplist.njk: 'dropdown' family wording should say 'droplist'

src/_includes/block-descriptions/droplist.njk opens with "A 'dropdown' is not one behavior but a composition…" — the block is the abstract family, so that sentence should say 'droplist'. The dropdown is one concrete member.
