---
type: idea
workItem: story
size: 3
parent: "315"
blockedBy: ["376"]
status: resolved
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: block:drawer
tags: [gap-analysis, block, drawer, dialog, modal]
crossRef: { url: /blocks/droplist/, label: "droplist — the abstract-family / concrete-member precedent" }
---

# Drawer block — concrete member of the dialog family (edge placement)

Author the `drawer` block as a **concrete member of the dialog family** — the edge-anchored, sliding
specialization of the abstract dialog block (#376), exactly as `dropdown` is a concrete member of the
abstract `droplist`. It does not re-implement the modal-surface machinery (focus containment, dismissal,
backdrop, scroll-lock, top-layer) — it **extends the dialog substrate** and fixes the configuration to an
edge: the Modal Intent's `placement: start | end` plus a slide-in motion (Motion Intent). Blocked by #376
(the abstract dialog block must exist first).

## Decision (2026-06-12) — resolved

The original "drawer block" candidate hid a fork (standalone block vs. dialog variant). Resolved with the
user toward the **abstract-family / concrete-member** pattern WE already uses for droplist:

- **A drawer IS a configuration of a dialog.** The Modal Intent's `placement` dimension is already
  `center · top · bottom · start · end · fill` — so drawer = `placement: start|end`, bottom sheet =
  `placement: bottom`, centered modal = `placement: center`. No new intent; the UX axis exists.
- **The block layer mirrors droplist:dropdown.** An abstract `dialog` block (#376) owns the shared
  machinery once; `drawer` is a concrete member that extends it (not a standalone re-implementation, not a
  mere variant-value). Avoids duplicating the dialog apparatus and follows the menu-block / droplist
  precedent.
- **Rejected:** a fully standalone drawer block (duplicates the dialog machinery with no substrate to share
  it). The slightly larger, correct path — author the dialog substrate first — was chosen.

## Build (once #376 lands)

- Add `drawer` to `fui:blocks.json` (type Component) as a concrete member: prose "the edge-anchored, sliding
  concrete member of the dialog family", `implementsIntent: modal`, composing surface + motion, extending
  the dialog substrate (per the droplist→dropdown prose convention; WE expresses abstract/concrete in the
  summary, not a structured field).
- Fix the configuration: `placement: start | end` (side, RTL-aware), slide-in/out motion, swipe-to-dismiss
  in addition to the inherited escape/outside/backdrop dismissal.
- `we:block-descriptions/drawer.njk` — overview, what it inherits from the dialog substrate vs. what it adds
  (edge placement + slide + swipe), Web Standards + Framework Research tables.
- Semantics term *Drawer* (a concrete dialog-family member). Cross-ref the sibling future members (bottom
  `sheet`, centered `modal`).

## Acceptance

- `drawer` block documented as a concrete member extending the dialog substrate (#376), not a standalone
  re-implementation; `placement: start|end` + slide.
- `check:standards` green; page renders at `/blocks/drawer/`.

## Outcome (2026-06-12)

Authored the `drawer` block as the edge-anchored concrete member of the dialog family (status `draft`,
type Component, `implementsIntent: modal`, composes surface + motion). It extends the abstract dialog
substrate (#376) and re-implements none of its machinery — only fixes `placement: start|end` (RTL-aware
via logical insets), adds slide motion + swipe-to-dismiss. 4 design decisions (extends-not-reimplements ·
edge=Modal placement start/end · swipe layered on inherited dismissal · member-not-flag). `fui:blocks.json` +
`we:block-descriptions/drawer.njk` (what-it-fixes-vs-inherits table, standards, framework research, family) +
semantics term *Drawer*. Coverage: drawer → covered. `check:standards` green; page at `/blocks/drawer/`.
The dialog→drawer chain (the user's abstract-family design) is complete; sheet + centered-modal are future
siblings.
