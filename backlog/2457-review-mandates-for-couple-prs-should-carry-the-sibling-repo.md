---
bornAs: xy8e7h0
kind: story
size: 3
relatedTo: ["2285", "2287", "2263"]
status: open
dateOpened: "2026-07-12"
tags: [review, drain, cross-repo, mechanical-gate]
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
---

# Resolve a couple's cross-repo symbol MECHANICALLY, before the reviewer ever sees it

A fresh-context diff-only reviewer judging ONE half of a cross-repo couple false-positives on symbols
the sibling PR adds: re-reviewing plateau#19 (impl half of the #2449 couple), the round-2 reviewer's
only finding was that `--under-lease` does not exist in `we:scripts/merge-ai-prs.mjs` — it verified
against WE main, where the couple's WE half (PR #441) had not landed. The fix is **not** to tell the
reviewer anything. The drain already has local clones of the sibling repos and the manifest already
names their refs, so "does this symbol exist in the couple" is script-decidable: fetch each
`repos[].ref` into its sibling clone, grep, and drop the finding before it reaches a mandate.

## Re-scoped 2026-08-03 — the prompt approach was tried twice and rejected

The original fix line (thread the manifest's repo/ref list into the mandate text) was built as PR
#1011 and bounced twice by `/review`, then the boolean-flag retreat was bounced again. That PR is
**closed**; this item is re-scoped to the mechanical check. Recorded because the failures generalise:

1. **It cannot fire where the bug lives.** Only a WE PR carries a lane manifest —
   `we:scripts/merge-ai-prs.mjs` states it outright: *"an orphan/impl PR has none → null"*. The
   motivating incident was plateau#19, an **impl** half. Any manifest-derived signal is null there.
2. **The amnesty excuses same-repo bugs.** A couple is one PR per repo, so the sibling half can never
   define a symbol in *this* repo — yet the instruction's operative test is "absent from this repo",
   which is the **only** basis a diff-only reviewer has for an undefined-symbol finding. A genuinely
   missing local helper then reads as expected-mid-couple: a false negative on the mandatory
   correctness lens, on every couple.
3. **The trigger stays author-controlled even as one bit.** `crossRepo = m.repos.length > 1`, read
   PR-body-first, and the body is author-editable. One extra `repos` entry buys amnesty across every
   lens **and** the #2439 independent validator. Closing the *data* channel (the first retreat) does
   not close the *control* channel.

Root pattern: a review-**relaxing** signal satisfiable by author assertion is a control channel, and
no amount of sanitising or corroboration fixes that — corroboration proves existence, not identity.

## Why mechanical is strictly better

- **It fires on both halves.** The check keys on the couple's refs, not on which repo holds the
  manifest.
- **It is exact, so there is no amnesty.** It answers "this symbol exists at X" or "it exists
  nowhere". A same-repo missing helper still reports normally — the failure mode inverted in (2)
  cannot occur.
- **Forgery collapses into compliance.** To make the check pass you must actually add the symbol.
  There is no bit to flip.
- **It never touches a prompt**, so no author-controlled bytes reach the gate that judges that author.
- Memory rule #51: script-decidable → hook, judgment stays in context. Symbol existence is
  script-decidable.

## The machinery already exists

- `siblingCloneName` / `CONSTELLATION_REPO_NAMES` (`we:scripts/merge-ai-prs.mjs`, #2287/#2263) already
  give the drain local clones of `web-everything`, `frontierui` and `plateau-app`.
- The lane manifest already carries `repos[].ref` — the same field `crossRepo` reads today.
- `resolveNetDiffBasis` already fetches arbitrary refs **without checkout** (#2336-safe), so the
  fetch primitive is in hand.

Nothing new needs building at the transport layer; this is a filter step plus its oracles.

## Definition of done

- **A1 — the check.** For a couple half, resolve each unresolved cross-repo-qualified reference in the
  diff against the couple's other `repos[].ref`, in the existing sibling clone, without checkout.
- **A2 — filter, do not instruct.** A finding whose symbol resolves in a sibling ref is dropped before
  the mandate is built. No mandate text changes; `buildMandate`/`buildPanelMandate` keep their current
  signatures.
- **A3 — no blanket behaviour.** A symbol that resolves **nowhere** in the couple is reported exactly
  as today. Prove it with a negative oracle: a genuinely missing local helper on a couple half must
  still surface.
- **A4 — degrade honestly.** A sibling clone that is absent, or a fetch that fails, means the check
  did not run — the finding passes through unfiltered. Never treat "could not check" as "resolved".
- **A5 — the motivating case.** A regression reproducing plateau#19's shape: an impl-half diff
  referencing a flag defined only in the couple's unlanded WE half is NOT reported.

## Boundary

Not a mandate-text change, and explicitly **not** a couple-context parameter — that is the approach
this item was re-scoped away from. Not a numbering or link-syntax change either: the check searches
the couple's known refs, so it never needs a reference to name which ref defines the symbol.

## Residue from the closed PR

`we:scripts/review-core-cli.mjs`'s `buildMandateText()` passes no `netChangedFiles`, so #2450's
ground-truth block never reaches a reviewer seeded through the CLI seam — and
`we:scripts/workflows/review-parked-prs.mjs`, the **mechanized** panel, seeds every lens through
exactly that CLI. That gap is real, independent of this item, and is filed separately.
