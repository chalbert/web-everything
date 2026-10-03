---
bornAs: x9t0jzp
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4815-a-not-real-ruling-on-a-tool-less-juror-finding-ends-the-revi.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a check:standards rule that rejects open backlog cards whose Done-when section still contains "TODO… (from chalbert/web-everything#3473 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4815-a-not-real-ruling-on-a-tool-less-juror-finding-ends-the-revi.md:16` — Add a check:standards rule that rejects open backlog cards whose Done-when section still contains "TODO:" or the template Hint line. Add a second rule that requires an Executable line before a card moves out of the draft state.
2. `we:backlog/4815-a-not-real-ruling-on-a-tool-less-juror-finding-ends-the-revi.md:13` — Add a backlog-lint rule (check:standards) that rejects an open card whose Done-when still contains the literal "TODO" placeholder. Make it also require two Must lines (error refuses, non-code inputs treated cautiously) when the card text contains loosening language such as "closes", "cannot carry" or "never re-dispatched".

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3473@2b8b18a13219d66b4973b9a10b02ac5b4007e747

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
