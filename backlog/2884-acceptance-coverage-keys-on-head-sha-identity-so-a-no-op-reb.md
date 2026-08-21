---
bornAs: xyl3dc9
kind: story
size: 3
status: open
parent: "3054"
relatedTo: ["2409", "2198"]
scope: ["we:scripts/lib/review-escalation.mjs"]
dateOpened: "2026-08-02"
tags: [gate, review, drain]
---

# Acceptance coverage keys on head-SHA identity so a no-op rebase invalidates a valid review

`acceptanceCoversHead` keyed on sha identity alone, which the #2409 docblock took deliberately — but with the drain rebasing a manifest-carrying lane on every main advance, "self-corrects on a fresh accept" became a livelock (PR #983: five re-parks, landed only via an operator valve). Sibling slices under #3054 have since added two fail-closed content-equivalence tiers that close the mechanism; what this card still owes is the convergence regression test and the docblock, which still asserts the pre-fix "ANY head change re-parks" behaviour the same function no longer has.

## This is a ratified tradeoff, not an oversight

State it plainly, because the fix must not be written as though someone got it wrong. `we:scripts/lib/review-escalation.mjs` says so directly: the gate keys on head-SHA identity, so **any** head change re-parks, "including a benign rebase-onto-main / force-push of an already-accepted branch that adds no review-worthy content… That is stricter than the motivating case, but defensible: a rebase DOES change the tree, and the re-park self-corrects on a fresh accept. We prefer the false-park over honouring an accept against a tree the reviewer never saw."

What this item carries is **new evidence against the "self-corrects" clause**, not a claim that the strictness is wrong.

## The evidence — PR #983, 2026-08-02

The drain's rebase-drop (#2198) rebases a manifest-carrying lane whenever `main` advances. On a busy night `main` advanced four times in about twenty minutes, partly from PRs opened to fix this very PR's review findings. Each advance rebased the lane, which changed the head, which invalidated the acceptance, which re-parked the PR.

Five re-parks. Two of them followed a valid human acceptance, one of which carried a correct `reviewed-sha` marker for the then-live head. The self-correction never converged, because a fresh accept has to win a race against the next rebase and the rebase is driven by unrelated traffic. The PR landed only via the `--no-review-escalation` operator valve.

So the clause that makes the strictness acceptable — "it self-corrects" — does not hold whenever the drain is also the thing moving the head.

## The obvious fix is not free

Comparing content instead of identity (`git patch-id` over the net `<merge-base>..<head>` patch, which is exactly the check run by hand on #983 and which came back byte-identical) would make a pure rebase preserve the acceptance.

But a rebase changes the **base**, and an identical net patch can still combine badly with whatever landed on `main` in between — a semantic conflict that no textual comparison sees. "Byte-identical diff" is therefore not the same as "the review is still valid", and #2409's stated preference for the false-park is a defensible answer to precisely that. Required CI re-runs on the rebased head and catches mechanical breakage, not semantic breakage.

Options worth weighing, rather than assuming the first one:

- **Content-keyed coverage** — patch-id on the net patch. Kills the livelock; accepts the semantic-conflict residual.
- **Keep sha-identity, remove the race** — do not rebase a PR that carries a live acceptance, or re-evaluate the gate before the rebase rather than after. Preserves the strictness and fixes the convergence failure instead.
- **Auto-re-stamp on a provably-identical rebase** — the drain, having produced the rebase itself, re-stamps the marker when the net patch is unchanged; a human re-accept is then only needed when content actually moved.

The second and third keep #2409's safety posture intact, which is why this should not be filed as "switch to patch-id".

## What has changed since this was filed — read before building (verified 2026-08-21)

The option this card said should *not* be assumed has effectively been taken, twice, by the sibling slices
under epic #3054. `acceptanceCoversHead` (`we:scripts/lib/review-escalation.mjs:1379-1428`) now runs three
tiers, not one:

1. **SHA identity** (`:1386-1387`) — unchanged, still first.
2. **`#x169fqe` content-equivalence** (`:1399-1406`) — `normalizeDiffFingerprint` on both sides; a
   byte-identical reviewed diff honours the accept. Fail-closed: both fingerprints must be present and equal.
3. **`#x9xqexm` contribution equivalence** (`:1414-1421`) — `normalizeContributionFingerprint`, base-independent,
   checked **last** so it can only honour an accept the two stricter tiers already rejected.

Both markers are stamped on accept (`buildReviewedDiffMarker` / `buildReviewedContributionMarker`, called at
`we:scripts/review-set-label.mjs:906-907`) and read at land (`parseReviewedContribution`,
`we:scripts/merge-ai-prs.mjs:3437`). Epic #3054's own digest records the measurement: 16 stamp-certified
accept→head pairs plus 201 replayed content-preserving rebases — **5 false stales before, 0 after**, with
181/181 genuine contribution changes still caught.

So **do not re-litigate the three options above.** The livelock's mechanism is closed. What is left is this
card's own two unmet DoD bullets — the convergence *proof* and the docblock *reconciliation*.

## The residual is a live contradiction, not a leftover

`acceptanceCoversHead`'s summary paragraph (`we:scripts/lib/review-escalation.mjs:1372-1376`) still reads:

> The gate keys on head-SHA IDENTITY, so ANY head change re-parks … the re-park self-corrects on a fresh accept.

Both halves are now **false in the same function they document**: a head change with a matching diff or
contribution fingerprint does *not* re-park, and the self-correction clause is the very claim this card's
evidence (PR #983, five re-parks, landed only via `--no-review-escalation`) falsified. The bullet list above
it names three outcomes where the code now has five. A reader reaching for the escapes' preconditions is
told they do not exist.

This is exactly DoD bullet 2 — "#2409's stated preference is either preserved or explicitly revised in the
docblock; the two must not silently disagree" — and it is currently unmet on `main`.

## Done when

1. **Executable — the livelock regression test exists and reproduces the sequence.** Run, from the WE
   checkout root:

   ```
   npx vitest run scripts/lib/__tests__/review-escalation.test.mjs
   ```

   The path is `lib/` on purpose: `we:scripts/__tests__/review-escalation.test.mjs` covers the unrelated
   escalation-reason-block helpers and never imports `acceptanceCoversHead`; every existing test for it —
   the `#2409` / `#x169fqe` / `#x9xqexm` describe blocks — lives in
   `we:scripts/lib/__tests__/review-escalation.test.mjs`, which is where the new case belongs. It passes
   with a case that drives the full ordering: accept at sha A (stamping both fingerprint markers
   from the reviewed diff) → an unrelated `main` advance → a content-preserving rebase to sha B → assert
   `acceptanceCoversHead` returns `covers: true` with the contribution reason, **and** that a second,
   genuinely-content-changing head move on the same fixture returns `covers: false`. The negative half is
   what stops the test passing for the wrong reason.
2. **Executable — the convergence is asserted at the decision seam, not only at the predicate.** A case in
   `we:scripts/__tests__/merge-ai-prs.test.mjs` (the file already reasons about this at line 2558) asserts
   the land decision for that same rebased-but-content-identical PR is **not** `park` — i.e. the accept
   converges to a land with no operator valve. A green criterion 1 alone does not prove this; the predicate
   and the seam are different failure surfaces.
3. **Observable — the docblock no longer contradicts the function.** The paragraph at
   `we:scripts/lib/review-escalation.mjs:1372-1376` is rewritten to state the three-tier ordering and the
   fail-closed precondition of each escape, and to record #2409's preference as **explicitly revised** (with
   the PR #983 evidence as the reason) rather than silently superseded. One grep for the phrase
   `ANY head change re-parks` in that file returns nothing.
4. **Observable — the bullet list matches the branches.** The `•` outcome list at
   `we:scripts/lib/review-escalation.mjs:1366-1371` enumerates every `return` in the function body — a
   reader counting bullets and counting returns gets the same number.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion ahead of the build) — Re-verified against the live repo: we:scripts/lib/review-escalation.mjs:1379-1430 has three tiers (SHA identity ~1385-1387, content-equivalence 1399-1406, contribution 1418-1425), the docblock at 1372-1376 still literally says 'ANY head change re-parks ... self-corrects', and the bullet list at 1366-1371 lists three outcomes against five actual returns. All three factual premises the card's DoD rests on hold.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — DoD item 2 requires a test at the decision seam (we:scripts/__tests__/merge-ai-prs.test.mjs, asserting decideReviewGate's action is not 'park'), not only at the acceptanceCoversHead predicate. decideReviewGate (we:scripts/lib/review-escalation.mjs:2000-2019) already threads acceptedDiff/headDiff/acceptedContribution/headContribution through to the predicate, so this seam test is buildable today; confirmed no such seam-level test exists yet in that file.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — DoD item 1 requires the negative half (a genuinely content-changing head move must still return covers:false) explicitly so the new test cannot pass for the wrong reason — the card states this reasoning directly.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — DoD items 3-4 are pure legibility fixes: rewriting the stale docblock paragraph and reconciling the bullet list against the actual return count, gated by a grep-based negative check ('ANY head change re-parks' must return nothing).

**Corrections applied by this review:**

- DoD item 1's given command (`npx vitest run we:scripts/__tests__/review-escalation.test.mjs`) points at the wrong file: that top-level file only covers the unrelated #2324 escalation-reason-in-body helpers and never imports or references `acceptanceCoversHead`; every existing test for `acceptanceCoversHead` (the #2409/#x169fqe/#x9xqexm describe blocks) lives in `we:scripts/lib/__tests__/review-escalation.test.mjs`, which is the file the new convergence test belongs in.

The card's factual claims about the live three-tier gate, the stale docblock, and the missing convergence/seam tests all check out against we:scripts/lib/review-escalation.mjs and its test files; the only defect found is a wrong test-file path in its own DoD instructions.

_Recorded through the declared `review-prep` operation._

**Author response (2026-08-21).** The correction is right and is applied: DoD item 1 now names
`we:scripts/lib/__tests__/review-escalation.test.mjs`, with a sentence saying why, so the criterion cannot
pass against a file that never imports `acceptanceCoversHead`. No other finding was raised.
