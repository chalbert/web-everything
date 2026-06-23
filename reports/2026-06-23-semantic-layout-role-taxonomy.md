# Semantic layout-role taxonomy — prior-art survey & decision prep

**For:** backlog #1680 (decision). **Date:** 2026-06-23. **Status:** prep research (no ruling made here).

## The question

What is WE's canonical set of *semantically-distinct layout roles*, and — the load-bearing half — **by what
criterion is one role distinct from another**, so the list is principled (a minting contract) rather than a
vote? Today WE ships only a concept-stage `layout` intent (we:src/_data/intents/layout.json — app-shell
region mechanics: shell/pane/dock × push/overlay/rail) plus scattered point intents (`resizable` #1384,
`arrangeable`, `overview-grid`, `slide-layout-template` #1191). There is no systematic map of the role set.

The style-variant half ("1 impl per role, per-project looks via variants + plateau presets") is **already
codified** — open-numbered-variants (we:docs/agent/platform-decisions.md#open-numbered-variants) +
the plateau assembler (#775). So this decision is scoped to **the role set + the distinctness criterion**.

## Prior art surveyed

Sources: Every Layout (every-layout.dev), WAI-ARIA APG landmark regions + HTML sectioning, Tailwind layout
utilities, MUI, Radix Themes, Chakra UI, Carbon 2x-grid, Material Design 3 canonical layouts, Open UI, and
CSS-native layout (flex/grid/subgrid/container-queries/scroll-snap).

**Each source draws the "distinct role" line by a *different* criterion, and the criteria diverge:**

- **CSS-mechanism** (Every Layout) — one primitive = one CSS idea. Stack ≠ Cluster ≠ Grid because each is a
  distinct mechanism (margin-flow vs flex-wrap vs auto-fit grid). 12 primitives: Stack, Box, Center, Cluster,
  Sidebar, Switcher, Cover, Grid, Frame, Reel, Imposter, Icon.
- **Document semantics** (ARIA/HTML) — the line is *what role the content plays in the page outline*:
  banner / navigation / main / complementary / contentinfo / region / search / form. Geometry-blind: a
  visually identical box is `navigation` or `complementary` depending purely on its content.
- **Composition intent** (MUI/Chakra/M3) — named archetypes: Stack/Grid/Container primitives **plus**
  page-level canonical layouts (M3: feed, list-detail, supporting-pane on a "layout scaffold").
- **No roles** (Tailwind/Carbon) — expose raw CSS atoms or a single grid; decline to name roles at all.

**The decisive finding — the sidebar case.** Every Layout has *one* `Sidebar` primitive (CSS criterion:
flex-basis + grow + wrap). ARIA has *no* sidebar — the same box is `complementary`, `navigation`, or
`region` by content alone. So a CSS-mechanism taxonomy and a document-semantics taxonomy are **orthogonal
axes, not refinements of each other.** A taxonomy that picks only one criterion either mis-merges roles that
differ semantically (pure-mechanism) or can't separate roles that share no landmark (pure-semantics — Stack,
Cluster, Grid all map to *no* landmark yet are clearly different roles).

## Consolidated candidate role set

| Candidate role | Sources | Universal? | A11y landmark mapping | CSS mechanism |
|---|---|---|---|---|
| **Stack** (vertical flow + even spacing) | Every Layout, MUI, Chakra, CSS | **Universal** | none | margin-between / flex-col+gap |
| **Cluster** (wrap group: tags/buttons) | Every Layout, Chakra (Wrap), CSS | Common | none | flex-wrap + gap |
| **Grid** (uniform responsive cells) | all | **Universal** | none | auto-fit minmax / 12–16col |
| **Box / Container** (padded, max-measure) | all | **Universal** | none / `region` if named | padding / max-width + auto-margin |
| **Center** (center + constrain measure) | Every Layout, Chakra | Common | none | margin auto / flex center |
| **Sidebar / Split** (fixed + fill, collapses) | Every Layout, CSS (Holy Grail), M3 | Common | `complementary`\|`navigation` | flex-basis + grow + wrap |
| **Switcher** (threshold flip H↔V) | Every Layout | Library-specific | none | flex-wrap + min() |
| **Cover** (full-height focal child) | Every Layout | Library-specific | none | flex-col + margin auto |
| **Frame / AspectRatio** (crop media) | Every Layout, MUI, Chakra, Tailwind | Common | none | aspect-ratio + object-fit |
| **Reel / Scroller** (overflow strip) | Every Layout, (carousels) | Common | none / `region` | overflow + scroll-snap |
| **Imposter / Overlay** (centered over context) | Every Layout, CSS | Common | none (dialog → role) | absolute / grid-stack |
| **Masonry** (shortest-column packing) | MUI, CSS | Niche | none | grid masonry / columns |
| **App-shell / Scaffold** (page regions) | M3 scaffold, CSS, WE `layout` | Common (page-level) | composite: banner+main+nav+contentinfo | sticky/grid regions |

Universal core across *all* sources: **Stack, Grid, Box/Container** (Center, Cluster close behind).
Every-Layout-only: Switcher, Cover, Icon. M3 canonical layouts + app-shell sit at a **higher altitude**
(page archetypes composed *from* the primitives), not the same tier.

## Implications for the decision (forks the survey shaped)

1. **Distinctness criterion → hybrid.** Because CSS-mechanism and document-semantics are orthogonal, no
   single criterion works. The clean cut: a **structural role** (the CSS composition mechanism) cross-cut by
   an **optional landmark annotation** (the content's document meaning). Pure-mechanism, pure-semantics, and
   vague composition-intent are each individually broken (the survey shows why). This is the load-bearing
   call.
2. **Altitude → primitives are roles; page-archetypes are *compositions*.** App-shell / list-detail / feed
   are arrangements *of* roles (regions), not atomic roles. Bias-to-separation + the survey's altitude split
   argue they are named **compositions** (FUI blocks / plateau assembler presets), not entries in the role
   taxonomy. WE's existing `layout` intent (app-shell regions) is the boundary case to reconcile.
3. **Open-numbered set, not a closed list.** Mirror intents-open-design + open-numbered-variants: ratify a
   **core role set + a distinctness contract** for minting new roles (a role earns its name iff it adds a
   distinct CSS mechanism OR a distinct landmark meaning; differs only in look → it's a variant, not a role).
   Marginal candidates (Switcher, Cover, Icon, Masonry, Spacer) are then *contract-tested*, not voted.
4. **Role vs variant cut line.** A new role iff distinct **mechanism** OR distinct **landmark meaning**;
   same on both axes / differs only in tokens → presentational variant (MUI ImageList standard/quilted/woven
   = one Grid role + variants; Chakra HStack/VStack = axis variant of Stack, not separate roles).

## Placement (constellation)

Layout roles are **intents** (project-less, like the existing `layout`/`resizable`/`arrangeable` intents —
the dockable-sibling pattern). **FUI** ships exactly one block impl per role. Per-project looks ride the
**variant** axis + **plateau** assembler presets. No new project needed for the taxonomy itself.

## Sources

every-layout.dev/layouts · w3.org/WAI/ARIA/apg/practices/landmark-regions · developer.mozilla.org ARIA
landmark roles · tailwindcss.com/docs (display/flex/grid/columns/aspect-ratio) · mui.com/material-ui
(grid2/stack/masonry/image-list) · radix-ui.com/themes/docs/overview/layout · chakra-ui.com/docs/components
· carbondesignsystem.com/elements/2x-grid · m3.material.io/foundations/adaptive-design/canonical-layouts ·
open-ui.org.
