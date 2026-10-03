---
bornAs: xbov34j
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4315-a-confirmed-broken-impact-advisory-finding-must-not-be-ignor.md"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — A check:standards rule flagging 'no preparation stamp' text when preparedAgainstSha is present (doc not… (from chalbert/web-everything#3259 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4315-a-confirmed-broken-impact-advisory-finding-must-not-be-ignor.md:23` — A check:standards rule flagging 'no preparation stamp' text when preparedAgainstSha is present (doc note at most; low value).
2. `we:backlog/4315-a-confirmed-broken-impact-advisory-finding-must-not-be-ignor.md:38` — Add a bullet to the card's design/test plan requiring ruling comments to be accepted only when posted by the configured reviewer-bot login, with a named test for a non-bot author. Implementation could add a shared 'trusted comment author' helper that review-set-label and review-pr-io both use.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3259@98a7e15d3ff161988d91ee225a773ff0dc1418d0

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
