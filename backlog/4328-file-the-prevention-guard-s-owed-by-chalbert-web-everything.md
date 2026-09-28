---
bornAs: xkznzrm
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4309-github-api-budget-queue-refused-writes-and-account-spend-per.md"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2832's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4309-github-api-budget-queue-refused-writes-and-account-spend-per.md` — Add a deterministic replay concurrency test that pauses execution after ownership validation and before child creation, completes takeover, then resumes the old worker. Require this test before accepting an exactly-once implementation or revise the delivery guarantee.
2. `we:backlog/4309-github-api-budget-queue-refused-writes-and-account-spend-per.md:67` — A unit test asserting that the exact payload sent to the network on the *first attempt* of a `--body-file` write contains the op-id marker.
3. `we:backlog/4309-github-api-budget-queue-refused-writes-and-account-spend-per.md:122` — A unit test asserting that a single query with a known cost of 500 points is correctly attributed entirely to the caller without being capped.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2832@a80d259fd46b490c7ab2e1e3d001bc4f1539636e

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
