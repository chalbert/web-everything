---
bornAs: xrzo6ud
kind: story
size: 2
parent: "3383"
status: open
dateOpened: "2026-09-06"
tags: []
scope:
  - we:skills-src/finish/
  - we:skills-src/mechanical-delivery-doctrine/
---

# finish and manual rebase work have no pointer to the reconcile-finding operation

we:scripts/conveyor/reconcile-finding.mjs (built 2026-09-05) posts a review:changes bounce with a cross-cutting sequencing finding — its own header names the exact motivating case as "a rebase agent" that discovers, while rebasing onto main, that a sibling item deliberately deferred the very feature the PR builds, with no way to post that concern anywhere but a private task summary. we:skills-src/finish/SKILL.md is the skill that IS that rebase agent ("A finisher clones the existing ref, rebases onto main, and fixes whats red") and it names neither we:scripts/conveyor/reconcile-finding.mjs nor the sequencing-conflict case at all (checked — zero hits). Confirmed live 2026-09-06: this exact tool had to be independently re-derived from scratch by a session that did not know it already existed, mirroring the we:scripts/operations/review-dispatch.mjs precedent where a session DID know to look because we:skills-src/mechanical-delivery-doctrine/SKILL.md names it. Add a paragraph to we:skills-src/finish/SKILL.md (and/or we:skills-src/mechanical-delivery-doctrine/SKILL.md): if a rebase/reconciliation session finds the PR conflicts with a decision made elsewhere on main, post it via `node we:scripts/conveyor/reconcile-finding.mjs <pr> --body-file=<path> [--repo=<owner/name>]` rather than only reporting it in the session summary.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
