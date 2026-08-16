---
bornAs: xdj48uy
kind: task
parent: "2410"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs"]
blockedBy: ["2409", "2416", "2502"]
dateOpened: "2026-07-27"
tags: []
---

# anti-test-gaming re-park must exempt a review:accepted PR (else an accepted PR trips it forever)

The drain's scanTestTampering re-park short-circuits before decideReviewGate, so a human-accepted PR whose own test fixtures contain skip/only/.each markers is re-parked every pass and never lands. The exemption must be scoped to the reviewed DIFF (a SHA-pinned, human-applied accept), NOT to the presence of the `review:accepted` label — a label-keyed exemption reopens two trust-chain holes (see below), so this is blocked on #2409 + #2416 + #2502.

## The seam

In `we:scripts/merge-ai-prs.mjs` (~L1836–1856), the anti-test-gaming gate (#2440) runs on the candidate's net
diff text and, on a `scanTestTampering` hit, does `v.decision = 'skip'`, re-adds `review:human`, and
`continue`s — **before** the `decideReviewGate` call (~L1858). `decideReviewGate` is the one place that checks
`review:accepted` **first** and returns `{action:'merge'}` (`we:scripts/lib/review-escalation.mjs` L524).
Because the test-gaming block short-circuits ahead of it, an already-cleared PR never reaches that gate.

## Why it bites

`scanTestTampering` fires on a diff's own **test fixtures**. A PR that legitimately adds `.skip.each` /
`.only.each` / `it.skip` **as test data** (e.g. #2669, which tightens `scanTestTampering` itself and adds those
markers as regression fixtures) trips the detector on **every** drain pass. So after a human clears it via
`/review` (→ `review:accepted`), the daemon re-parks it and re-stamps `review:human` next pass — an infinite
park loop. #791 hit this: it was human-accepted, CI-green, cleanly mergeable, yet the daemon would never land it;
it had to be merged by hand.

## Why the first attempt was withdrawn (PR #809, `review:changes`)

The first cut keyed the exemption on the **presence** of the `review:accepted` LABEL
(`shouldReparkForScan({tripped, reviewAccepted}) = tripped && !reviewAccepted`, wired around BOTH pre-gate
re-parks). Two independent reviews (the drain's advisory pass and the operator's `/review`) confirmed that
reopens two trust-chain holes, because the label is not the diff:

- **Finding 1 — stale-accept + tamper-push.** `review:accepted` is not SHA-pinned and is not cleared on a new
  push. Accept a benign diff, then push a `.skip`/`.only`/delete-test or manifest-weakening commit: the scan
  trips but the exemption returns `false`, so the PR merges on the stale accept with no human look. Holds even
  for a human-applied accept. The pre-#2737 behaviour re-parked it `review:human` every pass — that is exactly
  the property the manifest-tamper docblock promises ("a post-review WEAKENING edit → re-park for a HUMAN look").
- **Finding 2 — agent self-clear.** `we:scripts/lib/auto-land-seam.mjs` can apply `review:accepted` with NO
  human on the agent-clearable `review:pending` track. A label-keyed exemption then lets an agent-applied accept
  skip the deterministic anti-gaming / manifest-tamper backstop the scans exist to escalate — the agent panel
  clearing a trust-chain concern for itself.

The blanket-label exemption was therefore **removed** (PR #809 restored to the pre-#2737 code): both scans again
re-validate the CURRENT diff every drain pass, closing both findings and restoring the docblock property.

## The correct fix (blocked — do not ship a label-keyed exemption)

The exemption must be scoped to the **diff**, not the label. That needs the accept-time SHA-record path:

1. Record the reviewed head SHA when `review:accepted` is applied, and exempt ONLY when the current head SHA
   equals the recorded reviewed SHA — any new push re-arms both scans (closes Finding 1). This is the property
   of **#2409** (reviewed commit-set must match head) + **#2502** (emit/record the per-PR head SHA).
2. Additionally gate the exemption on a **human-applied** accept — SHA-pin alone still exempts an AI-accept at
   the same SHA (closes Finding 2). This is the property of **#2416** (honor `review:accepted` only when a human
   applied it).

Both closes require infrastructure those three items own; they are all still `open`. Shipping a standalone
SHA-record here would conflict with them, so this item is **blocked on #2409 + #2416 + #2502** and should be
picked up once they land (or fold into them).

Note: #2669 already tightened `scanTestTampering` for `.skip.each` chains and `.test('literal')` method calls,
but the scanner still reads raw diff text — a test file that ADDS a fixture line containing `it.skip(` as string
DATA still trips it (verified). So the underlying false-positive re-park is real; it is a nuisance (a legit
accepted PR needs a hand-merge), NOT a reason to reopen a trust-chain hole. The nuisance waits for the
diff-scoped fix above.

## Observed again in production (PR #1366, 2026-08-15 / 2026-08-16) — [xnt5u0s](/backlog/xnt5u0s-review-human-silently-re-applied-minutes-after-a-clear-human/)

This item's diagnosis is still exactly correct on live `main`, confirmed against the real GitHub timeline (`gh
api repos/chalbert/web-everything/issues/1366/timeline`), and the loop it predicts fired twice within 26 hours:

- **18:12:35Z 2026-08-15** — `review:human` applied, park comment: *"test-gaming suspected — CI-green may be
  manufactured by tampering with tests: tests-removed: we:scripts/__tests__/citation-check.test.mjs (net 1 test
  case(s) removed)"* — the exact `scanTestTampering` branch this item names.
- **18:32:52Z** — human clears via `--to=clear-human` (`review:accepted` applied, `review:human` removed,
  independent-review note recorded).
- **18:33:52Z** — `ready-to-merge` re-applied (CI green + accepted).
- **18:35:49Z, 2 minutes later, with NO intervening commit on this PR's own lane** — `review:human` re-applied,
  `ready-to-merge` stripped again. **No new park comment was posted** — `postDrainReasonComment` deduped the
  identical reason text against the 18:12:39Z comment, so the re-park is invisible on the PR itself; only the
  label timeline shows it happened.
- **20:18:59Z 2026-08-16 (next day)** — human clears a second time, this time noting in the clearance comment:
  *"Re-clearing after a reconcile-pass race re-applied review:human post-clearance; original acceptance stands."*
- **20:19:22Z** — `ready-to-merge` re-applied. **20:19:38Z, 16 seconds later** — `review:human` re-applied again,
  `ready-to-merge` stripped again.

Both re-applications land within a couple of drain passes of the clearance, with the diff unchanged both times
— exactly the infinite park loop this item's title names ("an accepted PR trips it forever"), reproduced against
a real gate-self-adjacent trigger (a net test-case removal), not a hypothetical.

**Current code location has moved** (the file has grown since this item's 2026-07-27 filing): the
`scanTestTampering` short-circuit now runs at
[we:scripts/merge-ai-prs.mjs:3290-3291](scripts/merge-ai-prs.mjs) (`const gaming = scanTestTampering(...); if
(netDiffText.scored && gaming.tampered) { ... }`), still unconditionally ahead of the `decideReviewGate` call
further down the same loop, still with no read of `review:accepted` / `operatorClearance` anywhere in the
branch. The sibling manifest-tamper short-circuit a few lines above it
([we:scripts/merge-ai-prs.mjs:3256-3280](scripts/merge-ai-prs.mjs), the `tamper.tampered` branch) has the
identical structural blind spot for the same reason and is exposed to the same loop, just gated on a different
trigger (manifest-value drift vs. a diff-content heuristic).

**Priority signal.** Of this item's two blockers, #2409 is `resolved`; #2416 and #2502 remain `open` — #2416
predates the `--to=clear-human` ceremony (#2895) that since shipped a stronger, SHA-pinned provenance record
(`reviewed-sha`/`reviewed-diff`/`reviewed-contribution` markers, `parseOperatorClearance`) than #2416 originally
asked for, so it may already be substantially (or fully) satisfied — worth a fresh look before assuming #2416's
original scope still stands as written. Given this has now caused a human to re-run the clearance ceremony
twice on the same PR within one day, this item is a strong candidate to unblock and build next, not to leave on
the board indefinitely behind two aging, possibly-superseded blockers.
