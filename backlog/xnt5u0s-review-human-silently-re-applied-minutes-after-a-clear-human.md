---
kind: task
status: open
dateOpened: "2026-08-16"
tags: [gate, review, drain, review-escalation, clear-human, incident]
crossRef: { url: /backlog/2737-anti-test-gaming-re-park-must-exempt-a-review-accepted-pr-el/, label: "#2737 (the matched root cause, blocked)" }
---

# review:human silently re-applied minutes after a clear-human clearance, no new commit — reproduced twice on PR #1366

A human genuinely clears a `review:human` PR via the sanctioned `--to=clear-human` ceremony
(`we:scripts/review-set-label.mjs`), which correctly removes `review:human` and adds `review:accepted`. Minutes
later, with no new commit pushed to the PR, `review:human` is silently re-applied alongside the still-present
`review:accepted` — an inconsistent label pair that then withholds `ready-to-merge` regardless of the accept
(`classifyPr`'s HOLD-INTEGRITY logic, #2832). Reproduced twice on WE PR #1366, roughly 26 hours apart, both
times against an unchanged diff.

## This is a known bug, already diagnosed and filed — [#2737](/backlog/2737-anti-test-gaming-re-park-must-exempt-a-review-accepted-pr-el/)

Investigation traced tonight's PR #1366 recurrence to an **exact match** for an existing, still-open item:
[**#2737** — "anti-test-gaming re-park must exempt a review:accepted PR (else an accepted PR trips it
forever)"](/backlog/2737-anti-test-gaming-re-park-must-exempt-a-review-accepted-pr-el/), filed 2026-07-27 from a
different incident (#791). This item exists to (a) record fresh, dated production evidence that the bug #2737
already diagnosed is still live, hitting a human twice in one day, and (b) make the case for unblocking #2737
now rather than leaving it queued behind two aging blockers. The full incident write-up and current
line-numbers live on #2737 itself (added by this investigation, "Observed again in production" section) so the
evidence isn't duplicated here — this card is deliberately short.

## The mechanism (confirmed against live `main` and the real GitHub timeline)

The drain's anti-test-gaming gate in `we:scripts/merge-ai-prs.mjs` (~line 3290: `const gaming =
scanTestTampering({ diffText: netDiffText.text }); if (netDiffText.scored && gaming.tampered) { ... }`) runs
**before** `decideReviewGate` is ever called, in the same escalation-pass loop. On a hit it unconditionally sets
`v.decision = 'skip'`, `v.humanRequired = true`, re-applies `review:human` (`shouldApplyReviewLabel` only checks
"not already present" — never "was this ever cleared"), strips `ready-to-merge`, and `continue`s past the rest
of the loop. **It never reads `review:accepted` or `operatorClearance`.** The sibling manifest-tamper
short-circuit a few lines above it (~line 3256, the `tamper.tampered` branch) has the identical shape and the
same blind spot.

Because `scanTestTampering`'s verdict is a pure function of the PR's own diff text, and the diff does not change
just because a human clicked clear-human, the verdict is **permanently `true`** for any PR it ever trips on —
so every clearance is undone by the very next drain pass, forever, with no escape but a manual
`--no-review-escalation=<pr>` override or an actual content change to the diff. Confirmed live on PR #1366: the
re-application at 18:35:49Z (2026-08-15) landed 2 minutes after the clear-human ceremony with zero intervening
commits on the PR's own lane, and the one at 20:19:38Z (2026-08-16) landed 16 seconds after `ready-to-merge` was
re-applied following a second clear-human. **`postDrainReasonComment` deduped the identical park-reason text
against the very first park comment, so the second re-application on 2026-08-15 posted no comment at all** — the
label just flipped back with no fresh explanation on the PR, which is the "silent" half of this bug's name.

**Why this is a real problem, not a cosmetic nuisance.** A human's explicit, ceremonial sign-off
(`--to=clear-human` requires `--actor` + a quoted `--reason`, #2895) is being silently overridden by a
deterministic re-derivation that has no memory of that ceremony ever happening — the exact question this
investigation was asked to answer: **the reconcile pass has no way to know a human already cleared this PR; it
blindly re-derives `gaming.tampered` from the diff every pass, unconditionally.** The failure mode observed is
the "stuck forever" direction (a legitimately-cleared PR loops indefinitely, as it did twice tonight) — but the
same missing check means the inverse is equally possible in principle: if `scanTestTampering`'s heuristic itself
had a bug that under-detected a genuine tampering diff, nothing downstream would catch it either, since this
gate is a hard `continue` with no cross-check against the escalation pass that follows it.

## Fix direction

#2737 already specifies the correct fix and why the obvious shortcut is wrong: **do not** exempt on the mere
presence of the `review:accepted` label (tried once, in PR #809, and reverted — a label-keyed exemption reopens
a stale-accept-plus-tamper-push hole and an agent-self-clear hole, both documented on #2737). The exemption must
be scoped to the **reviewed diff**, honored only when the current head is SHA-pinned to what a human actually
looked at. #2737 is `blockedBy: ["2409", "2416", "2502"]`; #2409 is `resolved` (the reviewed-commit-set gate this
whole item's `acceptedSha`/`reviewedSha` machinery already relies on), but #2416 ("honor `review:accepted` only
when a human applied it") and #2502 (per-PR head-SHA emission) remain `open`. #2416 was filed 2026-07-10, before
the `--to=clear-human` ceremony (#2895) shipped its own SHA-pinned provenance record
(`reviewed-sha`/`reviewed-diff`/`reviewed-contribution` markers + `parseOperatorClearance`, all in
`we:scripts/lib/review-escalation.mjs`) — worth checking whether #2416's original ask is now substantially
covered by that later work before assuming it needs a fresh build from scratch.

**Recommendation: pick up #2737 (and its blockers #2416/#2502) next**, rather than treat this as a fresh design
problem — the diagnosis, the two prior fix attempts (one shipped and reverted, one still blocked), and the
precise correct-fix shape are all already on the board. This card's only job is to supply the evidence that
makes it urgent.

## Related

[#2737](/backlog/2737-anti-test-gaming-re-park-must-exempt-a-review-accepted-pr-el/) (the matched root cause,
blocked on #2416/#2502) · [#2416](/backlog/2416-gate-honor-review-accepted-only-when-a-human-applied-it/) ·
[#2502](/backlog/2502-emit-per-pr-head-sha-in-the-merge-sweep-then-add-the-head-sh/) ·
[#2409](/backlog/2409/) (resolved, the reviewed-commit-set gate) ·
[#3023](/backlog/3023-a-drain-re-score-revokes-a-human-clearance-a-content-preserv/) (resolved — the sibling
fix for the SAME class of bug on the main `decideReviewGate` path, not the pre-gate test-gaming short-circuit
this card is about) · [#3021](/backlog/3021-the-contribution-fingerprint-still-collides-on-an-intra-sect/)
(open, dev-ready — the remaining gap on that sibling path) ·
[#3024](/backlog/3024-a-stale-acceptance-re-park-re-asserts-review-human-from-the-/) (open, blocked on #3053 —
another sibling gap, scope-narrowing on a genuinely stale re-park).
