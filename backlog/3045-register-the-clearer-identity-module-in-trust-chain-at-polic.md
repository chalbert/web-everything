---
bornAs: x1hptjt
kind: story
size: 1
status: open
dateOpened: "2026-08-09"
scope:
  - we:scripts/lib/gate-config.mjs
  - we:scripts/lib/__tests__/gate-config.test.mjs
  - we:scripts/lib/review-independence.mjs
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

## The gap is LIVE on `main`, and measured

PR #1100 merged 2026-08-09T12:40:01Z, so the module is on `main` (first landed in `057a98cb`) and #2844 is
`status: resolved`. There is no blocker left: the file exists, the roster is free, and the misclassification
is observable today rather than prospective. Measured by calling the real predicates on a lane clone of
`main` at `cf6730a3`:

```
isPolicyCorePath  isPolicySpecPath  path
false             false             scripts/lib/review-independence.mjs
true              false             scripts/lib/auto-land-seam.mjs
true              true              scripts/lib/review-runner-core.mjs
true              false             scripts/lib/review-escalation.mjs
true              true              scripts/lib/gate-config.mjs

scoreEscalation({ changedFiles: ['scripts/lib/review-independence.mjs'], diffLines: 40 })
  → { escalate: true, humanRequired: false,
      reasons: ['blast-radius (scripts/lib/review-independence.mjs)'] }
```

So the header's own description of today's behaviour is exactly right: an edit here **escalates** (the
`^scripts/` blast-radius rule) and is then **agent-clearable**, because `humanRequired` is false.

## What the module's header says

Read verbatim from [we:scripts/lib/review-independence.mjs](scripts/lib/review-independence.mjs) lines
54–60 on `main`:

```text
NOT YET TRUST-CHAIN REGISTERED, AND THAT IS AN OWED FOLLOW-UP, NOT A CHOICE. This module DECIDES what may
clear the gate, which is the textbook `policy` tier in `we:scripts/lib/gate-config.mjs`'s own words — an
edit here should force `review:human`, exactly as it does for the seam that calls it. It is absent from
`TRUST_CHAIN` only because #2844 landed while a concurrent change (PR #1098) held the roster, and editing
the leash classification from two lanes at once is the merge hazard the roster exists to prevent. Today an
edit here still ESCALATES (the `^scripts/` blast-radius rule) but does not force a human. Register it as
`{ role: 'clearer-identity', file: 'review-independence.mjs', tier: 'policy' }` in the next roster edit.
```

Every clause of that paragraph is now true, including "#2844 landed". Delete it as part of the registration,
because it will then be describing a state that no longer holds.

## The edit

One entry appended to `TRUST_CHAIN` in [we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs),
matching the shape of its neighbours — which carry `leash` and `homes` in addition to the three fields the
header names, so the header's snippet is abbreviated, not the full record:

```js
{
  role: 'clearer-identity',
  file: 'review-independence.mjs',
  tier: 'policy',
  leash: 'spec',     // see below — this field, not `tier`, is what forces review:human
  desc: '…decides WHO may clear the gate; an agent may not clear an edit to its own independence check…',
  homes: ['scripts/lib/review-independence.mjs'],
},
```

**`leash`, not `tier`, is the field that delivers this item.** After #2771/#2785 the policy tier is SPLIT and
`tier: 'policy'` on its own no longer forces a human: `scoreEscalation` derives
`humanRequired = leashFiles.length > 0 || statuteFiles.length > 0`, where `leashFiles` comes from
`isDeclarativeLeashPath` / `isPolicySpecPath` — i.e. from `POLICY_SPEC_BASENAMES`, which
[we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs) derives as "every policy member whose `leash`
is not exactly `'code'`". Registering this module as `tier: 'policy', leash: 'code'` would put it in the
roster, flip `isPolicyCorePath` to `true`, and leave `humanRequired` at `false` — i.e. satisfy a naive
"it's in the roster now" check while changing nothing about the hole this item names.

The sibling entries `review-runner-core` and `review-runner-cli` both carry `leash: 'spec'` under a comment
saying reclassifying them is "a separate, human-ratified call", and the roster's own guidance is explicit:
"If you cannot answer with confidence, leave it `'spec'` and file the classification as its own decision —
the fail-closed direction is human, never committee." Take `'spec'`. It is not a no-op: it is precisely the
behaviour change this item exists to make.

## Sibling card — read it first

[#2960](/backlog/2960-register-the-review-label-cli-on-the-trust-chain-s-policy-ti/) (open) is the same shape
one file over: register [we:scripts/review-set-label.mjs](scripts/review-set-label.mjs) — the other file that
decides what may clear the gate — at policy tier. It already works through the #2771 spec-vs-code question in
detail and states the option set (place the file in `POLICY_SPEC` with the leash-statement reason, or
register `tier: 'policy'` for the escalation signal only and cover the preconditions in the conformance
suite). Answer this item's `leash` with the same argument, or say why the two files land on different sides.
The two roster edits are also natural to do in one PR, since the roster is itself `leash: 'spec'` and each
edit costs a human clearance.

## An agent may BUILD this; only a human may CLEAR it

The roster file is itself policy tier AND declarative leash (`isPolicyCorePath` and `isPolicySpecPath` both
return `true` for its basename, per the run above), so this PR will carry `review:human` by construction and
only an operator clearance lands it. That is the design working, not a blocker: authoring the entry, its
`desc`, and its test is ordinary agent work, exactly as it is for the sibling #2960. Budget for the human
clearance at the end, not for a human to write the diff.

## Acceptance

- `isPolicySpecPath` returns `true` for the clearer-identity module's path, and `scoreEscalation` over a
  changed-file set containing it returns `humanRequired: true`. The assertion must be on the human-forcing
  predicate, not only on `isPolicyCorePath` — a `leash: 'code'` entry satisfies the latter without changing
  the gate.
- The "NOT YET TRUST-CHAIN REGISTERED" paragraph is removed from the module header, so the file and the
  roster stop disagreeing.
- The roster's own conformance/enum test covers the new entry, the same as every other role, including the
  invariant that every `policy` member declares a valid `leash`.
