---
kind: task
status: resolved
blockedBy: ["1324"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:src/_data/intents/action.json"
tags: []
---

# Add disposition dimension (affirmative|dismissive|neutral, open-numbered) to Action Intent

Ratified in #1324: add a 6th dimension 'disposition' to we:src/_data/intents/action.json naming the affirmative/dismissive/neutral semantic — the recommended core set, open-numbered (authors may extend per the #1318 contract), NOT a closed enum. Most-permissive default: absent → block infers from the native signal else neutral. Unlocks groupOrdering: platform (macOS affirmative-last / Windows affirmative-first) and default-button emphasis, which are unsatisfiable today for plain type=button + JS actions. Single small edit; block wires disposition → native command/value/default-button.

## Progress

- Added the `disposition` dimension to `we:src/_data/intents/action.json` (`affirmative | dismissive |
  neutral`), described as an open-numbered axis (#1318) orthogonal to `level`/`variant`, with the
  most-permissive default (absent → infer from native signal else `neutral`).
- Added a rendered `<h3>Disposition</h3>` section to the intent's `description` HTML so the
  `/intents/action/` page documents the new axis alongside Levels / Grouping.
- The FUI block wiring (`disposition` → native `command`/`value`/default-button) is impl, out of scope
  for this intent-contract edit.
