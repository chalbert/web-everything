---
bornAs: xy4kshz
kind: decision
status: open
dateOpened: "2026-07-13"
tags: []
---

# Plateau-app product separation — the menu is too big; carve it into distinct products

Plateau-app's menu has grown too big; it should separate into **distinct products** rather than one
flat app. Plateau Loop (the delivery coordinator, [#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/))
is one such product; the autonomous Explorer ([#1167](/backlog/1167-autonomous-explorer/) / [#1522](/backlog/1522-explorer-captured-gaps-epic/))
is a candidate for another (name TBD). This is the sibling framing to
[#2446](/backlog/2446-where-does-plateau-loop-live-plateau-app-module-own-repo-or-/)
(where the Loop lives) — that decides one product's home; this decides the shell they all share.

## Fork 1 — how the products relate to the plateau-app shell
*Fork-existence:* plateau-app can stay one app that merely groups its menu, or become a thin shell
hosting separately-addressable products — both are real end-states with different blast radius.
- **(default) thin product shell** — plateau-app becomes a shell; each product (Loop, Explorer, …) is
  a self-contained surface with its own route/menu section, extractable later without a rewrite.
  *Confidence: medium — matches "carve into distinct products" and keeps future extraction cheap.*
- **(b) grouped menu only** — keep one app, just reorganise the menu into sections. Weaker: it hides the
  size problem without giving products independent lifecycles.

## Fork 2 — which products to extract first, and naming
*Fork-existence:* the extraction set is genuinely open — Loop is settled, the rest are candidates.
- **(default) Loop first, Explorer second** — Loop already has an epic and a live daemon; the Explorer
  is the next-most-coherent standalone surface. Name for the Explorer product is unresolved.
- **(b) a different second product** — some other current menu area may be a cleaner extraction; needs a
  survey of the current menu before committing.

## Boundaries / lineage
Un-prepared — run `/prepare` before ratifying (survey the current plateau-app menu; settle the Explorer
product name). Surfaced 2026-07-12 as operator direction during the first
[#2445](/backlog/2445-plateau-loop-extract-the-delivery-machinery-into-a-coordinat/) watch run.
