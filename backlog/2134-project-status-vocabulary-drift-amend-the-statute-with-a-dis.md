---
kind: decision
status: open
dateOpened: "2026-07-02"
tags: []
---

# Project-status vocabulary drift: amend the statute with a distinct PROJECT_LIFECYCLE

The project status axis names three different vocabularies (data says poc, the public five-stage ladder at we:src/project-lifecycle.njk says concept-poc-draft-candidate-stable, the descriptor LIFECYCLE enum a third) and we:docs/agent/platform-decisions.md deliberately keeps project status outside LIFECYCLE - so closing the drift is a statute amendment (e.g. a distinct enum-validated PROJECT_LIFECYCLE matching the public ladder), not a plain drift fix. Surfaced by the #2088 grounding digest; independent of any tier ruling.
