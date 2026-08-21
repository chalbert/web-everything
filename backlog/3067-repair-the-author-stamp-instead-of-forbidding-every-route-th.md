---
bornAs: xqz1mat
kind: story
size: 3
status: active
dateOpened: "2026-08-11"
dateStarted: "2026-08-21"
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

## Progress

**Status:** the owed wiring is done and live. The item stays `active` — two halves remain, both deliberate.

**Branch:** `lane/3067-author-stamp`

**Done.** `we:scripts/lib/review-independence.mjs` grew `prCreatedAt`/`stampLostMarked` as OPT-IN inputs and its own header named the gap: *"wiring them into `we:scripts/review-set-label.mjs` / `we:scripts/lib/auto-land-seam.mjs` (so a live clear actually consults them) is left as this item's own owed follow-up"*. No live caller passed either, so **every clearance recorded `unknown-author`** whether the PR predated the regime or had a stamp stripped an hour ago — including all five recorded in this session.

`createdAt` now rides the existing `gh pr view` (one more `--json` field, no extra hop — the pattern `body` (#2844) and `state` (#2953) already use), and `we:scripts/review-set-label.mjs` passes both signals. A post-regime PR with no stamp now records **`stamp-lost`**; a pre-regime one still records `unknown-author`. Three end-to-end tests drive the real CLI against the recording fake `gh` and assert the durable comment, plus the opt-in case (no `createdAt` → byte-identical old behaviour). Mutant killed: dropping `prCreatedAt` from the call reddens the suite.

**Not done — `we:scripts/lib/auto-land-seam.mjs`, deliberately.** That seam is already STRICT fail-closed: `unknown-author` and `stamp-lost` both refuse, so wiring it changes only the reason string. It would cost threading two parameters through three signatures (`decideAutoLand`, `applyAutoLand`, and their caller) for no behaviour change. Recorded as a decision, not an oversight.

**Not done — making the clear REFUSE on `stamp-lost`.** This is the half that turns detection into enforcement, and it needs a call first. `we:scripts/review-set-label.mjs` refuses only `SELF_CLEAR`; adding `STAMP_LOST` would block **every PR opened outside `pr-land`** — which on a credential-less host is all of them, because `pr-land` needs `gh` and the MCP connector does not stamp. Those PRs are correctly `stamp-lost` (no authorship evidence exists, so tolerating them was never safe), but blocking them with no alternative stamping route strands the whole credential-less workflow. The refusal should land together with a route that stamps a PR opened without `pr-land`, not before it.

**Next.** Decide the pairing above; and check whether `we:scripts/pr-body-edit.mjs --repair` should run automatically from the drain (the card's second Done-when) rather than only by hand.
