---
bornAs: xnthi3f
kind: story
size: 5
parent: "2649"
status: open
blockedBy: ["2656", "2657"]
scope: ["we:skills-src/"]
dateOpened: "2026-07-24"
tags: []
---

# Thin /jury skill shell + subject-agnostic workflow entry (F1)

New we:skills-src/jury/SKILL.md that only invokes the engine and renders (no jury logic in the shell), plus a subject-agnostic workflow generalizing we:scripts/review-parked-prs.mjs so one harness runs any of the three subjects.
