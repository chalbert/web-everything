---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4539-verify-lane-run-the-gate-inline-when-a-heavy-slot-is-free-in.md"]
dateOpened: "2026-10-02"
tags: []
---

# Prevention — Add a build-time guard: --inline must refuse when the existing marker is running for the same HEAD and… (from chalbert/web-everything#3471 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `(no file cited)` — Add a build-time guard: `--inline` must refuse when the existing marker is `running` for the same HEAD and not stale. Test it with an integration case that pre-seeds a running marker with a live pid.
2. `we:backlog/4539-verify-lane-run-the-gate-inline-when-a-heavy-slot-is-free-in.md:22` — Add a deterministic in-process refusal of `--inline` under the dispatch env in we:verify-lane.mjs, plus a guard-bash test table with compound-command, quoting and env-prefix rows. Both belong in this item's Test plan.
3. `we:backlog/4539-verify-lane-run-the-gate-inline-when-a-heavy-slot-is-free-in.md:39` — Record pid plus process start time (or a nonce held in the slot meta) in the marker. Have the dispatcher cross-check that the slot is held by the same owner before honouring the skip. Add a truth-table row for a live pid with a mismatched owner.
4. `we:backlog/4539-verify-lane-run-the-gate-inline-when-a-heavy-slot-is-free-in.md:28` — Add a deterministic integration test that kills the coordinator with SIGKILL while its gate remains alive, triggers reclamation and dispatch, and asserts that another gate cannot start until the surviving gate is terminated or finishes.
5. `we:backlog/4539-verify-lane-run-the-gate-inline-when-a-heavy-slot-is-free-in.md:25` — A write-gate or linter that prevents unconditional state overwrites after a branching fallback, or a test that asserts safe behavior under concurrent requests.
6. `we:backlog/4539-verify-lane-run-the-gate-inline-when-a-heavy-slot-is-free-in.md:27` — A lint rule forbidding `detached: true` for short-lived worker processes without an explicit supervisor process to reap them.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3471@3176825ff9baad1d581b26e1ae5374f15d886d7d

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
