---
bornAs: xgvexd5
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/3811-harden-the-plateau-app-deploy-gate-against-brute-force-befor.md"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add an acceptance line requiring a minimum GATE_CODE entropy, for example 128 bits random, plus a cumul… (from chalbert/web-everything#3380 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/3811-harden-the-plateau-app-deploy-gate-against-brute-force-befor.md:41` — Add an acceptance line requiring a minimum GATE_CODE entropy, for example 128 bits random, plus a cumulative or escalating per-IP lockout, and a deploy-time check that rejects a short code.
2. `we:backlog/3811-harden-the-plateau-app-deploy-gate-against-brute-force-befor.md:43` — Add acceptance lines: the revoke route goes through the same limiter, bearer and HMAC comparison is constant-time, the signature is checked before any Durable Object call, and the test plan has a case for each. A review lens on new authenticated endpoints would catch the class.
3. `we:backlog/3811-harden-the-plateau-app-deploy-gate-against-brute-force-befor.md:6` — Have the card-split step file the sibling card, and add a check:standards rule that a scope entry removed from a card must appear in an existing card's scope.
4. `we:backlog/3811-harden-the-plateau-app-deploy-gate-against-brute-force-befor.md:25` — A review standard requiring every negative behavioral constraint ('must not') in a spec to map to an explicit negative assertion in the test plan.
5. `we:backlog/3811-harden-the-plateau-app-deploy-gate-against-brute-force-befor.md:25` — A review standard requiring every negative behavioral constraint ('must not') in a spec to map to an explicit negative assertion in the test plan.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3380@e3bc6f34aeca21c38fdeec071c31061d1fec70e7

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
