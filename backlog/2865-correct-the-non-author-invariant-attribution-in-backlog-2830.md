---
bornAs: xq5vxmk
kind: task
parent: "2527"
status: open
dateOpened: "2026-08-02"
scope:
  - we:backlog/2830-drain-auto-review-must-clear-review-pending-mechanically-no-.md
tags: [citation-verification, backlog-hygiene, ratify-gate]
---

# Correct the non-author-invariant attribution in backlog/2830 — cite #2398, not #2439

`backlog/2830` attributes the non-author / conflict-of-interest invariant to **#2439** in three places. The
anchor `#agent-convergence-independent-validation` resolves to a single ruling owner, **#2398** — which is
the exact correction PR #974 made to `backlog/2563` in the same diff that introduced #2830.

## Provenance

Found in the independent `/review` of PR #974. The PR corrected the one instance its own gate could see and
re-seeded the same class three times in a file added by the same PR. Noted at accept, not blocked on.

## The three occurrences

- "Honor the non-author invariant (#2439): the auto-review is an INDEPENDENT pass…"
- "**#2439** — non-author clear (conflict-of-interest invariant): the auto-review must be independent…"
- "The clear is done by a NON-author review pass (#2439), never by the author."

## Why the gate cannot see it

Gate 10 is **anchor-adjacency triggered** by design — that adjacency is what buys its measured
zero-false-positive precision. None of these three sentences names the anchor token, so the detector's
precondition is absent. This is the far more common authoring form: the ruling cited by a bare `#NNN` with
the rule stated only in prose. Covering it is **#2821 gate 2** (the `#NNN`-plausibility check), explicitly
listed as NOT delivered by the #974 subset — so the class is knowingly ungated, and this instance needs a
hand fix.

## Acceptance

- All three references in `backlog/2830` cite **#2398** for the ruling. Where #2439 is genuinely meant as
  the build slice (the independent hardened validator work), say so explicitly rather than letting the bare
  number stand in for the rule.
- `check:standards` stays green.
