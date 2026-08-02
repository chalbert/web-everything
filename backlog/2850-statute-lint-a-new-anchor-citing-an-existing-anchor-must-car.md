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

**Why the label alone is insufficient (round-3 finding R3).** The originating defect was round 2's blocker B3: the anchor carried a `composes with — does not alter — #2398` line while in fact NARROWING #2398 (it asserted a "separate session or service" bar that #2398 never sets — #2398 permits an in-process role-separated subagent given fresh context). A presence-only lint sees the required vocabulary phrase and passes, so **the very finding that produced this item would still land green**. Clause 2 of the mechanical fix is therefore load-bearing, not a refinement.

## Mechanical fix

In `we:scripts/lib/validate-rules-anchors.cjs`, when a NEW anchor's body references an existing anchor id:

1. **Relation label (presence).** Error unless an explicit relation line accompanies the cite — from a fixed
   vocabulary: `composes with — does not alter` / `extends` / `supersedes` / `narrows`.
2. **Relation FIDELITY (the half that closes the class).** A label alone is not enough: a `composes with — does not
   alter` claim must be *true*. When an anchor asserts identity or non-alteration with a cited anchor, the gate must
   locate the cited anchor's normative sentence inside the cited body — else require `extends` / `narrows` /
   `supersedes` instead. **Without this clause the lint is satisfied by writing the phrase**, which is exactly the
   defect it was filed for (see Why it matters).
3. **Reconcile with `x2vqz2v` (the duplication lint)** (the duplication lint) so fidelity is satisfied by a LINK plus a short relation
   label, never by copying the cited anchor's text into the new one — otherwise clause 2 becomes a licence to quote,
   and the two guards pull against each other.

## Provenance

Outstanding prevention **M1** from the human `/review` on **PR #982** (`we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.
