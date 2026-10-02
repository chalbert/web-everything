---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/xyb2jwr-close-watch-hand-holding-mode-keep-all-or-chosen-sessions-un.md", "we:backlog/xw539ty-delivery-postmortem-toggle-turn-on-a-root-cause-postmortem-f.md"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Add a card-template or check:standards rule requiring a 'Must treat X as untrusted / bounded authority'… (from chalbert/web-everything#3358 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/xyb2jwr-close-watch-hand-holding-mode-keep-all-or-chosen-sessions-un.md:13` — Add a card-template or check:standards rule requiring a 'Must treat X as untrusted / bounded authority' line on epics that introduce an automated actor acting on untrusted input; at minimum, add that line to this epic's Done-when when it is decomposed.
2. `we:backlog/xw539ty-delivery-postmortem-toggle-turn-on-a-root-cause-postmortem-f.md:16` — A template linter or check that flags known boilerplate hints (like the "loosens a refusal" hint) when they are left unmodified in newly filed backlog items, or requires deleting unused template sections.
3. `we:backlog/xyb2jwr-close-watch-hand-holding-mode-keep-all-or-chosen-sessions-un.md:16` — A template linter or check that flags known boilerplate hints (like the "loosens a refusal" hint) when they are left unmodified in newly filed backlog items, or requires deleting unused template sections.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3358@a4418622ee8c455bcd4fa2074cbae0dddcc434cb

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
