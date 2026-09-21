---
bornAs: xz9npcb
kind: task
parent: "3383"
status: open
scope: ["we:scripts/push-if-green.mjs", "we:scripts/verify-lane.mjs", "we:scripts/__tests__/verify-lane.test.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# push-if-green and verify-lane treat --help as an unknown flag and run the full gate

Running `push-if-green --help` (we:scripts/push-if-green.mjs) does not print help. Its tiny argument loop ignores any flag it does not know, so it runs the full gate against the checkout (a ten-minute test:unit plus check:standards) and would push main if that came back green. we:scripts/verify-lane.mjs has the same argument loop and defaults to its verify mode, so `--help` and `-h` (a positional) start a real verification run and write a lane-verify marker. Give every script that can push or run a heavy gate an explicit --help/-h that prints usage and exits 0 with no side effects, and refuse an unknown flag with a message, as we:scripts/lane-pool.mjs already does (unrecognized flag(s)).

## FOUND (2026-09-21, by reading the source; neither script was run with the flag, because running it IS the trap)

- **push-if-green.** `we:scripts/push-if-green.mjs` (~63) collects every `--x` or `--x=y` into a `flags` map and reads only the keys it knows (`repo`, `gate`, `branch`, `remote`, `assume-green`, `dry-run`, `json`, `sha`). An unknown key is stored and never looked at, so `--help` falls through to the real run: gate, then push.
- **verify-lane.** `we:scripts/verify-lane.mjs` (~65) has the same loop, and its `MODE` defaults to `verify` unless the first positional is `check`, `reset` or `request`. `--help` sets a flag nobody reads, and `-h` is a positional that matches no mode, so both start a real verification run and its start-write of the lane-verify marker.
- **The pattern to copy.** `we:scripts/lane-pool.mjs` (~1659-1697) keeps a per-command set of known flags and refuses the rest with "unrecognized flag(s): ..." and a pointer to its `help` command.
- **Other scripts that can push or run a heavy gate** (`we:scripts/pr-land.mjs`, `we:scripts/merge-ai-prs.mjs`, `we:scripts/lane-drain.mjs`) have no `--help` handling in a text search. Whether they refuse unknown flags is NOT verified: check each, and cover any that do not in the same change or file the gap.

## Done when

1. **Executable** — a test for `push-if-green` (a new file beside `we:scripts/__tests__/verify-lane.test.mjs`, same throwaway-repo substrate) runs it with `--help` and again with `-h`, with a `--gate=` command that writes a sentinel file, and asserts exit 0, usage text on the output, the sentinel absent, and no push attempted. It fails today (the gate runs) and passes after.
2. **Executable** — the same test for `verify-lane` (added to `we:scripts/__tests__/verify-lane.test.mjs`): `--help` and `-h` exit 0 with usage text, the sentinel-writing gate never runs, and no lane-verify marker is written.
3. **Executable** — for each of the two scripts, an unknown flag (`--no-such-flag`) exits non-zero with a message naming the flag, the sentinel absent, and the same holds for a misspelt known flag (`--assume-gren`).
4. The scan of the other push-or-gate scripts is recorded in this card's Progress: each is either covered by the same tests or named as a gap with its own item.
