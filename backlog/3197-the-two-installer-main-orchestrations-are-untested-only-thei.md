---
bornAs: xmg1ft3
kind: task
status: resolved
dateOpened: "2026-08-19"
dateStarted: "2026-08-19"
dateResolved: "2026-08-19"
tags: []
---

# the two installer main() orchestrations are untested — only their pure halves are

`we:scripts/bootstrap-session.mjs` and `we:scripts/converge-daemon-install.mjs` both had their decisions extracted into pure, tested functions (gitDirStatus, systemdInstallSteps). What neither has is a test of the main() that CALLS them: the order the steps run in, what is skipped under --dry-run, what exit code a drift reports. An installer is exactly the code a human runs once and trusts, so the orchestration is the part that must not be wrong. Drive each main() over injected handles and pin the sequence.

## How it was closed

Both `main()`s now take an injected io bag and are exported. A bag rather than eight parameters because the
list will grow, and a caller that must re-list every handle to add one starts passing partial bags.

`we:scripts/bootstrap-session.mjs` — `defaultIo()` carries the settings read/write, the two hook installers,
the deploy shell, the existence probe, the env and the output sink. Three orchestration invariants are pinned,
each mutation-checked separately:

- `--dry-run` PLANS and does not perform — removing the planned-branch reddens it;
- a durable host writes nothing without the explicit `install` — dropping `mayWriteUserTree` from the write
  decision reddens two;
- a drift under `--check` reaches the exit code, and does NOT outside it — returning a constant 0 reddens it.

`we:scripts/converge-daemon-install.mjs` — `systemdIo()` carries `systemctl`, the fs writes, the clone probe
and both output sinks. The probe is in the bag for the same reason as the rest: `installBlockers` shells git,
and a test of the orchestration that still spawns git is not testing the orchestration and gives a different
answer on every machine. Pinned: the three calls run in the order `systemdInstallSteps` declares (matched
against that list, so the two cannot drift), the unit files are written BEFORE any `systemctl`, an unchecked
step does not fail the install while the decisive one does, and uninstall removes the unit files even when
`disable` reports the timer was never loaded.

Nothing in either suite spawns a process or touches a settings file, so the systemd tests run on a mac as
readily as on the Linux host they describe.

## What is deliberately NOT claimed

The `if (s.decides)` guard in the systemd install loop is not pinned, and the test says so. `decides` currently
marks the LAST step, so an unconditional assignment leaves the same value behind — the guard is unobservable
from outside and removing it reddens nothing. It is defence for a step list this code does not yet have
(anything appended after `enable --now`). A test claiming to cover it would be claiming coverage it does not
have.

## Done when

1. **Executable** — a test that drives `we:scripts/bootstrap-session.mjs`'s `main()` over injected settings/write handles
   and asserts, in order: what `--dry-run` reports and does NOT write, and that a missing grant exits non-zero
   with the drift message rather than silently repairing it.
2. A test that drives `we:scripts/converge-daemon-install.mjs`'s `systemdMain()` and asserts the three `systemctl` calls
   run in the order `systemdInstallSteps` declares — reload, stop, enable — and that only the last one decides
   the exit code.
3. Neither test spawns a real process or touches a real settings file.
