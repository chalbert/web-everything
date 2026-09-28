---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/daemon-overlay.mjs", "we:scripts/lib/__tests__/daemon-rebuild.test.mjs", "we:scripts/lib/daemon-rebuild.mjs", "we:scripts/__tests__/daemon-overlay.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2827's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/daemon-overlay.mjs` — Add a deterministic stale-recovery concurrency test that pauses between ownership inspection, rename, and restoration, and asserts exclusive entry with three contenders; use a locking protocol that preserves exclusivity during recovery.
2. `we:scripts/lib/__tests__/daemon-rebuild.test.mjs` — Extend the named test with staged and unstaged sentinel changes and compare index bytes and working-tree contents before and after the preview; require it in the targeted test gate.
3. `we:scripts/lib/daemon-rebuild.mjs:2211` — A unit test in `we:scripts/lib/__tests__/daemon-rebuild.test.mjs` exercising `previewOverlayConflict` against a rename/delete conflict to verify the exact parsed file names.
4. `we:scripts/lib/daemon-rebuild.mjs:2307` — A unit test where `main` advances with a file modification AFTER an existing overlay branches, and a candidate overlay conflicts with `main` on that file.
5. `we:scripts/daemon-overlay.mjs:155` — A concurrency test for `withAddGuardLock` specifically targeting the PID write window, or using filesystem timestamps (`birthtimeMs`) instead of file contents to verify lock identity.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2827@f2b81fc50e0fdcf38411f5612c5658431f0af069

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
