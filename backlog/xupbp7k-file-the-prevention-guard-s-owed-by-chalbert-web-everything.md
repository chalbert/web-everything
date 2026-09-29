---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/daemon-boot-smoke.mjs", "we:scripts/lib/daemon-boot-watchdog.mjs", "we:scripts/lib/__tests__/daemon-boot-smoke.test.mjs", "we:scripts/lib/__tests__/daemon-boot-watchdog.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2965's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/daemon-boot-smoke.mjs:95` — Resolve against the actual `file://<root>/` and assert the result stays under that root, plus a unit case for marker-name traversal. Better, add a shared `isContainedRelative(root, rel)` helper with property-style tests, and a lint or standards rule flagging hand-rolled `startsWith` path containment.
2. `we:scripts/lib/daemon-boot-smoke.mjs:178` — Gate the override behind an explicit test-only signal (e.g. an injected `entries` param rather than env), or make an active override return `ok:false` unless a second test-only env var is set. Add a lint rule against env-driven gate-narrowing knobs in `scripts/lib` gates.
3. `we:scripts/lib/daemon-boot-smoke.mjs` — A linter rule banning `'file://' +` string concatenations in favor of `url.pathToFileURL()` to ensure safe file URL construction.
4. `we:scripts/lib/daemon-boot-smoke.mjs` — A standard that sub-process harnesses communicate results via IPC, temporary files, or distinctly prefixed lines, rather than assuming pristine stdout.
5. `we:scripts/lib/daemon-boot-smoke.mjs` — A deterministic test for all `runChild` harness scripts that validates they exit cleanly even when the evaluated code leaves an open handle.
6. `we:scripts/lib/daemon-boot-watchdog.mjs` — An eslint rule requiring an `'error'` listener on any `child_process.spawn` result.
7. `we:scripts/lib/daemon-boot-watchdog.mjs:93` — A concurrency soak test that spawns multiple failing watchdogs in parallel against the same state directory to verify the guard trips, or scoping the state file by entry name (e.g. including `encodeURIComponent(entry)` in `bootStatePath`).

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2965@5e30dce287c23b814ee16eb2f830e46efd64eebe

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
