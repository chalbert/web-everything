---
kind: story
size: 2
status: resolved
dateOpened: "2026-08-11"
dateStarted: "2026-08-11"
dateResolved: "2026-08-11"
tags: [gate, review, independence, guard, footgun]
scope:
  - we:scripts/guard-bash.mjs
  - we:scripts/pr-body-edit.mjs
  - we:scripts/__tests__/pr-body-edit.test.mjs
---

# A PR body edit strips the author stamp and disarms the self-clear guard

`pr-land` stamps `authored-by-actor` into a PR body at open, and the self-clear refusal reads it from there. A
raw `gh pr edit --body` replaces the whole body and drops the stamp, after which the guard reads
`unknown-author` — a state the invoked CLI deliberately permits. PR #1162 landed on its own author's clearance
for exactly this reason. This denies the raw command and adds a wrapper that carries the stamp across.

## What happened

Three PRs from one session, one difference:

| PR | stamp | outcome |
| --- | --- | --- |
| #1160 | present | self-clear **refused** — the guard worked |
| #1163 | present | would refuse |
| #1162 | **absent** | guard inert → clear accepted → **merged** |

#1162 is the only one whose body was rewritten. Three `gh pr edit --body-file` calls published review
corrections, and each replaced the body wholesale. The PR whose description was revised most carefully for
honesty is the one that landed unguarded.

## Why not simply refuse on a missing stamp

That was the first instinct and it is wrong. The invoked CLI's tolerance of `unknown-author` is a **ratified
choice** with its reason recorded in
[we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs): refusing there would strand
every PR opened before the stamp existed, with no human able to clear it.

The tolerance is right for an **old** PR and wrong for a **stripped** one, and after the fact nothing can tell
those apart — the body simply has no stamp either way. So the fix keeps the two distinguishable rather than
weakening the rule that depends on them being distinguishable.

## What landed

- [we:scripts/guard-bash.mjs](../scripts/guard-bash.mjs) denies `gh pr edit … --body` / `--body-file`, with a
  `PR_BODY_STAMP_OK=1` escape mirroring the `MAIN_PUSH_OK=1` one already in that file.
- [we:scripts/pr-body-edit.mjs](../scripts/pr-body-edit.mjs) reads the current body, carries every stamp the
  replacement lacks, and writes through the escape.

Nothing in the repo is affected: every `gh pr edit` under `we:scripts/` is `--add-label` or `--remove-label`.
Body rewriting was only ever an ad-hoc operator action.

**It carries every distinct stamp, not one.** A two-stamp body resolves to `''` by design
(agreement-or-nothing), so dropping one would turn an unresolvable body into a confident single-author one —
a refusal silently becoming a permit, the same defect class this closes. Pinned by test.

## The deny is PARTIAL, and the boundary is worth stating

It covers the shell routes only, and the first cut covered fewer than it claimed. Review found three bypasses:
`gh` documents `-b`/`-F` as exact equivalents of `--body`/`--body-file` and neither matched; a quoted
`"--body-file"` has a quote before the dashes rather than whitespace; and `gh api -X PATCH …/pulls/<n> -f
body=…` is not `gh pr edit` at all. Matching on `shellTokens` rather than the raw string collapses the first
two, and a second arm covers `gh api`.

**What no shell guard can reach:** the GitHub web UI. A body edited in a browser strips the stamp with nothing
to intercept it. That route stays open, and the mitigation is the same one that caught this — the stamp's
absence is visible to any reviewer who looks.

## What this does not fix

The cause of #1162's bad clearance was not only the stripped stamp — it was that the reviewer was spawned with
the subagent tool, which **inherits the parent's session id**, so no reviewer that session was a distinct
actor. The guard would have caught it on any stamped PR, and did on #1160. Spawning reviewers through a path
that mints a real actor id (`deriveSessionId` in
[we:scripts/lib/judge-spawn.mjs](../scripts/lib/judge-spawn.mjs) already does this) is the other half, and it
is a working-practice change rather than a code one.

## Done when

- [x] A raw body rewrite is denied, with a sanctioned escape.
- [x] The wrapper carries a dropped stamp back, and an ambiguous body stays ambiguous.
- [x] A label edit is unaffected.
