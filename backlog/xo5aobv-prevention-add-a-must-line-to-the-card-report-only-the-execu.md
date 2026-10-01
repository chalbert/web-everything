---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xd6u5ta-a-load-cap-hold-that-lasts-over-30-minutes-raises-a-health-a.md"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a Must line to the card: report only the executable basename, pid, RSS and CPU%, never argv. The im… (from chalbert/web-everything#3360 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xd6u5ta-a-load-cap-hold-that-lasts-over-30-minutes-raises-a-health-a.md:13` — Add a Must line to the card: report only the executable basename, pid, RSS and CPU%, never argv. The implementation can then be tested with a fixture process whose args contain a sentinel secret and an assertion that the alert text omits it.
2. `we:backlog/xd6u5ta-a-load-cap-hold-that-lasts-over-30-minutes-raises-a-health-a.md:14` — A pre-commit hook or markdown linter configured to reject unresolved 'TODO's and unmodified template text (like 'Hint: ...') in newly added backlog cards.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3360@63cc14644147dbd2ab7cdac57970df7b0a99ef5a

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
