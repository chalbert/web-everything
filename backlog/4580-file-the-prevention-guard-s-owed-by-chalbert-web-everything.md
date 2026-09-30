---
bornAs: xvw0m6h
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/daemon-overlay.mjs", "we:scripts/lib/daemon-rebuild.mjs", "we:scripts/__tests__/daemon-overlay.test.mjs", "we:scripts/lib/__tests__/daemon-rebuild.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3063's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/daemon-overlay.mjs:193` — Add a test where the replacement lock at re-check time is also gone but has a different token (for example a dead-pid owner written mid-recovery). More generally, run a mutation check on every compound guard the diff describes in prose.
2. `we:scripts/lib/daemon-rebuild.mjs:2214` — Add a direct unit test of `parseMergeTreeConflictFiles` with message-only output (no stage lines) containing a path with ` in ` and a later ` in HEAD.`.
3. `we:scripts/daemon-overlay.mjs:163` — After renaming `.recover` aside, read the owner token inside `aside` and put it back if it is not the stale one, as the old code did for the main lock. Or extend the named residual in the header comment.
4. `we:scripts/daemon-overlay.mjs:232` — Add a test for owner-write failure that asserts a replacement holder's lock survives. Make the catch remove the dir only if the owner is still empty or our own token.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3063@2dee2f0cb09ee4c6fba8fedc3616aa59021aa7f0

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
