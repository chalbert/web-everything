---
kind: story
size: 3
status: open
dateOpened: "2026-07-10"
tags: [gate, review, drain, gate-self]
---

# Gate check: a PR's reviewed commit-set must match its head before review:accepted is honored

Close the ordering hole exposed while landing the gate-hardening work: a commit can ride into a PR's tree around review time and be honored under review:accepted without having been the tree the reviewer actually looked at (PR #368 carried a second, unrelated commit at accept time; the accept comment named only the first). Add a deterministic gate to the drain/review path (we:scripts/lib/review-escalation.mjs / we:scripts/merge-ai-prs.mjs): before honoring review:accepted (or landing), diff the PR's currently-reviewed/accepted commit-set against its live head; if the head advanced past what the acceptance covered, refuse to auto-land and re-park for a fresh look. Belongs under the gate-hardening epic (parent edge to be added once that epic lands from PR #368). Ships with an invariant tripwire like the rest of the gate.
