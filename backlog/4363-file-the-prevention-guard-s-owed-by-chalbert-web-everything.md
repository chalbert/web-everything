---
bornAs: xx604u2
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4294-workers-run-affected-tests-while-working-the-full-gate-once.md", "we:backlog/4360-verify-daemon-runs-checks-in-parallel-up-to-the-heavy-admiss.md"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2854's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this PR's latest advisory review named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4294-workers-run-affected-tests-while-working-the-full-gate-once.md:38` — Add a check:standards rule that resolves relative markdown links and `we:` refs in backlog/*.md against the tree.
2. `we:backlog/4360-verify-daemon-runs-checks-in-parallel-up-to-the-heavy-admiss.md:112` — Doc note: when correcting a card in place, either drop the 'kept for the record' claim or keep the original text under the header.
3. `we:backlog/4294-workers-run-affected-tests-while-working-the-full-gate-once.md:36` — A standard markdown link checker running in `check:standards` or CI that validates internal repository links.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2854@b96869b3cf05537b15a8d4612d49f0811f01aa56

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
