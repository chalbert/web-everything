---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4513-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a check:standards rule or backlog-health audit that fails a prepared card whose ## Done when has no… (from chalbert/web-everything#3459 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4513-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md:59` — Add a `check:standards` rule or backlog-health audit that fails a prepared card whose `## Done when` has no numbered `**Executable**` line carrying a backtick command (or an explicit `why not` line). Cards prepared by the launcher would then be rejected before stamping.
2. `we:backlog/4513-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md` — Add a check:standards rule for prevention-debt cards: any 'Follow-ups' or 'owed' section must reference a backlog id, or the card cannot be stamped prepared. Until that exists, file one follow-up card per generalized guard before this lands.
3. `we:backlog/4513-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md` — Add a test case to the planned we:daemon-boot-smoke-prevention.test.mjs: a fixture that prints a forged ok:true frame and calls process.exit(0) at import must yield ok:false. The harness should embed a random nonce passed via argv, and the parent should accept a frame only when the exit status is 0 and the frame carries that nonce. Put this into the card's test plan now, since it is a pre-implementation spec fix.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3459@df41769951e4048a49e1dafd318ae064afd27521

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
