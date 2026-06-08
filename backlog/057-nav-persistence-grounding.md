---
type: decision
workItem: story
size: 2
status: open
dateOpened: "2026-06-03"
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
