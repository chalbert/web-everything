---
bornAs: xmg1ft3
kind: task
status: open
dateOpened: "2026-08-19"
tags: []
---

# the two installer main() orchestrations are untested — only their pure halves are

`we:scripts/bootstrap-session.mjs` and `we:scripts/converge-daemon-install.mjs` both had their decisions extracted into pure, tested functions (gitDirStatus, systemdInstallSteps). What neither has is a test of the main() that CALLS them: the order the steps run in, what is skipped under --dry-run, what exit code a drift reports. An installer is exactly the code a human runs once and trusts, so the orchestration is the part that must not be wrong. Drive each main() over injected handles and pin the sequence.

## Done when

1. **Executable** — a test that drives `we:scripts/bootstrap-session.mjs`'s `main()` over injected settings/write handles
   and asserts, in order: what `--dry-run` reports and does NOT write, and that a missing grant exits non-zero
   with the drift message rather than silently repairing it.
2. A test that drives `we:scripts/converge-daemon-install.mjs`'s `systemdMain()` and asserts the three `systemctl` calls
   run in the order `systemdInstallSteps` declares — reload, stop, enable — and that only the last one decides
   the exit code.
3. Neither test spawns a real process or touches a real settings file.
