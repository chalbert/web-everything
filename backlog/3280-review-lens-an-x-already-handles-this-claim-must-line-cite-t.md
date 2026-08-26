---
bornAs: x17op72
kind: story
size: 3
status: open
dateOpened: "2026-08-25"
tags: [review-quality, citation-verification, jury]
scope:
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
relatedTo: ["3026", "3118"]
---

# Review lens: an 'X already handles this' claim must line-cite the code performing X

`we:agent-memory-src/grep-every-name-you-cite-in-prose.md` makes a cited name prove it exists, and #3026
proposes a gate for that. Neither covers the next failure: a name that resolves inside a sentence that is
still false. "`dispatch-lane`'s observer is where handle recovery lives" grepped clean and was wrong — the
observer compares a minted id, it recovers nothing. Extend the `correctness` lens's pre-registered
expectation (`we:scripts/lib/review-core.mjs:1847`) so a claim that some cited file *already handles* a
behaviour must quote or line-cite the code performing it, and a reviewer rejects the claim when it does not.

## The failure this closes

PR #1565 amended #3118's fork survey. It recorded a measurement — `claude --bg` ignores `--session-id` —
and then wrote:

> *"...so the handle must be recovered from the listing.
> `we:scripts/operations/dispatch-lane-io.mjs`'s observer is where that lives."*

Every name in that sentence resolves. The file exists, it has an observer, and the observer does read
`claude agents --json`. What it does **not** do is recover anything: `createDispatchObservers` runs
`sessions.find((s) => s && String(s.sessionId) === handle)`
(`we:scripts/operations/dispatch-lane-io.mjs:735`) against the id `createDispatchSinks` minted itself
(`:555`, passed as `--session-id` at `:618`), and the sink's header states the design outright — *"THE
HANDLE IS MINTED, NOT DISCOVERED"* (`:509`).

So the sentence pointed a future reader at a fix that does not exist, and did it while citing the exact
file where the *opposite* is asserted. A name-resolution gate (#3026) passes this sentence. A
grep-every-name discipline passes this sentence. The claim is about **semantics**, and only a reader who
opens the cited lines catches it — which is why this is a review-lens bar rather than a `check:standards`
rule.

## What to change

`LENS_EXPECTATIONS[MANDATE_LENSES.CORRECTNESS]` (`we:scripts/lib/review-core.mjs:1847`) is the single source
for the correctness juror's charter and its later mandate — the module's own header says the wording **is**
the commitment. Add the claim-verification clause there, so both the pre-registered charter a human aligns
on and the mandate the juror runs carry it. Its shape, roughly: *a prose claim that a cited file already
performs some behaviour is held to the same bar as a code change — quote or line-cite the code that performs
it, or the claim is a finding.*

Two things to settle while doing it:

- **Scope of the clause.** Every prose artifact under review, or only the ones where prose IS the deliverable
  (backlog bodies, `leash: spec` files, PR bodies) — the concentration
  `we:agent-memory-src/grep-every-name-you-cite-in-prose.md` already names?
- **Whether the other three panel lenses want it too.** `standards-conformance` has a plausible claim on
  "this follows the ratified statute" assertions. Default: correctness only, since a false already-handled
  claim is a correctness defect in the artifact.

## Done when

1. **Executable** — `npx vitest run review-core` passes with a new assertion that
   `LENS_EXPECTATIONS[MANDATE_LENSES.CORRECTNESS]` carries the claim-verification clause, and the existing
   `LENS_EXPECTATIONS` describe block at `we:scripts/lib/__tests__/review-core.test.mjs:1663` still passes
   (every lens non-empty, `expectationForLens` agrees, the object frozen). The new assertion fails before
   the change and passes after.
2. The two open questions above are answered in the item or in the commit that closes it — not left implicit
   in the wording.
