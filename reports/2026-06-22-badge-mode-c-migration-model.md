# Badge mode-C migration model — prep research for decision #1621

**Date:** 2026-06-22 · **Decision:** [#1621](backlog/1621-badge-mode-c-migration-model-how-do-the-bespoke-we-docs-badg.md)
· **Blocks:** #1598 (migrate WE-docs badge surfaces → FUI badge), #1208 (dogfood backlog badges/chips →
FUI badge + filter-chip) · **Lineage:** epic #866 / #777 (WE-docs dogfoods FUI), siblings #865 (chrome
dogfood), #786/#765 (mode-C), #1381 (per-block mechanism), #1603 (filter-chip).

## What the item asked

Two entangled sub-calls surfaced when #1598 was claimed and the real FUI tree was read:
1. **Vocabulary mapping** — `we:src/_includes/backlog-badges.njk` renders a bespoke per-kind/per-status
   palette (story=blue, epic=purple, decision=indigo, …) plus link-pills and a conditional pill; FUI's
   badge offers only `tone ∈ {neutral,info,success,warning,error}`. The bespoke palette + link-pills have
   no FUI-badge equivalent. How do they map?
2. **Mount model for many-small-components** — a tile carries ~6 badges and a page lists hundreds; the
   item feared per-badge mode-C shadow mounts (~25+ shadow roots + dynamic imports per page).

## What grounding changed

Reading the real tree (both repos) reshaped both forks — the item's option lists were materially
incomplete, and both fork *defaults* land where the item guessed but for corrected reasons.

### Fork 1 — the `className` extension seam the item missed

The item framed three options: (a) extend FUI's tone enum, (b) migrate only the tone-mappable subset and
**hand-roll the rest**, (c) arbitrary-bg/fg config. Grounding surfaced a fourth, better seam the item
omitted: **FUI's badge already ships a `className` extension hook** — `fui:blocks/badge/Badge.ts:34,48`
(`createBadge({className})`) and the `<we-badge class>` passthrough (`fui:blocks/badge/BadgeElement.ts:30`
uses `classList.add`, which *appends* to author-supplied classes; `fui:blocks/transient/TransientElement.ts:62-65`
copies non-excluded attributes). `BASE_CLASS='fui-badge'` and `BADGE_CSS` are **exported** "so a composing
host can inject it" (`fui:blocks/badge/Badge.ts:38,82`). So the non-tone surfaces are **not** "hand-rolled
native" — they dogfood the badge's geometry + a11y wiring and carry the domain palette via the `className`
escape + WE-docs-local CSS.

The prior-art survey (published as the `/research/` topic + below) confirms this is the **industry-universal
governance pattern**: a small semantic-status badge keeps a *closed* tone enum; domain/taxonomy palettes
live OUTSIDE it via a className/CSS escape or a separate component. The textbook precedent is **GitHub
Primer's own split** — the semantic `Label` (closed `variant` enum, "conveys no semantics by itself") vs a
separate `IssueLabelToken` carrying an arbitrary `fillColor` for domain labels. Atlassian Lozenge (closed
enum, no custom color), Shopify Polaris ("reserve status colors… still reserved when communicating a
status"), SLDS (theme hooks, not a color prop) all keep the semantic enum closed. The systems that merged
a custom color into the semantic component (Ant Design Tag/Badge) accumulate contrast/dark-mode bugs.
GitHub issue labels (arbitrary per-repo colors) are the canonical "domain taxonomy ≠ fixed tone" case.

So Fork 1 is a **forced invariant**: branch (a) — adding `--kind-story` to FUI's enum — is *broken*
(leaks a consumer taxonomy into a shared status component; violates minimize-lock-in + the closed-tone
contract). Branch (c) is broken (Ant-style contrast debt + lock-in). The ruling: consume FUI's badge
contract for every presentational pill; map to a tone where one *genuinely* fits; carry the domain palette
via `className` + docs CSS.

**Skeptic amendment (folded in):** for pure-taxonomy surfaces (kindBadge, tierBadge) where a tone would be
a lie (story is not "info"), consume the badge **geometry + a docs-owned modifier class with NO FUI tone
class** — don't fake-map a taxonomy onto a status tone. And the native link-pills (`blockerChip`,
`childCircle`) must consume the **same docs status tokens** the migrated status badges resolve to, so the
migration doesn't fork "resolved-green" into two definitions.

### Fork 2 — mode-C is the wrong tool; the transient element is the ratified reference shape

The item's options: (a) per-badge mode-C shadow, (b) register the transient element once, (c) single
batched registry-mount. Grounding:

- **Mode-C (a) is broken.** `fui:embed/in-document.ts:63-93` attaches *one shadow root per mount point*
  via a *per-point dynamic `import()`*; it is the trusted, heavy/interactive iframe-replacement path. The
  badge's `mountInDocument` (`fui:blocks/badge/Badge.ts:112`) is a *five-tone showcase demo*, not a
  per-instance path. Per-badge mode-C = N shadow roots + N imports/page.
- **(c) collapses into (b)** — registering the custom element once *is* the single pass; the platform's
  upgrade walk handles every instance. Not a distinct end-state.
- **The transient element (b) is the ratified reference shape.** `we:docs/agent/block-standard.md` §7 item
  7 (#1381): *"Behavior-free presentational control (button, **badge**, …) → (A) transient self-erase →
  native. The reference shape."* FUI already ships `fui:blocks/badge/registerBadge.ts` + `<we-badge>`
  (`fui:blocks/badge/BadgeElement.ts`) which upgrades to a native `<span class="fui-badge fui-badge--tone">`,
  zero wrapper — exactly mode-C's per-instance fear *avoided*: light-DOM upgrades, no shadow roots, no
  per-instance imports.

**A reframe I attempted and the skeptic correctly refuted:** emit the badge's *lowered native form*
(`<span class="fui-badge…">`) directly in the njk macros — zero JS, zero FOUC. Refuted on three verified
grounds: (1) it is **§7 item 2's explicit *no-element / CSS-only* path — the lowest-compliance choice**;
(2) reproducing `decorate()`'s class-mapping + `__icon`/`__label` + `role=status`/`aria-label` logic in
Nunjucks is **WE holding badge implementation** (violates the WE-zero-impl foundation + the #865 "FUI
renders, WE owns data" precedent — `we:src/_data/chrome.js:1-10`); (3) it couples the docs build to FUI
*internal* class names (a rename breaks the board silently) rather than the stable `<we-badge>` /
`createBadge` contract. So the default flips back to **(b) the transient element**, with the FOUC concern
handled the way the chrome dogfood already handles it — a CSS baseline (`we-badge { … }`) so the element is
styled *before* upgrade, mirroring `we:src/_includes/layouts/base.njk`'s reveal-nav SSR baseline.

**Delivery sub-fork (genuine).** The 11ty board must obtain FUI's `registerBadge` + `BADGE_CSS`:
(i) **runtime cross-origin import from the FUI origin** now (the `fui:embed/in-document.ts` precedent:
"runtime FUI-hosted module, no `frontierui` alias, imports no FUI source" + the #1499 cross-origin
pattern) → (iii) **typed import from the published `@frontierui/blocks` package** at the #700/#872
end-state; (ii) vendoring into the WE build is *rejected* (WE-zero-impl + the #170 duplication/drift hazard).

**Build-time SSR render — a filed end-state enhancement (d).** Once `@frontierui/blocks` is published
(#700), FUI could export a `renderBadge(config): string` the 11ty build calls — zero client JS, zero
FOUC, FUI code still renders (true dogfood), coupling to a function contract not classes. This is the
genuinely-best *static-board* path but requires a new FUI export + a build-time FUI dependency, so it is a
separately-prioritized enhancement gated on #700, not the interim default.

**Consistency:** badge and filter-chip are the same §7 transient family — render both as `<we-*>` elements
(badge→span, the *interactive* `we-filter-chip`→`<button aria-pressed>`). The filter row is *already*
interactive (`we:src/backlog.njk:90` hand-rolled `<button aria-pressed>` + JS), so the chip genuinely
needs the runtime element; the badge does not, but uses the same element model for a coherent board.

## Net effect on #1598 / #1208

#1598's title "mode-C inline SDK" is **re-framed → transient-CE dogfood** (mode-C is reserved for the one
big chrome mount, not many small pills). #1208's filter row maps cleanly to `we-filter-chip`. No
`fui:embed/badge-in-document.ts` / `fui:embed/filter-chip-in-document.ts` module is needed (those would
only matter under the rejected mode-C branch). Both unblock on ratifying #1621.

## Prior-art sources

Atlassian Lozenge (closed enum) — https://developer.atlassian.com/platform/forge/ui-kit/components/lozenge/ ·
Polaris Badge "reserve status colors" — https://github.com/Shopify/polaris-react/discussions/6579 ·
Primer Label (semantics-free) + IssueLabelToken `fillColor` — https://primer.style/components/label/ ·
https://primer.style/product/components/token/ · Carbon Tag (categorization color-families) —
https://carbondesignsystem.com/components/tag/usage/ · GitHub arbitrary label colors —
https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels ·
HTML web components / light-DOM progressive enhancement —
https://css-tricks.com/html-web-components-make-progressive-enhancement-and-css-encapsulation-easier/ ·
https://adactio.medium.com/extensible-web-components-e794559b8c2e
