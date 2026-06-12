---
type: decision
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-03"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: [navigation, focus-delegation, accessibility, intent, composition]
relatedReport: reports/2026-06-03-navigation-intent-vocabulary.md
relatedProject: webintents
crossRef:
  url: /intents/focus-delegation/
  label: Focus Delegation Intent
---

# Decide the home for focus-on-route-change

Where keyboard/AT focus goes after a view swaps is the single most a11y-critical navigation behavior, but the research deliberately did **not** make it a Navigation Intent dimension: the correct answer is overwhelmingly opinionated (WAI-ARIA APG — move to the new view's main heading via `tabindex="-1"` + `.focus()`), and "where does focus go" already overlaps the [Focus Delegation intent](/intents/focus-delegation/) (`strategy: roving|virtual|native`). Navigation references the platform `focusReset` contract rather than owning the value set.

🔶 DECIDE: pick one home for the closed value set `heading | target | preserve | auto`.
- **Option A (recommended):** add a `reset` (or `routeReset`) axis to Focus Delegation — it already owns focus movement; route-change focus is the cross-view counterpart of within-widget focus. Keeps all "where does focus go" vocabulary in one intent.
- **Option B:** leave it as an APG-cited prose contract in the Navigation Intent description (current state), adding no new axis anywhere.

Either way, do not duplicate the value set across two intents. Note the APG caveat: focus management and `aria-live` route-change announcements can conflict — composes with the Live Region / Status intent.

## Ruling (2026-06-11)

**Neither Option A nor B as framed.** The discussion surfaced a third, truer model: route-change focus is **not** a Focus Delegation concern at all. Focus Delegation presupposes a *delegator* — a live widget routing focus among its items (roving/virtual); a view swap has none. Where focus lands on a view swap is a **latent behavior of rendering/activating a surface**, and the *same* behavior fires on a modal open and a tab change. It is really an **autofocus-on-activation** behavior — the focus twin of Navigation's existing `scroll` landing dimension.

Decisive evidence: [Focus Containment](/intents/focus-containment/) **already** names "where focus lands when it opens" (bundled with trap + restore-on-close). So the paradigm exists in the registry; it just lives inside the overlay protocol.

- The closed value set `heading | target | preserve | auto` is the shared **autofocus-on-activation** atom (APG default `heading`; borrows the platform `autofocus` / dialog-focusing vocabulary).
- Focus Containment = that atom **+** trap **+** restore. Navigation = that atom **alone** (landing only, no trap).
- It does **not** become a Focus Delegation axis, and Navigation does **not** own a private copy.

**Applied here:** the Navigation Intent prose (`src/_data/intents.json`) had a latent bug — its "Focus reset" composition note pointed the value set at Focus Delegation. Fixed: it now points at the autofocus-on-activation contract / Focus Containment, with the trap distinction spelled out, and the `summary` line updated to match.

**Graduates to → #287** (extract the shared autofocus-on-activation intent — the real design work; rewires #055's focus story).
