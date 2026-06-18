# Reveal navigation menus — the disclosure-panel paradigm (prior-art grounding for #609)

**Date**: 2026-06-14
**Point**: Top-level nav that discloses a panel of links on hover/focus (dropdown nav, mega-menus, the WE header) is the **WAI-ARIA APG Disclosure Navigation** pattern composed with the **Anchor** intent — not a new widget and not the menu/menubar role. After the survey only **two** genuine forks survive (where the composition lives; where hover-intent lives); the rest are forced invariants or support-all.
**Research page**: `/research/reveal-navigation-menus/`
---

## Question

Where does the **reveal-navigation paradigm** live in the WE constellation, and which of its many concerns are genuine design decisions vs. forced invariants vs. support-all? The base already exists — the **nav-list** block ([fui:blocks.json:2082](../src/_data/blocks.json#L2082), W3C APG *Disclosure Navigation*, `nav:section` toggle, roving tabindex). #609 is the **reveal-panel layer + cross-cutting concerns** on top of it. The WE site header ([we:base.njk:32-69](../src/_layouts/base.njk#L32), [we:style.css:241-276](../src/css/style.css#L241)) is a live, hand-rolled dogfood instance.

## Recommendation

1. **Disclosure, not menu — forced invariant (ratify).** APG is explicit: site nav that reveals link lists is the **Disclosure** pattern (`aria-expanded` + `aria-controls`, native list/anchor semantics), **not** `menu`/`menubar` (composite-widget roving focus + type-ahead first-character nav, for application command menus like Google Docs). Few sites need that machinery; using it for nav is an anti-pattern.
2. **No new block by default — composition recipe (Fork 1).** Header reveal nav = a **nav-list section** (disclosure) whose disclosed content is an **anchored panel** (Anchor intent, `type=menu/popover`, `strategy=escape` for the no-reflow popover). The mega-menu *multi-column shape* is panel layout — support-all, not a standard. The named-composition-block alternative (matching the `menu`/`drawer` house style) is the main alternative.
3. **Mint a small hover-intent concern (Fork 2).** The open/close delay + safe-area corridor recurs across reveal-nav, menu submenus, and hovercards; per the separation bias it earns its own reusable behavioral concern that those surfaces compose. The *mechanic* (CSS-bridge / JS pointer-polygon / delay-only) is a **Technical Configurator** setting, not a UX dimension.
4. **No-reflow, i18n label-growth, native-first CSS baseline — forced invariants (ratify), not new dimensions.** Reflow-vs-no-reflow is already the existing `anchor.strategy = inline | escape` axis (in-flow sidebar accordion reflows fine; header popover must not). i18n resilience (no English-keyed fixed widths, no label truncation) and "CSS disclosure baseline, JS enhancement" are good-practice invariants.

## Key Findings

### A11y — Disclosure vs Menu (decisive, forced invariant)
- **W3C APG**: the [Disclosure Navigation Menu example](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/) is the recommended pattern for "typical site navigation with expandable groups of links." The [Menubar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) requires composite-widget focus management (roving tabindex, first-character type-ahead) "unnecessary for typical site navigation."
- Disclosure ARIA is **minimal**: keep native `<ul>`/`<a>` semantics; the only additions are `aria-expanded` + `aria-controls` on each toggle. Menu roles strip link semantics and impose desktop-menu keyboard rules.
- Community consensus (Adrian Roselli / Terrill Thompson / evinced) mirrors APG: **"menus are not menus"** — reserve `role=menu`/`menubar` for app commands.
- **Dogfood gap (build, not fork):** the WE header heads are `<span aria-hidden>` with the panel revealed by `:hover`/`:focus-within` only ([we:style.css:271-276](../src/css/style.css#L271)) — there is **no** `aria-expanded`/`aria-controls`, no keyboard toggle, no Esc/outside-click dismissal. The dogfood is **not yet APG-conformant**; conforming it is a graduation build item.

### Hover-intent / the diagonal problem (genuine, deep, divergent)
- **Origin**: Bruce "Tog" Tognazzini & Jim Batson, Apple HID team; popularized as the "Amazon triangle" / hover-tunnel.
- **The problem**: moving the pointer diagonally from a trigger toward the panel briefly crosses a *sibling* trigger, naïvely closing the open panel ("menu rage").
- **Three escalating mechanics seen in the wild**:
  - **delay-only** (timeout before close) — what Radix NavigationMenu and Headless UI ship.
  - **CSS safe-area bridge** — an invisible `::before` strip spanning the trigger→panel gap so `:hover` survives the trip (what the WE dogfood does, [we:style.css:263-270](../src/css/style.css#L263)).
  - **pointer-direction polygon** ("safe triangle") — track cursor velocity, build an SVG/`pointer-events` triangle toward the panel corners, keep the panel open while the pointer stays inside it ([jQuery-menu-aim](https://github.com/kamens/jQuery-menu-aim), [Smashing 2023](https://www.smashingmagazine.com/2023/08/better-context-menus-safe-triangles/), [CSS-Tricks](https://css-tricks.com/dropdown-menus-with-more-forgiving-mouse-movement-paths/)).
- **Divergence**: Radix deliberately ships delay-only and has *open* requests to add the polygon ([radix #1549](https://github.com/radix-ui/primitives/issues/1549), [#2437](https://github.com/radix-ui/primitives/issues/2437)); PrimeVue is adding it ([#8448](https://github.com/primefaces/primevue/issues/8448)). So the *mechanic* is unsettled across libraries → a Technical Configurator setting, while the *intent* ("tolerate diagonal travel; don't open on incidental pass-through") is a forced invariant.

### Reveal mechanics, modality, no-reflow (support-all + invariants)
- **NN/g** ["Mega Menus Work Well for Site Navigation"](https://www.nngroup.com/articles/mega-menus-work-well/): validates the pattern; guidance — show all options in a 2-D layout, avoid hover-only timing traps, give a non-hover path.
- **Triggers** (support-all, all three mandatory): pointer (hover), keyboard (focus / `:focus-within` / Enter), **touch (no hover → first tap toggles, not navigates)**.
- **No-reflow**: an anchored panel (`anchor.strategy=escape`, top-layer/popover) must never resize chrome. Two mechanics: absolute/popover out-of-flow (dogfood) vs. reserve-space. For header nav, popover; for an in-flow sidebar accordion, reflow is fine — *that distinction is already the `anchor.strategy` axis*, not a new dimension.
- **Native substrate**: CSS Anchor Positioning (`anchor()`, `position-try` flip/shift) + Popover API (top-layer, light-dismiss) — already owned by the WE **Anchor** intent ([we:intents.json:1204](../src/_data/intents.json#L1204)). The reveal panel needs nothing new here; it composes Anchor.
- **i18n**: translated labels grow (DE/FI +30–40%); collapsed bar + panel columns must absorb growth without reflow/clipping (no fixed px keyed to English, no truncation). Ties Internationalization × no-reflow. Forced invariant.

### Composition seam (cite, don't reinvent)
- **nav-list** ([fui:blocks.json:2082](../src/_data/blocks.json#L2082)) — base; `nav:section` is the disclosure primitive.
- **disclosure intent** ([we:intents.json:1816](../src/_data/intents.json#L1816)) — expand/collapse contract (native `<details>`/`<summary>`).
- **navigation intent** ([we:intents.json:1146](../src/_data/intents.json#L1146)) — landmark + `aria-current`.
- **anchor intent** ([we:intents.json:1204](../src/_data/intents.json#L1204)) — placement (12-way grid), collision (flip/shift), `strategy=inline|escape`, dismissal (light/explicit/modal), `type=menu/popover`.
- **menu block** ([fui:blocks.json:3181](../src/_data/blocks.json#L3181)) / **drawer block** ([fui:blocks.json:3277](../src/_data/blocks.json#L3277)) — adjacent **composition-manifest** blocks to disambiguate from (command menu; off-canvas) and the house-style precedent for Fork 1's block alternative.

## Forks after research (reshaped)
- **Fork 1 — Home & shape.** Genuine. Composition recipe (default) vs. named composition block. (Mega-menu multi-column shape demoted to support-all.)
- **Fork 2 — Hover-intent home.** Genuine, reshaped. Standalone behavioral concern (default) vs. anchor-intent dimension. (Mechanic → Technical Configurator, not a fork.)
- **Fork 3 — No-reflow & i18n (dissolved).** These are forced invariants / the existing `anchor.strategy` axis, not new dimensions.
- **A11y disclosure-not-menu (dissolved into ratify).** Forced invariant; surfaced a concrete dogfood conformance gap → graduation build.

## Files Created/Modified
| File | Action |
|---|---|
| `we:reports/2026-06-14-reveal-navigation-disclosure-pattern.md` | created (this report) |
| `we:src/_data/researchTopics.json` | added `reveal-navigation-menus` entry |
| `we:src/_includes/research-descriptions/reveal-navigation-menus.njk` | created (write-up) |
| `backlog/609-…reveal-navigation-menus….md` | rewritten to prepared-fork shape, `preparedDate` set |
