---
bornAs: x09pzox
kind: task
parent: "2822"
status: open
dateOpened: "2026-08-02"
tags: [conveyor, statute-lint, prevention, precedent]
---

# Statute-lint: a #NNN cited as cleared precedent must resolve to a resolved item

Statute anchor bodies cite items in precedent framing ("Concrete precedent:", "cleared", "proven by") to justify a clearance. Today nothing checks that such a cite resolves to a status: resolved item, so an anchor can lean on an open or dangling `#NNN` as if it were settled. Extend the statute gate (`we:scripts/lib/validate-rules-anchors.cjs`) so a `#NNN` in precedent framing must resolve to a `status: resolved` backlog item, failing `check:standards` otherwise.

## Gap

`we:scripts/lib/validate-rules-anchors.cjs` validates anchor structure but does not read the *status* of an item a body cites as decided precedent. So an anchor can write "cleared by #NNN" / "**Concrete precedent:** #NNN" where `#NNN` is still open, parked, or has no matching item at all.

## Why it matters

A statute rule that rests a clearance on precedent is only as sound as that precedent being *actually settled*. The PR #982 `/review` caught exactly this class — dangling external finding IDs asserted as prior art (commit `5afb602a` dropped them by hand). A gate closes the class so the next author can't reintroduce it.

## Mechanical fix

In `we:scripts/lib/validate-rules-anchors.cjs`, when an anchor body uses a precedent-framing token (`Concrete precedent:`, `cleared`, `proven by`, and similar) adjacent to a `#NNN`, resolve that id against the backlog and **error** unless the target exists and is `status: resolved`. A hash-slug (`xNNNNNN`) cite resolves to its item the same way (a not-yet-landed sibling), so the rule accepts both id forms.

## Provenance

Outstanding prevention **B1** from the human `/review` on **PR #982** (the stop-the-line conveyor-governance statute, `we:backlog/2851-stop-the-line-conveyor-governance-the-orchestrator-never-abs.md`), captured per the prevention-introspection discipline (#2823). Enforcement belongs on the open conveyor-mechanization line (#2840 / #2785); this item does not reopen the resolved decision.
