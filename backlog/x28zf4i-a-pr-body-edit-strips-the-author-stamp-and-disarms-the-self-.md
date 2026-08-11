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

It covers shell routes only, and it took **two review rounds and four bypasses** to get there. Each was
verified against the real `gh`, not reasoned about:

| bypass | why it slipped |
| --- | --- |
| the short flags | documented equivalents of `--body`/`--body-file`; the regex matched only long flags |
| the quoted long flag | quoted, so the character before the dashes is a quote, not whitespace |
| the REST field write | not `gh pr edit` at all |
| a shorthand with its value glued on | pflag makes it ONE token, and the pattern required an exact match |

Matching on `shellTokens` handles quoting; dropping the end-anchor handles gluing; two API arms handle the
layer below. The `--input` form is refused **on shape** rather than content — its payload sits in a file, so
the guard cannot see whether the body is touched. That over-denies a title-only patch, which is what the
`PR_BODY_STAMP_OK=1` escape is for.

**What no shell guard can reach:** the GitHub web UI. A body edited in a browser strips the stamp with nothing
to intercept it. That route stays open, and the mitigation is the same one that caught this — the stamp's
absence is visible to any reviewer who looks.

A fifth round found a fifth: the GraphQL endpoint has no `pulls/<n>` path to key on, so with the mutation in a
file neither the endpoint nor the mutation name appears in argv and every arm missed it. Verified against real
`gh` — it reached GitHub's resolver. Closed by keying the file-payload arm on `graphql` too.

## THE DENY-LIST IS THE WRONG SHAPE, and five rounds is enough evidence to say so

Five rounds, five spellings, and the code was never conceptually wrong — only incompletely enumerated. That is
not bad luck. A deny-list over a rich CLI grammar is exactly as good as its author's knowledge of that grammar,
and `gh` has long flags, short flags, glued values, quoted flags, two API layers, and file-fed payloads on
both. Each round closed a real hole and each round I believed it was the last.

**The guard is worth keeping** — it stops the accident that actually happened, cheaply, at the moment it
happens. But it should not be mistaken for coverage, and this item should not accumulate a sixth round.

**The route-agnostic fix is REPAIR, not refusal:** notice that a PR body has lost its stamp and put it back.
That covers every route at once — including the GitHub web UI, which no shell guard can ever reach — and it
does not depend on anyone enumerating a CLI's argument grammar correctly. Filed as the follow-up; deliberately
not bundled here, because it replaces this approach rather than extending it.

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
