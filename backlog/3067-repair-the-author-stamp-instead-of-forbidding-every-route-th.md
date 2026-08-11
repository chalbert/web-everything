---
bornAs: xqz1mat
kind: story
size: 3
status: open
dateOpened: "2026-08-11"
tags: [gate, review, independence, guard, footgun]
scope:
  - we:scripts/lib/review-independence.mjs
  - we:scripts/pr-body-edit.mjs
---

# Repair the author stamp instead of forbidding every route that strips it

`#3066` blocks the shell commands that wipe a PR's `authored-by-actor` stamp, and took **six review rounds
and six spellings** to get most of them. That is the wrong shape of fix: a deny-list over a CLI's argument
grammar can only ever enumerate. Notice a stamp is missing and put it back, and every route is covered at once
— including the ones no shell guard can reach. The reviewer's acceptance of `#3066` was explicitly
conditioned on this item existing.

## Why the deny-list cannot finish

Each round closed a real hole, verified against the live tool, and each time the author believed it was the
last:

| round | spelling |
| --- | --- |
| 1 | the long flag |
| 2 | the short flags |
| 3 | the quoted long flag |
| 4 | a shorthand with its value glued on |
| 5 | the REST field write, and a file-fed payload |
| 6 | the GraphQL endpoint, with the mutation in a file |

Round six also produced two spellings of the *same* endpoint that still slip: a leading slash, and the absolute
API URL. Both were fired at GitHub and reached the `updatePullRequest` resolver.

## The routes that remain open, named exhaustively

So the next reader does not have to rediscover them:

- **The GitHub web UI.** Edit a body in a browser and no shell guard exists to intercept it.
- **The GraphQL endpoint by non-canonical spelling** — a leading slash, or the full URL.
- **A forged identity.** Setting the session id directly defeats the comparison outright. Already ruled out of
  scope by `we:scripts/lib/review-independence.mjs` — this is the same determined-actor class.

The accident that actually happened, and every habitual spelling of it, IS covered. That is what the deny-list
is worth: it raises an accidental strip from free to "deliberately route around a named guard". It is not
coverage, and `#3066` should not be read as claiming otherwise.

## What repair looks like

The stamp is derivable after the fact — the PR's opening actor is knowable from the lane that produced it, and
the drain already reads PR bodies every pass. So:

1. **Detect.** A body with no `authored-by-actor` stamp is either an old PR or a stripped one. Today those are
   indistinguishable, which is exactly why the self-clear guard tolerates `unknown-author` and why
   `plateau-app#137`'s ancestor landed on its own author's clearance.
2. **Distinguish.** A PR opened after the stamp existed and now lacking one has been stripped. That is a
   checkable date comparison, not a judgement.
3. **Repair or refuse.** Restore the stamp from the recorded opener, or — if it cannot be recovered — mark the
   PR as *stamp-lost* so the clear refuses rather than tolerating it. The second half is the important one:
   the tolerance is only safe while "no stamp" reliably means "old".

Step 3's refusal is what makes this a fix rather than a nicety. Once a stripped body is distinguishable from an
old one, the guard can fail closed on the stripped case without stranding the old ones — which is the exact
trade `we:scripts/lib/review-independence.mjs` documents as impossible today.

## Done when

- [ ] A PR whose body lost its stamp is detected, and distinguished from one that never had it.
- [ ] The stamp is restored where the opener is recoverable.
- [ ] Where it is not, the clear REFUSES rather than reading as `unknown-author`.
- [ ] The web-UI route is covered, since it is the one no shell guard can reach — and is the test case.
