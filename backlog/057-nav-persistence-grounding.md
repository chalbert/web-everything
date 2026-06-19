---
type: decision
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-03"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
codifiedIn: "one-off"
tags: [navigation, intent, persistence, deep-linking, vocabulary]
relatedReport: reports/2026-06-03-navigation-intent-vocabulary.md
relatedProject: webintents
crossRef:
  url: /intents/navigation/
  label: Navigation Intent
---

# Confirm the Navigation `persistence` value set

The `persistence` dimension (`url` | `memory` | `session`) is the weakest-grounded of the five Navigation Intent dimensions. Unlike `history` (Navigation API `navigate({history})`) or `scroll` (`scrollRestoration`), it rests on a *convention* — the WHATWG split between the URL and the History `state` object — rather than a single platform enum.

🔶 DECIDE: keep the three-way set (`url` survives refresh + share; `session` rides History `state`, survives traversal but not a fresh share; `memory` is in-memory only) or collapse to `url | memory` and treat `session` as an implementation nuance. Recommendation: **keep all three** — `session` is a genuinely distinct, user-perceivable outcome (a wizard step that survives Back/Forward but isn't shareable), and TanStack Router's search-params-vs-state distinction is precedent. Revisit if no block exercises `session` within two implementing blocks.

## Ruling (2026-06-10) — keep all three, provisional

**Decided: keep `url | session | memory`.** The deciding factor is asymmetry of error, not option count: keeping an unexercised value costs one unused enum (reversible, caught by the review gate); collapsing a real distinction bakes a *lossy* vocabulary into an intent that implementing blocks conform to, so re-expanding it later is a breaking change — and #053 (the Wizard/Stepper block this unblocks) is the canonical `session` consumer, so the distinction is about to be exercised, not hypothetical.

The one real weakness — `session` rests on the WHATWG URL-vs-History-`state` convention rather than a single platform enum — is a **grounding/documentation** gap, not a modeling error. Resolved by citing that platform basis explicitly on the dimension (`we:src/_data/intents.json` → `navigation.dimensions.persistence.description`).

**Kept provisional:** the review gate stays a real checkpoint — revisit `session` if no block exercises it within two implementing blocks. Recorded on the dimension description so it can't quietly ossify.
