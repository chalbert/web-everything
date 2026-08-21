---
bornAs: xnt5u0s
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

## What changed since filing — verified against `main`, 2026-08-21

**The `scanTestTampering` branch this card reported is FIXED.** [#3178](/backlog/3178-scantesttampering-re-parks-review-human-on-every-drain-pass-/)
(`status: active`, PR #1459) landed `shouldReparkForTestTampering` + `parseLatestHumanClearedSha` in
[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs), and
[we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs)'s anti-test-gaming branch now lazily fetches
`headRefOid` + comments on a tampering hit and skips the re-park when a `clear-human` marker is bound to the
current head. It did **not** wait on #2416/#2502: it keyed the exemption to the `--to=clear-human` ceremony's
own SHA-pinned marker rather than to the `review:accepted` label, which is exactly the "scoped to the reviewed
diff, not the label" shape #2737 required. The forgeability residual of that comment marker is carried
separately by [#3179](/backlog/3179-replace-the-forgeable-clear-human-comment-marker-with-a-loca/).

**One branch of the same class is still open: the manifest-tamper short-circuit.** The `tamper.tampered` branch
a few lines above it in the same escalation-pass loop still has the identical blind spot — it sets
`decision='skip'`, `humanRequired=true`, re-applies `review:human`, strips `ready-to-merge` and `continue`s,
reading neither `review:accepted` nor any operator clearance. And it loops for the same structural reason:
`recordBaseline` writes only when there is no prior baseline, so once a weakening manifest edit is captured the
mismatch is permanent for that PR — the verdict is a pure function of `(frozen baseline, live manifest)`, which
a clear-human ceremony does not change. There is no per-branch escape but the pass-wide/per-PR
`--no-review-escalation` override.

**This card's remaining job is that one branch** — with the fix technique now proven and unblocked by #3178.
The recommendation the card originally carried ("pick up #2737") is superseded: #2737's blockers gate its
*label-keyed* design, which #3178 routed around. #2737's body also names the manifest-tamper sibling, so
whoever builds this should reconcile the two cards (narrow or close #2737) rather than land the same fix twice.

## Design

**Mirror #3178's landed shape, one branch up.** Extract the decision into
[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) as a pure sibling of
`shouldReparkForTestTampering`, so the drain keeps no policy of its own:

```js
// we:scripts/lib/review-escalation.mjs
/** Re-park for a manifest baseline mismatch? Same posture as shouldReparkForTestTampering: a mismatch that a
 *  human already cleared AT THIS HEAD via `--to=clear-human` is not re-parked. Fails CLOSED on nulls. */
export function shouldReparkForManifestTamper({ tampered, humanClearedSha = null, headSha = null } = {}) { … }
```

- Wire it at the `if (tamper.tampered)` branch in `we:scripts/merge-ai-prs.mjs`, reusing the SAME lazy
  `gh pr view --json headRefOid,comments` fetch #3178 added a few lines below — hoist that lookup so both
  branches share one `gh` hop instead of paying two on a PR that trips both.
- Keep `parseLatestHumanClearedSha` (NOT a bare `reviewed-sha == head` compare): an ordinary agent
  `review:accepted` also stamps `reviewed-sha`, and treating it as a clearance would let the panel clear a
  trust-chain concern for itself — the hole `we:scripts/lib/review-baseline-state.mjs`'s gate exists to close.
- Fail CLOSED on any fetch miss (both values `null` ⇒ still re-park), matching the sibling.
- **Do not** clear or re-record the baseline on a clearance. The baseline is the honest first-sighting record
  (`getBaseline`/`recordBaseline` in `we:scripts/lib/review-baseline-state.mjs`); suppressing the *park* is the
  fix, rewriting the *evidence* is not.

**The silent-relapse half.** `postDrainReasonComment` dedupes on `(kind, reasonText, auditLine)` by reading the
PR's existing comments, so a second re-park with identical text posts nothing — the "silent" in this card's
title. Once the re-park is correctly suppressed this mostly stops mattering, but a genuine re-park *after* a
clearance should still say so. Cheapest honest fix: include the cleared head SHA in the reason text for a
post-clearance re-park, so the dedupe key differs from the original park's — the same technique the clearance
revocation comment already uses (`buildClearanceRevocationComment`, which names the head SHA precisely so the
dedupe does not swallow it).

## Done when

1. **Executable** — `npx vitest run review-escalation` is green with cases pinning
   `shouldReparkForManifestTamper`: `tampered:false` ⇒ `false`; `tampered:true` with no clearance ⇒ `true`;
   `tampered:true` with `humanClearedSha === headSha` ⇒ `false`; `tampered:true` with a clearance at a
   DIFFERENT sha ⇒ `true`; either value `null` ⇒ `true` (fails closed). Fails today — the export does not
   exist.
2. **Executable** — `npx vitest run merge-ai-prs` proves the wiring at the drain seam: a fixture PR whose
   manifest baseline mismatches AND that carries a `clear-human` marker at the current head is NOT re-parked
   and does NOT have `ready-to-merge` stripped; the same fixture with the marker at a stale sha still re-parks.
3. **Observable** — the `if (tamper.tampered)` branch in `we:scripts/merge-ai-prs.mjs` no longer re-parks
   unconditionally: it calls `shouldReparkForManifestTamper`, and the `gh pr view --json headRefOid,comments`
   lookup is performed once per verdict, shared with the anti-test-gaming branch (one `gh` hop, not two, on a
   PR that trips both).
4. **Executable** — a case pins the anti-relapse property the gate must not lose: a manifest weakened AGAIN
   after the clearance (a new `diffBaseline` reason, or the head advancing past the cleared sha) still
   re-parks, so this narrows the false-positive loop without weakening the #2414 tamper gate.
5. **Executable** — the SILENT half is closed, not just described: a case asserts that a re-park occurring
   AFTER a recorded clearance renders a reason text that differs from the original park's — it names the
   cleared head SHA, the way `buildClearanceRevocationComment` already does — so
   `hasDrainReasonComment`'s `(kind, reasonText, auditLine)` dedupe does not swallow the second comment. Two
   `hasDrainReasonComment` calls, the original park text and the post-clearance text, must not collide.
6. **Executable** — `npm run check:standards` reports 0 errors. This edits
   `we:scripts/merge-ai-prs.mjs`, the sole writer to `main`, so it carries the same adversarial-review bar as
   #3178 did.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: check by mutation or reversion ahead of the build) — Reproduced twice on real PR #1366 with GitHub-timeline evidence, and re-verified against live main today (2026-08-21): we:scripts/merge-ai-prs.mjs:3256-3280 (the `if (tamper.tampered)` branch) still reads neither review:accepted nor any clearance marker before re-parking, confirming the card's central claim by direct inspection, not just citation.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The proposed export has one intended caller (we:scripts/merge-ai-prs.mjs, 'the sole writer to main'), mirroring the proven single-consumer shape of `shouldReparkForTestTampering` in we:scripts/lib/review-escalation.mjs — confirmed via grep that the sibling function also has exactly one call site, so there is no hidden fan-out to hunt for the new one.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Done-when item 3 requires proving the hoisted `gh pr view --json headRefOid,comments` fetch in we:scripts/merge-ai-prs.mjs runs once, shared between the manifest-tamper and test-gaming branches — a concrete round-trip assertion at the shared seam, not just a unit test of the pure function.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Done-when items 2 and 4 both require proving the new gate changes real drain behaviour (suppresses re-park when genuinely cleared at head; still re-parks on a fresh tamper or stale clearance) rather than merely existing as an unused pure function.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — The Design section names the exact legibility fix needed — embed the cleared head SHA in the re-park reason text so a post-clearance re-park's comment doesn't dedupe-collide with the original park text — but no Done-when item requires it; see reported finding.

**Corrections recommended:**

- none — the preparation held up as written.

The card's diagnosis and fix design hold up against the live repo — the manifest-tamper branch (we:scripts/merge-ai-prs.mjs:3256-3280) is confirmed still unconditional and clearance-blind exactly as described, and the proposed `shouldReparkForManifestTamper` faithfully mirrors the proven, already-landed `shouldReparkForTestTampering` shape (we:scripts/lib/review-escalation.mjs:1331) — but the Done-when checklist has two calibration gaps (the silent-relapse SHA-in-reason-text fix is described but not required, and item 2's fixture-PR wording doesn't match this file's own established test convention), neither of which blocks landing.

_Recorded through the declared `review-prep` operation._

**Applied by the lane, 2026-08-21.** The one finding is correct: the Design described the SHA-in-reason-text
fix for the "silent" half of this bug but no criterion required it, so an implementing lane could have shipped
the re-park fix and left the dedupe collision in place. `## Done when` gained item 5, asserted against
`hasDrainReasonComment`'s real `(kind, reasonText, auditLine)` dedupe key rather than against prose. The
juror's second note — that item 2's "fixture PR" wording does not match this suite's own test convention — is
a phrasing preference about a test that does not exist yet; the criterion already names the observable
(`review:human` not re-applied, `ready-to-merge` not stripped), so the implementing lane picks the convention.
Recorded rather than silently ignored.

