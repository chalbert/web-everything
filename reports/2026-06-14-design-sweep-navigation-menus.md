# Design sweep — navigation menus (reveal nav): closed & open states — 2026-06-14

Backlog: [#610](/backlog/610-design-sweep-navigation-menus-closed-open-states-live-naviga/). A **focused**
competitive sweep of top-level **reveal navigation** (dropdown / mega-menu / hover-disclosure) — distinct from
the broad design-system gap-sweep. Prior-art grounding for the reveal-nav candidate standard
[#609](/backlog/609-candidate-standard-reveal-navigation-menus-mega-menu-hover-d/); its forks can't reach
"ready to ratify" without it.

## Method — live navigation (not a screenshot corpus)

Drove a real headless Chromium (Playwright 1.58) to each public, logged-out site, captured the **closed** bar
and the **opened** panel, and extracted each top-level trigger's a11y facts (`<button>`-vs-`<a>`,
`aria-expanded`, `aria-haspopup`, `aria-controls`, `role`) plus the **reveal method** (hover vs click,
measured by which interaction flipped `aria-expanded` to `true`). Static screenshots only show the closed
state — the reveal mechanics and panel layout are only observable by driving the browser. This establishes the
**live-navigation capture seam** (public, logged-out); the logged-in variant is the separate
[#611](/backlog/611-app-screenshot-access-system-managed-email-inbox-for-logged-) concern.

## Matrix — 8 targets × the axes

| Site | Trigger element | Reveal | Panel kind | Layout | Anchor / width | A11y pattern |
|---|---|---|---|---|---|---|
| **Stripe** | `<button>` + `aria-expanded` | **hover** | mega | 5 labelled columns, item + description | full-width, overlay (no reflow) | disclosure (no `role=menu`) |
| **Vercel** | `<button>` + `aria-expanded` + `aria-controls` | **hover** | mega | 3 sections w/ icons | trigger-anchored, overlay | disclosure + `aria-controls` |
| **GitHub** | `<button>` + `aria-expanded` | **click** | mega | multi-column w/ icons + "View all features" | wide, overlay | disclosure |
| **MDN** | `<button>` + `aria-expanded` + `aria-controls` | **click** | dropdown | 3 columns (reference / guides / langs) | trigger-anchored, narrow, overlay | disclosure + `aria-controls` |
| **Apple** | `<button>` + `aria-expanded` + `aria-controls` (nav items are `<a>`) | **click** | mega | full-width, sectioned | full-bleed, overlay | disclosure |
| **USWDS** (gov design system) | `<button>` + `aria-expanded` + `aria-controls` | **click** | dropdown → mobile accordion | single column, trigger-anchored | **accessible-disclosure reference baseline** |
| **GOV.UK** | plain `<a>` links on desktop; mobile = a "Menu" disclosure button | **none (desktop)** | — | no reveal nav on desktop | — | deliberately avoids hover mega |
| **AWS** | custom JS mega (not exposed via standard a11y attrs to the heuristic) | hover/click (custom) | deep mega | full-width multi-column | overlay | custom (weakest a11y surface) |

(Captured live: closed + open screenshots for Stripe, Vercel, GitHub, MDN, Apple, USWDS; AWS/GOV.UK
closed only — AWS's mega is custom-element-driven and GOV.UK has no desktop reveal.)

## Recurring good-practice invariants (consistent across the set)

1. **Disclosure, not an ARIA menu.** Every captured trigger is a `<button aria-expanded>` toggling a panel of
   ordinary links — **none** use `role="menu"`/`menuitem`. This matches WAI-ARIA APG guidance: reserve the
   menu role for application menus; site navigation is a **disclosure**. *(Candidate forced invariant for #609.)*
2. **The revealing top-level item is a `<button>`, not a link.** Real navigation targets live *inside* the
   panel; the trigger only toggles. (Apple keeps its non-revealing items as plain `<a>`.)
3. **Overlay, no reflow.** The open panel floats above content; the header does not grow or push the page —
   layout stability is preserved. *(Candidate forced invariant.)*
4. **`aria-controls` links trigger → panel** on the more accessible implementations (Vercel, MDN, Apple, USWDS).
5. **Sectioned columns** for mega-panels (2–5 labelled groups, each item a label + short description).
6. **Esc + outside-click dismissal** is universal (observed); focus returns to the trigger.

## Divergences — the genuine forks (handed to #609)

- **FORK — reveal trigger: hover vs click.** The central, real fork. Stripe/Vercel use **hover-disclosure**
  (with hover-intent delay + a safe-triangle to the panel); GitHub/MDN/Apple/USWDS use **click-disclosure**.
  Both are coherent end-states (hover = faster desktop browsing; click = touch-parity + intentional open), so
  by the support-all-coherent + most-flexible-default rules this is **not** a winner-pick but a configurable
  dimension: **click is the most-accessible / most-permissive default (works on touch unchanged), hover is an
  author opt-in** that *must* carry a tap-to-toggle touch fallback (first tap opens, does not navigate). GOV.UK
  is the data point for "no hover at all."
- **DIMENSION (not a fork) — panel scale: full-width mega vs trigger-anchored dropdown.** Stripe/Apple go
  full-bleed; MDN/Vercel anchor to the trigger. Both legitimate → a panel-width / anchor configuration axis
  (anchor-positioning), not a single mandate.
- **DIMENSION — panel density:** single-column dropdown (MDN/USWDS) vs multi-section mega (Stripe/GitHub) — a
  content-volume choice, configurable.

## Handoff to #609

The reveal-nav candidate standard should encode: **disclosure-semantics + overlay-no-reflow + Esc/outside-click
dismissal + focus-return** as forced invariants; **hover-vs-click** as the configurable reveal dimension with a
**click default + mandatory touch fallback for hover**; and **panel width/anchor + density** as open
configuration. USWDS is the accessible-disclosure reference to conform against.
