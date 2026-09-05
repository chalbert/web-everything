---
kind: task
status: open
scope: ["we:scripts/conveyor/"]
relatedTo: ["3478"]
dateOpened: "2026-09-05"
tags: []
---

# we:queue-work.mjs's pid-identity + cwd + checkout-marker checks have a TOCTOU gap between the three syscalls

isRunnerProcess(pid), cwdForPid(pid) and looksLikeCheckout(cwd) in we:scripts/conveyor/queue-work.mjs (#3478 review round 3, correctness) run as three separate syscalls with a time gap between them. If the runner process exits and the OS reuses its pid for an unrelated process inside that window, the tool can pass identity verification against the (now-dead) runner but resolve cwd/checkout-marker against the new process, silently narrowing rather than eliminating the class of failure #3478 closes. Investigate whether a single atomic read (e.g. resolving cwd+cmdline together from one /proc snapshot on Linux, or accepting the residual risk as documented/bounded on macOS) is worth the complexity.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
