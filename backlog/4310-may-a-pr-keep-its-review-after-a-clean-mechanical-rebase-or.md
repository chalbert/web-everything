---
bornAs: xf6sp7r
kind: decision
status: resolved
dateResolved: "2026-10-01"
dateOpened: "2026-09-27"
crossRef: { url: /backlog/4307-land-time-order-for-a-ready-pr-that-overlaps-a-larger-pr-alr/, label: "#4307 — land-time order for an overlapping PR (ratified)" }
tags: []
---

# May a PR keep its review after a clean mechanical rebase, or does any conflict resolution always cost a fresh review round

**Split off #4307's Fork 2** by the 2026-09-27 operator ruling on #4307: that ruling decided ONLY #4307's Fork 1 (the bounded-yield landing order, ratified — see [drain-overlap-yield-landing-order](we:docs/agent/platform-decisions.md#drain-overlap-yield-landing-order)) and explicitly left this axis open, per the repo convention that one decision card carries one ruling. The operator ruling below supersedes the historical default.

This is a **separate axis, not an alternative** to the land-time yield order: whatever gets a PR into conflict with `main` — today's status-quo ordering, a released yield (#4307), or anything else — the conflict is resolved by a rebase, and this decision is about what that rebase COSTS the PR's review state, not about landing order.

## Context

- **Today's rule (status quo).** Any conflict resolution on a PR sends it back through a fixer, a full CI run and a fresh review round, whatever the size of the rebase diff.
- **The candidate axis.** When the rebase onto the new `main` is textually clean, or resolves with both sides kept verbatim (no interleaved edit to one function/region), the PR could in principle keep its existing review state and go straight back to CI, skipping the fresh review round.
- **Why it isn't a forced call.** A reviewer approved a diff that, after a non-trivial rebase, no longer exists byte for byte — the review's premise has moved. And "both sides kept verbatim" is a real correctness question, not just a diff-emptiness check: two edits landing in the same function can rebase "cleanly" (no conflict markers) while still producing behavior neither side reviewed.

## Fork 1 — does a clean mechanical rebase preserve review state?

- **Status quo (default until ratified).** Every conflict resolution — however it arose — resets the PR through a fresh review round. Simple, conservative, no new trust surface.
- **B. Keep the review after a mechanical rebase.** When the rebase is textually clean or resolves with both sides kept verbatim, keep the PR's review state (skip straight to CI). Needs: (1) a precise, mechanically-checkable definition of "clean"/"both sides kept verbatim" that can't be fooled by an interleaved edit; (2) a trust rule for who/what asserts it; (3) a red-team pass before it can be adopted, given a stale review is exactly the failure mode a reviewer exists to catch.

**Historical preparation status (superseded by the operator ruling below): filed, NOT prepared.** No research pass, no skeptic pass, no ratification yet. Carries forward #4307's own note: "B's trust question deserves its own research and skeptic pass." Run `/prepare` on this item before presenting it for a ruling.

## Proposed ruling — NOT READY (needs /prepare, then explicit ratification)

Not proposed yet beyond the status-quo default above; prepare first.


## Operator ruling

Operator, 2026-10-01, verbatim:

> Ok for the review that survive, thought it was already the case

Answering the orchestrator's proposal:

> a review (including the human clearance) survives a rebase or CI fix that leaves the PR's own diff unchanged, checked mechanically; any real change to the PR's own diff still needs a fresh review.

## PR #3253 — observed diagnosis

The heal changed the PR's own contribution. Fresh review was correct under this ruling; an equivalent runtime value is not an unchanged source diff.

- [13:49:28Z clearance](https://github.com/chalbert/web-everything/pull/3253#issuecomment-5932812260) binds human clearance to `95cb216548ba6b8e702c49527745ccd50355a7d6`, contribution fingerprint `27381bade5815ad928b373dff9ead23134402e24f9ea2a69dbc3405164c182dc`.
- Read-only Git probes recovered that head and the [heal commit](https://github.com/chalbert/web-everything/commit/f2247f0abf422ce9259b71e418098f8b9da8d942). Computing `normalizeContributionFingerprint` from we:scripts/lib/review-escalation.mjs over the original net diff (`ef097d284..95cb21654`) reproduces the clearance fingerprint exactly. The rebased contribution BEFORE the repair (`dda3ff327..190ea9097`) has the SAME fingerprint. AFTER the repair (`dda3ff327..f2247f0ab`) it is `95b268fd31b4879c6c278f72e6a69862e717509aeeb0ce50e0da1aa06a3ec9a6`.
- Thus the rebase preserved the reviewed contribution, but the subsequent CI repair did not. The heal commit changes exactly one line in we:scripts/conveyor/soak/breaks/missing-run-structural-deferral-loops.mjs; comparing that file at the original and rebased pre-repair heads yields no diff. The contribution delta is:

```diff
-const REPO = 'chalbert/web-everything';
+const REPO = ['chalbert', 'web-everything'].join('/'); // built, not a literal — a stub slug, not a hardcoded target repo
```

The commit message attributes this repair to the multi-repo check rejecting a literal slug. That is the commit author's explanation; the source change and changed fingerprints above were independently observed.

At [14:07:43Z](https://github.com/chalbert/web-everything/pull/3253#issuecomment-5933156531), we:scripts/conveyor/ci-heal-mark.mjs handed a live acceptance to `spawnCiHealRearm`, which invokes we:scripts/conveyor/rearm-review.mjs. The accepted branch of `decideSetLabel` in we:scripts/review-set-label.mjs removes the acceptance and adds pending. Its old comment unconditionally called this a repaired `review:changes` bounce, even though the latest verdict was the human clearance. The renderer now distinguishes the observed acceptance from a bounce, and the CI-heal record acknowledges the separate possible acceptance re-arm. No new clearance or live PR mutation is performed by this change.

The GitHub issue timeline independently confirms `review:accepted` removed at 14:07:40Z and `review:pending` added at 14:07:41Z. Round 4 was added at 14:58:38Z. The [15:05:14Z agent acceptance](https://github.com/chalbert/web-everything/pull/3253#issuecomment-5934207920) records the same post-repair contribution fingerprint computed above, with no human-clearance marker. The [15:10:07Z drain park](https://github.com/chalbert/web-everything/pull/3253#issuecomment-5934290248) explicitly reports four net test cases removed in we:scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs; the timeline shows human hold added at 15:09:59Z and awaiting-advisory at 15:10:03Z. Thus the return to the human gate followed a plain agent acceptance of changed content, not loss of an unchanged clearance during restamping. Later timeline state shows the operator cleared the human gate again at 16:17:24Z; the investigation makes no live-state changes.

The existing restamp path (`decideRestampHumanClearance`) cannot carry the clearance across this repair: the contribution proof differs. The CI-heal re-arm path itself does not attempt that proof, so a strictly mechanical heal still warrants a separate follow-up; #3253 is evidence of a changed contribution, not a reproduced mechanical-carry failure.

## Follow-ups

- Codify the reusable ruling in the shared statute in a separately authorized task. Shared agent docs are explicitly out of scope for this job; no false `codifiedIn: one-off` classification is used.
- Route provably unchanged CI-heal acceptances through the existing restamp proof before re-arming, retaining current live-verdict and human-hold safeguards. Replay a genuinely unchanged heal as well as unreadable proof and changed-contribution cases. The #3253 repair must remain a fresh-review case.
- Testing lesson: compare each head against its own recorded base and verify the pre-repair rebased contribution separately; comparing heads directly can conflate main's movement with the PR's repair.


## Validation

- Focused tests: 366 passed across we:scripts/__tests__/review-set-label.test.mjs, we:scripts/conveyor/__tests__/rearm-review.test.mjs and we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs. The replay uses #3253's observed contribution fingerprints: unchanged after the rebase, changed after the CI repair. Comment tests cover acceptance, bounce, and retained human hold.
- `npm run check:standards`: zero errors (existing warnings remain).
- Required `node we:scripts/verify-lane.mjs` invocation (run with the checkout-relative script path): 135 suites passed, two failed, one skipped; 6,952 tests passed, five failed, five skipped. The five failures are three real-process-table probes in we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs and two parent-process attribution probes in we:scripts/lib/__tests__/gh-app-shim.test.mjs. Direct probes of `/bin/ps aux` and `/bin/ps -p <own-shell-pid> -o command=` both returned `Operation not permitted` in this sandbox. The process-table reader returns unknown on this error; the caller-attribution code falls back, explaining the observed assertions. This session cannot elevate permissions. These tests were neither skipped nor weakened; a run with permitted process-table access is still required for a green lane gate.
