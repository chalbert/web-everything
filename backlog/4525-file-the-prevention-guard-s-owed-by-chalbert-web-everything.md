---
bornAs: x1sc0zj
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/build-dispatch-hold-route-land.mjs", "we:scripts/operations/__tests__/build-dispatch-hold-route-land.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2967's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/build-dispatch-hold-route-land.mjs:118` — Add a round-trip assertion to the scope-clearing tests: parse the output frontmatter with the repo's own frontmatter parser and require `scope` to be `[]`. Better still, have `landOne` reject a card whose post-edit frontmatter fails to parse.
2. `we:scripts/operations/build-dispatch-hold-route-land.mjs` — Add a deterministic regression test that parses the transformed frontmatter for inline, wrapped, and block-list scope fixtures and asserts an empty scope with other fields preserved; update scope replacement to consume the complete YAML value.
3. `we:scripts/operations/build-dispatch-hold-route-land.mjs:146` — A deterministic lint rule or shared git wrapper that catches checking ancestry against a remote-tracking branch immediately after a default fetch that only updates FETCH_HEAD, or a rigorous E2E soak test running the router in a deliberately stale lane.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2967@bbef413af479a268701a157c5f3303903d80fa97

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
