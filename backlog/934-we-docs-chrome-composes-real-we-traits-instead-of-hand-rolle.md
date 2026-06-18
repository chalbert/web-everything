---
type: idea
workItem: epic
size: 13
parent: "777"
status: open
blockedBy: ["932"]
dateOpened: "2026-06-18"
locus: frontierui
relatedProject: webdocs
tags: [dogfood, chrome, traits, webbehaviors]
---

# WE-docs chrome composes real WE traits instead of hand-rolled behavior

The #865/#931 chrome renders correctly but is a **weak conformance proof**: its blocks hand-wire interaction
behavior imperatively, re-implementing WE traits (`nav:section`, `nav:list`) that already exist. So the
dogfood currently proves "FUI can render a nav," not "WE's standards stack composes one" — undercutting
#777's "site as conformance proof" premise. This epic reworks the chrome so it **composes the real traits**
via the webbehaviors registry: chrome blocks become trait-marked DOM templates, the registry wires behavior,
and the rendered site genuinely exercises the standard. Blocked on #932 (whether mode-C boots the registry).

## Why (grounding, researched 2026-06-18)

- `disclosure-nav`/`sectioned-nav` hand-roll `addEventListener` for a pattern shipped as the registered
  `nav:section`/`nav:list` traits (`fui:blocks/navigation/`). Single-source-of-truth violation, twice over.
- The registry runs over shadow roots already (`CustomAttributeRegistry.upgrade(ShadowRoot)`); the only thing
  missing is the decision + wiring to boot it in mode-C — that is #932.
- This epic is the *build* that #932's ruling unblocks; it does not re-decide the seam.

## Likely slices (#932 ratified 2026-06-18 — draw the rest at slice time)

**#932 ruling applied:** boot the registry & compose (Fork 1=A); no boundary issue (website≠standard,
`we:docs/agent/platform-decisions.md` `#we-fui-embed-boundary` rule 6); registry lifecycle **leans shared** —
settle against a running mount here (Fork 3). **This epic is NOT a pure rebuild** — it carries a real
trait-platform build below; re-confirm size 13 (likely light) when slicing.

- **Shadow-scope the nav traits (precondition).** `fui:blocks/navigation/NavSectionBehavior.ts:47`
  `controlledElement` uses `document.querySelector` → inert inside a shadow root; switch to a
  `this.target.getRootNode()`-scoped lookup so the trait resolves its panel in a mode-C mount at all. Audit
  `nav:list` for the same. Without this slice, "compose traits" is a no-op.
- **Add the horizontal-menu coordinator trait.** The current `nav:section`/`nav:list` miss sibling-exclusive
  open, outside click/focus dismiss, responsive desktop-only gating, and Escape→collapse+refocus (all in the
  hand-rolled `fui:blocks/disclosure-nav/DisclosureNav.ts` `wireDisclosure`). New/extended trait, not a rebuild.
- **Boot the registry in the mode-C chrome path** — instantiate a (lean: shared-per-page) `CustomAttributeRegistry`,
  register the chrome traits, `upgrade(shadowRoot)` on mount, `downgrade` on teardown (`fui:embed/chrome-in-document.ts`).
- **Rebuild `disclosure-nav` as a trait-composing template** — emit `<button nav:section="…">` markup + CSS;
  delete `wireDisclosure()` and the ported behavior. Keep the horizontal/responsive CSS (that part is genuinely
  presentational, not a trait).
- **Rebuild `sectioned-nav` likewise** (the vertical accordion), retiring its hand-rolled toggle.
- **Reconcile the `navigation` intent** — declare/compose it meaningfully (note: WE's intent→conformance is
  itself unfinished — there is a build-time `intentProfileResolver` but no runtime conformance gate; coordinate
  with that gap rather than fake a tie).
- **Update the #931 regression guards** to assert trait composition (e.g. `nav:section` present + registry
  upgraded), not just collapsed-by-default DOM.

## Done when

- The mounted chrome's disclosure behavior is driven by the registered `nav:section`/`nav:list` traits (no
  per-block `addEventListener` for those patterns), verified by Playwright (behavior intact: open/Escape/
  outside-click) **and** a unit assertion that the traits are bound.
- `disclosure-nav`/`sectioned-nav` carry no hand-rolled behavior code; the conformance value is real.
- Aligns with #933's compose-not-hand-roll invariant (this epic is its first real application).

Supersedes the *behavioral* half of #931 (whose hand-rolled `disclosure-nav` is explicitly interim). Unsliced
until #932 ratifies (slicing now would guess the boot/layering shape the decision settles).
