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

After the write, re-read and search for the rendered section. Present ⇒ `verified: true`. Absent ⇒ return
`{recorded: false, verified: false, path}` and take no further action.

**Verify the STAGED content, not an in-memory read — round 2, forced by an independent panel (2026-08-25).**
Round 1 said "re-read the file after writing." The `no-op` juror showed that leaves a second window open:
`recordPrepVerdict` would verify by reading the file into memory, and then `git add` reads the file *again*
from disk. A concurrent writer landing between those two reads gets committed under a report that already
said `verified: true` — the same defect, one step later in the pipeline.

So the order is: write → `git add` → verify what is **staged** (`git show :<path>`) → commit. Verifying the
index rather than the working tree means the bytes checked are exactly the bytes committed, and there is no
remaining gap for a racing writer to slip through. This is a strictly cheaper fix than locking, and it is
the reason the check moved after the stage rather than before it.

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
2. Reorder to write → stage → verify-the-index → commit.
3. Return the third outcome; ensure the commit and push blocks are skipped on it.
4. Test via a stubbed index reader that returns the pre-write text.

## Delivery shape

Incremental behind `main`, in #3233's PR. No branch.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-prep-io.test.mjs` passes a case
   that stubs the **staged**-content read to return the card's pre-write text, and asserts the returned
   object is `{recorded: false, verified: false}` — asserting explicitly that it does **not** throw.
2. **Executable** — the same case asserts the `commit` spy and the pr-land spy were each called **zero**
   times, proving the false-success path takes no downstream action. (The `add` spy IS called once — staging
   precedes verification by design; asserting `add` at zero would encode the wrong order.)
3. **Executable** — a case asserting the verification reads the **index**, not the working tree: the working
   tree is mutated after staging and the run still reports `verified: true`, because the staged bytes are
   the ones that get committed. This is the case that distinguishes round 2's design from round 1's, and it
   passes only if the check sits after the stage.
4. **Executable** — the happy path asserts `verified: true` is present on the success return, so the field
   cannot be quietly dropped.
5. **Mutation** — deleting the verification branch reddens case 1 by name; moving the check back to before
   the stage reddens case 3 by name. (Case 4 alone would stay green under both, which is why it is not the
   mutation target.)
6. `npm run check:standards` shows **no new warnings** against the 0-error / 1435-warning baseline. Stated
   as a delta, not as "passes": the gate exits 0 both before and after, so an exit-code assertion would be
   decorative — the same defect #3238 refutes in this PR, which this criterion originally reproduced.
