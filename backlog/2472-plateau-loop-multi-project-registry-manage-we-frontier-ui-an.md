---
bornAs: xsde084
kind: epic
parent: "2445"
status: open
priority: low
dateOpened: "2026-07-12"
tags: []
---

# Plateau Loop: multi-project registry — manage WE, Frontier UI, and plateau-app as first-class projects

Make the Loop manage a registry of projects, each with its own backlog, lane pool, and gate
config. The machinery is already keyed by repo name; this makes the registry first-class.

The registry is what lets the operable console ([#2474](/backlog/2474-plateau-loop-operable-console-manage-and-operate-the-drain-d/))
handle **multiple backlogs from multiple repos** with per-repo build status and orchestration —
the end state the console morphs toward. Its data-model prerequisite is per-repo backlog ownership:
each repo holds its own `backlog/*.md` rather than everything living in Web Everything today
([#2475](/backlog/2475-per-repo-backlog-files-each-constellation-repo-owns-its-own-/)).

Deferred behind the phase-1 evidence gate (#2456) — `priority: low`, parked, pickable.
