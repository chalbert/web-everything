---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/fix-agent-brief.md", "we:scripts/operations/__tests__/dispatch-lane.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3144's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/fix-agent-brief.md:342` — Add a brief-lint assertion that any `running` retry instruction names a numeric cap and a stand-down outcome. Separately, add a live-run proof (throwaway lane, then a sibling lane) before landing async-gate brief changes.
2. `we:scripts/operations/__tests__/dispatch-lane.test.mjs:2814` — Add an integration test or a live-lane proof step covering a `request`, commit, then finish-guard sequence on a fix lane. Loosen the whitespace-exact negative assertions to a regex such as `/verify-lane\.mjs run\b/` within step 4.
3. `we:skills-src/conveyor/fix-agent-brief.md:336` — Add a deterministic integration test that requests verification from a sibling-repo lane, exercises runner discovery, and asserts that check settles with that repo’s gate verdict; require it in the test gate.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3144@943b15503c87acc0ec3b7589e055f6d1d4b1cc87

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
