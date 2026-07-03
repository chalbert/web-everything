---
name: prepared-item-stale-vs-sibling-ruling
description: A prepared decision can go stale when a sibling ruling later takes over a question it pre-settled locally — reconcile before ratifying
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35babf0e-4b31-4fbf-8c42-cd5cbbc6527f
---

A **prepared** decision item can pre-settle a cross-cutting question *locally* (in its own body,
uncited), and then a **sibling** decision resolves and becomes the authority for that same question —
leaving the prepared item silently stale even though it reads as "ready to ratify."

**Why:** prepare-ahead is used heavily here (the `/prepare` skill), and epics fan out into many parallel
prepared siblings that share cross-cutting questions (form, naming). Prep freezes each item's framing at
its prep date; a later sibling ruling doesn't retro-edit the others. So a prepared item's "settled"
sub-questions are only settled *as of prep* — one can be overtaken without any citation to flag it.

**How to apply:** before ratifying a prepared item, check whether a sibling (usually under the same
`parent` epic) has since resolved and taken ownership of any question the item treats as
internally-forced/settled. If so, rewrite the item to *apply* the sibling ruling (cite it, drop the local
re-derivation) rather than re-deciding — then ratify against the reconciled item. Worked case
(2026-07-01): #1976 (async-region directive) framed its form as "forced Ⓣ template" locally; #1983 had
since ruled the catalog-wide form (`<template type=>` Fork 2 (a)) and #1976's own example was #1983's
*rejected* branch. Reconciled #1976 to #1983 before ratifying GO.

Distinct axis from [[verify-ratified-citation-against-live-status]] (that's a *present* citation being
false; this is an *absent* one — a sibling you must notice overtook you). Related: [[decision-item-single-source-not-discussion-log]].
