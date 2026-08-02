---
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, statute-lint, prevention, anchor-overlap]
---

# Statute-lint: flag verbatim duplication between a new anchor and the anchors it links

A new statute anchor that copies rule text out of an anchor it cites creates a second, unmaintained copy: amend the
original and the copy silently disagrees, while its `composes with — does not alter` label asserts a fidelity it
cannot keep. Flag long verbatim runs shared between a new `{#anchor}` and any anchor it links, so copied rule text
must become a link. This is the counterpart to #2850 — together they must be one mechanism, or "prove you restated
it faithfully" becomes the reason a restatement exists.

## Gap

`we:scripts/lib/validate-rules-anchors.cjs` checks that anchors resolve, are unique, are non-orphan, and have
substance. Nothing measures overlap BETWEEN anchors, so a new anchor may restate a linked anchor's rule in full and
pass green.

## Why it matters

Worked instance — PR #982 (`we:backlog/xzc1sc5-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`).
Round 2 of the human `/review` found the diff had copied #2771's three-trigger set and its
leash-vs-derivation-code file roster into two new anchors, each under a relation line claiming no alteration; one copy
had silently substituted a trigger. Round 3 deleted those two copies but GREW a third: #2398's four anti-test-gaming
clauses and its validator definition are now restated verbatim inside `#deterministic-oracle-clears-slice` and
`#fix-review-convergence-independent-root-cause`. #2398 is live under epic #2410, so those copies will drift.

The file-roster case is worse than prose drift: `we:scripts/lib/review-escalation.mjs`,
`we:scripts/lib/review-core.mjs`, `we:scripts/lib/review-policy.mjs`, `we:scripts/lib/review-policy.contract.json`,
`we:scripts/lib/gate-config.mjs` and the invariant/conformance suites have a machine-readable home in
`we:scripts/lib/gate-config.mjs`. A prose copy in statute goes stale the moment the roster changes, and nothing
compares them.

## Mechanical fix

In `we:scripts/lib/validate-rules-anchors.cjs`:

1. When a NEW `{#anchor}` body links an existing anchor, **warn** on any shared verbatim run of ≥12 words between
   the two bodies — copied rule text must become a link.
2. **Error** when a backticked path token inside a `we:docs/agent/platform-decisions.md` anchor body does not resolve
   against the tier roster in `we:scripts/lib/gate-config.mjs` — a prose file list that disagrees with the roster
   fails the build.
3. Reconcile with #2850 in ONE rule: satisfy relation-fidelity by requiring a LINK plus a short relation label,
   never by requiring a quotation. If #2850 lands first as a quote-the-source check, this item supersedes that half.

## Provenance

Outstanding prevention **M10** from round 2 of the human `/review` on **PR #982** — the one prevention from that
round that was never filed alongside #2842–#2850. Re-surfaced as a round-3 finding by the simplicity and
standards-conformance lenses. Captured per the prevention-introspection discipline (#2823). Related: #2850
(relation-line presence), #2842 (precedent cites resolve).
