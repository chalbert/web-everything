---
bornAs: xaznhht
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4792-an-incomplete-check-read-prefers-the-fresher-rest-rows-over.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a backlog-card lint that rejects cards whose text matches loosening-a-refusal wording (prefer, merg… (from chalbert/web-everything#3573 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4792-an-incomplete-check-read-prefers-the-fresher-rest-rows-over.md:14` — Add a backlog-card lint that rejects cards whose text matches loosening-a-refusal wording (prefer, merge, apply ... instead of refuse) unless a refuse-on-error Must line is present. Failing that, replace the TODO Done-when placeholder with a required fail-closed test line.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3573@7c400cc66300062992a2cbdb755a54d5a5d62282

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
