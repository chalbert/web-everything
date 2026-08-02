---
bornAs: xbptb5h
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [statute-lint, check-standards, prevention, decision]
---

# check:standards: a prepared decision with zero forks must record a fork-existence collapse

A `kind: decision` carrying `preparedDate` but zero `## Fork` headings passes silently, hiding whether the forkless shape is deliberate (a fork-existence collapse) or an authoring miss. Add a `check:standards` error: such an item must record an explicit fork-existence collapse note or a research cite.

## Gap

The prepared-decision health check (G4/G5) reads a decision's readiness but does not require a *justification* when a prepared decision carries no `## Fork` sections. A forkless prepared decision therefore reads identically whether the author collapsed the forks on purpose or simply forgot to write them.

## Why it matters

"Prepared" means the forks were researched to Definition-of-Ready before the call. A prepared decision with no forks is either a legitimate fork-existence collapse (the options weren't genuinely in contention) or an invisible gap. Requiring the author to say which turns an invisible forkless pass into a readable, cite-able record — exactly the note PR #982's own decision item had to add.

## Mechanical fix

Add a `check:standards` **error**: a `kind: decision` with `preparedDate` and zero `## Fork` headings must record either an explicit **fork-existence collapse** section or a **research cite**. Absent both, fail.

## Provenance

Outstanding prevention **M4** from the human `/review` on **PR #982** (`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.
