---
bornAs: xhqqy9j
kind: task
status: open
dateOpened: "2026-08-20"
tags: []
---

# Declare a stage-pr-view operation that refuses an incomplete PR view

The file transport that lets a credential-less host review a PR is fail-closed on a missing file and wide open on a present one. The review assembler defaults every field it reads, so a hand-assembled view that drops labels reviews a review:human PR as unlabelled and clearable, and one that drops comments hides the escalation and the last verdict. This declares the staging half: a field that is absent is refused, a field that is present and empty is believed, and the view is written under the reader own injective filename.

## The half of "fail-closed" that was not closed

`we:scripts/operations/review-pr-io.mjs` says of its file transport, accurately, that "a missing or
unparseable file throws and names the path; it never silently degrades to an empty view, which would
review a PR as if it had no body, no labels and no comments."

That is true of a **missing** file. It is false of a **present** one. `assembleReviewDetail`
(`we:scripts/review-detail.mjs`) defaults every field it consumes:

| field absent | what the review concludes |
| --- | --- |
| `labels` | `labelNames([])` → `humanRequired: false` → **a `review:human` PR reads as clearable** |
| `comments` | no advisory comment, no human verdict comment, no escalation timestamp |
| `files` | an empty diffstat |
| `body` | `escalationReason: []` → `disposition: null` → the park's shape is unknown |

None of those throws. The #1466 fix taught the transport to check the view's `number`; nothing taught it
to check that the view is **complete**. And the only way to obtain a view on a host where `gh` cannot
authenticate is to assemble one by hand from another API's response, which is precisely the process that
drops a field by omission.

## The decision: absent is refused, empty is believed

A PR really can have no labels and no comments, so a truthiness check would refuse the ordinary case this
exists to serve. The line that works is **presence, not emptiness**:

- `labels` **missing** → refused. No claim was made, and no claim must never read as "none".
- `"labels": []` → believed. That is a claim by whoever staged it, and claims are believed.

This is the same line `verify` (#3207) draws between a check that failed and one that never ran.
Absence of evidence is not evidence of absence, and the whole value here is refusing to let it become one.

Types are checked, not just presence, because the realistic error is a mapping that puts `labels` as an
object under a different key — and `typeof [] === 'object'` waves that straight through.

## The boundary of the guarantee, stated

It catches an **omitted** field. It cannot catch a **wrong** one: a view staged with `"body": ""` for a PR
that has a body is an explicit, believed, and incorrect claim. Hit while proving the operation live, and
recorded here rather than left implied — the operation narrows the failure surface, it does not close it.

## It restates nothing

The field list is the reader's own `PR_VIEW_FIELDS` and the filename is its own `prViewFileName`, both
injected at the single call site rather than re-typed. The filename matters as much as the content:
`prViewFileName` percent-encodes the slug because a `-`-flattened one was not injective and two repos
collided onto one file, so one repo's view silently answered for the other's (#1466). A second namer here
would stage the view under a name the reader does not look up.

The declared type table is **not** derived from `PR_VIEW_FIELDS` on purpose. Deriving it would let a new
field arrive with no declared type and be waved through — a completeness check that quietly stops being
complete. Asserting equality instead turns that into a test failure until somebody decides what the new
field must be.

## Done when

1. **Executable** — `npx vitest run` over `we:scripts/operations/__tests__/stage-pr-view.test.mjs` passes 23
   assertions; collapsing absent-and-empty into one truthiness test reddens 8, dropping the type check
   reddens 2, dropping the subject check reddens 1.
2. **Proven on the real failure** — staging a view of a live PR with `labels` omitted is refused by name;
   staging the complete one writes it where the reader looks and the review then runs.
3. **Derived** — `stage-pr-view --help` through `we:scripts/operations/run.mjs` prints usage the CLI adapter
   derived from the declaration, with no argv parser written.
