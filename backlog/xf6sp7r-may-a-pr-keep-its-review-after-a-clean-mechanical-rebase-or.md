---
kind: decision
status: open
dateOpened: "2026-09-27"
crossRef: { url: /backlog/xgos7st-land-time-order-for-a-ready-pr-that-overlaps-a-larger-pr-alr/, label: "xgos7st — land-time order for an overlapping PR (ratified)" }
tags: []
---

# May a PR keep its review after a clean mechanical rebase, or does any conflict resolution always cost a fresh review round

**Split off xgos7st's Fork 2** by the 2026-09-27 operator ruling on xgos7st: that ruling decided ONLY xgos7st's Fork 1 (the bounded-yield landing order, ratified — see [drain-overlap-yield-landing-order](docs/agent/platform-decisions.md#drain-overlap-yield-landing-order)) and explicitly left this axis open, per the repo convention that one decision card carries one ruling. Status quo (see below) is the default meanwhile.

This is a **separate axis, not an alternative** to the land-time yield order: whatever gets a PR into conflict with `main` — today's status-quo ordering, a released yield (xgos7st), or anything else — the conflict is resolved by a rebase, and this decision is about what that rebase COSTS the PR's review state, not about landing order.

## Context

- **Today's rule (status quo).** Any conflict resolution on a PR sends it back through a fixer, a full CI run and a fresh review round, whatever the size of the rebase diff.
- **The candidate axis.** When the rebase onto the new `main` is textually clean, or resolves with both sides kept verbatim (no interleaved edit to one function/region), the PR could in principle keep its existing review state and go straight back to CI, skipping the fresh review round.
- **Why it isn't a forced call.** A reviewer approved a diff that, after a non-trivial rebase, no longer exists byte for byte — the review's premise has moved. And "both sides kept verbatim" is a real correctness question, not just a diff-emptiness check: two edits landing in the same function can rebase "cleanly" (no conflict markers) while still producing behavior neither side reviewed.

## Fork 1 — does a clean mechanical rebase preserve review state?

- **Status quo (default until ratified).** Every conflict resolution — however it arose — resets the PR through a fresh review round. Simple, conservative, no new trust surface.
- **B. Keep the review after a mechanical rebase.** When the rebase is textually clean or resolves with both sides kept verbatim, keep the PR's review state (skip straight to CI). Needs: (1) a precise, mechanically-checkable definition of "clean"/"both sides kept verbatim" that can't be fooled by an interleaved edit; (2) a trust rule for who/what asserts it; (3) a red-team pass before it can be adopted, given a stale review is exactly the failure mode a reviewer exists to catch.

**Status: filed, NOT prepared.** No research pass, no skeptic pass, no ratification yet. Carries forward xgos7st's own note: "B's trust question deserves its own research and skeptic pass." Run `/prepare` on this item before presenting it for a ruling.

## Proposed ruling — NOT READY (needs /prepare, then explicit ratification)

Not proposed yet beyond the status-quo default above; prepare first.
