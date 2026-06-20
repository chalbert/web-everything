---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: "intent:autofocus-on-activation"
tags: [navigation, focus, accessibility, intent, composition]
relatedReport: reports/2026-06-03-navigation-intent-vocabulary.md
relatedProject: webintents
---

# Autofocus-on-activation intent: extract the shared initial-focus contract

When a surface becomes active — route swap, tab change, modal/overlay open — initial keyboard/AT focus must land somewhere by a closed set (heading | target | preserve | auto; WAI-ARIA APG default: the new view's main heading via tabindex=-1 + focus()). focus-containment already half-names this as "where focus lands when it opens", bundled with trap+restore. Extract that landing as a standalone autofocus-on-activation contract (borrowing the platform autofocus / dialog-focusing vocabulary): focus-containment composes it + trap/restore; Navigation composes it alone (landing only, no trap). NOT a Focus Delegation axis — a view swap has no delegator. Ruling from #056.

## The atom

`autofocus-on-activation` answers one question: *a surface just became active — where does initial keyboard/AT focus land?* Closed value set:

- `heading` (default) — the new surface's main heading, made programmatically focusable (`tabindex="-1"` + `.focus()`). The WAI-ARIA APG answer; the overwhelmingly correct default.
- `target` — an author-named element (by id/ref) inside the surface (e.g. the first form field of a wizard step).
- `preserve` — leave focus where it is (correct for in-place swaps that don't relocate the user — a filter re-render, an in-place tab panel).
- `auto` — platform default: honor a URL fragment / a descendant `autofocus` attribute, else fall back to `heading`.

This mirrors the existing Navigation `scroll` dimension (`auto | top | preserve | manual`) — focus landing is the a11y twin of viewport landing; both are latent behaviors of rendering the new surface.

## Why a shared contract, not three copies

The same landing question fires on every surface activation — route swap (Navigation), tab change (Navigation `lateral`), overlay open (Focus Containment / Modal). [Focus Containment](/intents/focus-containment/) already half-expresses it ("where focus lands when it opens"), bundled with trap-the-rest-inert + restore-on-close. Factor the **landing** out as the shared atom:

- **Focus Containment** = `autofocus-on-activation` (landing) **+** trap **+** restore-on-close.
- **Navigation** = `autofocus-on-activation` (landing only — a forward navigation does not make the rest inert).

So neither owns a private copy of the value set, and it never lands in Focus Delegation (roving *within* a live widget presupposes a delegator; a view swap has none).

## Open shape questions (decide during build)

- **`target` reference syntax** — id string, or a ref token consistent with how other intents name in-surface elements (cf. focus-delegation `controller`).
- **`preserve` vs Focus Containment restore** — when a contained overlay closes, restore-on-close already returns focus to the invoker; confirm `preserve` on the *opening* path doesn't fight the closing path. They're different edges (open landing vs close return) but should be documented together.
- **`auto` precedence** — exact order of URL fragment vs descendant `autofocus` attribute vs `heading` fallback; align with the platform dialog-focusing steps so native behavior isn't overridden gratuitously (native-first).

## Done when

- [x] `autofocus-on-activation` registered in `we:src/_data/intents.json` with the closed value set (`landing`: heading | target | preserve | auto) + APG-grounded description (status `concept`).
- [x] Focus Containment's "where focus lands when it opens" re-expressed as *composing* this atom — its `initialFocus` prose now names the atom as the canonical landing question and frames its own values as the overlay profile (the atom's `target` = this dimension's `explicit`), no duplicated value set.
- [x] Navigation references it as a composed contract — the `<em>autofocus-on-activation</em>` placeholder + "Extraction tracked in #287" pointer replaced with a live `/intents/autofocus-on-activation/` link.
- [ ] Implementation reference — deferred: none exists today (greps for `focusReset`/route-change focus in `plugs` and Frontier UI came back empty); the intent ships at `concept` status, impl lands with a consumer (#055).
- [ ] `#055` focus story can consume it — left for #055.

## Progress

- **Status:** resolved 2026-06-11 (batch `batch-2026-06-11`). Spec-only authoring item; the atom is now a first-class intent the catalog auto-renders. The two non-build "Done when" boxes (impl ref, #055 consumption) are deferred-by-design — this item only extracts the contract; consumption lands with #055.
- **Done:**
  - Registered `autofocus-on-activation` (status `concept`, one `landing` dimension, `target?` reference field) in `we:src/_data/intents.json` with an APG-/native-grounded description and three `designSystemResearch` entries (WAI-ARIA APG, HTML native autofocus/dialog-focusing, React Aria/Radix FocusScope). Catalog page auto-renders at `/intents/autofocus-on-activation/`.
  - Wired the two composers to reference (not duplicate) the atom: Navigation's Focus-reset pointer is now a live link; Focus Containment's Initial-focus section frames its `initialFocus` values as the overlay profile of the shared landing contract.
  - Gate: full suite + `check:standards` green (see batch ledger).
