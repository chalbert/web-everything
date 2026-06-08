---
type: decision
workItem: story
size: 2
status: open
dateOpened: "2026-06-03"
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
