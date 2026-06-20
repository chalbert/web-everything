---
kind: story
size: 8
status: open
dateOpened: "2026-06-20"
tags: []
---

# Semantics glossary comprehensiveness — audit missing terms + gate to maintain ubiquitous language

Track all named language in `/semantics/` so the constellation speaks one consistent vocabulary. GAP
(found during #1319/#1325): the glossary (we:src/_data/semantics/, rendered by we:src/semantics.njk)
holds cross-cutting terms but omits most named standards — Status Indicator, Notification Marker,
Action, Selection, and the new Tag intent (#1325) all have `/intents/` definitions yet no glossary
term, so coverage is ad-hoc and language drifts. Two streams: **(1) audit + backfill** every named
intent/block/protocol/plug/capability, preferring to *derive* each term from its source JSON
title/summary (so the glossary can't drift), hand-authoring only genuinely cross-cutting terms; **(2)
harden the gate** — a `check:standards` rule flagging any named standard with no glossary entry, so new
standards must register their language. Derive-vs-hand-author is decided in stream 1.
