---
bornAs: xwh81wh
kind: story
size: 1
status: open
dateOpened: "2026-08-06"
relatedTo: ["2326", "2433", "2644", "2882"]
scope:
  - we:scripts/review-set-label.mjs
  - we:scripts/lib/review-core.mjs
  - we:skills-src/review/SKILL.md
tags: [review, skill, ergonomics]
---

# The /review skill's documented call sequence fails twice on first use (body-file path guard, notice outcome vocabulary)

Two papercuts in the `/review` skill's own documented steps, both hit on the first invocation during the
human review of **WE PR #1063** (2026-08-06). Neither is dangerous and both have workarounds, but each costs
a round-trip on a path that is supposed to be mechanical, and one of them pushes the agent toward a *worse*
practice than the guard it trips.

## 1. `--body-file` refuses the agent scratchpad, pushing findings into the tracked tree

`we:scripts/review-set-label.mjs` constrains `--body-file` to `[cwd, os.tmpdir()]` — correctly, since the
file is published to a public PR and cannot be unpublished. But on macOS `os.tmpdir()` is `/var/folders/…`,
while the Claude Code session scratchpad is `/private/tmp/claude-501/<project>/<session>/scratchpad`. So the
sanctioned agent temp directory is refused:

```
{"error":"--body-file must live under the repo root or the temp dir
 (got /private/tmp/claude-501/…/scratchpad/pr1063-findings.md)
 — its contents are published to a public PR"}
```

The only workaround is to copy the findings **into the repo root** and delete it afterwards — dropping an
untracked file into the tracked tree, which is exactly the kind of stray the guard's spirit is trying to
avoid. A forgotten `rm` leaves a findings file staged into someone's next tight-pathspec commit.

Options (pick one — this is the judgment half): widen the allowlist to a scratchpad root passed by an env
var the harness already sets; accept any path under `/private/tmp` **and** `/tmp` in addition to
`os.tmpdir()` (both are OS temp roots on darwin, so this does not weaken the leak guard); or — cheapest —
leave the guard alone and document the repo-root-then-delete workaround in the skill so nobody rediscovers it.

## 2. `renderReviewNotice` says `accept`, the CLI says `accepted`

The skill's step 4 uses `--to=accepted`; its step 6 uses `renderReviewNotice({ outcome })`, which rejects
that same word:

```
Error: renderReviewNotice: unknown outcome "accepted" — must be one of accept, changes
```

So the documented sequence throws when the operator carries the obvious value through. Fix: accept both
spellings in `renderReviewNotice`, or single-source the verdict vocabulary between
`we:scripts/lib/review-core.mjs` and `we:scripts/review-set-label.mjs` (the label side already uses
`accepted`/`changes`, so normalising toward the CLI's words is the smaller change).

## Why one item, not two

Same seam, same discovery, same fix session: the `/review` skill's documented call sequence does not run
clean end-to-end. Split only if (1) turns into a real allowlist design discussion.
