---
kind: story
size: 3
parent: "1963"
status: open
blockedBy: ["1962"]
dateOpened: "2026-06-29"
tags: []
---

# Expose transient vs light-DOM as a configurable per-project option (soft-transient blocks)

#1963's transient audit found 8 hard-transient blocks (must emit native: text-field, number-input, date, time and datetime pickers) versus 7 soft-transient (presentational: badge, tag, section-card, auto-heading, meter, progress, card) whose transient case is cleanliness-only. Per the item-6 configurable-variant rule, expose transient versus persistent light-DOM as a per-project option (native-first default, light-DOM opt-in) for the soft-7 and re-evaluate their default. The per-block default is #1962's call; blocked on it. Ratified under #1963.
