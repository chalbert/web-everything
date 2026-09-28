---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xnfj1tp-drain-lands-a-ready-pr-after-not-before-a-larger-overlapping.md", "we:backlog/x3qhvy9-blocker-two-live-fixers-on-one-pr-reaper-backstop-clobbers-t.md"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2829's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xnfj1tp-drain-lands-a-ready-pr-after-not-before-a-larger-overlapping.md:40` — Add a deterministic planner regression test combining couple membership with overlap ranking, and require cycle detection or ordering over coupled groups before applying yields.
2. `we:backlog/xnfj1tp-drain-lands-a-ready-pr-after-not-before-a-larger-overlapping.md:1` — Require test plans to explicitly enumerate default branches (like missing configuration/cards) alongside explicit configured values.
3. `we:backlog/x3qhvy9-blocker-two-live-fixers-on-one-pr-reaper-backstop-clobbers-t.md:1` — Require test plans to explicitly verify locking behavior for commands/functions that the design promises will operate under a lock.
4. `we:backlog/x3qhvy9-blocker-two-live-fixers-on-one-pr-reaper-backstop-clobbers-t.md:1` — Require IO/projection layers that are explicitly modified to carry new fields to have their own unit tests enumerated in the test plan.
5. `we:backlog/xnfj1tp-drain-lands-a-ready-pr-after-not-before-a-larger-overlapping.md:1` — Require test plans to explicitly verify new caching layers, especially those intended to prevent API rate-limit exhaustion.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2829@37c35df4bc6cacf09fb279169ef50899b709338a

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
