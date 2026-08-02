---
bornAs: xyl12xs
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, statute-lint, prevention, anchor-overlap]
---

# Statute-lint: a new anchor citing an existing anchor must carry an explicit relation line

When a new statute anchor cites an existing anchor, the relationship — does it compose, extend, supersede, or narrow it? — is left implicit, so a new rule can silently alter a prior one. Add a statute-overlap rule: a NEW `{#anchor}` whose body cites an existing anchor must carry an explicit relation line — one of "composes with — does not alter", "extends", "supersedes", or "narrows".

## Gap

`we:scripts/lib/validate-rules-anchors.cjs` does not require a new anchor to declare how it relates to any existing anchor it references. Overlap is currently expressed (or not) in free prose.

## Why it matters

Statute is reversible-with-lineage: a later rule may narrow or supersede an earlier one, but only *explicitly*. An unlabelled cite lets a new anchor quietly shift the meaning of an existing one, breaking the "compose, don't mutate" discipline. This is exactly the shape the PR #982 review flagged — the diff added four cross-linked anchors, and the review required each cross-anchor cite to state its relation (e.g. `#2398` relation relabelled narrows→applies in commit `26f992a0`).

## Mechanical fix

In `we:scripts/lib/validate-rules-anchors.cjs`, when a NEW anchor's body references an existing anchor id, **error** unless an explicit relation line accompanies the cite — from a fixed vocabulary: `composes with — does not alter` / `extends` / `supersedes` / `narrows`.

## Provenance

Outstanding prevention **M1** from the human `/review` on **PR #982** (`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.
