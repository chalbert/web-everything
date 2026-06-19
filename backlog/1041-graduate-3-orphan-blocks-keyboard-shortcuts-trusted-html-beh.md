---
type: idea
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
tags: []
---

# Graduate 3 orphan blocks: keyboard-shortcuts, trusted-html-behavior, breakpoint-observer

Surfaced by the #991 audit (§9): of 46 draft/concept blocks, these 3 are orphans — zero backlog refs, no demo, no item driving them to active. Give each an owning path: keyboard-shortcuts (own item + demo), trusted-html-behavior (pairs with trusted-html — own or fold), breakpoint-observer (pairs with flex-row / breakpoint intent — own or fold). Default is a non-destructive owner+demo to graduate; fold-into-sibling or retire-the-stub is a per-block call deferred to this item.

## Progress

Surfaced an owner for each of the 3 orphan draft/concept blocks (audit §9 / #991) — the non-destructive
default (own + demo). Per-block call: OWN all three (none is a true duplicate to fold) —
trusted-html-behavior is the composable *behavior* form, distinct from the trusted-html *element* block
it composes with (bias-toward-separation). Scaffolded a dedicated build+demo owner item per block, each
naming the block id so it is no longer a zero-backlog-ref orphan:
- `keyboard-shortcuts` → owner #1139 (chord normalization Module + demo)
- `trusted-html-behavior` → owner #1140 (Trusted Types innerHTML behavior + demo; composes trusted-html)
- `breakpoint-observer` → owner #1141 (breakpoint-intent runtime: media/container queries + reactive
  matches() API + the 4 declared traits; pairs with flex-row #508 at viewport scope)

Each owner drives its block draft/concept→active when built. This surfacing item is complete; the builds
are the owner items (well beyond one size-5 slice).
