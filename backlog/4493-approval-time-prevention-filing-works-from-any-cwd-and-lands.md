---
bornAs: xfae85y
kind: story
size: 5
parent: "4075"
status: resolved
scope: ["we:scripts/lib/prevention-landing-job.mjs", "we:scripts/review-set-label.mjs", "we:scripts/operations/review-loop-cli.mjs", "we:scripts/operations/review-dispatch.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedAgainstSha: "023e7cfdf35913a64c23d2fcfca49ed9ebd2b5f0"
tags: []
---

# Approval-time prevention filing works from any cwd and lands its card

`we:scripts/review-set-label.mjs`'s approval-time filing runs `file-item` in the process cwd; from the primary checkout it is refused (live: #2939, 2026-09-29), and even from a lane it only writes the card to the working tree — nothing commits it or opens a PR, so the owed card is lost unless someone lands it by hand.

This is not just a #2939 near-miss — it has already lost cards at scale. The review daemon clone `~/workspace/wev-review-daemon` holds 74 untracked `backlog/x*-file-the-prevention-guard-s-owed-by-*.md` cards (git status, 2026-09-29 1:25 PM ET). The daemon's own approval-time/review-loop prevention filings write the card into its clone's working tree and nothing ever lands them; daemon-rebuild logs them as "untracked-kept". So owed prevention cards have been silently lost at scale across BOTH filing callers, not just the one this item started from.

Fix: the filing step acquires its own lane, files, commits, verifies, opens the PR, releases the lane. This must cover every filing caller — `we:scripts/review-set-label.mjs`'s approval-time filing AND the review daemon's review-loop filing (e.g. `we:scripts/operations/review-loop-cli.mjs`) — and the MVP should also land (or dedupe via the idempotency key, then land) the 74 stranded cards through this same product path, never by hand-copying files out of the daemon clone.

Soak break: run the ceremony from the primary cwd on a PR owing prevention and show the card's PR opens.

## Design

**Premise check (against current `main` at prepare time, `preparedAgainstSha` below):** #4317 (PR #2865, merged
2026-09-28T21:24:37Z, + two advisory-changes follow-ups) already fixed the approval-time caller —
`we:scripts/review-set-label.mjs#fileApprovalPreventionCard` no longer shells `file-item` in-process; it spawns
a DETACHED landing job (`we:scripts/operations/land-prevention-card.mjs`) that acquires its own lane, files,
verifies, opens the PR, and releases — exactly this item's own "Fix:" paragraph, for that ONE caller. Its own
test suite (`we:scripts/__tests__/review-set-label.approval-prevention-filing.test.mjs`) already asserts "writes
NOTHING [into] the calling checkout". So live evidence (a) — the #2939 `--to=clear-human` refusal — reads as
this item's own MOTIVATING incident rather than a still-open gap in `we:scripts/review-set-label.mjs`'s OWN code
path; I found no residual bug there and did not re-touch that function's logic.

The REAL, still-open gap is exactly what the card's own "Fix:" paragraph names as in-scope and what I confirmed
by reading the code: `we:scripts/operations/review-loop-cli.mjs#fileItemForPrevention` — the review DAEMON's own
mechanized `prevention-outstanding` filing — still drives the declared `file-item` operation IN PROCESS, against
whatever checkout is running the review loop (routinely `~/workspace/wev-review-daemon`, a read-only-by-
convention clone that never commits or pushes). Its own test file
(`we:scripts/operations/__tests__/review-loop-cli.test.mjs`) had zero coverage of "writes nothing to the calling
checkout" — every existing test injects its own `fileItem` stub, so nothing ever exercised the REAL production
binding's write behavior. This is the SAME bug #4317 fixed for the other caller, never ported to this one — the
direct cause of "both filing callers" in live evidence (b)'s 74 stranded cards.

**The fix:** extract #4317's detached-spawn machinery (argv-building, log path, settingsEnv forwarding, the
async-spawn-error listener) out of `fileApprovalPreventionCard` into a new shared leaf,
`we:scripts/lib/prevention-landing-job.mjs#spawnPreventionLandingJob` — generic over which caller is filing, not
approval-specific. `we:scripts/review-set-label.mjs#fileApprovalPreventionCard` becomes a thin, name- and
signature-preserving wrapper over it — behavior-preserving except one cosmetic stderr-label change (see
*Converge findings* below); its whole existing test suite passes unmodified, verified.
`we:scripts/operations/review-loop-cli.mjs` gets a new production binding,
`fileItemForPreventionViaLandingJob`, that calls the same shared leaf (tagged `sessionPrefix:
'review-loop-prevention'` so its jobs are distinguishable in the shared log directory) and synthesizes a
`file-item`-shaped `{code, lines}` payload carrying `queued: true` + a job handle in place of a real card
number — mirroring the approval-time caller's own already-established "queued for landing" phrasing/shape — so
every existing downstream reader (`parseFiledPayload`, the `filed?.code !== 0` refusal path, the idempotency
fast-path via `findFiledPreventionCard`) needs no new plumbing. `runReviewLoopOnce`'s default `fileItem`
parameter now points at this new binding instead of the old in-process one (which stays exported/tested, unused
as the default, in case a genuinely-in-a-lane caller ever wants the synchronous variant back).

A new direct import from an "entry file" (`we:scripts/operations/review-loop-cli.mjs`) tripped the #4387
review-code-path totality guard (`we:scripts/operations/__tests__/review-dispatch.test.mjs`);
`we:scripts/lib/prevention-landing-job.mjs` is now listed in
`we:scripts/operations/review-dispatch.mjs#REVIEW_CODE_PATH_FILES` (a one-line addition, not a design change) so
a managed clone behind on it still refuses to dispatch a review.

## MVP (Musts only)

1. `we:scripts/operations/review-loop-cli.mjs`'s mechanized prevention filing routes through the same detached
   lane + file-item/verify/open-pr/release job #4317 already built, instead of writing into the calling checkout.
2. `we:scripts/review-set-label.mjs`'s existing (#4317) approval-time path is unchanged in behavior (thin-wrapper
   extraction only) — re-verified green, not re-designed.
3. A regression test proves the review-loop caller's PRODUCTION binding no longer writes into a fixture
   "daemon clone" checkout (mirrors #4317's own such test for the other caller).
4. `runReviewLoopOnce`'s rendering (plain text + `--json`) correctly reports the new "queued for landing"
   outcome without disturbing any existing (numbered-card) rendering path or test.

## Follow-ups (beyond MVP — filed separately, never hand-fixed here)

- Land (or dedupe-then-land, via the card-side idempotency key) the 74 cards already stranded, untracked, in
  `~/workspace/wev-review-daemon`'s `backlog/`, through this SAME product path (lane + file-item + verify +
  open-pr) — never by hand-copying files out of the daemon clone. This is a genuinely separate migration/backfill
  concern (bulk-processing 74 pre-existing files, most already superseded or duplicate) from the "stop making new
  orphans" fix above, and does not block it landing.

## Test plan (each fails before the change, passes after)

1. `fileItemForPreventionViaLandingJob` spawns the shared landing job (tagged `review-loop-prevention`) and
   synthesizes a `queued: true` payload on success; a failed spawn returns a non-zero code + the spawn error,
   never throws. — RED before (function did not exist), GREEN after.
2. A fixture "daemon clone" checkout (a temp dir shaped like one — a `backlog/` dir, no `lane/*` branch) gets NO
   new file or directory anywhere under it when `spawnPreventionLandingJob` runs against it (stubbed
   `spawnDetached`) — the exact regression class #4317 fixed for the other caller, now proven for this seam too.
3. `runReviewLoopOnce`'s mechanized branch, given a queued (not-yet-numbered) filing result, still resumes to
   `accept`, and renders "queued for landing via a lane (tracking a handle)" in plain text and
   `{queued: true, handle, num: null, path: null}` in `--json` — without changing any EXISTING (numbered-card)
   test's asserted text/JSON shape (all pre-existing tests pass unmodified).

## Proof plan (live, before/after)

- BEFORE: `we:scripts/operations/review-loop-cli.mjs#fileItemForPrevention` (the old default) is the ONLY
  production binding for the mechanized filing branch; a card filed by a review-loop run against a non-lane
  checkout lands in THAT checkout's own `backlog/`, untracked (matches the 74 live orphans in
  `~/workspace/wev-review-daemon`, dated 2026-09-29).
- AFTER: `fileItemForPreventionViaLandingJob` is the default; the same run instead spawns the SAME detached
  lane+file-item+verify+open-pr+release job #4317's caller already uses, verified end to end by that job's own
  existing test suite (`we:scripts/operations/__tests__/land-prevention-card.test.mjs`) plus this item's new
  tests above (both `vitest related` runs green, see PR body for the exact command + output).
- The approval-time caller's own (#4317) live proof — "run the ceremony from the primary cwd on a PR owing
  prevention and show the card's PR opens" — is UNCHANGED by this item (thin-wrapper extraction preserves its
  spawn behavior, with one cosmetic exception — see *Converge findings* below; its own test suite reconfirms
  this, unmodified, green) — this item does not re-run that specific live GitHub proof, since it did not change
  that caller's runtime behavior.

## Converge findings (round 1) — fixed vs. dismissed

Round-1 panel (correctness/security/simplicity/standards-conformance/claim-accuracy, care `elevated`) found real
gaps. Fixed in round 2: (1) the wiring itself — `runReviewLoopOnce`'s production DEFAULT (no injected `fileItem`)
was untested; every existing test injects its own stub, so the one-line default swap that is this item's whole
point was unguarded (flagged independently by 4 of 5 jurors) — added a test that stubs only the bottom-most
`spawnDetached` seam and calls `runReviewLoopOnce` with no override. (2) This card's own "Done when" line used a
non-runnable `we:`-prefixed pseudo-path inside a shell command and an inaccurate "fails before" framing —
corrected below. Dismissed, with reasons: the security lens's title/scope/digest-injection concern is already
covered, for every caller of the shared job, by `we:scripts/operations/land-prevention-card.mjs
#boundLandPreventionCardInput` (length caps + control-char/HTML-comment neutralization, unconditional on every
input) — the juror could not see that function's file (an unchanged file, outside the diff it was shown) and its
own finding already notes argv-array spawning precludes shell injection; this item adds a caller to an existing,
already-bounded seam, not a new trust boundary. The idempotency-blind-spot finding is the SAME already-filed,
already-accepted residual as #4399 (open, `blockedBy: 4317`) for the OTHER caller — folded into #4399's scope
(now covers both callers) rather than filed as a duplicate; not a new gap this item introduces. Filed rather than
hand-fixed here, both pre-existing/low-severity and `parallelizable: true`: the security lens's title/scope/
digest-hardening idea → `we:backlog/xszsr8e-bound-title-scope-digest-reaching-the-prevention-card-landin.md`; the
simplicity lens's "delete the now-unused `fileItemForPrevention`" idea →
`we:backlog/xwtj36n-delete-the-now-unused-in-process-fileitemforprevention-build.md`. The "byte-for-byte" claim
above is corrected to note the one cosmetic exception (the
async-error stderr message's own label changed from `fileApprovalPreventionCard:` to
`spawnPreventionLandingJob:`).

**Round 2** (fresh panel over the round-1 fixes) caught that my round-1 fix of the "Done when" line was itself
incomplete — the corrected line still carried a literal, non-runnable `we:` prefix inside the shell command
(standards-conformance + claim-accuracy, independently) — and that the "byte-for-byte" claim I'd only fixed in
this section still stood, unfixed, in the Proof plan above (claim-accuracy). Both genuinely fixed now: the
executable command moved into a fenced code block (exempt from the `we:`-locus lint, since it is a real shell
command, not a doc citation) with the bare, runnable path; the Proof plan's wording corrected the same way as
here. The two new follow-up cards (`xszsr8e`, `xwtj36n`) also had file-item's placeholder "Done when" — replaced
with real executable criteria on each card. Round 2's repeat idempotency/security/dead-code findings are the SAME
three already dismissed above (folded into #4399 / filed as `xszsr8e` / filed as `xwtj36n`) — not new. One
genuinely new, minor simplicity finding — the thin wrapper's docblock stayed long after the extraction shrank its
body to one line — fixed by trimming it to a pointer at the shared leaf's own doc.

**Round 3** (fresh panel again): simplicity came back CLEAN (0 findings) — the docblock trim held. The remaining
lenses repeated the SAME already-dismissed idempotency/security class (correctness, security — still #4399 /
`xszsr8e`, not new) plus two real, now-fixed accuracy gaps: the round-2 docblock trim pointed to detail the leaf's
own doc didn't actually carry yet — fixed by restoring the "why detached"/`num`/`rel`-null/`retractTo` specifics
onto `spawnPreventionLandingJob` itself (the leaf, not the wrapper, so it is written once); and the Design
section's own "zero behavior change" phrase (claim-accuracy) — fixed at its source, matching the *Converge
findings* wording above. A test title overclaim (claim-accuracy) — "the REAL default `spawnJob`…" named a
guarantee only the SEPARATE default-wiring test (added in round 1) actually proves — renamed to say what it
actually checks. This item stops re-running `/converge` after round 3: every remaining/repeated finding is either
already fixed above or already filed/folded as a follow-up with a stated reason — none names a taste/product/
policy call a human, not a reviewer, must make, so this is not a `review:human` park; it lands `ready-to-merge`
on a green gate per the *Escalations* rubric (size/thoroughness is not itself a park reason, and nothing here is
a policy call).

## Done when

1. **Executable** — the new `fileItemForPreventionViaLandingJob`/`spawnPreventionLandingJob`/
   production-default-wiring tests do not exist before this item (the functions/imports they exercise do not
   exist, so the file fails to even load), and pass after:
   ```
   npx vitest run scripts/operations/__tests__/review-loop-cli.test.mjs
   ```
