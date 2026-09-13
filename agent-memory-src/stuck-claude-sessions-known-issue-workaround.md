---
name: stuck-claude-sessions-known-issue-workaround
description: Claude Code sessions can show as alive in `claude agents` with no live process, and `claude stop`/`claude rm` fail or silently no-op — a documented known issue (GitHub #77683). The `clear-stuck-session` operation (#3383) mechanizes the fix; a manual filesystem move is the fallback only if that operation itself is unavailable or fails.
metadata:
  type: reference
---

Claude Code has a documented known issue (GitHub issue #77683, confirmed since v2.1.210,
"Completed background-agent sessions can't be removed from the `claude agents` fleet
view"): a session can persist in listings (`claude agents --json --all`) with
`status: null` and no matching live process, and the normal cleanup commands
(`claude stop <id>`, `claude rm <id>`) either fail outright or appear to succeed without
actually removing the entry.

**Preferred fix: the `clear-stuck-session` operation** (#3383, commit `81d5c9745` —
`scripts/operations/clear-stuck-session.mjs` / `clear-stuck-session-io.mjs`). It replays
`reconcile-core.mjs`'s own `assessLiveness` verdict (the SAME liveness rule the reconcile pass uses,
never a second liveness check), requires a real human `confirm` before touching anything outside this
repo's own tree, and quarantines the job directory rather than deleting it:

```bash
node scripts/operations/run.mjs clear-stuck-session --session=<id>
# or, to resolve whichever session is bound to a PR:
node scripts/operations/run.mjs clear-stuck-session --pr=<n>
```

It refuses to move anything unless the session is CONFIRMED stuck — listed, last-reported job state
`"blocked"`, `assessLiveness` reports nothing live, and no run record still holds an in-flight effect
on it — see that file's own header for the full verdict logic.

**Fallback, only if the operation itself is unavailable or fails:** manually move the session's job
directory aside — `<config-dir>/jobs/<session-id>/` — rather than relying on `stop`/`rm`. The daemon
drops it from listings once the directory is gone from disk. This is the same move the operation
performs (into `<config-dir>/jobs/.cleared/<id>-<timestamp>/`, recoverable, never a delete) — reach for
it by hand only when `clear-stuck-session` itself can't run.

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
  `claude daemon status` for supervisor health, then run `clear-stuck-session` (above),
  falling back to the manual jobs-directory move only if that operation is unavailable.
- This is a Claude Code CLI-level issue, not something fixable from within this repo's
  own mechanical dispatch code — don't spend effort trying to code around it here beyond
  what's already built (`clear-stuck-session`'s reuse of `reconcile-core.mjs`'s
  `liveness-unknown` handling, which correctly refuses to dispatch a fresh fix onto a
  session it can't prove dead).
