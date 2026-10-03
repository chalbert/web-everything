---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/item-activity.mjs", "we:scripts/operations/item-activity-io.mjs", "we:scripts/operations/__tests__/item-activity.test.mjs", "we:scripts/operations/__tests__/item-activity-io.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Export TERMINAL_STATES from agent-activity-io and derive live as 'not terminal'. Add a parametrised uni… (from chalbert/web-everything#3634 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/item-activity.mjs:62` — Export TERMINAL_STATES from agent-activity-io and derive live as 'not terminal'. Add a parametrised unit test over all known `claude agents` states; a check:standards rule flagging hand-written state allowlists would be heavier than needed.
2. `we:scripts/operations/item-activity-io.mjs:96` — Add a deterministic regression fixture with a readable Claude-path file matching a Codex session ID, and assert that no transcript pointer is returned without an explicit recorded path.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3634@c08f927484927ea47c310ffccb164a573d528a45

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
