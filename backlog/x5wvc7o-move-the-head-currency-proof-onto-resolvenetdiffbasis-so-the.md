---
kind: story
size: 3
status: open
dateOpened: "2026-08-05"
tags: []
---

# Move the head-currency proof onto resolveNetDiffBasis so the SCORER shares it

PR #1039 review finding 5. we:scripts/fetch-parked.mjs now proves the head ref is CURRENT before claiming a net basis, but the proof is homed in that one consumer. we:scripts/merge-ai-prs.mjs's resolveNetDiffBasis still swallows its fetch error and falls through to whatever tracking ref is cached, so the drain's escalation SCORE, its anti-test-gaming scan, and pr-land's scorer all keep the unproven path. Consequence: one pass can auto-land against a stale tree while refusing to label that same tree 'net' for the reviewer — which makes the module's 'one shared basis, no second place to drift' contract false in the direction that matters. Fix: an optional expectOid on resolveNetDiffBasis that verifies the resolved candidate IS the expected object id, with fetch-parked passing it through and the drain opting in. Deliberately NOT bundled into PR #1039: that PR is the reviewer-facing basis, and this changes the SCORING path — different blast radius, different reviewers, and #1039 is a carve-out from a PR that bounced four rounds by growing each time it was repaired.
