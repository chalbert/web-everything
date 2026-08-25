---
bornAs: x4kry5w
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-21"
preparedDate: "2026-08-25"
relatedTo: ["3233"]
tags: [operations, epic-3029, review-prep, preparation]
scope:
  - we:scripts/operations/review-prep-io.mjs
  - we:scripts/operations/__tests__/review-prep-io.test.mjs
---

# review-prep reports a verdict recorded when the note never reached the card

Observed on two independent lanes on 2026-08-21. The operation returns stopped complete with applied effects and prints that the review was recorded, while the note is absent from the card — a write race with a concurrent edit in the same lane. This is success reported on a write that did not happen, the same class as open-pr classifying a post-open refusal as opened. A caller that trusts the report records a review that does not exist. The record effect must verify its own write landed, or report a third outcome, never a bare success.

## What is already there, and why it is not enough

`recordPrepVerdict` **does** guard the read→write window: it compares a content hash and, on a mismatch,
declares zero effects rather than clobbering a concurrent edit
(`we:scripts/operations/review-prep-io.mjs`, the `changed since it was read` branch). That guard is
*pre*-write. The observed failure is *post*-write — the write is issued, the report says recorded, and the
text is not in the file afterwards. A pre-write hash check cannot see that, by construction.

So this is not "add a guard that is missing"; it is "the existing guard covers the wrong half of the
window." The cheap, complete fix is to re-read after writing and assert the rendered section is actually
present, which is a direct observation rather than an inference about who else held the file.

## The decided design

After the write, re-read the file and search it for the rendered section. Present ⇒ `verified: true`.
Absent ⇒ return `{recorded: false, verified: false, path}` and take no further action — no commit, no land.

**A third outcome, not a throw.** A throw would be indistinguishable from the operation crashing, and the
engine's replay rules then treat it as UNKNOWN and refuse to retry. A returned `recorded: false` is a
determinate answer the caller can act on: the write did not land, nothing was committed, re-run is safe.

## Delivered together with #3233 — stated rather than assumed

Both cards change the same function in the same file, and the pairing is not administrative convenience: as
long as `record` still bundles the land (#3233), a read-back that passes would report `verified: true` on a
run whose verdict still ends up stranded on an orphan ref. Verification only means something once the thing
being verified is the whole of what `record` promises. They land in one PR; each keeps its own test.

## Tasks

1. Extract the rendered section's presence test into a small predicate so the test can assert on it directly.
2. Re-read after write; branch on presence.
3. Return the third outcome; ensure the commit/land block is skipped on it.
4. Test via a stubbed reader that returns the pre-write text.

## Delivery shape

Incremental behind `main`, in #3233's PR. No branch.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-prep-io.test.mjs` passes a case
   that stubs the post-write read-back to return the card's pre-write text, and asserts the returned object
   is `{recorded: false, verified: false}` — asserting explicitly that it does **not** throw.
2. **Executable** — the same case asserts the commit spy and the pr-land spy were each called **zero** times,
   proving the false-success path takes no downstream action.
3. **Executable** — the happy path asserts `verified: true` is present on the success return, so the field
   cannot be quietly dropped.
4. **Mutation** — deleting the read-back branch reddens case 1 by name. (Case 3 alone would stay green with
   the branch deleted, which is why case 1 is the mutation target and not case 3.)
5. `npm run check:standards` passes.
