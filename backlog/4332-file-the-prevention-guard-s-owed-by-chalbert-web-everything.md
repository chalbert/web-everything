---
bornAs: xokyo8z
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4311-lane-concurrency-ceiling-counts-stale-unreleased-leases-as-a.md"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2833's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4311-lane-concurrency-ceiling-counts-stale-unreleased-leases-as-a.md` — Require an executable resolver regression with an active, clean holder beyond the quiet window, and gate early reclamation on holder-liveness or renewable ownership evidence rather than acquisition age alone.
2. `we:backlog/4311-lane-concurrency-ceiling-counts-stale-unreleased-leases-as-a.md:386` — Separate capability tests that must fail on the base from preservation tests that must pass on both versions; validate preservation tests against targeted unsafe mutations when implementing the story.
3. `we:backlog/4311-lane-concurrency-ceiling-counts-stale-unreleased-leases-as-a.md:169` — A design-review gate requiring that every logical condition (e.g., handling the 'closed' PR state) explicitly written into a design snippet has a corresponding and complete test case defined in the Test Plan.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2833@5eea927705613f8858e443003b3d6e7d9ee44e4f

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
