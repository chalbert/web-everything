---
bornAs: xy0ff9u
kind: story
size: 2
status: resolved
dateStarted: "2026-08-12"
dateResolved: "2026-08-12"
dateOpened: "2026-08-12"
relatedTo: ["2324"]
tags: [gate, review, drain, marker-forgery]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/merge-ai-prs.mjs
---

# The escalation-reason marker has no render boundary, so a PR body that quotes it self-attests

`bodyHasEscalationReason` and `parsePolicyStamp` scan a PR body for literal markers with no distinction between
*the drain wrote this* and *someone typed it*. A PR that documents the markers — even inside a fenced code
block — reads as already-stamped. Found live: PR #1167's own description defeated both of the scanners it
shipped.

## Observed, not hypothesised

The independent review of #1167 probed the live body and got:

- `bodyHasEscalationReason` → **true**
- `parsePolicyStamp` → **`{ version: "1", digest: "08da26b668de" }`**

Neither was written by the drain. Both came from a fenced example in the PR description showing what the block
looks like. The digest happened to be the true current value, so the forgery was *correct* — which is worse,
because nothing about the output would look wrong.

**Failure scenario.** A `review:human` re-park consults `bodyHasEscalationReason` to decide whether the body
already carries a reason block ([we:scripts/merge-ai-prs.mjs](../scripts/merge-ai-prs.mjs)). Reading a quoted
example as the real thing, it skips the write and attests `durableRecorded = true`. The operator opening that
PR sees no escalation reason, and any later reader attributes a parameter set the drain never stamped.

## This family already has a fix, applied elsewhere

The verdict comment got a render boundary during the marker-hardening work: `neutralizeCommentMarkers` escapes
`<!--` and `-->` at the render seam so quoted content can never open or close a trusted block. That work also
established the sharper lesson — an *unclosed opener* can borrow the builder's own closing delimiter to forge
content **inside** the trusted region.

The escalation-reason block and the policy stamp never got the same treatment. They are the same shape of
target and should get the same boundary rather than a bespoke one.

## Two related findings from the same review, recorded here

- **First match wins.** `parsePolicyStamp` takes the first stamp in the body, so one quoted early shadows the
  drain's real appended stamp. The author-actor marker solved this by resolving to `''` on disagreement —
  *agreement-or-nothing* — because first-match is positional, not temporal, and a body has no clock in it.
  The same reasoning applies here.
- **One-shot append.** The block is written once, so a re-score after a contract change keeps the original
  stamp. Defensible — it records the rules the first park applied — but it must be stated wherever the stamp
  is read, or an analysis will treat it as the current parameter set.

## Watch for

The point is not to forbid documenting the markers. `#3075`'s body legitimately shows the block, and escaping
it by hand worked but relies on the author remembering. The boundary belongs at the seam that *reads* the body,
so a correct example costs nothing.

## Done when

- [x] A quoted or fenced marker in a PR body cannot satisfy `bodyHasEscalationReason`.
- [x] A quoted stamp cannot shadow or substitute for one the drain wrote.
- [x] The one-shot-append semantics are stated wherever the stamp is read — today that is `parsePolicyStamp`
      itself, since nothing else reads it yet; the note travels with the parser rather than with a consumer
      that does not exist.
