---
type: idea
workItem: story
size: 3
status: open
dateOpened: "2026-06-17"
tags: []
---

# Structure the webStandards bag for display on /blocks/{id}/ (humanize concern, group/order)

The block-pages.njk Accessibility & Web Standards panel (#826) renders block.webStandards as-authored: the raw camelCase concern key in a code cell, rows in object order. Refine the DISPLAY only — humanize the concern label (ariaCurrentStep → 'aria-current step'), order/group concerns, optionally link the concern to a standards-panel/term page — without changing the flexible {concern:{usage,reference}} field-shape, which #803 keeps as the realization SoT. Pure presentation polish on a working panel; not blocking anything.
