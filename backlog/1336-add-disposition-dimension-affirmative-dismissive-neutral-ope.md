---
kind: task
status: open
blockedBy: ["1324"]
dateOpened: "2026-06-20"
tags: []
---

# Add disposition dimension (affirmative|dismissive|neutral, open-numbered) to Action Intent

Ratified in #1324: add a 6th dimension 'disposition' to we:src/_data/intents/action.json naming the affirmative/dismissive/neutral semantic — the recommended core set, open-numbered (authors may extend per the #1318 contract), NOT a closed enum. Most-permissive default: absent → block infers from the native signal else neutral. Unlocks groupOrdering: platform (macOS affirmative-last / Windows affirmative-first) and default-button emphasis, which are unsatisfiable today for plain type=button + JS actions. Single small edit; block wires disposition → native command/value/default-button.
