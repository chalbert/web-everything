---
kind: story
size: 8
status: open
dateOpened: "2026-06-20"
tags: []
---

# Semantics glossary comprehensiveness — audit missing terms + gate to maintain ubiquitous language

Track all named language in `/semantics/` for one consistent vocabulary. GAP (found via #1319/#1325):
the glossary (we:src/_data/semantics/, rendered by we:src/semantics.njk) holds cross-cutting terms but
omits most named standards — Status Indicator, Notification Marker, Action, Selection, and the new Tag
intent (#1325) have `/intents/` definitions yet no glossary term, so coverage drifts. Two streams:
**(1) audit + backfill** every named intent/block/protocol/plug/capability, preferring to *derive* each
term from its source JSON (so it can't drift); **(2) harden the gate** — a `check:standards` rule
flagging any named standard with no glossary entry. Derive-vs-hand-author is decided in stream 1.
