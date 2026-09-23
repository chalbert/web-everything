---
kind: task
parent: "3383"
status: open
blockedBy: ["3881"]
scope: ["we:skills-src/conveyor/runner.mjs", "we:skills-src/conveyor/verify-daemon.mjs", "we:skills-src/conveyor/pass-daemon.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# extend GitHub App token auto-refresh to the remaining fleet daemons

Follow-up to #3881 (ratified #3866 Fork 1a). #3881 wired we:scripts/lib/github-app-auth-env.mjs's startGithubAppTokenAutoRefresh into the review daemon, the fix-dispatch daemon and the drain only. The remaining long-running fleet processes still draw every gh call from the operator's personal rate-limit bucket: the Dispatcher (we:skills-src/conveyor/runner.mjs), the Verify daemon (we:skills-src/conveyor/verify-daemon.mjs), and every watcher launched through we:skills-src/conveyor/pass-daemon.mjs. Each needs the same two-line wiring #3881 used (start the refresher in main(), stop it on shutdown), and its launchd config needs the three WE_GITHUB_APP_* env vars. The pass-daemon watchers are the interesting case: we:skills-src/conveyor/pass-daemon.mjs spawns each pass as a child process, so wiring the refresher once there covers every watcher it launches via env inheritance -- no per-watcher change needed. Opt-in stays unchanged: an unconfigured process keeps today's behavior.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
