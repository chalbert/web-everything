---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#compose-dont-handroll"
preparedDate: "2026-06-14"
tags: [candidate-standard, intent, block, navigation, disclosure, decision]
relatedReport: reports/2026-06-14-reveal-navigation-disclosure-pattern.md
relatedProject: webintents
crossRef: { url: /backlog/610-design-sweep-navigation-menus-closed-open-states-live-naviga/, label: "Fed by — nav-menu design sweep (#610)" }
---

# Candidate standard — reveal navigation menus (mega-menu / hover-disclosure panels)

**Prepared, ready to ratify.** The reveal-navigation paradigm — top-level nav whose sections disclose
a panel of links on hover/focus (dropdown nav, mega-menus, the WE header) — is **not greenfield**: the
base is the **nav-list** block ([fui:blocks.json:2082](src/_data/blocks.json#L2082), W3C APG *Disclosure
Navigation*), and the panel surface is the existing **anchor** intent. The prior-art survey (published
as [/research/reveal-navigation-menus/](/research/reveal-navigation-menus/)) collapses the concern to
**two genuine forks**, each with a **bold** recommended default; everything else is a forced invariant
(ratify) or support-all. Disclosure-not-menu, no-reflow, i18n resilience, and native-first are
invariants — not decisions.

## Ruling — ratified 2026-06-14 (both forks: option A)

**Fork 1 → A (composition recipe, no new block), homed on nav-list.** The reveal-panel layer is *not*
a new block. The discriminator is **own design thesis**, not "borrowed machinery": `menu`
([fui:blocks.json:3181](src/_data/blocks.json#L3181)) and `drawer`
([fui:blocks.json:3277](src/_data/blocks.json#L3277)) each earned a block because each draws a *new* line
(invocation-not-value; the edge-anchored member of the dialog family) — both also borrow all their
machinery via `composesIntents`, so "borrowed machinery" can't be what justifies a block. **reveal-nav
draws no new line:** disclosure-not-menu is already nav-list's ruling, the out-of-flow panel is already
`anchor.strategy=escape`, and the one new concern (hover-intent) is homed in Fork 2 — a reveal-nav
block's `designDecisions` would only *forward* to other entities and would **duplicate nav-list's
existing home** for disclosure-nav. So: document the recipe (nav-list section + disclosure + anchor
`strategy=escape`/`type=menu`) and express the panel as an **out-of-flow surface-strategy value on
nav-list's existing disclosure axis** (in-flow accordion vs. escape panel) — the recipe + a conformance
demo is the standard.

**Fork 2 → A (standalone hover-intent concern).** Mint the small reusable concern; do not fold it onto
anchor. The decisive reason is **orthogonality of concern**, not "recurs without anchor" (most consumers
— submenu, hovercard, reveal panel — *are* anchored): hover-intent is a *trigger-transition* behavior
(when does pointer motion count as intent-to-open, tolerating diagonal travel), whereas anchor owns
*placement + dismissal* of an already-open surface. Coupling "should I open" to "where do I sit" mixes
trigger semantics into the tethered-surface contract. The **mechanic** (delay-only / CSS safe-area / JS
polygon) → Technical Configurator, never a UX dimension or WE mandate — ratified as written.

**Ergonomic home for pure compositions = a devtools assembler, not block proliferation.** Fork 1's
own-thesis test produces a clean dividing line — *own-thesis family → block; pure-composition
meta-component → no block* — but that would leave authors without ergonomic help, and proliferating
thin blocks (the menu/drawer route) is exactly what's declined here. The complement is a zero-lock-in
**"build-your-own-component" composition assembler** in devtools that wires the primitives into a
meta-component and **emits a plain, ejectable composition recipe** (honours *minimize-lock-in* and
*impl-is-not-a-standard* — the tool is a deferred build; the recipe it emits is the standard).
reveal-nav is its first preset. Filed separately (motivated by, not contained in, this decision).

## The axes (what the survey decomposed)

Reveal nav is **composition, not invention**. The orthogonal axes, each pinned to the real tree:
**disclosure** (expand/collapse) is owned by the disclosure intent ([we:intents.json:1816](src/_data/intents.json#L1816)) and nav-list's `nav:section` ([fui:blocks.json:2099](src/_data/blocks.json#L2099)); **panel surface** (placement / collision / no-reflow strategy / dismissal) is owned by the anchor intent ([we:intents.json:1204](src/_data/intents.json#L1204), `strategy: inline|escape`, `type: menu/popover`); **landmark + current** by the navigation intent ([we:intents.json:1146](src/_data/intents.json#L1146)). The only genuinely *new* concern the survey isolated is **hover-intent** (the open/close-delay + safe-area corridor) — homed in Fork 2. The dogfood header ([we:base.njk:32-69](src/_layouts/base.njk#L32), [we:style.css:241-276](src/css/style.css#L241)) proves the recipe and is the conform-to reference.

### Recommended path at a glance

| Fork | Ratified | Main alternative (rejected) | Confidence |
|---|---|---|---|
| **1 — Home & shape** | ✅ **A — Composition recipe** — nav-list section + disclosure + anchor (`strategy=escape`); no new block, homed on nav-list's surface-strategy axis | A named "reveal-nav" composition block (matches the `menu`/`drawer` house style) — rejected: no own thesis, duplicates nav-list's home | Med |
| **2 — Hover-intent home** | ✅ **A — Mint a small standalone hover-intent concern** that reveal-nav / submenus / hovercards compose | A `hoverIntent` dimension folded onto the anchor intent — rejected: mixes trigger semantics into the tethered-surface contract | Med |

## Fork 1 — Where does the reveal-panel layer live?

**Crux.** A header reveal menu = a nav-list section (disclosure) whose disclosed content is an *anchored,
out-of-flow* panel. nav-list's `nav:section` ([fui:blocks.json:2099](src/_data/blocks.json#L2099)) today
discloses *in-flow* (sidebar accordion); the anchor intent already expresses the out-of-flow popover
(`strategy=escape`, [we:intents.json:1204](src/_data/intents.json#L1204)). So the standards artifacts to
express it **already exist** — the question is whether the composition gets a *named home*.

- **A — Composition recipe (no new block). ✅ Default.** Document "header reveal nav = nav-list section +
  disclosure intent + anchor intent (`strategy=escape`, `type=menu`)" as a pattern + a conformance demo;
  mint **no** new block. *Tradeoff:* lowest lock-in, honours *impl-is-not-a-standard* and the
  separation/compose bias, and the only new concern (hover-intent) is homed separately in Fork 2 — so
  there's little own-machinery left to justify a block. The recipe is the standard; the demo proves it.
- **B — Named "reveal-nav" composition block.** A thin block (à la `menu` [fui:blocks.json:3181](src/_data/blocks.json#L3181) and `drawer` [fui:blocks.json:3277](src/_data/blocks.json#L3277), both *composition manifests*) that composes nav-list + disclosure + anchor. *Tradeoff:* matches the house style for "a family realized by composing intents" and gives the conformance demo a first-class home — but adds a surface whose machinery is entirely borrowed, which the compose bias argues against.

*Rejected — a new mega-menu **widget** with its own positioning/disclosure machinery:* re-implements
what anchor + disclosure already own (cite-don't-reinvent). *Demoted to support-all — the multi-column
"mega" shape:* single dropdown vs. N-column panel is panel layout, not a standards choice; both are
supported.

## Fork 2 — Where does hover-intent live?

**Crux.** The diagonal problem (pointer travelling trigger→panel crosses a sibling and naïvely closes
it) needs an open/close-delay + a safe-area corridor. The *intent* ("tolerate diagonal travel; don't
open on incidental pass-through") is a **forced invariant** — every good menu does it. The genuine fork
is **where the reusable behavior lives**, because it recurs across reveal-nav, menu submenus, and
hovercards (and even a CSS-only in-flow disclosure could want an open-delay) — it appears *without*
anchor, which is the separation-bias tell.

- **A — Mint a small standalone hover-intent concern. ✅ Default.** A reusable behavioral concern that
  reveal-nav, the `menu` block's submenus, and a future hovercard all compose. *Tradeoff:* honours the
  separation bias (a concept that recurs without its neighbour earns its own home) and keeps anchor
  focused on tethering; cost is one more small entity.
- **B — `hoverIntent` dimension on the anchor intent.** Fold open/close-delay + safe-area onto the
  anchor intent ([we:intents.json:1204](src/_data/intents.json#L1204)) alongside its `dismissal` axis.
  *Tradeoff:* one fewer entity and anchor already owns surface lifecycle — but couples a
  trigger-transition behavior to the tethered-surface contract and leaves non-anchored hover-reveals
  uncovered.

*Not a fork — the mechanic.* delay-only (Radix/Headless) · CSS safe-area bridge (the WE dogfood,
[we:style.css:263-270](src/css/style.css#L263)) · JS pointer-direction polygon (jQuery-menu-aim /
safe-triangle) is **unsettled across libraries** (Radix ships delay-only with open polygon requests) →
a **Technical Configurator** setting at graduation, never a UX dimension or WE mandate.

---

## Context (not part of the call)

### Supported by default (not decisions)
- **Panel shape** — single dropdown vs. multi-column mega-panel (layout, not a standard).
- **Reveal triggers** — pointer (hover), keyboard (focus / `:focus-within` / Enter), **touch** (no hover
  → first tap toggles, not navigates). All three mandatory; one standard, three triggers.

### Forced invariants (ratify — not weighed)
- **Disclosure, not menu.** APG: site nav revealing link lists is the *Disclosure* pattern
  (`aria-expanded` + `aria-controls`, native list/anchor semantics) — **not** `menu`/`menubar` (roving
  focus + first-character type-ahead, for app commands). Mirrors nav-list's existing ruling. Plus
  Esc-to-close, click/blur-outside dismissal, focus return, `prefers-reduced-motion`.
- **No-reflow = the existing `anchor.strategy` axis**, not a new dimension. Anchored header panel
  (`escape`, top-layer/popover) must never resize chrome; in-flow sidebar accordion (`inline`) reflowing
  is legitimate — same axis, two values.
- **i18n label-growth.** Translated labels grow (DE/FI +30–40%); bar + columns absorb growth without
  reflow or clipping — no English-keyed fixed widths, no truncation. (Internationalization × no-reflow.)
- **Native-first.** CSS disclosure baseline (works without JS, `:focus-within`), JS as progressive
  enhancement (hover-intent / Esc / touch tap-toggle).

### Composition seam (cite, don't reinvent)
nav-list ([fui:blocks.json:2082](src/_data/blocks.json#L2082)) · disclosure ([we:intents.json:1816](src/_data/intents.json#L1816)) · navigation ([we:intents.json:1146](src/_data/intents.json#L1146)) · anchor ([we:intents.json:1204](src/_data/intents.json#L1204)). Disambiguate from: menu block ([fui:blocks.json:3181](src/_data/blocks.json#L3181), commands) and drawer block ([fui:blocks.json:3277](src/_data/blocks.json#L3277), off-canvas).

### Graduation follow-ons (after the call — blocked on this decision)
- **Conform the dogfood header.** It is **not yet APG-conformant**: heads are `<span aria-hidden>`
  ([we:base.njk:33](src/_layouts/base.njk#L33)) with the panel on `:hover`/`:focus-within` only
  ([we:style.css:271-276](src/css/style.css#L271)) — no `aria-expanded`/`aria-controls`, no keyboard toggle,
  no Esc/outside-click dismissal. A build item, not a fork.
- **Technical Configurator card** for the hover-intent mechanic (delay ms / close-delay / safe-area
  strategy / touch behavior) per *intent-UX-only, technical→configurator*.
- The conformance demo for whichever home Fork 1 picks.

## Progress

- **Status:** RESOLVED 2026-06-14 — both forks ratified to option A (see **Ruling** above). Fork 1 → A
  (recipe, no block, homed on nav-list); Fork 2 → A (standalone hover-intent concern); mechanic → Configurator.
  Discussion added the **devtools composition-assembler** finding (the ergonomic home for pure-composition
  meta-components) — filed as a separate epic. Graduation builds spun under `blockedBy: 609`.
- **Research:** [/research/reveal-navigation-menus/](/research/reveal-navigation-menus/) +
  [report](reports/2026-06-14-reveal-navigation-disclosure-pattern.md). Survey **dissolved** the original
  Fork 3 (no-reflow/i18n → invariants) and **reshaped** hover-intent (mechanic → Configurator).
- **Spun graduation builds (all `blockedBy: 609`):** mint hover-intent concern + Configurator card; graduate the reveal-nav recipe (nav-list out-of-flow surface value + conformance demo); conform the dogfood header to APG. Plus the **composition-assembler** epic (motivated by, crossRef).
- **Fed by:** the nav-menu **design sweep [#610](/backlog/610-design-sweep-navigation-menus-closed-open-states-live-naviga/)** (still open — a live-navigation capture would add real-site grounding, but the published survey already brings the forks to DoR).
- **Origin:** harvested while iterating the WE header menu on 2026-06-14.
