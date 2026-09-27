---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/guard-lane.mjs", "we:scripts/guard-bash.mjs", "we:scripts/__tests__/guard-lane.test.mjs", "we:scripts/__tests__/guard-bash.test.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2749's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#2749's review to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/guard-lane.mjs:251` — Add a CLI-level test that spawns the real guard-lane hook with LANE_GUARD_OFF=1 and a daemon-clone target path and asserts it still exits 2/denies — a deterministic test, cheap to add, that would have reddened immediately against the current placement.
2. `we:scripts/guard-bash.mjs:1774` — Add a chained/repeated -C case to the guard-bash fuzz/property suite (folding each -C relative to the previous one, matching git's documented semantics) so any parser/semantics drift reddens automatically, and fix gitDashCTarget to fold all -C occurrences rather than just the first.
3. `we:scripts/guard-bash.mjs:1852` — Add a regression test that pre-creates a symlink into a registered daemon clone and asserts a write through it is denied, forcing the implementation to realpath each resolved operand before the prefix comparison (mirroring how we:scripts/guard-lane.mjs already receives a pre-realpath'd real from its caller).
4. `we:scripts/guard-bash.mjs` — Add a deterministic regression matrix combining allowed Git subcommands with redirects into protected clones, and check redirection effects independently of Git classification.
5. `we:scripts/guard-bash.mjs` — Add deterministic source/destination tests for filesystem commands, including copying out, copying in, and moving out; classify mutation targets according to each command's semantics.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
