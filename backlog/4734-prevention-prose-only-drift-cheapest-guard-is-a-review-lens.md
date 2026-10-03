---
bornAs: x6hepxj
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/3372-verify-lane-runs-the-full-suite-instead-of-the-diff-driven-s.md", "we:scripts/lib/verify-lane-gate.mjs", "we:scripts/conveyor/verify-dispatch.mjs", "we:scripts/lib/__tests__/verify-lane-gate.test.mjs", "we:scripts/conveyor/__tests__/verify-dispatch.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Prose-only drift. Cheapest guard is a review lens that compares card claims with the brief test asserti… (from chalbert/web-everything#3414 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/3372-verify-lane-runs-the-full-suite-instead-of-the-diff-driven-s.md:80` — Prose-only drift. Cheapest guard is a review lens that compares card claims with the brief test assertions. No deterministic gate is practical.
2. `we:scripts/lib/verify-lane-gate.mjs:440` — Reject any gate containing quote, backslash, `$`, `{`, `}`, `*`, `?` or `~` outside a strict path-token charset (`[A-Za-z0-9_./@=,-]`). Better, parse the gate into argv and run it with `execFile` with no shell. Add a table test in we:verify-lane-gate.test.mjs that feeds each blocked flag in quoted, escaped, `$'…'` and brace form and expects refusal. Ideally make the test property-style: for each blocked flag, any shell-equivalent spelling must be refused.
3. `we:scripts/conveyor/verify-dispatch.mjs` — Coordinate marker writers with a shared lock or equivalent conditional-update mechanism, and add a deterministic interleaving test that installs a newer request after the ownership read and verifies it survives.
4. `we:scripts/lib/verify-lane-gate.mjs` — Validate parsed shell arguments or accept structured arguments instead, with deterministic tests covering quoted, escaped, and expanded forbidden flags.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3414@097e398e8df1458a20ce412163545e288fccb4c5

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
