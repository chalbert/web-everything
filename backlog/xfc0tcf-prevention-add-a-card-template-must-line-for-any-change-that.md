---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xxh4zw8-a-cancelled-required-check-still-strands-a-pr-in-awaiting-ci.md"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a card-template Must line for any change that tightens a verdict on an externally sourced set. It s… (from chalbert/web-everything#3424 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xxh4zw8-a-cancelled-required-check-still-strands-a-pr-in-awaiting-ci.md:28` — Add a card-template Must line for any change that tightens a verdict on an externally sourced set. It should require one test per provenance value (`live`/`cache`/`stale-cache`/`fallback`). A lens check that greps for `source:` handling would also catch it.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3424@641b380b6bbe21000b084ea18581cf9f60ca3b17

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
