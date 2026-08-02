---
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, statute-lint, prevention, review-policy]
---

# Statute-lint: an anchor's clearance claim may not be weaker than its cited rubric reason

An anchor that names a review-rubric reason can assert a clearance weaker than that reason's own `clearance` field, silently under-claiming the bar the contract sets. Add a `check:standards` rule pinning statute clearance claims to `we:scripts/lib/review-policy.contract.json`: an anchor naming a rubric reason may not assert a clearance weaker than that reason's `clearance` field.

## Gap

The review-policy contract (`we:scripts/lib/review-policy.contract.json`) is the single source of truth for each rubric reason's required clearance. A statute anchor can cite one of those reasons in prose and describe a *weaker* clearance than the contract mandates, and no gate cross-checks the two — so the statute drifts below its own contract.

## Why it matters

Statute is the cite-able layer the rest of the constellation reasons from. If an anchor can restate a rubric reason at a lower bar than the contract, readers cite the weaker version and the guarantee erodes. Pinning the claim to the contract keeps statute and contract in lockstep by construction.

## Mechanical fix

Add a `check:standards` rule that, for each anchor naming a rubric reason, looks up that reason in `we:scripts/lib/review-policy.contract.json` and **errors** if the anchor asserts a clearance strictly weaker than the reason's `clearance` field. Stronger or equal is fine; weaker fails.

## Provenance

Outstanding prevention **B2** from the human `/review` on **PR #982** (`we:backlog/xzc1sc5-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.
