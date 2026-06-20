---
kind: task
status: resolved
blockedBy: ["300"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "block:droplist"
tags: []
---

# Demote droplist Menu button entry to trigger-only (Fork G)

Demote the droplist family Menu button entry to trigger-only — per #173 Fork G, a true menu button opens a role=menu of commands (owned by the Menu block #300), not a role=listbox of values; fui:blocks.json:21,36 currently mis-files it as a droplist member. Remove or redirect the entry so the constellation has one home for menu button.

## Progress

Demotion applied across all 5 roster references so the menu button is no longer filed as a droplist member; only its trigger shape (`button[aria-haspopup]`) is documented as shared, surface owned by the Menu block (#300):
- `fui:src/_data/blocks.json:21` (droplist summary roster) — removed "Menu button" from the members list.
- `fui:src/_data/blocks.json:36` ("Family vs. members") — removed from the member list + added a note that a menu button is a value-invoker owned by the Menu block, trigger-only per Fork G / #301.
- `we:src/_data/semantics.json` (Droplist term) — removed from the roster + added the not-a-member note.
- `we:src/_includes/block-descriptions/droplist.njk:16` (family terms table) — reframed the row from "Concrete member" to "Not a droplist member", links to `/blocks/menu/`.
- `we:src/_includes/block-descriptions/droplist.njk:122` (per-member trait table) — removed the Menu button row (it resolves no droplist traits).

`check:standards` green (0 errors). The Menu block (#300) already documented the demotion as the spec; this closes the follow-on.

**Graduated to** `block:droplist` — menu-button demoted to trigger-only — fui:blocks.json + we:semantics.json + we:droplist.njk (Fork G).
