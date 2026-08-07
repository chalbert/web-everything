---
bornAs: xppuj0m
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

[we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) — the `accept` decision (~L90–95) sets `addLabel: review:accepted` with `removeLabels: [review:pending]` **only**; it does **not** remove a pre-existing `review:changes`. (The mirror `changes` decision at ~L102–108 *does* drop a stale `review:accepted`.) So the swap is mutually-exclusive on the changes→accepted direction but **not** on accept-over-changes: applying `review:accepted` to a PR that still carries `review:changes` leaves **both** labels. Observed: PR #868 kept both until manually stripped. Combined with the accept-first precedence above (`decideReviewGate` ~L524), a coexisting `review:accepted` + `review:changes` PR merges on the accepted label with the changes-request still open. Observed again on PR #1049, which MERGED 2026-08-06 carrying `[ready-to-merge, review:accepted, review:changes]`.

**Observed again 2026-08-06 — PR #1062.** Taken `review:changes` → `review:accepted` through
[we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) (not a raw `gh pr edit`), and the PR ended up
carrying **both** labels: `gh pr view 1062 --json labels` reads `[ready-to-merge, review:accepted,
review:changes]`, `state: MERGED`. Exactly the asymmetry above — `decideSetLabel`'s `accepted` branch returns
`removeLabels: [review:pending]` while its `changes` branch returns `removeLabels: [review:pending,
review:accepted]`. It did **not** block the merge: `hasUnclearedReviewLabel`
([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs)) returns false once `review:accepted`
is present, so the bare-orphan backstop saw nothing to hold. This is a fresh live sighting confirming the
analysis, not new information — the ruled fix below (refuse the transition, require an explicit `rearm`) is
still the right one and this sighting does not change it.

**Observed again 2026-08-06 — PR #1056 (sighting #5), and this one DOES change the blast radius.** Same
mechanism, same tool: `--to=accepted` through
[we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) returned
`{"ok":true,"pr":1056,"to":"accepted","labels":["ready-to-merge","review:accepted","review:changes"]}`, and the
PR merged. The ruled fix below is unchanged and still right.

What is new is **evidence against this item's own "merge-path only" framing**. The #1062 note above concluded
the stale label was inert once `review:accepted` is present, on the strength of `hasUnclearedReviewLabel`
returning false. That holds for the MERGE path and nowhere else. Four consumers key on `review:changes` WITHOUT
consulting `review:accepted` at all:

- [we:scripts/conveyor/pr-watch.mjs](scripts/conveyor/pr-watch.mjs) — `PARK_LABELS` includes `review:changes`
  and `classifyPr` returns `parked` on any park label. The file contains **zero** occurrences of the string
  `accepted` — it has no concept of `review:accepted`. So an accepted, mergeable PR exits `EXIT_PARKED`, and
  `isReadyToLand` (same predicate) never fires the fast-drain trigger for it.
- [we:scripts/conveyor/tick-core.mjs](scripts/conveyor/tick-core.mjs) — `routeWatcherExit`'s `case 2` routes on
  `ls.includes(REVIEW_CHANGES_LABEL)` alone, so the conveyor **dispatches a fix agent at an already-accepted
  PR**. That is burned agent time, and it means the phantom bounce actively re-triggers the fix/rearm loop
  rather than sitting inert.
- [we:scripts/lane-resume.mjs](scripts/lane-resume.mjs) — `land()` hard-refuses with
  `{ action: 'review-changes', merged: false }`, so an accepted PR cannot be enqueued through that path; and
  `reviewChanges: true` feeds `classifyLane`, after which `markStackDescendantsBlocked` re-buckets every
  overlap-descendant to `blocked` behind a link that is not actually broken.
- [we:scripts/conveyor/status-board.mjs](scripts/conveyor/status-board.mjs) surfaces it under NEEDS YOU.

Failure directions are conservative (refuse / park) except the wasted fix dispatch, so this is still not a
merge-safety hole. But it upgrades the item from "the labels look untidy after an accept" to "the conveyor acts
on a phantom bounce", which is the part worth pricing when this is scheduled.

**Fix: REFUSE the transition, do NOT strip the label.** An earlier draft of this item said "the accept branch must also strip `review:changes` so the two review-axis verdicts can never coexist". Do not build that — it puts a label-clearing power in shared code that a machine inherits:

- [we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) `decideSetLabel` is **single-sourced** for BOTH the human `/review` path and the automated disposition seam — [we:scripts/lib/disposition-land-seam.mjs](scripts/lib/disposition-land-seam.mjs) calls it with `to: 'accepted'`, and [we:scripts/lib/auto-land-seam.mjs](scripts/lib/auto-land-seam.mjs) shells [we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) with `--to=accepted --actor="auto-land seam (enforce)"` in ENFORCE mode, with no human actor.
- A strip added to that branch therefore ships into the automated accept path **the day the enforce gate arms** — at which point a machine could clear a human's bounce with nobody aware. That is precisely the seam #2630 exists to close ("the strongest thing an auto-fix can do is re-arm the review, never clear it").
- This is a FORWARD design constraint, not a live hole: [we:scripts/lib/review-policy.contract.json](scripts/lib/review-policy.contract.json) has `landMode: "shadow"`, [we:scripts/lib/review-runner-core.mjs](scripts/lib/review-runner-core.mjs) hard-codes SHADOW regardless of config, and `runAutoLandSeam` has no production caller today (#2838 triple-gated the flip). The danger is that this item and the enforce ratification land as INDEPENDENT changes, neither review seeing the interaction.

So make the accept branch **refuse** when `review:changes` is live (the same shape as INVARIANT 2's refusal for `review:human`) and require an explicit re-arm first. The re-arm path already exists and already works for a hand-reviewed PR: [we:scripts/conveyor/rearm-review.mjs](scripts/conveyor/rearm-review.mjs) `decideRearm` swaps `changes`→`pending` on any PR carrying the label, with `--repo` optional and `--actor` overridable — nothing restricts it to conveyor-launched PRs. The automated seam needs no new wiring either: [we:scripts/lib/disposition-land-seam.mjs](scripts/lib/disposition-land-seam.mjs) already routes any `decideSetLabel` refusal to its fail-closed `parkedIntent`.

## Boundary vs. the gate-integrity family

- **#2309** (resolved) — `review:human` is a sticky merge veto, not only a fresh-diff score. Same *class* of fix (sticky veto + a recommended server-side belt) but a **different label/axis**: `review:human` = gate-self, human-only clear; `review:changes` = reviewer rejected the diff, the author lane must re-push. #2309 hardened `review:human`; this item does the equivalent for `review:changes` (and #2309's own body flags STRIPPING `review:human`, a distinct concern).
- **#2416** (open, sibling under #2405) — honor `review:accepted` only when a human applied it (the WHO/provenance of the accept). Different axis: this item is about `review:changes` never being overridden, not about who applied `review:accepted`.
- **#2412** (open) — escalated blast-radius/statute parks auto-land un-reviewed on a merge-anyway timeout. Different mechanism (the timeout path), same goal (no un-reviewed land).
