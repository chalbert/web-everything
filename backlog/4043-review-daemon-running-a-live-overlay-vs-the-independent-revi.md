---
bornAs: xcw0nxo
kind: decision
parent: "3383"
status: resolved
dateOpened: "2026-09-23"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
codifiedIn: "docs/agent/platform-decisions.md#drain-daemon-self-hosting-boundary"
preparedDate: "2026-09-24"
preparedAgainstSha: "03a91ee12647f594e6215c6290eed5ef86b872a9"
relatedReport: reports/2026-09-23-daemon-lifecycle-staleness-reload-prep.md
tags: [daemon, review, trust-chain, statute]
---

# Review daemon running a live overlay vs the independent-review invariant

**Digest.** Ruling #3681 lets the review daemon run *live overlays*: unmerged fix branches merged into its
clone ([#resident-daemon-reload-lifecycle](/docs/agent/platform-decisions/#resident-daemon-reload-lifecycle)
clause 5(e)). But [#drain-daemon-self-hosting-boundary](/docs/agent/platform-decisions/#drain-daemon-self-hosting-boundary)
clause 3 says a daemon may never approve its own code change (the #809 self-approval hole). The two collide in
exactly one case: an overlay's own graduation PR arrives for review, and the review would run on code that
already contains that PR. **Recommended: never let a PR be judged by a checkout that contains that PR's own
unmerged commits. Route its review to a `main`-only checkout instead** (Fork 1 (b)). Clause 3 is amended to
say so, and #3681 clause 7 is closed.

## Ruling (2026-09-24, operator: *"B"*)

**Fork 1 (b), as prepared.** A PR whose changed files overlap an active overlay is reviewed from a dedicated
`main`-only checkout through the normal graduated committee; missing/stale/dirty checkout → fail closed to
`review:human` with an alert; `we:scripts/review-set-label.mjs --to=accepted` refuses from an overlapping
checkout. Codified as the 2026-09-24 amendment to
[#drain-daemon-self-hosting-boundary](/docs/agent/platform-decisions/#drain-daemon-self-hosting-boundary)
clause 3; [#resident-daemon-reload-lifecycle](/docs/agent/platform-decisions/#resident-daemon-reload-lifecycle)
clause 7 now points to it. Build: story `xoeyi0b` (blockedBy #4044).

## Grounding — how review actually runs today

- The review daemon does not judge PRs itself. It dispatches a headless `review-<pr>` session per PR, and that
  session's `cwd` is the daemon's own clone: `dispatchReview({ root = REPO_ROOT })` then
  `spawnAgent(argv, { cwd: root })` ([we:scripts/operations/review-dispatch.mjs:361](../scripts/operations/review-dispatch.mjs#L361),
  [:428](../scripts/operations/review-dispatch.mjs#L428)). So the reviewer's brief, rubric, jury engine and
  the label writer ([we:scripts/review-set-label.mjs](../scripts/review-set-label.mjs)) all run from
  **whatever code is in that clone**.
- The clone is `~/workspace/wev-review-daemon` (launchd `com.we.review-daemon`), and it is **shared with the
  fix-dispatch daemon** ([we:scripts/lib/daemon-self-sync.mjs:41](../scripts/lib/daemon-self-sync.mjs#L41)).
  An overlay loaded for either daemon is live for both.
- Overlays enter through the same merge path as self-sync
  ([we:scripts/lib/daemon-load-overlay.mjs](../scripts/lib/daemon-load-overlay.mjs)). The per-clone overlay
  list itself is being built by #4044 (rebuild `origin/main` + overlays each tick).
- Independence today is checked at the **session** level only:
  [we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs) compares the clearer's
  `CLAUDE_CODE_SESSION_ID` with the author's stamp. A review session is always a different session from the
  overlay's author, so this check **passes** in the collision case. It cannot see that the *code doing the
  judging* is the code being judged.

**Concrete example.** An overlay `lane/xabc-soften-escalation` changes
[we:scripts/lib/review-escalation.mjs](../scripts/lib/review-escalation.mjs) so fewer engine-tier files
escalate. The operator loads it into `wev-review-daemon`. Its PR opens. The review daemon dispatches
`review-<pr>` from its clone, and that session runs the *new* escalation code. The new code decides its own PR
does not need the independent panel, and clears it. Every identity check passes. That is the #809 hole,
reopened by the overlay.

## Standing test — is this a fork?

Four branches were on the card. Two are excluded outright:

- **Accept the risk and weaken clause 3 (old (c)) — excluded.** Clause 3's independence rule is the operator's
  *one retained invariant* for daemon self-updates (ratified 2026-07-27). Overlays are the path where
  unreviewed daemon code runs soonest, so they are where the rule matters most.
- **Skip the PR while its overlay is active (old (a), skip form) — excluded, it deadlocks.** An overlay drops
  only once `main` has it (#3681 clause 5(b)). `main` gets it only after review. A review daemon that skips
  the PR until the overlay drops waits forever.

That leaves one real either/or, Fork 1 below.

## Fork 1 — where does an overlay's graduation PR get reviewed?

*Fork-existence:* (a) and (b) are both coherent and both close the hole. But one PR cannot be sent to a human
by rule **and** reviewed by the normal committee. They are exclusive routing choices.

- **(a) Escalate it to a human.** The review daemon detects the overlap and parks the PR `review:human`.
  Simple, no new checkout. But every overlay graduation becomes a human review. That is exactly what the
  operator rejected for daemon changes in clause 3: *"I do not want to human review every daemon change; use a
  good review committee depending on the size and complexity of change."* Overlays are meant to be frequent,
  so this would be a steady human load.
- **(b) Review it from a `main`-only checkout — recommended.** The review daemon detects the overlap and
  dispatches that PR's review session from a checkout that runs plain `origin/main` (no overlays), instead of
  its own clone. The PR then goes through the normal size-graded committee, judged by code that does not
  contain it. Cost: one more dedicated clone to keep fresh. A `main`-only clone needs none of #3681's overlay
  machinery, only the plain self-sync that already exists.
- **Fallback inside (b):** if the `main`-only checkout is missing, stale or dirty, the dispatch **fails
  closed to (a)**: park `review:human` with the reason. Never a review from the overlay clone.

**Default: (b) as the normal route.** (a) survives only as the fail-closed fallback, so the ruling is a
priority order: (b) first, (a) when (b) can't run.

**What counts as "overlap" — by files touched, not by commit identity.** A PR overlaps the clone when the files
it changes (vs `origin/main`) share any path with the files the clone's active overlays change (vs
`origin/main`). This is deliberately over-inclusive. A rebase, amend, squash or branch rename cannot dodge it,
because it doesn't look at commits or branch names at all. A false positive only means an unrelated PR gets
the normal `main`-only review, which is harmless.

```js
// Fork 1 (b) — we:scripts/operations/review-dispatch.mjs, before spawnAgent
const overlayPaths = changedPathsVsMain(root, readActiveOverlays(stateRoot)); // #4044's overlay list
const overlap = intersects(prChangedPaths(pr), overlayPaths);                 // path-based, rebase-proof
const reviewRoot = overlap ? resolveMainOnlyReviewRoot() : root;
if (overlap && !isFreshCleanMainCheckout(reviewRoot)) {
  return parkForHuman(pr, 'overlay-overlap: no fresh main-only review checkout');   // fail closed
}
spawnAgent(argv, { cwd: reviewRoot });
```

**Belt and braces (supported by default, not a fork):** `we:scripts/review-set-label.mjs --to=accepted`
refuses when the checkout it runs from has an active overlay overlapping the PR. The rule is then enforced where
the label is written, not only where the session is dispatched. A hand-run or mis-routed review still cannot
clear.

**Keeping the fallback rare (supported by default).** The `main`-only clone uses the plain self-sync that
already exists. Every fall-back-to-human is alerted and shows up in the heartbeat (#4051), so a stale clone is
fixed as a tooling failure instead of quietly becoming the always-human routine clause 3 rules out.

Skeptic: SURVIVES-WITH-AMENDMENT (independent headless seat, 2026-09-24). Its main attack landed: matching on
branch name or patch-id is dodged by a rebase, amend or rename, which reopens the hole. Fixed by switching to
path-based overlap (above). Its second attack: the human fallback could drift into routine human review, against
clause 3. Fixed by alerting and surfacing every fallback. Its classification point, that (b)+(a) is a priority
order rather than one pick, is folded into the default's wording. No statute collision found.
Screen: clear. A real policy choice, not an implementation detail. (a) costs recurring human attention however
well it's built; (b) doesn't.

## Out of scope — already ruled

Overlay code reviewing **other** PRs (not its own) is unreviewed code acting as a reviewer. #3681 clause 5(e)
accepted that risk explicitly; clause 5(a) (tests pass before pickup) and 5(d) (outside rollback) are its
mitigations. This card only rules the self-approval case that clause 3 covers.

## Statute change on ratify

- **Amend** `#drain-daemon-self-hosting-boundary` clause 3. Add: *"Independence covers the code as well as the
  actor: a PR is never judged by a checkout that contains that PR's own unmerged commits. A review daemon
  running a live overlay routes an overlapping PR's review to a `main`-only checkout, and fails closed to
  `review:human` when none is available."*
- **Close** `#resident-daemon-reload-lifecycle` clause 7: replace "Left open" with a pointer to the amendment.
- No collision found with other anchors in `we:docs/agent/platform-decisions.md`. The session-level check in
  `we:scripts/lib/review-independence.mjs` stays as is; this adds a code-level check beside it.

## Build carved off on ratify

One story, blockedBy #4044 (needs the overlay list). Touch-set: `we:scripts/operations/review-dispatch.mjs`,
`we:scripts/review-set-label.mjs`, `we:skills-src/conveyor/review-daemon.mjs`, `we:scripts/lib/` (new overlap
helper), plus provisioning the `main`-only review clone. Care: elevated (trust-chain machinery).

## Done when

1. **Executable** — a test in the build story: a PR whose files overlap an active overlay dispatches with
   `cwd` = the `main`-only root, including after its commits are rebased/amended relative to the loaded
   overlay. With that root missing, it parks `review:human` and raises an alert.
   `we:scripts/review-set-label.mjs --to=accepted` run from an overlapping checkout refuses. Fails before the
   build, passes after.
2. The statute text above is in `we:docs/agent/platform-decisions.md` and #3681 clause 7 points to it.
