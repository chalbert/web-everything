---
kind: story
size: 1
status: resolved
dateOpened: "2026-08-12"
dateStarted: "2026-08-12"
dateResolved: "2026-08-12"
tags: [gate, guard, lane, footgun]
scope:
  - we:scripts/guard-lane.mjs
  - we:scripts/__tests__/guard-lane.test.mjs
---

# guard-lane protects only the checkout it is launched from, so a lane cwd leaves the primaries open

The lane-isolation hook derived the workspace root with `dirname(weRoot)`, where `weRoot` is **the guard's own
location**. The hook is configured to run [we:scripts/guard-lane.mjs](../scripts/guard-lane.mjs) resolved
against the current directory — so a session whose cwd is a lane runs the lane's copy, and the guard protects
the lane instead of the shared tree. An edit to a primary checkout was allowed with no deny.

## Demonstrated, not theorised

2026-08-11, cwd in `lane-3`: a `Write` to a file in the `webeverything` primary checkout went straight through.
The edit was reverted by hand within a minute, but nothing in the system stopped it or recorded it.

The mechanism is arithmetic once you see it. With `weRoot` = `<workspace>/.lanes/web-everything/lane-3`,
`dirname` gives `<workspace>/.lanes/web-everything`, so the primary list becomes
`<workspace>/.lanes/web-everything/webeverything/` and its siblings — paths that do not exist. Nothing matches,
`inPrimary` is false, and the edit is allowed.

**The guard protected exactly the one tree that never needed protecting**, and only when launched from a lane
— which is where every edit-action is supposed to run. The hook was at its least effective in precisely the
situation it was written for.

## The fix

`workspaceRootOf` splits on the `.lanes` path segment rather than taking the parent, so the true workspace root
is recovered wherever the script runs from. A lane always lives at `<workspace>/.lanes/<pool>/lane-N`, so the
segment is a reliable anchor.

Verified from three launch points — the primary, a WE lane, a plateau lane — all now deny an edit to a primary,
and a genuine lane edit is still allowed from either.

## Worth noting about the failure shape

This is the same family as the other gate holes found this week: a guard that reads as enforced and is not.
`#x28zf4i`'s deny-list enumerated five spellings and missed a sixth; the self-clear refusal tolerated a missing
stamp it could not distinguish from an old PR. Here the guard was correct in its logic and wrong about **where
it was standing**.

A guard that derives its own scope from its own location is only as correct as the assumption about where it
runs — and hooks are resolved against the caller's directory, which the guard does not control.

## Done when

- [x] A primary-tree edit is denied whatever directory the hook is launched from.
- [x] A lane edit is still allowed, from either launch point.
- [x] The launch-location cases are pinned by test, including a nested lane path.
