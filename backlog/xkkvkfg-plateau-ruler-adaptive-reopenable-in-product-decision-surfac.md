---
kind: epic
status: open
dateOpened: "2026-07-20"
tags: []
---

# Plateau Ruler — adaptive, reopenable in-product decision surface

Generalize the console icon-grammar review mock (artifact 66248282, pilot for WE #2505/#2527) into a first-class in-product decision surface — the 'design rule screen' flagged early. It is the UI for the existing decision layer (prepare -> ratify -> codifiedIn), not new infra. Four capabilities: (a) ADAPTS layout to the decision archetype — pick-one-from-a-set, fork/either-or, structure (is-X-a-state), behavior/spec — each wants a different presentation; (b) accepts USER INPUT on how to be helped (rate-all, advocate-each-fork, search-more-candidates); (c) persists a durable DECISION RECORD so a saved decision is explainable ('why is A4 octagon-alert?') and reopenable; (d) is a STANDING, re-enterable, VERSIONED surface — reopen to reassess when new candidates or newly-discovered states appear. Reserve the full jury+ratings machinery for high-blast-radius decisions; offer a lighter mode for small ones (mirrors care-level). Facets tracked as child stories: the jury-refinement method + the decision-record schema. Plateau business logic; siblings #2505/#2527/#2574.
