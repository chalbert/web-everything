---
kind: task
status: open
scope: ["we:scripts/conveyor/"]
relatedTo: ["3478"]
dateOpened: "2026-09-05"
tags: []
---

# we:queue-work.mjs's isRunnerProcess matches ps command-line text, not the pid's actual executable path

isRunnerProcess() in we:scripts/conveyor/queue-work.mjs (#3478 review round 3, security) substring-matches the pid's `ps` command-line text against a fixed path fragment; it never resolves the pid's actual invoked script (e.g. via a Linux /proc/<pid>/exe realpath, or an equivalent macOS check). A process whose argv merely CONTAINS that substring as an argument, cwd, or log-file name — never as the actual invoked script — currently passes identity verification and has its cwd trusted as the queue-write target. Investigate a stronger, still cross-platform-tolerant identity check.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
