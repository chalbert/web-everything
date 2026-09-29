---
bornAs: xljw7b1
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/review-prep-io.mjs", "we:scripts/operations/__tests__/review-prep-io.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2945's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/review-prep-io.mjs:370` — Runtime validation in acquireFixClaim and pushRefusal that throws if a slug is passed where a repo key is expected, or a strong type system enforcing RepoKey over RepoSlug.
2. `we:scripts/operations/review-prep-io.mjs:370` — A `check:standards` lint enforcing type-branded strings (`RepoSlug` vs `RepoKey`) or strict variable naming conventions (`repoSlug` instead of generic `repo`) to prevent cross-contamination at API boundaries.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2945@809a8e4d64585f8ccae3a1b7905bd22b1dc61bf6

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
