---
bornAs: x92e314
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/brief-rule-ledger.json", "we:scripts/guard-bash.mjs", "we:scripts/__tests__/guard-bash.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2897's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:skills-src/conveyor/brief-rule-ledger.json:95` — Add a deterministic check (a test, or a check:standards rule) that every `kind: hook` enforcer in the ledger is registered in `we:.claude/settings.json` or a wrapper settings constant. Alternatively, add a per-rule `coverage` field naming which dispatch kinds are covered, and mark the rule `enforced` only when all kinds are.
2. `we:scripts/guard-bash.mjs:1775` — Add table-driven negative-space cases to we:guard-bash-card-overwrite.test.mjs: a directory destination, `-t`, `dd of=`, `rsync`, `ln -sf`. Either deny them or list each in the ledger `gap`. A lint requiring every `enforced` ledger rule to carry a `gap` field is an option.
3. `we:skills-src/conveyor/brief-rule-ledger.json:1` — Add a ledger test asserting that each `kind: hook` enforcer's script path appears in we:.claude/settings.json or in DELIVERY_HOOKS_SETTINGS, or carries an explicit `registeredIn` field. File the missing we:.claude/settings.json Stop registration as its own card.
4. `we:scripts/guard-bash.mjs:1749` — A path-resolution helper that infers the full file path from the source when the destination is a directory, coupled with a regex update to allow spaces (`[^'")]*` instead of `[^\s'")]*`).
5. `we:scripts/guard-bash.mjs:1777` — A deterministic `check:standards` test for shell guards that asserts both `cp src destFile` and `cp src destDir/` are properly blocked.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2897@7d139ac6d005823f36a4da77f4c0167bd0bf9b65

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
