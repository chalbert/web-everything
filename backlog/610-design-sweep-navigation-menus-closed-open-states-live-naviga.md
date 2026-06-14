---
type: issue
workItem: story
size: 5
status: open
dateOpened: "2026-06-14"
tags: [design-sweep, navigation, disclosure, prior-art]
crossRef: { url: /backlog/609-candidate-standard-reveal-navigation-menus-mega-menu-hover-d/, label: "Feeds — reveal-nav candidate standard (#609)" }
---

# Design sweep — navigation menus (closed & open states), live-navigation method

A **focused** competitive design sweep on **navigation menus only** — distinct from the broad
gap-sweep (`.claude/skills/gap-sweep-rerun`, which benchmarks whole design systems). Survey how
leading sites/products do top-level nav that **reveals** (dropdown / mega-menu / hover-disclosure),
capturing **both states**: the **collapsed** bar *and* the **opened** panel. Output is prior-art
grounding for the reveal-nav candidate standard [#609](/backlog/609-candidate-standard-reveal-navigation-menus-mega-menu-hover-d/)
(its forks can't reach "ready to ratify" without it).

## Why this needs live navigation (the method note)

Static, freely-available screenshots **only show the closed state** (or a single posed open shot).
The interesting behavior is **dynamic** and only observable by driving a real browser:

- The **open** panel — its layout, column sectioning, width, alignment to the trigger.
- **Reveal mechanics** — hover-intent delay, safe-triangle, whether it reflows the header, the
  open/close transition.
- **Modality** — keyboard (focus) and **touch (tap-to-toggle)** fallbacks, which no screenshot shows.

So this sweep should **actually navigate to the public sites** (Playwright/headed browser — hover +
focus + click, capture closed and open) rather than rely on a screenshot corpus. That capability —
driving public sites and capturing interaction states — is the seam this card establishes; note it
is **public, logged-out** browsing. The **logged-in** variant (needs accounts/email) is the separate
[#611](/backlog/611-app-screenshot-access-system-managed-email-inbox-for-logged-) concern.

## Scope per surveyed site

For each target, capture and note:

- **Closed:** trigger style (text vs button vs icon), spacing, how many top-level sections.
- **Open:** single dropdown vs multi-column mega-panel; sectioning; alignment to trigger; width;
  does it overlay (no reflow) or push content.
- **Reveal:** hover vs click; open/close delay; safe-triangle; transition; dismissal (Esc, outside-click).
- **Resilience:** behavior at narrow widths; touch; **does a longer (e.g. translated) label reflow it**.
- **A11y read:** disclosure (`aria-expanded`) vs menu role; focus handling.

Candidate targets: Stripe, Linear, Vercel, GitHub, Apple, AWS (deep mega-menu), Atlassian, MDN,
a gov/design-system site (GOV.UK / USWDS) for the accessible-disclosure baseline.

## Deliverable

A `/research/` topic + report (per the materialization pattern): matrix of sites × the axes above,
the recurring **good-practice invariants** (no-reflow, disclosure-not-menu, touch fallback,
hover-intent), and the divergences that are genuine forks — handed to #609 to prepare.

## Progress

- **Status:** OPEN — card for later. Created 2026-06-14 while iterating the WE header menu.
- **Note:** establishes the **live-navigation capture** method (drive public sites, capture
  closed + open + interaction), as opposed to a passive screenshot corpus.
</content>
