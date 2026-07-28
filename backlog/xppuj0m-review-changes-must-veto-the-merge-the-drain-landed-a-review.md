---
kind: story
size: 3
priority: high
parent: "2405"
relatedTo: ["2309", "2416", "2412"]
status: open
dateOpened: "2026-07-28"
tags: [gate, review, drain, merge, review-escalation]
---

# review:changes must veto the merge — the drain landed a review:changes PR (#870)

A PR carrying an outstanding changes-request landed without ever being re-reviewed to `review:accepted`. The `review:changes` veto is real but **not robust**: it lives only in the drain's client-side gate, `review:accepted` is checked *before* `review:changes`, and the accept label-swap never strips a stale `review:changes` — so a changes-requested PR can still reach `main`. Harden `review:changes` into a first-class, mutually-exclusive merge veto (with a server-side belt), the same class of fix #2309 gave `review:human`.

## Verified trace

PR #870 (WE #2739) **MERGED 2026-07-28T00:49:41Z** carrying exactly `[ready-to-merge, review:changes]` — no `review:accepted`. Observed live via `gh pr view 870 --json labels,mergedAt,state`: `mergeCommit 11f68b1c`, `state: MERGED`, labels `ready-to-merge` + `review:changes`. So a PR with an open changes-request (the reviewer actively rejected the diff, expecting the author lane to fix + re-push) landed with no re-review to `review:accepted`. The substance of #870 was fine — this is purely a process/gate hole.

## Current gate — what actually exists (and why it still let #870 through)

Contrary to a first read, the drain does **not** ignore `review:changes` outright:

- [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) `decideReviewGate` (~L520) checks `review:accepted` **FIRST** (~L524 → `{action:'merge'}`), then `review:changes` (~L529 → `{action:'wait-author'}`).
- [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) turns `wait-author` into a skip (~L1908: `gate.action === 'park' || 'wait-author'` → `v.decision = 'skip'`), and the bare-orphan-sweep backstop (~L1734–1743, `hasUnclearedReviewLabel`, ~L461) also refuses `review:changes`.

So the **label-scoped drain client-side path blocks a `review:changes`-only PR**. What is missing — the residual that let #870 land — is one or more of:

1. **No server-side belt — enforcement is client-side only.** The `review:changes` veto lives entirely inside `we:scripts/merge-ai-prs.mjs`. Nothing at the GitHub layer (branch protection / a required status check that fails while `review:changes` is present) blocks a merge that does **not** route through the drain rubric — a manual `gh pr merge`, or any other transport. This is the exact gap #2309 named as the recommended follow-up for `review:human`: "a second, server-side belt … so even a manual `gh pr merge` cannot bypass it." #870 is the proof it bites for `review:changes` too.
2. **`review:changes` is a *soft* wait-author, not a *sticky* veto.** `review:human` is treated as a hard, never-times-out sticky veto (the ~L531–535 block); `review:changes` is treated as "the author lane will re-push soon." It is not surfaced as an invariant violation the way a human-gated park is, so a `ready-to-merge` + `review:changes` coexistence reads as transient rather than "must not land."
3. **Accept-first precedence + label coexistence (see secondary finding).** `decideReviewGate` returns `merge` on `review:accepted` (~L524) *before* it ever looks at `review:changes` (~L529). If both labels coexist, it merges on the accepted label and never notices the unresolved changes-request.

## Fix direction

**A PR carrying `review:changes` must NOT be merged** — treat it as non-landable until it is re-reviewed to `review:accepted`:

- Make `review:changes` a **first-class merge veto** with the same strength as `review:human`: a hard block that is checked **alongside / before** the `review:accepted` short-circuit, so a coexisting `review:changes` cannot be overridden by a stale `review:accepted`.
- At minimum, treat `ready-to-merge` + `review:changes` as an **invariant violation the drain surfaces (re-parks) rather than merges**, mirroring the `#2406`-style tripwire pattern.
- Add the **server-side belt** (a required status check that fails while `review:changes` is present) so a non-drain / manual merge cannot bypass the client-side gate — the `review:human` follow-up #2309 recommended, generalized to the changes axis.

## Secondary contributing factor (confirmed in code) — the accept swap is not mutually exclusive

[we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) — the `accept` decision (~L90–95) sets `addLabel: review:accepted` with `removeLabels: [review:pending]` **only**; it does **not** remove a pre-existing `review:changes`. (The mirror `changes` decision at ~L102–108 *does* drop a stale `review:accepted`.) So the swap is mutually-exclusive on the changes→accepted direction but **not** on accept-over-changes: applying `review:accepted` to a PR that still carries `review:changes` leaves **both** labels. Observed: PR #868 kept both until manually stripped. Combined with the accept-first precedence above (`decideReviewGate` ~L524), a coexisting `review:accepted` + `review:changes` PR merges on the accepted label with the changes-request still open. Fix: the accept branch must also strip `review:changes` so the two review-axis verdicts can never coexist (make the review axis single-valued).

## Boundary vs. the gate-integrity family

- **#2309** (resolved) — `review:human` is a sticky merge veto, not only a fresh-diff score. Same *class* of fix (sticky veto + a recommended server-side belt) but a **different label/axis**: `review:human` = gate-self, human-only clear; `review:changes` = reviewer rejected the diff, the author lane must re-push. #2309 hardened `review:human`; this item does the equivalent for `review:changes` (and #2309's own body flags STRIPPING `review:human`, a distinct concern).
- **#2416** (open, sibling under #2405) — honor `review:accepted` only when a human applied it (the WHO/provenance of the accept). Different axis: this item is about `review:changes` never being overridden, not about who applied `review:accepted`.
- **#2412** (open) — escalated blast-radius/statute parks auto-land un-reviewed on a merge-anyway timeout. Different mechanism (the timeout path), same goal (no un-reviewed land).
