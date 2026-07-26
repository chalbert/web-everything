---
kind: decision
parent: "2676"
status: open
dateOpened: "2026-07-26"
tags: []
---

# Configurable hierarchy levels + per-level customizable views with presets

Eventually teams should define their OWN levels and customize the view per level, starting from presets (delivery / exec-rollup / design / dependency). The feature-tracking screen ships as the default "delivery" preset. Decide the config model.

Principle to carry into the ratified feature-tracker spec — the tree's columns and delivery markers are a named VIEW CONFIG, not hardcoded, so customization is additive later. This screen = the first preset ("delivery"). Likely aligns with the existing configurator / personas machinery rather than a new config system (check that when building). Open questions: is a view attached to a LEVEL, to a PERSONA, or to both; and who defines the levels — a team or the org.

Spun off the **feature-tracking-screen** design session (design committee → red-team → refine loop) under epic #2676 (Plateau design-studio). Deferred for a later session. Committee decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d
