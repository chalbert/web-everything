---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/2772-post-hoc-review-forensics-and-take-over-for-stalled-or-faile.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add an acceptance bullet and a named test: custody POSTs reject non-JSON content types, a mismatched Or… (from chalbert/web-everything#3521 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/2772-post-hoc-review-forensics-and-take-over-for-stalled-or-faile.md` — Add an acceptance bullet and a named test: custody POSTs reject non-JSON content types, a mismatched Origin and a non-loopback Host. Longer term, a lint or standards rule that every new vite.config middleware route with a mutating method must go through a shared origin-guard helper.
2. `we:backlog/2772-post-hoc-review-forensics-and-take-over-for-stalled-or-faile.md` — Add a design bullet and a test: untracked files are listed by name only, with no content. Gitignored and known secret paths are excluded or redacted from patch bodies. Add a lane-forensics test seeding a fake secret file and asserting it is absent from the DTO.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3521@f934b9ff297206063ca63daf6d945f92fcf448ca

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
