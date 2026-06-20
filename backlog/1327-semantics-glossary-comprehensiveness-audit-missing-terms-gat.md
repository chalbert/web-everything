---
kind: story
size: 8
status: open
dateOpened: "2026-06-20"
tags: []
---

# Semantics glossary comprehensiveness — audit missing terms + gate to maintain ubiquitous language

GOAL: track absolutely all named language in /semantics/ so the constellation speaks one consistent vocabulary. GAP found during #1319/#1325: the glossary (we:src/_data/semantics/<slug>.json, rendered by we:src/semantics.njk) covers cross-cutting terms (Severity Level, Notification Region) but NOT most named standards — Status Indicator, Notification Marker, Action, Selection, and the new Tag intent (#1325) all have /intents/ definitions but no glossary term, so language drifts and coverage is ad-hoc. TWO work-streams: (1) AUDIT + backfill — enumerate every named intent/block/protocol/plug/capability and ensure each has a glossary term (prefer DERIVING the term+definition from each standard's source JSON title/summary so the glossary cannot drift from the definition, hand-authoring only genuinely cross-cutting terms); (2) HARDEN the gate — add a check:standards rule that flags any named standard lacking a glossary entry (or, if auto-derived, asserts the derivation ran), so new standards must register their language. Decide derive-vs-hand-author as part of stream 1. Surfaced by #1319 (decorative Tag vocabulary) — Tag's term then lands automatically via this mechanism.
