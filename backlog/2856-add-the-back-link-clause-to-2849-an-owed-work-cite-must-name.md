---
bornAs: xl5yhja
kind: task
parent: "2822"
status: open
blockedBy: ["2849"]
dateOpened: "2026-08-02"
tags: [conveyor, statute-lint, prevention, citation]
---

# Add the back-link clause to #2849 — an owed-work cite must name the item that actually owns it

#2849 requires a statute anchor's interim / point-in-time claim to name the OPEN item whose resolution retires it.
That is a status test only: any open item satisfies it, including one that owns none of the work. As specified,
#2849 **passes the exact diff that motivated it** — PR #982's anchors cite #2840 / #2785, both open, neither holding
any reviewer-id scope. Add the missing half: the cited item must also point back.

## Gap

Verified on `main`: the nine guards filed for the #982 review carry `parent: "2822"` with no `blockedBy` or `parent`
edge to #2840 or #2785, and a grep for reviewer-id / session-service wording returns **zero** hits in both
`we:backlog/2785-implement-the-narrowed-review-human-rubric.md` and
`we:backlog/2840-human-principle-not-implementation-narrow-gate-self-from-pat.md`. The real owners are #2843
(oracle spec-tier + non-author signal), #2844 (reviewer id in the verdict; land seam refuses a self-clear) and
#2848 (the `human-verify` code reader).

So four landed anchors assert owed enforcement that nothing on the board is accountable for, and #2849 as written
would never say so. #2840 and #2785 can both resolve while #2843 / #2844 / #2848 stay open — at which point a reader
watching the *named* items concludes the independence precondition is satisfied and retires the `review:human`
interim rail, while nothing records or compares reviewer identity.

## Mechanical fix

Extend #2849's rule in `we:scripts/lib/validate-rules-anchors.cjs` from a **status test** to a **bidirectional**
one. An owed-work sentence in an anchor body — matched on the same token set #2849 already defines
(`owed as an outstanding prevention on`, `enforcement is owed`, `build-pending`, `until #NNNN`) — must cite at least
one backlog item that is BOTH:

1. not `status: resolved` (the clause #2849 already specifies), AND
2. whose **own body cites this anchor id or the described mechanism** — the back-link.

Clause 2 is the one that closes the class: it is the difference between "name something open" and "name the owner".
Both clauses read the same backlog index, so the added cost is one lookup.

## Why it is a separate item

#2849 is filed and unblocked; this clause changes its acceptance criterion, so it is tracked as its own change
rather than an in-place edit to a filed item's spec. `blockedBy: ["2849"]` — build the base rule first, then widen.
Note also that #2849's shape is contingent on the open statute-layering decision (#2854): if build status moves
out of anchors entirely, #2849 shrinks to the narrow "until #NNNN" case and this clause rides on that remainder.

## Provenance

Round-3 finding **R1** from the human `/review` on **PR #982** (decision landed as **#2851**), raised independently
by the correctness and standards-conformance lenses and verified against `main`. The prose fix to the four anchors is
tracked as #2853; this item is the **guard** that stops the class recurring. Related: #2849, #2853,
#2854, `2855` (the cite-from-title class this is one surface of).
