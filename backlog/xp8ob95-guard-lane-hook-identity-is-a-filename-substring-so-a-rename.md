---
kind: task
status: open
dateOpened: "2026-08-19"
tags: []
---

# guard-lane hook identity is a filename substring, so a rename or a mention un-installs it

`we:scripts/guard-lane-install.mjs` recognises "our" hook by testing whether the hook command CONTAINS the
guard's filename. Rename `we:scripts/guard-lane.mjs` and every installed hook becomes unrecognisable — never
replaced, never removed, and reported as absent, so the install claims a clean slate while a stale entry stays
live. The converse is as bad: an unrelated hook that merely mentions the name is silently deleted by a
re-install. Give the entry a marker of its own and match on that, keeping the substring as a legacy fallback.

The doc comment promises idempotence "by identity, not by count". That promise holds only while the filename
never changes, and nothing anywhere says it must not.

*Filed late and on purpose:* a commit message once claimed this was deferred to #2446, which is about where
plateau-loop lives — something else entirely. It was never actually filed until now.

## Why it is worth the change

The guard is a `PreToolUse` hook, so **failing to recognise it fails OPEN** — the lane isolation it enforces
simply stops applying, on every write, with nothing printed. A defect that removes a guard is not the same
class as a defect that removes a feature.

Both directions are reachable without anyone doing anything unusual:

- **Rename or move the script** — the ordinary consequence of reorganising `we:scripts/`. Every hook installed
  on every machine becomes invisible to the installer: `withGuardHook` appends a *second* entry beside the
  stale one instead of replacing it, `withoutGuardHook` leaves the stale one behind, and `guardStatus` reports
  a clean slate that is not clean.
- **Someone else's hook mentions the name** — a logger that echoes the command, a wrapper, a comment. A
  re-install deletes it. Nothing warns; it is just gone from their settings.

## Done when

1. **Executable** — a test in `we:scripts/__tests__/guard-lane-install.test.mjs` that installs the hook, renames
   the guard's path, re-installs, and asserts exactly ONE entry remains and it points at the new path. It fails
   today (two entries) and passes after.
2. A settings object carrying an unrelated hook whose command merely *mentions* the guard's filename survives a
   re-install untouched.
3. Hooks installed under the current filename-substring scheme are still recognised — the legacy fallback is
   pinned by its own test, because the whole point is that machines already carry the old shape.
