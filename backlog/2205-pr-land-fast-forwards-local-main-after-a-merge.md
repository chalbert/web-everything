---
kind: story
size: 2
parent: "2193"
status: resolved
dateOpened: "2026-07-03"
dateResolved: "2026-07-03"
tags: [lane, pr-flow, session-tooling, git]
---

# `pr-land` fast-forwards local `main` after a merge (parity with the drain)

`we:scripts/merge-ai-prs.mjs` fast-forwards local `main` to the just-advanced `origin/main` after it merges
(`git pull --ff-only --autostash`, best-effort), so the checkout it ran in never falls behind. But
`we:scripts/pr-land.mjs` — the `/pr` and per-item land path — **merges and then stops**: it runs the post-land
id-collision heal + derived regen, but never syncs local `main`. So every `/pr` land leaves the checkout it ran
in one merge behind `origin/main`, compounding the drift #2204 guards reads against.

**Fix:** after a successful `gh pr merge` (the default land path — not `--dry-run`, `--no-wait`, or
`--label-on-green`, which never merge here), run the SAME `git pull --ff-only --autostash` sync that
`we:scripts/merge-ai-prs.mjs` already uses, best-effort and reported (a diverged/conflicting reapply degrades
to a note, never fails the land — the merge already succeeded). Mirror its exact wording and error handling so
the two land routes behave identically. Small; add a source-level test that the sync call exists after the
merge and is best-effort. Relates to #2204 (the read-side guard) and the `keep-local-main-current-after-merge`
memory.
