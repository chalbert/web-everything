---
kind: story
size: 2
parent: "777"
status: open
blockedBy: ["867"]
dateOpened: "2026-07-09"
tags: []
---

# Remediate the 3 red warn-only a11y routes on the WE-docs gate

Three warn-only routes fail a11y and were first seen red only by #867's prep measurement: /semantics/ (button-name, select-name), /web-contexts/ (document-title, html-has-lang), /rules/backlog-workflow/ (scrollable-region-focusable). Remediate each so it measures green and becomes promotable per #867 Fork 1. Re-measure before starting (route list is from 2026-07-02).
