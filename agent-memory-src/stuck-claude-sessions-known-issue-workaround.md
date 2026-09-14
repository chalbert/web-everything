---
name: stuck-claude-sessions-known-issue-workaround
description: Claude Code sessions can show as alive in `claude agents` with no live process, and `claude stop`/`claude rm` fail or silently no-op — this is a documented known issue (GitHub #77683), with a manual filesystem workaround.
metadata:
  type: reference
---

Claude Code has a documented known issue (GitHub issue #77683, confirmed since v2.1.210,
"Completed background-agent sessions can't be removed from the `claude agents` fleet
view"): a session can persist in listings (`claude agents --json --all`) with
`status: null` and no matching live process, and the normal cleanup commands
(`claude stop <id>`, `claude rm <id>`) either fail outright or appear to succeed without
actually removing the entry.

**Confirmed workaround:** manually move the session's job directory aside —
`<config-dir>/jobs/<session-id>/` — rather than relying on `stop`/`rm`. The daemon drops
it from listings once the directory is gone from disk.

**What is NOT covered by this known issue** (still undocumented/unconfirmed, don't
conflate): sessions dispatched through the remote/mobile "bridge" mechanism carry extra
job-record fields (`bridgeSessionId`, `bridgeOwnerAccountUuid`, `firstTerminalAt: null`)
that aren't described in any public documentation. Whether bridge-dispatched sessions
have a genuinely different (worse) cleanup failure mode than locally-dispatched ones, or
just hit the same #77683 bug, is not established — treat that distinction as an open
question, not a confirmed fact, if it comes up again.

**How to apply:**
- If `claude stop`/`claude rm` fail on a session with the generic error "the background
  service may be restarting," don't keep retrying it as if it's transient — check
  `claude daemon status` for supervisor health, then try the manual jobs-directory
  removal workaround above.
- This is a Claude Code CLI-level issue, not something fixable from within this repo's
  own mechanical dispatch code — don't spend effort trying to code around it here beyond
  what's already built (e.g. `reconcile-core.mjs`'s `liveness-unknown` handling, which
  correctly refuses to dispatch a fresh fix onto a session it can't prove dead).
