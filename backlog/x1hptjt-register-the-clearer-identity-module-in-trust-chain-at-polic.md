---
kind: story
size: 1
status: open
blockedBy: ["2844"]
dateOpened: "2026-08-09"
scope:
  - we:scripts/lib/gate-config.mjs
  - we:scripts/lib/__tests__/gate-config.test.mjs
tags: [gate, review, trust-chain, policy-tier, review-independence]
---

# Register the clearer-identity module in TRUST_CHAIN at policy tier — its cited blocker PR #1098 is closed

`we:scripts/lib/review-independence.mjs` decides **who may clear the review gate**, which is `policy` tier by
[we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs)'s own definition — yet it is absent from the
`TRUST_CHAIN` roster, so an edit to it escalates but does not force `review:human`. Its own header calls this
an owed follow-up and names the reason it was deferred: a concurrent change, PR #1098, held the roster.
**PR #1098 is CLOSED, not merged** (`closedAt: 2026-08-08T14:40:00Z`, `mergedAt: null`), so that blocker no
longer exists. This item does the one-entry roster edit — deliberately left to an operator, because the
roster file is itself policy tier.

## Correcting the framing this was filed under

Two things must be said plainly or this item will be picked up and found unbuildable:

1. **The module does not exist on `main` today.** It arrives with PR #1100 (OPEN, branch
   `lane/2844-refuse-self-cleared-verdict`, backlog
   [#2844](/backlog/2844-land-seam-refuses-a-self-cleared-verdict-and-an-invariant-an/), `status: open`).
   Everything below was read from that branch via the GitHub contents API, not from a local checkout.
   Hence `blockedBy: ["2844"]` — the roster entry cannot be written before the file it names lands.
2. **`isPolicyCorePath` returning `false` for it today is therefore trivially true** — the path is not in the
   roster because nothing at that path exists yet. Verified by calling the real function in a lane clone of
   `main`:

   ```
   false  scripts/lib/review-independence.mjs
   true   scripts/lib/auto-land-seam.mjs
   true   scripts/lib/review-runner-core.mjs
   true   scripts/lib/review-escalation.mjs
   true   scripts/lib/gate-config.mjs
   ```

   The gap is real and the header's own reasoning stands; it is just **not yet observable** as a live
   misclassification. It becomes one the moment PR #1100 merges, which is why this is filed now rather than
   rediscovered later.

## What the module's header says

Read verbatim from PR #1100's branch, the last paragraph of the file header:

```text
NOT YET TRUST-CHAIN REGISTERED, AND THAT IS AN OWED FOLLOW-UP, NOT A CHOICE. This module DECIDES what may
clear the gate, which is the textbook `policy` tier in `we:scripts/lib/gate-config.mjs`'s own words — an
edit here should force `review:human`, exactly as it does for the seam that calls it. It is absent from
`TRUST_CHAIN` only because #2844 landed while a concurrent change (PR #1098) held the roster, and editing
the leash classification from two lanes at once is the merge hazard the roster exists to prevent. Today an
edit here still ESCALATES (the `^scripts/` blast-radius rule) but does not force a human. Register it as
`{ role: 'clearer-identity', file: 'review-independence.mjs', tier: 'policy' }` in the next roster edit.
```

Note the header also says "#2844 landed", which is not true either — #2844 is `status: open` and PR #1100 is
unmerged. The sentence was written in anticipation. Whoever takes this item should fix that clause in the
same change, or the file will keep asserting a landing that did not happen.

## The edit

One entry appended to `TRUST_CHAIN` in [we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs),
matching the shape of its neighbours — which carry `leash` and `homes` in addition to the three fields the
header names, so the header's snippet is abbreviated, not the full record:

```js
{
  role: 'clearer-identity',
  file: 'review-independence.mjs',
  tier: 'policy',
  leash: …,          // 'spec' or 'code' — see below; this is the actual judgment call
  desc: '…decides WHO may clear the gate; an agent may not clear an edit to its own independence check…',
  homes: ['scripts/lib/review-independence.mjs'],
},
```

**`leash` is the one open question, not `tier`.** The tier is settled by the header's own argument. But the
sibling entries `review-runner-core` and `review-runner-cli` both carry `leash: 'spec'` under a comment
saying reclassifying them is "a separate, human-ratified call", and the same reasoning plausibly applies
here. Pick `spec` unless there is a reason not to — it is the fail-closed direction and a strict no-op on
today's behaviour.

## Why an operator, not an agent

The roster file is itself `policy` tier (`isPolicyCorePath` returns `true` for it, per the run above), so an
edit to it forces `review:human` by construction — an agent cannot clear its own change to the leash roster.
That is the design working, not an obstacle. This card exists so the edit lives on the board rather than only
in a comment inside an unmerged file.

## Acceptance

- `isPolicyCorePath` returns `true` for the clearer-identity module's path.
- The "NOT YET TRUST-CHAIN REGISTERED" paragraph is removed from the module header (and its inaccurate
  "#2844 landed" clause goes with it), so the file and the roster stop disagreeing.
- The roster's own conformance/enum test covers the new entry, the same as every other role.
