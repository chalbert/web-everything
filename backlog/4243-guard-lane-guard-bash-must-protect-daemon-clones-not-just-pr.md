---
bornAs: xpt9fvd
kind: story
size: 5
parent: "4075"
status: active
scope: ["we:scripts/guard-lane.mjs", "we:scripts/guard-bash.mjs", "we:scripts/lib/daemon-clone-registry.mjs", "we:scripts/__tests__/guard-lane.test.mjs", "we:scripts/__tests__/guard-bash.test.mjs"]
dateOpened: "2026-09-26"
dateStarted: "2026-09-26"
tags: []
---

# Guard-lane/guard-bash must protect DAEMON clones, not just primary checkouts

Three times on 2026-09-26 a worker hand-edited/copied files INSIDE a resident daemon's OWN clone (wev-review-daemon canary files, a ci-heal completion edit, earlier work) — caught and reverted each time, but a dirty daemon clone BLOCKS that daemon's own rebuild (we:scripts/lib/daemon-rebuild.mjs) until a person notices. we:scripts/guard-lane.mjs (PreToolUse Edit/Write/NotebookEdit) and we:scripts/guard-bash.mjs (shell writes) already deny an edit/write targeting a constellation PRIMARY checkout outside a lane clone (#2123/#2749) — extend the SAME structure to a THIRD kind of protected checkout: a daemon's own dedicated clone (wev-review-daemon, wev-merge-daemon, wev-health-watch, the drain's clone(s) e.g. plateau-drain-daemon and .lanes/we-drain-daemon/lane-1 — note the drain clone sits UNDER .lanes/, so the ordinary lane-clone allow-shortcut must not swallow it). Deny Edit/Write/NotebookEdit and shell writes (redirects/tee/sed -i/perl -pi, cp/mv/rm, git reset/checkout/commit) targeting any daemon clone; the deny names the sanctioned route (a lane + we:scripts/daemon-overlay.mjs add --clone=<path>, or the rebuild CLI, from a lane). Keep allowed: the daemon's own writes (launchd process, never through Claude's hooks), read-only commands, the sanctioned CLIs (we:scripts/daemon-overlay.mjs, we:scripts/lib/daemon-rebuild.mjs, we:scripts/lib/daemon-load-overlay.mjs) invoked with --clone=<path> from a lane, and git fetch for diagnosis. Derive the clone list from a registry (union of a small hard-coded seed + every clone recorded in ~/.claude/daemon-overlays/*.json's clone field via we:scripts/lib/daemon-overlays.mjs), not hard-coded only, so a newly-registered daemon clone is protected automatically. Proof: we:scripts/__tests__/guard-lane.test.mjs / we:scripts/__tests__/guard-bash.test.mjs red-to-green on deny (Edit into wev-review-daemon, cp into it, git reset in it) and allow (we:scripts/daemon-overlay.mjs add --clone=... from a lane, git -C wev-review-daemon log, cat) cases, plus a live dry-run against the hook's own harness.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
